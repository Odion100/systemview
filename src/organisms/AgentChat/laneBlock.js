import { briefLine } from "./unseenSubagents";

// A LANE ROW IS A BLOCK, AND THE BLOCK'S HEAD HAS TO SAY WHAT THE WORK IS.
//
// His words, 2026-10-31: *"the fact that it's a branch — I want to be able to easily look at it,
// know what the branch is and know what the work is. Not have to guess. And how much do I care
// about the changes specifically? Could be there for me to expand and see more if I want."*
//
// WHAT THE ROW SAID BEFORE: a branch name, a bar, a fraction, two chips about whether the work was
// safe to delete, and the step it was on. Every one of those is true and not one of them answers
// *what is this lane for* — so the answer was the branch name, which is a slug somebody typed in a
// hurry. `lane/drawer-rows` is a guess dressed as a fact, and guessing is the thing he named.
//
// THE ANSWER EXISTS AND NOTHING WAS ASKING FOR IT. RFC-059 routes a subagent's events into a map
// keyed by the spawning call, each entry carrying THE BRIEF — the prompt that scoped the lane. The
// lane panel has shown it (folded, two clicks down) since the day it was built. It is the most
// direct statement of what a lane is for that exists anywhere in the system, and the row — the
// surface he actually reads — never said a word of it.
//
// NO REACT IN HERE, for the same reason `laneCook.js` has none: `AgentChat.js` imports
// react-markdown and jest cannot mount it, so a decision written inline there is a decision
// nothing can check. These four are exactly where a wrong answer would hide.

/**
 * WHAT THE WORK IS, in one line, and WHERE THAT CAME FROM.
 *
 * The `from` is not decoration — it is what keeps the line honest. A brief is what somebody TOLD
 * the lane; a commit subject is what the lane SAYS IT DID; a plan step is neither. Printing all
 * three in the same font, in the same place, with no word for which one you are looking at, is how
 * a surface comes to be confidently wrong — and this row's whole complaint was having to guess.
 *
 * THE ORDER IS THE ASSIGNMENT FIRST. The brief outranks the commits because it is stable and it is
 * the thing: a lane half-way through its work has committed a fraction of what it was asked for,
 * and a headline that read "wip" while the lane built a feature would be the old problem wearing a
 * sentence. Commits come second because they are what survives a restart — session memory holds
 * the brief and loses it, git does not.
 *
 * AND IT ADMITS WHEN IT HAS NOTHING. An empty `text` with `from: ""` is the honest state of a lane
 * registered by an agent for its own work before anything is committed, and the row says so
 * instead of repeating the branch name in a second font.
 */
export function laneWork({ brief = "", commits = [], items = [] } = {}) {
  const told = briefLine(brief);
  if (told) return { text: told, from: "brief", says: "what this lane was told to do" };
  // NEWEST COMMIT FIRST, which is the order `git log` answers in — the subject of the last thing
  // it did is the closest git can come to naming the work.
  const subject = (commits || []).map((c) => String((c && c.subject) || "").trim()).find(Boolean);
  if (subject) return { text: clip(subject), from: "commit", says: "the subject of its newest commit" };
  const step = (items || []).find((t) => t && t.state === "active") || (items || [])[0];
  const text = step && step.text ? clip(String(step.text)) : "";
  if (text) return { text, from: "plan", says: "a step off its own plan — nobody said what this lane is for" };
  return { text: "", from: "", says: "nothing says what this lane is for — no brief, no commit, no plan" };
}

const clip = (s, n = 72) => {
  const t = String(s || "").replace(/\s+/g, " ").trim();
  return t.length > n ? `${t.slice(0, n - 1)}…` : t;
};

/**
 * CAN HE FOLLOW IT — his first ask: *"I want to be able, if there's a subagent in it, to follow
 * it."*
 *
 * TWO ANSWERS, NOT ONE, because they lead to different controls and conflating them is how a
 * surface offers a live view of something that stopped three hours ago:
 *
 *   `has`  there is a log to READ. A finished lane's log is history and worth opening.
 *   `can`  there is something to WATCH. A log, and a run that has not closed.
 *
 * THE CLOSED RUN WINS OVER THE EVENTS, which is `laneCook`'s rule and the same reason: a finished
 * lane still offering "follow" is a surface testifying, and a button that follows nothing is worse
 * than no button. Nothing is inferred from the stream going quiet — a subagent thinking for two
 * minutes is silent and alive.
 *
 * `why` is for when `can` is false, and it is said out loud rather than left to be inferred,
 * because the two causes want different things from him: a lane with no log at all may be this
 * agent's own work (nothing is wrong), while a lane whose log aged out is a limit of session
 * memory he should know about rather than read as "idle".
 */
export function laneFollow({ events = null, finished = false } = {}) {
  const has = !!(events && events.length);
  if (!has)
    return {
      has: false,
      can: false,
      why: "no log held for this lane — either this agent's own work, or a subagent whose session ended",
    };
  if (finished) return { has: true, can: false, why: "the run is closed — its log is history now, not a live feed" };
  return { has: true, can: true, why: "" };
}

/**
 * THE CHANGES, AS ONE SENTENCE — *"how much do I care about the changes specifically? Could be
 * there for me to expand."* So: not a diff on the row, and not a diff in the fold either. A count
 * he can read in a glance, and the branch review he already has if he wants the lines.
 *
 * A LANE WITH NO COMMITS IS THE NORMAL CASE AND IT IS NOT AN ERROR. The work lives in the lane's
 * worktree until somebody commits, and `base...branch` is empty for all of it — so "no changes"
 * would be a flat lie about a lane that has been writing files for an hour. It says which it is.
 */
export function laneChanges({ files = null, commits = null, error = "" } = {}) {
  if (error) return { text: error, tone: "warn" };
  if (!files) return { text: "", tone: "" }; // not read yet — the caller says "reading…", not this
  const n = files.length;
  const c = (commits || []).length;
  if (!n)
    return {
      text: "nothing committed on this branch yet — the work is in the lane's worktree",
      tone: "",
    };
  return { text: `${plural(n, "file")} · ${plural(c, "commit")}`, tone: "" };
}

const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

/**
 * WHAT THE FOLD HOLDS, IN ORDER — and the order turns on whether the lane is still running,
 * because the two states are two different questions.
 *
 * Running, he opened it to WATCH: the log leads. Stopped, he opened it to REVIEW: the changes
 * lead. The same four sections either way — a fold whose contents move around is a fold you have
 * to search, and the sections are the same facts whichever question brought him.
 *
 * `live` is in the list even when there is no log, because `laneFollow` already has a sentence for
 * that case and a section that says why it is empty beats a section that silently is not there.
 */
export function laneFoldOrder({ finished = false } = {}) {
  return finished ? ["changes", "live", "brief", "standing"] : ["live", "changes", "brief", "standing"];
}

/**
 * IS IT ALIVE, AND WHEN DID IT LAST DO ANYTHING — the half that turns seeing into understanding.
 *
 * A brief says what a lane was ASKED for and a fraction says how far down its own list it is.
 * Neither answers the question he actually has while work is running, which is *is this thing
 * moving or is it stuck* — and he has had to answer it by watching the number fail to change.
 *
 * SILENCE IS NOT DEATH AND MUST NOT BE DRAWN AS IT. A subagent thinking for two minutes emits
 * nothing, and a lane reading "stalled" because a model is mid-thought would be the surface
 * testifying again. So this reports ELAPSED SINCE THE LAST EVENT and lets the number speak:
 * under a minute is working, minutes is quiet, and only a closed run is finished. The tone escalates
 * but the words never diagnose.
 *
 * A LANE WITH NO LOG GETS NO LIVENESS AT ALL, rather than a reassuring "idle": either it is this
 * agent's own work, or its session ended and the events aged out of memory. Both are "nothing is
 * watching this", which is an absence and is said as one.
 */
export function laneLiveness({ events = null, finished = false, now = Date.now() } = {}) {
  if (finished) return { text: "closed", tone: "done", ms: null };
  if (!events || !events.length) return { text: "", tone: "", ms: null };
  const last = events.reduce((t, e) => Math.max(t, Number((e && (e.ts || e.at)) || 0)), 0);
  if (!last) return { text: "", tone: "", ms: null };
  const ms = Math.max(0, now - last);
  if (ms < 60000) return { text: "working", tone: "live", ms };
  const mins = Math.floor(ms / 60000);
  if (mins < 60) return { text: `quiet ${mins}m`, tone: mins >= 10 ? "warn" : "", ms };
  const hrs = Math.floor(mins / 60);
  return { text: `quiet ${hrs}h`, tone: "warn", ms };
}

export default laneWork;
