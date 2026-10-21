// WHICH REPLY IS NEW — the one question auto-speech cannot get wrong.
//
// THE FAILURE IT EXISTS TO PREVENT: the feed re-renders constantly, and on a cold load EVERY
// settled reply in the backlog mounts at once. Speaking "on mount" without this would read the
// entire history at him the moment he opened the window — forty replies, in order, with one stop
// button. That is not a bug you ship once; it is the thing that makes somebody turn a feature off
// and never turn it back on.
//
// TWO GUARDS, because each one misses what the other catches:
//
//   * ARMED AT LOAD. A row is only new if it settled AFTER this module was imported. The backlog
//     carries real timestamps from when it was actually said, so history fails this test by
//     construction — no heuristic about mount timing, no guessing at list position.
//   * SPOKEN ONCE, BY KEY. React remounts rows for reasons that have nothing to do with new
//     messages — a tab change, a filter, a parent re-render. The key is the row's own identity, so
//     a reply that has been considered is never considered again, whichever way it comes back.
//
// Marking is NOT conditional on speaking: a backlog row is recorded as seen even though it stays
// silent, so it can never speak later when something re-mounts it.
//
// STREAMING NEEDED NO GUARD HERE, and that is worth saying so nobody adds one. `Feed.js` mounts
// the control as `{r.settled && <SpeakReply …/>}` — the button does not exist until the reply is
// finished, so there is no half-written text for a voice to race.
const ARMED = Date.now();
const SEEN = new Set();

/**
 * True exactly once per row, and only for a row that arrived after this page did.
 * Calling it MARKS the row — it is a decision, not a question, and asking twice is a bug.
 */
export function takeIfNew(key, ts) {
  const k = String(key || "");
  if (!k || SEEN.has(k)) return false;
  SEEN.add(k);
  const when = Number(ts);
  return Number.isFinite(when) && when > ARMED;
}

/** Testing seam — a module armed at import cannot otherwise be exercised. */
export function _reset(armedAt) {
  SEEN.clear();
  return armedAt;
}

export const armedAt = () => ARMED;
