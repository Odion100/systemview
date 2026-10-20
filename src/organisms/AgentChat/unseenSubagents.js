// NO SUBAGENT RUNS UNSEEN.
//
// His standing rule, and the one this system is built on: *"you shouldn't be able to spawn subagents
// without me seeing it."*
//
// WHAT WAS ALREADY TRUE: RFC-059 routes a subagent's events away from the owner's feed and into a
// map keyed by `parent` — the id of the Agent call that spawned it — each carrying the prompt that
// scoped it. So the data has been there all along.
//
// WHAT WAS NOT: a ROW only exists for a lane with a run record, and the join from `parent` to a row
// is `lane.source`, which is set by exactly one thing — the subagent calling `worklist set` with a
// `lane:` source. A subagent that never registers one therefore has:
//   · no `source`, so `laneLogFor` can never find it,
//   · no run record, so `stripRuns` draws nothing,
//   · and consequently no row anywhere at all.
//
// It runs, it spends tokens, it reads and writes files, and the strip is silent. Measured
// 2026-10-20: two research subagents were spawned for a behaviour eval, neither registered a lane,
// and neither appeared on any surface. The events were collected the whole time — nothing read them.
//
// SO THIS IS A SELECTOR, NOT A FEATURE. Everything needed is already in the split's output; the only
// thing missing was asking it the question.

/** The first line of a brief, short enough to be a row. A brief is a whole prompt. */
export const briefLine = (brief, max = 72) => {
  const first = String(brief || "")
    .split("\n")
    .map((l) => l.trim())
    .find(Boolean) || "";
  return first.length > max ? `${first.slice(0, max - 1)}…` : first;
};

/**
 * Every subagent with no row of its own.
 *
 * `laneMap` is the split's `lanes` — a Map (or entries array) of `parent id -> { source, brief,
 * events }`. `rowSources` is every source that ALREADY has a row in the strip, so a subagent that
 * registered properly is not reported twice.
 *
 * Returns rows newest-activity-first, because the one still running is the one worth seeing.
 */
export function unseenSubagents(laneMap, rowSources = []) {
  const known = new Set((rowSources || []).map((s) => String(s || "")).filter(Boolean));
  // ARRAY FIRST, AND THIS ORDER IS THE WHOLE POINT: an Array has `.entries()` too, and it yields
  // `[index, value]` — so testing for `.entries` first silently turned `[["a", lane]]` into
  // `[[0, "a"], [1, lane]]` and the array branch was dead code. Caught by its own claim, not by
  // reading it.
  const entries = Array.isArray(laneMap) ? laneMap : laneMap && typeof laneMap.entries === "function" ? [...laneMap.entries()] : [];
  const out = [];
  for (const [parent, lane] of entries) {
    if (!parent || !lane) continue;
    const source = String(lane.source || "");
    // REGISTERED AND ALREADY DRAWN — not this function's business.
    if (source && known.has(source)) continue;
    // REGISTERED BUT NOT DRAWN is a different fault (a run record that went missing) and it is
    // still unseen, so it is reported — with its source, which is the clue to why.
    const events = Array.isArray(lane.events) ? lane.events : [];
    const ts = events.reduce((n, e) => Math.max(n, Number(e && e.ts) || 0), 0);
    out.push({
      parent: String(parent),
      source,
      brief: briefLine(lane.brief),
      fullBrief: String(lane.brief || ""),
      events: events.length,
      ts,
      // WHAT IT HAS BEEN DOING, for a row that has no name to show. A subagent with no brief and no
      // source would otherwise be an id and a number, which is visible without being legible.
      last: lastDoing(events),
      // RUNNING OR FINISHED — the difference between "this is spending right now" and "this already
      // stopped", which is the whole point of seeing it at all. `ended` is set by the split from the
      // spawning call's RESULT; absent means still running, and that is never inferred from the
      // events going quiet, because a subagent thinking for two minutes is silent and alive.
      ended: !!(lane.ended && lane.ended.ts !== undefined),
      failed: !!(lane.ended && lane.ended.ok === false),
      endedTs: (lane.ended && Number(lane.ended.ts)) || 0,
      state: !lane.ended ? "running" : lane.ended.ok === false ? "failed" : "finished",
      // WHY IT HAS NO ROW, said out loud rather than left to be inferred — the two causes need
      // different answers from him.
      why: source ? "registered, but no row — its run record is missing" : "never registered a lane",
    });
  }
  // RUNNING FIRST, whatever the clock says. A live subagent spending tokens outranks a finished one
  // that happens to have stopped more recently.
  return out.sort((a, b) => Number(a.ended) - Number(b.ended) || b.ts - a.ts);
}

/** The most recent thing it did, in a few words. Tool calls first — they are what it is spending. */
function lastDoing(events) {
  for (let i = events.length - 1; i >= 0; i -= 1) {
    const e = events[i];
    if (!e) continue;
    if (e.kind === "tool.call") return String(e.summary || e.name || "a tool call").slice(0, 60);
    if (e.kind === "status" && e.status) return String(e.status).slice(0, 60);
  }
  for (let i = events.length - 1; i >= 0; i -= 1) {
    const e = events[i];
    if (e && e.kind === "assistant.text" && e.text) return String(e.text).replace(/\s+/g, " ").trim().slice(0, 60);
  }
  return "";
}

/** The band's count: how many things are running that nothing else on screen accounts for. */
export const unseenCount = (laneMap, rowSources) => unseenSubagents(laneMap, rowSources).length;
