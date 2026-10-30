import { getAgent } from "./hub";
import { keysOfDocument, marksFrom, problemMarks, queueOf } from "./specRun";

// THE PROOFS BUS — one owner of a proofs run, whoever started it.
//
// WHY A MODULE AND NOT AN EVENT PAIR. The run is started from two places that cannot see each
// other: the Proofs tab in the side panel, and the arc document's diagram in the middle. The obvious
// wiring is a window event out and another back — and it is wrong for one reason: THE PANEL MAY NOT
// BE MOUNTED. Run from the diagram with the panel closed and nothing would answer, so the node
// would spin until a timeout and the result would exist nowhere. His words are the requirement:
// "you can go back and open it if you want and see if anything goes wrong, FROM WHEREVER YOU RAN
// IT."
//
// So the run lives here. The diagram calls `run()`; the panel subscribes and renders whatever the
// last run was, including one that finished before it opened. Neither has to be on screen for the
// other to work.
//
// IT HOLDS ONE RUN, not a history. The durable record of a run is the hub's handle (`CLI.getRun`)
// and the documents themselves; this is the window's view of the one in front of you, and it dies
// with the page like every other gesture.

// `marks` is the per-spec half, keyed by `utils/specRun`'s one address. The booleans above say
// whether A RUN is happening; this says what each SPEC is doing, which is the thing a reader
// actually watches. Anything that runs a spec writes here — the hub-driven run below, and the
// panel's own card runner through `mark()` — so whatever started it, every surface showing that
// spec moves at the same moment off the same value.
let state = { scope: null, listed: null, ran: null, running: false, at: 0, marks: {} };
const subs = new Set();

const emit = () => {
  // A COPY PER NOTIFY, so a subscriber cannot hold a reference that mutates under it and then
  // compare it against itself and decide nothing changed.
  const snap = { ...state };
  subs.forEach((fn) => {
    try {
      fn(snap);
    } catch {
      /* a broken subscriber must not stop the others from hearing */
    }
  });
};

export const last = () => ({ ...state });

export function subscribe(fn) {
  if (typeof fn !== "function") return () => {};
  subs.add(fn);
  // FIRES IMMEDIATELY with what already happened — that is the whole point: a panel mounting after
  // a diagram-started run must show it, not an empty tab.
  try {
    fn({ ...state });
  } catch {}
  return () => subs.delete(fn);
}

/** The three menu targets, as the hub's three scopes. One vocabulary, translated in one place. */
export function scopeOf(target) {
  const t = target || {};
  if (t.kind === "objective") return { objective: t.id };
  if (t.kind === "plan" || t.kind === "rfc" || t.kind === "document") return { document: t.id };
  if (t.kind === "arc") return { arc: t.id };
  return {};
}

// A run in flight is not cancelled by a second one; the later answer wins and the earlier is
// dropped, so a slow first run cannot overwrite a fast second.
let seq = 0;

/**
 * ONE SPEC CHANGED STATE. The door anything that runs a spec writes through — the loop below, and
 * the proofs panel's own card runner, which executes window-side and until now told nobody.
 *
 * Takes a map so a whole document's worth lands in one notify rather than one re-render per spec.
 */
export function mark(patch) {
  if (!patch || !Object.keys(patch).length) return;
  state = { ...state, marks: { ...state.marks, ...patch } };
  emit();
}

const fill = (keys, status) => Object.fromEntries(keys.map((k) => [k, status]));

// TWO ANSWERS, ADDED UP. Running document by document means the hub replies once per document, and
// a surface showing "4 ran — 4 passed" after the fourth of seven would be telling the truth about
// the step and lying about the run. So the rows, the counts and the problems accumulate.
const foldRan = (acc, part) => ({
  ...(acc || {}),
  ...(part || {}),
  tests: [...((acc && acc.tests) || []), ...((part && part.tests) || [])],
  problems: [...((acc && acc.problems) || []), ...((part && part.problems) || [])],
  passed: ((acc && acc.passed) || 0) + ((part && part.passed) || 0),
  failed: ((acc && acc.failed) || 0) + ((part && part.failed) || 0),
  // A refusal on one document must not be stamped over a run of six that worked.
  error: (acc && acc.error) || (part && part.tests && part.tests.length ? "" : part && part.error) || "",
});

/**
 * Collect and run, and tell everyone listening. Resolves with the hub's answer — so a caller that
 * wants to wait on it (a node's running state) can.
 *
 * IT RUNS A DOCUMENT AT A TIME, in the listing's own order, and that is the whole difference
 * between a run you can watch and a run you can only wait for. `api/runTests.js` `executeSpecs`
 * awaits every spec and returns when all of them are done — the hub streams nothing and there is
 * no socket here to stream over. But the hub's `document` scope already exists, and the listing
 * already says which documents are in scope, so the window can ask for them one by one: before
 * each, its specs go `running`; after it answers, they settle pass or fail. The marks fill in
 * left to right, which is what "watch it run" means with a request/response hub.
 *
 * NOT A SECOND RUNNER. Every one of these calls is the same `Agent.runProofs` door with a scope it
 * already supports; `api/proofs.js` collects and `api/runTests.js` executes, exactly as before. The
 * only thing that changed is how many times the window asks, and therefore how often it can say so.
 */
export async function run(projectCode, scope = {}) {
  const Agent = getAgent();
  const mine = ++seq;
  if (!Agent || typeof Agent.runProofs !== "function") {
    // ABSENCE STATED. A hub older than this feature has no door, and a surface that spins and then
    // quietly shows nothing is worse than one that says what is missing.
    state = { scope, listed: null, ran: { error: "this hub has no proofs door yet — restart it" }, running: false, at: Date.now(), marks: {} };
    emit();
    return state.ran;
  }
  // THE MARKS ARE CLEARED BY THE RUN THAT REPLACES THEM, not left to decay. A second run showing
  // the first run's greens beside its own queued specs is a surface telling two stories at once.
  state = { ...state, scope, running: true, at: Date.now(), marks: {} };
  emit();

  // THE LISTING FIRST, so what a surface says is in scope matches what is about to run. A document
  // edited since the last look would otherwise run specs the list never showed — and it is also
  // what the loop below walks, so the order you watch is the order the list showed you.
  let listed = null;
  try {
    listed = await Agent.listProofs({ projectCode, withSource: true, ...scope });
    if (mine === seq) {
      state = { ...state, listed: listed || null, scope: (listed && listed.scope) || scope, marks: queueOf(listed) };
      emit();
    }
  } catch {
    /* the run below is the answer that matters; a failed listing is not worth refusing it over */
  }

  const docs = ((listed && listed.documents) || []).filter((d) => (d.specs || []).length);

  try {
    // NO LISTING, NO STEPS TO SHOW — ask once, the way this always did. Degrading to the single
    // call is the honest fallback: a run that did not happen because the listing failed would be
    // a feature costing a feature.
    if (!docs.length) {
      const ran = await Agent.runProofs({ projectCode, ...scope });
      if (mine === seq) {
        state = { ...state, ran: ran || null, running: false, marks: { ...marksFrom(ran), ...problemMarks(ran, listed) } };
        emit();
      }
      return ran;
    }

    let acc = null;
    for (const doc of docs) {
      if (mine !== seq) return acc; // a later run owns the surface now; stop writing to it
      const keys = keysOfDocument(listed, doc.id);
      state = { ...state, marks: { ...state.marks, ...fill(keys, "running") } };
      emit();
      let part;
      try {
        part = await Agent.runProofs({ projectCode, document: doc.id });
      } catch (e) {
        part = { error: String((e && e.message) || e) };
      }
      if (mine !== seq) return acc;
      acc = foldRan(acc, part);
      // A DOCUMENT THAT ANSWERED NOTHING still has to settle. Left `running`, its specs would spin
      // for the rest of the session on a run that is over for them.
      const settled = { ...fill(keys, "fail"), ...marksFrom(part), ...problemMarks(part, listed) };
      state = { ...state, ran: acc, marks: { ...state.marks, ...settled } };
      emit();
    }
    if (mine === seq) {
      state = { ...state, ran: acc, running: false };
      emit();
    }
    return acc;
  } catch (e) {
    const ran = { error: String((e && e.message) || e) };
    if (mine === seq) {
      state = { ...state, ran, running: false };
      emit();
    }
    return ran;
  }
}

/** Collect without running — the counts a surface shows before anybody presses anything. */
export async function list(projectCode, scope = {}) {
  const Agent = getAgent();
  if (!Agent || typeof Agent.listProofs !== "function") return null;
  try {
    // WITH THE SOURCE — the window builds each run block into the same component a document does,
    // so it needs the body, not just the count.
    const listed = await Agent.listProofs({ projectCode, withSource: true, ...scope });
    state = { ...state, listed: listed || null, scope: (listed && listed.scope) || scope };
    emit();
    return listed;
  } catch {
    return null;
  }
}

/** The diagram's door: a menu target, run, and a promise its `is-running` border can wait on. */
export const askProofs = (projectCode, target) => run(projectCode, scopeOf(target));

const proofsBus = { run, list, subscribe, last, scopeOf, askProofs, mark };
export default proofsBus;
