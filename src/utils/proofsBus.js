import { getAgent } from "./hub";
import { marksFrom, problemMarks } from "./specRun";

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
let state = { scope: null, listed: null, ran: null, running: false, at: 0, marks: {}, ask: 0, cleared: 0 };
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
  const marks = { ...state.marks, ...patch };
  // A RUN IS OVER WHEN NOTHING IS STILL MOVING, and that is DERIVED rather than announced. A
  // runner that forgets to say "done" — or dies mid-sequence — used to leave every surface stuck
  // on "running…" over a board of settled specs, which is the surface contradicting itself. The
  // marks are the fact; `running` is read off them.
  const moving = Object.values(marks).some((v) => v === "running");
  state = { ...state, marks, running: state.running && moving };
  emit();
}

const fill = (keys, status) => Object.fromEntries(keys.map((k) => [k, status]));

// THE PANEL IS NOT OPENED FOR YOU. A run used to dispatch `sv:openRegion` so the scratchpad came
// up with it — reasonable when a run was something you had to watch, and wrong now that it is not:
// the cards run in the page whether the panel is visible or not (it is `display:none` when
// collapsed, never unmounted), so the only thing the reveal did was take his screen. His: *"I
// don't want it to open up from the document anymore automatically. It's up to me to open up the
// scratch pad."* The results are waiting there whenever he opens it.

// WHO CAN RUN A SPEC IN THE PAGE. The proofs panel registers itself while it is mounted, and that
// registration is the whole of the decision below: a runner is here, or it is not. A TIMER would
// have been the obvious way to find out and it is the wrong one — it makes every press wait for a
// deadline to prove a negative, and it makes the answer depend on how busy the machine is.
const runners = new Set();

/** The panel, saying it is on screen and can drive its own cards. Returns the way to take it back. */
export function offerRunner(fn) {
  runners.add(fn);
  return () => runners.delete(fn);
}

/** That runner is finished. The marks already say what happened; this only stops the spinner. */
export function finished(token) {
  if (token && token !== state.ask) return;
  state = { ...state, running: false };
  emit();
}

/**
 * COLLECT, SHOW, AND ASK THE PANEL TO RUN IT — the same ▶ Run all, pressed from somewhere else.
 *
 * THERE IS NO SECOND RUNNER, and that is the whole correction. The proofs panel already pulls
 * every document's specs in as cards and already runs them WINDOW-SIDE, one at a time, each card
 * reporting running → pass/fail into `mark()`. A document's ▶ used to ignore all of that and call
 * the hub instead, which executed the lot somewhere else and answered once at the end — so every
 * dot on the ledger changed colour in the same frame and the press cost a round trip for a result
 * you could not watch. His read of it was exact: *"it doesn't have to do some crazy orchestration.
 * The system can already pull up all tests and run them, so from the document is not an extra
 * feat."*
 *
 * So this collects the scope, puts it on the board as and raises an ASK. The panel runs it. The dots light one at a time for free, because the ledger and the cards were already reading
 * the same marks.
 *
 * THE HUB IS THE FALLBACK, not the path. A press from the drawer on the Agents page has no proofs
 * panel anywhere to pick the ask up, and a press that silently does nothing is worse than a slow
 * one — so if nothing claims it, the hub runs it exactly as it always could.
 */
export async function run(projectCode, scope = {}) {
  const Agent = getAgent();
  const mine = ++seq;
  if (!Agent || typeof Agent.listProofs !== "function") {
    // ABSENCE STATED. A hub older than this feature has no door, and a surface that spins and then
    // quietly shows nothing is worse than one that says what is missing.
    state = { ...state, scope, listed: null, ran: { error: "this hub has no proofs door yet — restart it" }, running: false, at: Date.now(), marks: {}, ask: 0 };
    emit();
    return state.ran;
  }
  // THE MARKS ARE CLEARED BY THE RUN THAT REPLACES THEM, not left to decay. A second run showing
  // the first run's greens beside its own fresh ones is a surface telling two stories at once.
  state = { ...state, scope, listed: null, ran: null, running: true, at: Date.now(), marks: {}, ask: 0 };
  emit();

  let listed = null;
  try {
    listed = await Agent.listProofs({ projectCode, withSource: true, ...scope });
  } catch {
    listed = null;
  }
  if (mine !== seq) return null;

  state = {
    ...state,
    listed: listed || null,
    scope: (listed && listed.scope) || scope,
    // NO QUEUE IS PAINTED. The cards run one at a time and say so as they go; a board of
    // "queued" was a state the window never has, and the thing that sat stuck when the runner
    // broke. An unmarked spec is one nothing has run, which is the truth until a card reaches it.
    marks: {},
    // The token a runner claims. Same number as the run, so a stale panel cannot claim an old ask.
    ask: mine,
  };
  emit();

  // A RUNNER IS ON SCREEN — its cards ARE the run, and they report through `mark()` as they go.
  if (runners.size) return null;

  // NOBODY TO RUN IT HERE — a press from the drawer on a page with no proofs panel. Run it
  // hub-side, the way this always could; a press that silently does nothing is worse than a slow
  // one. The marks settle in one go because a hub run genuinely is one answer.
  try {
    const ran = typeof Agent.runProofs === "function"
      ? await Agent.runProofs({ projectCode, ...scope })
      : { error: "nothing here can run specs" };
    if (mine !== seq) return ran;
    const marks = { ...state.marks, ...marksFrom(ran), ...problemMarks(ran, listed) };
    // A SPEC THE ANSWER NEVER MENTIONED IS NOT STILL QUEUED — the run is over for it.
    for (const k of Object.keys(marks)) if (marks[k] === "running") marks[k] = "fail";
    state = { ...state, ran: ran || null, running: false, marks };
    emit();
    return ran;
  } catch (e) {
    const ran = { error: String((e && e.message) || e) };
    if (mine === seq) {
      state = { ...state, ran, running: false, marks: fill(Object.keys(state.marks), "fail") };
      emit();
    }
    return ran;
  }
}

/**
 * WIPE THE RESULTS. A run left every control green for the rest of the session with nothing
 * anywhere to take it back — the panel's own Clear reset the CARDS and never the marks, so the
 * ledger in the document stayed green over a board that had been cleared. The listing stays: what
 * is in scope did not change, only what happened to it.
 */
export function clear() {
  // `cleared` IS THE TOKEN THE CARDS WATCH. Wiping the marks tells every surface that READS them;
  // the panel's cards hold their own pass/fail state as well, so a clear from a document left the
  // ledger grey over a panel still showing PASSED — one gesture, two answers. A counter rather
  // than a boolean, so two clears in a row are two events and the second is not swallowed.
  state = { ...state, ran: null, running: false, marks: {}, cleared: (state.cleared || 0) + 1 };
  emit();
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

const proofsBus = { run, list, subscribe, last, scopeOf, askProofs, mark, offerRunner, finished, clear };
export default proofsBus;
