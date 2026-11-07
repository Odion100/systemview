// THE WORK BAND IS TABS. His ask, 2026-10-19, and then his correction once he saw it: *"get rid
// of them shits and just make it types… just make it tabs."* So there is no view toggle and no
// stacked mode — the band is one tab per TYPE of work, always. A toggle between tabs and a stack
// was furniture for a choice he did not want to keep making.
//
// Everything that decides WHICH TABS EXIST and WHICH ONE IS SHOWING lives here, away from the
// render: a band whose rows all vanished must not keep showing an empty pane while work sits on
// another tab, and that rule is the whole reason this is a function and not an inline ternary.
//
// THE BAND IS WORK IN FLIGHT, AND ONLY THAT. His ruling: *"I would make it all about the worklist.
// Work in flight. Not about dashboard shit, which I already have on an amazing dashboard."* So the
// four DOCUMENT tabs are gone — reports, RFCs, arcs and gaps were a folder, a filename pattern and
// a row per file, which is an inventory, and the dashboard is where an inventory belongs. What is
// left is work that is RUNNING: a job, a lane, a procedure's own list.
//
// `owed` STAYS, and the distinction is the reason: an obligation is not a folder of anything — it
// is one line across every kind at once, the answer to *"help me resolve what's open"*, which is
// what he said the drawer was for. It is first for the same reason.
//
// The `family` field survives with one value because the band's colour rule is keyed on it, and a
// second family may well come back; what it must not become again is a cupboard.
// AND A THIRD KIND OF THING, FIRST IN THE ROW: WHAT IS OWED BY HIM. His ask, 2026-10-30 —
// *"can get rid of the regular things like list and report counts, and just make that whole top
// header of the bar about things like approvals waiting… in general, I just need the drawer to help
// me resolve what's open."* The inventory counts came out of the head, and what replaced them needs
// somewhere to land: not a fourth document tab (an obligation is not a FOLDER of anything — it is
// one line across every kind at once) and not a section above the tabs (the band is tabs, full
// stop). So it is a tab, and it is first, because being first is what "help me resolve what's
// open" means when the band comes up.
//
// IT LEADS WITHOUT STEALING. `bandTabs` keeps the stored choice while that choice has rows, so
// being first only decides the band's tab for somebody who has not picked one — or whose pick has
// emptied out. A tab that hijacked the pane every time an approval landed would be the opposite of
// useful.
export const BAND_KINDS = [
  { key: "owed", label: "owed", family: "owed" },
  { key: "jobs", label: "job", family: "work" },
  { key: "lanes", label: "lane", family: "work" },
  { key: "lists", label: "list", family: "work" },
];

export const TAB_KEY = "sv.chat.bandTab";

// NOT EVERY WORD TAKES AN S. "3 oweds" is not English — `owed` is already what it is in the
// plural, and a word that reads wrong is a word he has to translate before he can use the tab.
const INVARIANT = new Set(["owed"]);

const plural = (word, n) => `${n} ${word}${n === 1 || INVARIANT.has(word) ? "" : "s"}`;

// Plural the way the band head already speaks: "1 job", "3 lanes".
//
// THE LANE TAB CAN HOLD TWO KINDS, AND THEN IT NAMES BOTH. A subagent with no branch is not a lane
// — it has no run record and nothing to diff — so a tab reading "3 lanes" over one lane and two
// subagents is a claim the disk does not support. It says "1 lane · 2 subagents" instead: longer,
// but every word of it is true, and the row already scrolls by design (reports fan out by subtype,
// so its length was never bounded). With one kind present the phrase collapses to that kind alone,
// which is why nothing changed for the case he has been looking at for weeks.
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
 * - A kind with no rows gets NO TAB — a tab that can only ever say "nothing here" is furniture.
 * - The stored choice wins while it still has rows; otherwise the first tab that has any does,
 *   because the alternative is an empty pane beside a tab bar that says there is work.
 * - Everything empty → no tabs and `active: ""`, and the band renders nothing at all.
 */
export const bandTabs = (counts = {}, stored = "") => {
  // A COUNT FOR A KIND THE BAND NO LONGER DRAWS IS IGNORED, not an error. The callers that still
  // know about documents hand them over in the same object, and a tab exists only if BAND_KINDS
  // names it — so dropping a kind here is the whole removal, and a stored choice pointing at one
  // falls through to the first tab with rows (below), which is what already happens to any tab
  // whose work finishes.
  const tabs = BAND_KINDS.flatMap((k) => {
    const c = counts[k.key];
    // THE LANE TAB'S COUNT FOLDS IN; REPORTS FAN OUT. Both arrive as an object and they mean
    // opposite things on purpose, so it is said here rather than left to be inferred: a report
    // subtype becomes its OWN tab, because a planning report and an account wait on different
    // things; a lane-less subagent becomes a SECTION inside the lane tab, because he asked for
    // two sections and not two tabs.
    //
    // AND THE SUM IS WHAT DECIDES THE TAB EXISTS — this is the bug he hit. `lanes` was the count
    // of REGISTERED lanes alone, so with no lanes registered and two lane-less subagents running,
    // the count was 0, the rule below deleted the tab, and the render gate (`active === "lanes"`)
    // could never be true: the rows existed, their chats existed, and nothing could reach them.
    // His rule is that no subagent runs unseen, so a running subagent BUYS the tab. The number
    // that decides the tab exists is therefore every row in the pane — and the LABEL is not that
    // number said once (see `bandLabel`), because "3 lanes" over 1 lane and 2 subagents would
    // trade an invisible row for a false one.
    if (k.key === "lanes" && c && typeof c === "object") {
      const parts = { lanes: Number(c.lanes) || 0, subagents: Number(c.subagents) || 0 };
      return [{ ...k, n: parts.lanes + parts.subagents, parts }];
    }
    return [{ ...k, n: Number(c) || 0 }];
  }).filter((t) => t.n > 0);
  if (!tabs.length) return { tabs, active: "" };
  const kept = tabs.find((t) => t.key === stored);
  return { tabs, active: (kept || tabs[0]).key };
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
