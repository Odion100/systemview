// WHAT A BAND ROW SAYS BEFORE IT IS OPENED, and what waits behind the fold — one decision for
// every kind of row in the drawer, with no React in it so the answer can be held to its claims.
//
// THE PROBLEM IT EXISTS FOR, in his words: *"how much do I care about the changes specifically?
// Could be there for me to expand and see more if I want. Maybe it's an expandable block. Maybe
// most of the stuff in here needs to be… a block with some information at the top for me to know
// exactly what the work is."*
//
// Every document row in the band was a FLAT LINE: the id, the title, then a state word, an owner,
// a retention clock, who filed it and a timestamp, all competing for one row's width — and the
// path, the single fact that says where the thing actually is, available only as a hover title.
// Measured against what he opens the drawer for, that is backwards: the line leads with the one
// fact he needs and everything else is a thing he asked for by expanding.
//
// THREE RULES, AND THEY ARE THE WHOLE MODULE:
//
//   1. THE HEADLINE IS THE IDENTITY AND WHAT THE THING IS. `id — title`, the report's name, the
//      obligation's own sentence. Nothing derived, nothing dated, nothing counted.
//   2. THE FLAG STAYS ON THE HEADLINE. It is the one exception and it is deliberate: a press
//      waiting behind a fold is a press he cannot see, and the band head above is its legend
//      (*"the reason I know it's an approval is because it says it above"*). The mark says
//      SOMETHING WAITS; the fold says what.
//   3. EVERYTHING ELSE FOLDS — including the path, which was never on the row to begin with.
//      A fold that only repeats the line it hangs under is furniture; this one carries the facts
//      the line could not afford plus the one it never had.
//
// IT DOES NOT FETCH AND IT DOES NOT FORMAT TIME. A retention clock and a filing date are already
// derived on the render side by the same functions the documents themselves use (`retainLine`,
// moment) — asking for them again here would be a second answer that can disagree with the
// document about its own clock. They arrive as `extra`, already said; what this module decides is
// WHETHER THEY BELONG ON THE ROW OR IN THE FOLD, which is the question that was actually open.

/** The mark a kind wears when something is waiting, and the sentence that explains it. */
const FLAG = {
  // ⚑ = your press finishes it. One mark for one meaning, wherever a decision sits undone.
  press: { glyph: "⚑", says: "your press finishes this one" },
  // ⊘ = stopped, and nobody's signature moves it. Sharing ⚑ made the band unreadable (*"I don't
  // know what the other one is"*), so a stop keeps its own mark.
  stop: { glyph: "⊘", says: "stopped — this needs work, not a verdict" },
};

/**
 * WHO FILED A REPORT, read out of its filename — `report.<agent>.<...>.md`. Pure, so it lives here
 * rather than as an inline IIFE in the markup, where it was unprovable and duplicated nothing.
 */
export const filedBy = (path = "") => {
  const m = String(path || "").match(/report\.([^.]+)\./);
  return m ? m[1] : "";
};

// A fold entry nobody can read is not an entry. Empty text is dropped rather than drawn as a
// label with nothing after it — the fold's whole value is that every line in it says something.
const facts = (list) =>
  list
    .filter((f) => f && f.text !== null && f.text !== undefined && String(f.text).trim())
    .map((f) => ({ tone: "", ...f, text: String(f.text) }));

/**
 * The block one band row draws.
 *
 * @param kind `"report" | "rfc" | "arc" | "gap" | "owed"`
 * @param row the kind's own row, exactly as its rows module built it
 * @param extra facts already derived on the render side: `{ line, when, clock: {text, urgent} }`
 * @returns `{ flag, flagSays, title, fold }` — `flag` is "" when nothing waits, `fold` is ordered
 *   and never holds an entry with nothing to say.
 */
export function bandBlock(kind, row = {}, extra = {}) {
  const b = BLOCK[kind];
  if (!b) {
    // AN UNKNOWN KIND STILL DRAWS. A row vanishing because nobody taught this file its word is the
    // same silent omission the owed list was built to replace — so it falls back to whatever
    // identity the row carries and folds the one fact every row has.
    return { flag: "", flagSays: "", title: String(row.id || row.name || row.path || ""), fold: facts([{ key: "path", label: "file", text: row.path }]) };
  }
  const f = b.flag ? b.flag(row, extra) : "";
  const mark = FLAG[f] || null;
  return {
    flag: mark ? mark.glyph : "",
    flagSays: mark ? (b.flagSays ? b.flagSays(row, extra) : mark.says) : "",
    title: b.title(row),
    fold: facts(b.fold(row, extra)),
  };
}

const BLOCK = {
  // A REPORT'S NAME IS ITS HEADLINE — it is the one kind whose rows carry a sentence a person
  // wrote on purpose. Its clock, its author and its filing time are the facts that were crowding
  // that sentence, and all three are things he looks for only once he is interested.
  report: {
    // A REPORT'S FLAG IS NOT ON THE REPORT. The shell counts approvals per path on its own parse
    // and the band holds them in a map beside the list, so the caller says whether this one waits
    // — reconstructing it from the row would be a second count that can disagree with the head.
    flag: (r, x) => (x.waiting ? "press" : ""),
    // THE SENTENCE, THEN THE FILENAME — and `id` is where the sentence actually lives. A registry
    // row's fields are `id, kind, path, project, members, at, state`: there is no `name` on it, so
    // this fell straight through to the path and would have drawn
    // "reports/drain-stood-down-during-onboarding.md" where
    // "The drain was handed over mid-onboarding and stood down before it started" belongs — the
    // exact fault the rebuild exists to fix, shipped by the thing fixing it.
    //
    // NOT ONE ASSERTION CAUGHT IT because every fixture in the suite hands this a `name`. A test
    // that supplies a field the world does not send is green about a shape nothing reaches it with,
    // which is why the real rows had to be run through this before anybody rendered it.
    //
    // `name` STAYS FIRST so a caller that genuinely has one still wins; `path` stays last because a
    // filename is better than an empty headline and worse than anything else here.
    title: (r) => String(r.name || r.id || r.path || ""),
    fold: (r, x) => [
      // INVALID LEADS, because it is the row saying its own leaf does not parse — every other fact
      // in the fold is downstream of a leaf that does.
      { key: "invalid", label: "invalid", text: r.state && r.state.invalid ? r.state.invalid : "", tone: "warn" },
      { key: "clock", label: "retention", text: x.clock && x.clock.text ? x.clock.text : "", tone: x.clock && x.clock.urgent ? "warn" : "" },
      { key: "who", label: "filed by", text: filedBy(r.path) },
      { key: "when", label: "filed", text: x.when },
      { key: "path", label: "file", text: r.path },
    ],
  },
  // AN RFC SAYS WHERE IT STANDS — and that sentence is derived, which is exactly the kind of fact
  // rule 3 sends down. `rfcLine` is still the one definition of it; it arrives as `extra.line`
  // rather than being recomputed, so the fold and the list can never word it differently.
  rfc: {
    flag: (r) => (r.waiting > 0 ? "press" : ""),
    flagSays: (r) => `${r.waiting} waiting for your verdict`,
    title: (r) => titleWith(r),
    fold: (r, x) => [
      { key: "state", label: "stands at", text: x.line },
      { key: "path", label: "file", text: r.path },
    ],
  },
  // AN ARC'S PROGRESS AND ITS OWNER BOTH FOLD. *"2 of 7 moving and 2 of 7 waiting are the same
  // progress and not the same situation"* is why the blocked count exists — and it survives the
  // fold as the ⊘ on the headline, which is the part of it that changes what he does next.
  arc: {
    flag: (a) => (a.blocked ? "stop" : ""),
    flagSays: (a) => `${a.blocked} objective${a.blocked === 1 ? "" : "s"} blocked`,
    title: (a) => titleWith(a),
    fold: (a, x) => [
      { key: "state", label: "progress", text: x.line },
      { key: "owner", label: "owner", text: a.owner },
      { key: "path", label: "file", text: a.path },
    ],
  },
  // A GAP CARRYING ITS OWN PROOF IS ONE PRESS FROM RESOLVED, and that is the only thing about a
  // gap that waits on him — an unfixed gap is work, and work wears no flag.
  gap: {
    flag: (g) => (g.state === "open" && g.hasProof ? "press" : ""),
    flagSays: () => "a proof is in the file — one press from resolved",
    title: (g) => titleWith(g),
    fold: (g, x) => [
      { key: "state", label: "stands at", text: x.line },
      { key: "path", label: "file", text: g.path },
    ],
  },
  // AN OBLIGATION'S HEADLINE IS THE OBLIGATION. `says` is already a sentence somebody wrote to be
  // read in place, so the headline keeps it whole and the fold carries where to go — which is the
  // one thing the owed row never said out loud (*"the line rides the title, not the row"*, and a
  // title is not something you can read down a list).
  owed: {
    flag: (o) => (o.group === "press" ? "press" : "stop"),
    flagSays: (o) => (o.group === "press" ? FLAG.press.says : FLAG.stop.says),
    title: (o) => `${o.id} — ${o.says}`,
    fold: (o) => [
      { key: "why", label: "because", text: WHY_WORD[o.why] || o.why },
      { key: "tail", label: "", text: o.tail },
      { key: "path", label: "file", text: o.line > 1 ? `${o.path}:${o.line}` : o.path },
    ],
  },
};

// `id — title`, and the id alone when a document gave itself no title. Never `id — ` with nothing
// after the dash: a dangling separator reads as a title that failed to load.
const titleWith = (r) => `${r.id}${r.title ? ` — ${r.title}` : ""}`;

// THE CATEGORY, IN WORDS. `why` is owed.js's internal tag; on screen it has to be a thing he
// recognises, because the whole point of the fold is that it explains the headline rather than
// repeating it in a shorter font.
const WHY_WORD = {
  clock: "a retention clock is running out",
  approval: "an approval is unsigned",
  proof: "the fix is in the file, unsigned",
  mine: "an objective is yours",
  blocked: "an objective is declared blocked",
  unplanned: "objectives with no plan attached",
  undecidable: "nothing can take it out of draft",
  claims: "claims resting on nothing",
};

export default bandBlock;
