import { getAgent } from "./hub";

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

let state = { scope: null, listed: null, ran: null, running: false, at: 0 };
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
 * Collect and run, and tell everyone listening. Resolves with the hub's answer — so a caller that
 * wants to wait on it (the diagram's `is-running` border) can.
 */
export async function run(projectCode, scope = {}) {
  const Agent = getAgent();
  const mine = ++seq;
  if (!Agent || typeof Agent.runProofs !== "function") {
    // ABSENCE STATED. A hub older than this feature has no door, and a surface that spins and then
    // quietly shows nothing is worse than one that says what is missing.
    state = { scope, listed: null, ran: { error: "this hub has no proofs door yet — restart it" }, running: false, at: Date.now() };
    emit();
    return state.ran;
  }
  state = { ...state, scope, running: true, at: Date.now() };
  emit();

  // THE LISTING FIRST, so what a surface says is in scope matches what is about to run. A document
  // edited since the last look would otherwise run specs the list never showed.
  try {
    const listed = await Agent.listProofs({ projectCode, withSource: true, ...scope });
    if (mine === seq) {
      state = { ...state, listed: listed || null, scope: (listed && listed.scope) || scope };
      emit();
    }
  } catch {
    /* the run below is the answer that matters; a failed listing is not worth refusing it over */
  }

  try {
    const ran = await Agent.runProofs({ projectCode, ...scope });
    if (mine === seq) {
      state = { ...state, ran: ran || null, running: false };
      emit();
    }
    return ran;
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

const proofsBus = { run, list, subscribe, last, scopeOf, askProofs };
export default proofsBus;
