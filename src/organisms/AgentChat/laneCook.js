import { foldState } from "../AgentWorkbench/feedRows";

// IS THIS LANE COOKING RIGHT NOW? — the predicate behind the lane panel's cooking line.
//
// IT EXISTS BECAUSE THE PANEL COULD NOT SAY. The lane panel drew the lane's rows and nothing
// else, so between utterances a working subagent read as a stopped one — and subagents barely
// speak, so that is most of the time. His words, watching a lane run: *"his logs are coming in as
// he works, but I don't see him cooking in that little chat."* The signal was always in the events
// the panel was already folding for its rows; nobody asked them for it.
//
// It lives in its own file because `AgentChat.js` imports react-markdown and jest cannot mount it
// (ESM, transformIgnorePatterns) — so a predicate written inline there is a predicate nothing can
// check, and the two guards below are exactly where a wrong answer hides.

/**
 * The lane's own folded state, but only while it is genuinely mid-turn.
 *
 * TWO GUARDS, AND BOTH ARE THE POINT:
 *
 * - **the lane's OWN events, never the owner's.** The session stream carries both and they are
 *   split upstream precisely so a lane's activity cannot puppet the owner's cooking line. Folding
 *   the wrong half here would re-create that bug pointing the other way.
 * - **a closed run wins over any working event.** A lane whose worklist is all-done is finished,
 *   whatever its last event said — and a finished lane still reading "thinking" is the original
 *   complaint inverted, which is worse than silence because it is a surface testifying.
 *
 * @param {Array|null} laneEvents the events routed to this lane
 * @param {boolean} finished whether the lane's run is all-done
 * @returns {{state: string, doing: string|null, liveChars: number}|null} null when there is no line to draw
 */
export default function laneCook(laneEvents, finished = false) {
  if (finished) return null;
  if (!laneEvents || !laneEvents.length) return null;
  const st = foldState(laneEvents);
  if (!st) return null;
  // `waiting` counts: a lane blocked on an answer is not idle, and saying so is how you tell the
  // difference between a lane that needs something and a lane that died.
  if (st.state !== "working" && st.state !== "waiting") return null;
  return st;
}
