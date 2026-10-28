// THE WORK BAND IS TABS. His ask, 2026-10-19, and then his correction once he saw it: *"get rid
// of them shits and just make it types… just make it tabs."* So there is no view toggle and no
// stacked mode — the band is one tab per TYPE of work, always. A toggle between tabs and a stack
// was furniture for a choice he did not want to keep making.
//
// Everything that decides WHICH TABS EXIST and WHICH ONE IS SHOWING lives here, away from the
// render: a band whose rows all vanished must not keep showing an empty pane while work sits on
// another tab, and that rule is the whole reason this is a function and not an inline ternary.
//
// REPORTS ARE A TAB (his call, 2026-10-19 — he reversed the earlier answer after living with the
// folded mailbox: *"reports are supposed to be a tab in the drawer, the strip, whatever"*). So the
// mailbox fold is gone and reports take their turn beside the other kinds, under the same rules:
// no reports, no tab.
// RFC-071 — DOCUMENTS ARE A TAB TOO, for the same reason reports became one: a document with
// members and an unsent update is work waiting on him, and work waiting on him belongs where the
// rest of it is. The row is the document; the press is its send.
// TWO FAMILIES, AND THEY ARE DIFFERENT KINDS OF THING. `jobs`, `lists` and `lanes` are WORK that
// is running — a procedure's own list, a branch somebody is building on. `reports`, `rfcs` and
// `arcs` are DOCUMENTS on disk: a folder, a filename pattern, and a row per file. The second group
// is the one that becomes configurable — reports is only in it by default because it lives in
// `.systemview`, not because the word "report" means anything to the band.
//
// The families are told apart by COLOUR and nothing else (his call: *"could be a different colour
// of the type, like you're overthinking it"*). Not a glyph, not a separator, not a second row —
// those all say "these are two lists" when the truth is one band holding two kinds of thing.
export const BAND_KINDS = [
  { key: "jobs", label: "job", family: "work" },
  { key: "lanes", label: "lane", family: "work" },
  { key: "lists", label: "list", family: "work" },
  { key: "reports", label: "report", family: "document" },
  { key: "rfcs", label: "RFC", family: "document" },
  // RFC-072 §7 — AN ARC IS WORK THE PROJECT IS CARRYING, so it sits beside the rest of it rather
  // than behind a path only an agent knows. Same rule as every other kind: no arcs, no tab.
  { key: "arcs", label: "arc", family: "document" },
  // THE FOURTH REGISTERED KIND, which had no surface anywhere. A gap is the one document an agent
  // writes INTO SOMEBODY ELSE'S repo — so it is the kind that most needs to be findable by a person
  // who did not file it, and it was the only kind you could not see at all.
  { key: "gaps", label: "gap", family: "document" },
];

export const TAB_KEY = "sv.chat.bandTab";

// A SUBTYPE TAB SAYS THE WORD ALONE — "2 specs", never "2 reports:spec" (his point, 2026-10-28:
// the whole reason the subtypes expanded into their own tabs is so the word "report" does not
// repeat across the bar). And the word is the SHORT one: a planning report's tab says "plan".
const SUBTYPE_WORD = { planning: "plan" };

// Plural the way the band head already speaks: "1 job", "3 lanes".
export const bandLabel = (kind, n) => {
  const sub = kind.startsWith("reports:") ? kind.slice(8) : "";
  const row = BAND_KINDS.find((k) => k.key === kind);
  const word = sub ? SUBTYPE_WORD[sub] || sub : row ? row.label : kind;
  return `${n} ${word}${n === 1 ? "" : "s"}`;
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
  // REPORTS FAN OUT BY SUBTYPE, AT THE TOP (his call, settled 2026-10-28 after trying the nested
  // strip: *"it makes sense logically, but I don't want to search for shit"*). A tab inside a tab
  // is a thing you have to find; what was really waiting for you belongs where the eye already is.
  // Each subtype waits on a DIFFERENT thing — a planning report waits to become an RFC, a notice
  // waits to be read, a spec is current-or-drifted — and the vocabulary is OPEN, so the tabs come
  // from whatever words the documents carry: a subtype nobody has used costs nothing, the first
  // document to use one buys the tab, and the row scrolls when the words outgrow it. Untyped
  // reports keep the plain `report` tab.
  const tabs = BAND_KINDS.flatMap((k) => {
    const c = counts[k.key];
    if (k.key === "reports" && c && typeof c === "object") {
      const subs = Object.keys(c).filter((w) => w && c[w] > 0).sort();
      const out = [];
      if (c[""] > 0) out.push({ ...k, n: c[""] });
      subs.forEach((w) =>
        out.push({ key: `reports:${w}`, label: SUBTYPE_WORD[w] || w, family: "document", n: c[w] })
      );
      return out;
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
