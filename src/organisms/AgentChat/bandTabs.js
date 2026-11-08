// THE WORK BAND IS TABS. His ask, 2026-10-19, and then his correction once he saw it: *"get rid
// of them shits and just make it types… just make it tabs."* So there is no view toggle and no
// stacked mode — the band is one tab per TYPE of work, always. A toggle between tabs and a stack
// was furniture for a choice he did not want to keep making.
//
// Everything that decides WHICH TABS EXIST and WHICH ONE IS SHOWING lives here, away from the
// render: a band whose rows all vanished must not keep showing an empty pane while work sits on
// another tab, and that rule is the whole reason this is a function and not an inline ternary.
//
// THE BAND IS WORK IN FLIGHT, AND NOTHING ELSE. His ruling, 2026-11-06, once the dashboard
// existed: *"all these documents being shown here are irrelevant. This was originally all about
// the worklists — some agents and worklists — and it could be that again… I would make it all
// about the worklist. Work in flight."* The document tabs this band grew through 2026-10 — owed,
// reports (and the subtype fan-out), RFCs, arcs, gaps — were each asked for in their day, and the
// dashboard is where every one of those facts lives now. A drawer that repeats the dashboard is
// two surfaces owning one answer, so the kinds that remain are the ones that are RUNNING: a job's
// list, a lane on a branch (or a subagent without one), a procedure's own run. The documents were
// not lost — they moved house.
// AND NONE OF THE THREE COMES AND GOES. His ruling, 2026-11-07, stated once and then repeated for
// each kind because I shipped only the first: *"the list should exist down there empty instead of
// disappearing"* → *"default list always"* → *"jobs, worklists, empty while they're still
// showing"* → *"lanes."*
//
// THE EMPTINESS RULE IS NOT GONE — IT MOVED. "A tab that can only ever say nothing here is
// furniture" was written when the band held INVENTORIES, where an empty tab said nothing a reader
// could act on. These three are not inventories: they are the shape of work in flight, and a band
// whose tabs appear and vanish as runs come and go is a surface you cannot learn, cannot aim at,
// and cannot put the first thing on. The emptiness rule now governs the ROWS inside a pane — each
// one says what it has none of — rather than the existence of the pane.
export const BAND_KINDS = [
  { key: "jobs", label: "job", family: "work", always: true },
  { key: "lanes", label: "lane", family: "work", always: true },
  { key: "lists", label: "list", family: "work", always: true },
];

export const TAB_KEY = "sv.chat.bandTab";

const plural = (word, n) => `${n} ${word}${n === 1 ? "" : "s"}`;

// Plural the way the band head already speaks: "1 job", "3 lanes".
//
// THE LANE TAB CAN HOLD TWO KINDS, AND THEN IT NAMES BOTH. A subagent with no branch is not a lane
// — it has no run record and nothing to diff — so a tab reading "3 lanes" over one lane and two
// subagents is a claim the disk does not support. It says "1 lane · 2 subagents" instead: longer,
// but every word of it is true. With one kind present the phrase collapses to that kind alone.
export const bandLabel = (kind, n, parts = null) => {
  const row = BAND_KINDS.find((k) => k.key === kind);
  const word = row ? row.label : kind;
  if (parts && (parts.lanes || parts.subagents)) {
    const said = [];
    if (parts.lanes) said.push(plural(word, parts.lanes));
    if (parts.subagents) said.push(plural("subagent", parts.subagents));
    return said.join(" · ");
  }
  return plural(word, n);
};

/**
 * Which tabs to draw, and which is active.
 *
 * - Every kind is marked `always`, so the three tabs are a fixed row: see BAND_KINDS for why the
 *   emptiness rule moved from the tab to the rows inside it. The filter stays because the mark is
 *   per-kind and a future kind may well earn the old rule.
 * - The stored choice wins while it still has rows; otherwise the first tab that has any does,
 *   because the alternative is an empty pane beside a tab bar that says there is work.
 *   THE SAME RULE IS THE MIGRATION: a stored key from the band's document era ("rfcs", "owed",
 *   "reports:spec") names a tab that no longer exists, matches nothing, and falls through to the
 *   first tab with rows — no special case, no empty pane.
 * - Everything empty → no tabs and `active: ""`, and the band renders nothing at all.
 */
export const bandTabs = (counts = {}, stored = "") => {
  const tabs = BAND_KINDS.flatMap((k) => {
    const c = counts[k.key];
    // THE LANE TAB'S COUNT FOLDS IN. It can arrive as an object because the tab holds two kinds —
    // registered lanes and lane-less subagents — and the SUM is what decides the tab exists: with
    // no lanes registered and two subagents running, a count of registered lanes alone would be 0,
    // the rule below would delete the tab, and the render gate (`active === "lanes"`) could never
    // be true — rows and chats existing with nothing on screen able to reach them. His rule is
    // that no subagent runs unseen, so a running subagent BUYS the tab. The LABEL is not that sum
    // said once (see `bandLabel`): "3 lanes" over 1 lane and 2 subagents would trade an invisible
    // row for a false one.
    if (k.key === "lanes" && c && typeof c === "object") {
      const parts = { lanes: Number(c.lanes) || 0, subagents: Number(c.subagents) || 0 };
      return [{ ...k, n: parts.lanes + parts.subagents, parts }];
    }
    return [{ ...k, n: Number(c) || 0 }];
  }).filter((t) => t.n > 0 || t.always);
  if (!tabs.length) return { tabs, active: "" };
  const kept = tabs.find((t) => t.key === stored);
  return { tabs, active: (kept || tabs[0]).key };
};

// THE HEAD LINE SPEAKS WORK-STATE — what is in flight, and nothing about documents. Same ruling
// as the kinds above: approvals, retention clocks and blocked objectives are the dashboard's
// story; the drawer's one closed-state line answers "is anything running right now?".
//
// EVERY WORD OF IT IS DERIVED, NOT INVENTED. The counts come from the same rows the tabs count —
// a job run whose list is still moving, a lane standing on its branch, a subagent mid-run, a
// sourced run with steps left — and each segment is a DOOR into its own tab, the way the head's
// segments have always worked ("once it's open it just closes it").
//
// "nothing in flight" IS A MEASURED ZERO, said only when the rows were counted and none are
// moving — which can happen while the band still renders (finished runs he has not cleared, or a
// whiteboard with no work beside it). It is text, not a door: a button that opens a tab that does
// not exist is a press that answers nothing.
export const bandHead = ({ jobs = 0, lanes = 0, subagents = 0, runs = 0 } = {}) => {
  const segs = [];
  if (jobs) segs.push({ key: "jobs", tab: "jobs", text: `${plural("job", jobs)} running` });
  if (lanes) segs.push({ key: "lanes", tab: "lanes", text: `${plural("lane", lanes)} out` });
  if (subagents) segs.push({ key: "subagents", tab: "lanes", text: `${plural("subagent", subagents)} running` });
  if (runs) segs.push({ key: "runs", tab: "lists", text: `${plural("run", runs)} open` });
  if (!segs.length) return [{ key: "clear", tab: "", text: "nothing in flight" }];
  return segs;
};

export const readBandTab = (store) => {
  try {
    return (store || window.localStorage).getItem(TAB_KEY) || "";
  } catch {
    return "";
  }
};

export const writeBand = (key, value, store) => {
  try {
    (store || window.localStorage).setItem(key, value);
  } catch {
    /* private mode — the choice lasts this page's life, which is better than refusing it */
  }
};

// THE DEFAULT LIST'S OWN KEY. The session's plan carries no `source` — that absence IS its
// identity, and the row wears "default" for it — so a row has to be synthesised when the session
// has not written a plan yet, or has emptied it.
export const DEFAULT_LIST_KEY = "default";

// WHICH ROW A LIST IS, AND THE PLAN'S KEY CANNOT BE DERIVED FROM ITS RECORD. A run's record is
// owned by `run:<id>`, so its row is keyed by that id — but the session's own plan is owned by the
// SESSION file (`session-<slot>-<uuid>`), which shares no key with the live `todo.updated` the same
// plan arrives on (keyed "session"). Both are sourceless, both ARE the plan, and keyed apart they
// drew TWO "default" rows in his band — measured 2026-11-07, one scroll below the ruling that the
// plan always has a row. So a sourceless row takes the plan's key whichever side it came from, and
// the live event overwrites the disk row instead of sitting beside it.
export const listKey = (source, derived) =>
  String(source || "") ? String(derived || "") : DEFAULT_LIST_KEY;

/**
 * Guarantee the session's own plan has a row, even with nothing on it.
 *
 * `rows` are the lists already derived from disk and this session's events. A sourceless row is
 * the plan; if one is there it is kept exactly as it is — items, status, record and all — and if
 * not, an empty one is put at the END, because a plan with nothing on it should not outrank a run
 * that is actually moving.
 *
 * IT IS NOT FILTERED BY `cleared`. Clearing the plan is how he empties it, not how he deletes it:
 * the row has to survive its own clear or "always" would mean "until he uses it".
 */
export const withDefaultList = (rows = []) => {
  const list = Array.isArray(rows) ? rows : [];
  if (list.some((l) => l && !l.source)) return list;
  return [...list, { key: DEFAULT_LIST_KEY, source: "", items: [], status: null, attachments: null }];
};
