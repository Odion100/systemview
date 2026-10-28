import { stateOf as lifecycleStateOf, GROUP_OF, reasonOf } from "../../atoms/Markdown/blocks/lifecycleState";

// THE BAND'S RFC ROWS — the derivation, with no React in it so it can be proven in Jest.
//
// This tab replaced a `documents` tab that counted "documents somebody has not been pinged about".
// That failed his test and he named the replacement: *"you got arcs, you got RFCs… RFCs have
// approvals."* The distinction that makes this one work and that one not: an RFC with an unpressed
// approval is a decision WAITING ON HIM, and nothing else in the band surfaces it. The old tab's
// rows were either covered by another tab or were bookkeeping about a notification nobody needed.
//
// AND THE COUNT WAS LYING BEFORE THIS. "2 approvals waiting" scanned `.systemview/report.*.md`
// only — and only the first twenty — so an approval sitting in an RFC was invisible: measured
// 2026-10-21, RFC-050 and RFC-072 both held one and the strip said nothing about either.
//
// THEN THE STATE WAS LYING TOO, AND HE CAUGHT IT: the document's own trail said **built** while this
// row said `1 to approve`. Two readers of one subject — the trail read the registry row, this file
// parsed approval blocks and had never heard of built, settled or retired. So a settled RFC read
// `approved` here forever, and one carrying an approval nobody intends to press pinned itself at
// *waiting* and sorted above everything else. His ruling: **the lifecycle IS the state, and what is
// waiting on me is DERIVED from it as a flag.** The state now comes from `lifecycleState.stateOf` —
// the same function the trail draws — and the ⚑ rides the approval count, which the shell already
// counts for us on the row.

/** `RFCs/RFC-072-arc-planning-and-execution.md` → `RFC-072`. The number is the identity. */
export const rfcIdFromPath = (path = "") => {
  const m = /\/(RFC-\d+)[^/]*\.md$/i.exec(String(path));
  return m ? m[1].toUpperCase() : "";
};

// The title the document gives itself, with its own number stripped — the row already says that.
export const titleOf = (text = "", path = "") => {
  const h = /^#\s+(.+)$/m.exec(String(text));
  if (h) return h[1].replace(/^RFC-\d+\s*[—\-–:]\s*/i, "").trim();
  const m = /\/RFC-\d+-([^/]*)\.md$/i.exec(String(path));
  return m ? m[1].replace(/-/g, " ") : "";
};

// A row with no registry state is not given one. The shell derives state on its parse; if it has
// not parsed this document yet, the honest answer is silence — the same rule the trail follows.
/**
 * The rows, ordered the way he reads them: **what is waiting on him first**, then drafts, then
 * everything decided. Within a group the highest number leads, because an RFC's number is its age
 * and the recent one is the one in play.
 *
 * A REJECTED RFC STAYS IN THE LIST. It is closed, not deleted — and it is the one state somebody
 * is most likely to reopen by accident, so it should be visible saying what it is.
 */
// WHAT IS WAITING ON HIM STILL LEADS — that is what the tab is for — but it is the FLAG that
// decides it now, not a state word pretending to be one. Within a group the highest number leads,
// because an RFC's number is its age and the recent one is the one in play.
const RANK = { draft: 1, approved: 2, built: 3, settled: 4, rejected: 5, retired: 6, "": 7 };

/** The first run of digits in an id, or 0 — an id is not required to carry a number at all. */
const numberIn = (id) => parseInt((/\d+/.exec(String(id || "")) || [])[0], 10) || 0;

export function rfcRows(docs = []) {
  return docs
    .map((d) => {
      const row = d.row || null;
      // THE ROW'S ID IS THE IDENTITY (RFC-073), and the path is only a fallback for a document the
      // shell has not parsed yet. Reading the number out of the filename meant a registered RFC
      // whose file is not named `RFC-nnn-*.md` was invisible here — `MOCK-RFC` at
      // `RFCs/proofs/mock-rfc.md` registered fine, drew its trail, and never appeared in the list.
      // The folder stopped meaning anything; the filename has to stop meaning anything too.
      const id = (row && row.id) || rfcIdFromPath(d.path);
      if (!id) return null;
      const st = row && row.state ? row.state : null;
      return {
        key: d.path,
        path: d.path,
        id,
        title: titleOf(d.text, d.path),
        // THE ONE DEFINITION — the function that draws the trail on the document itself.
        state: st ? lifecycleStateOf("rfc", row) : "",
        // The flag, derived and separate: the shell counted these on its own parse.
        waiting: st ? Number(st.approvals) || 0 : 0,
        // §4.2: the raw reason and the group the list acts on. Kept as two fields because they
        // answer two things — the word to SHOW, and whether this row belongs here at all.
        retiredAs: st ? String(st.retiredAs || "") : "",
        retireGroup: st ? GROUP_OF(st.retiredAs) : "",
      };
    })
    .filter(Boolean)
    // ENDINGS LEAVE THE LIST, PAUSES STAY IN IT (§4.2). An ending is a decision that this document
    // is finished with — cancelled, superseded, out of service — and keeping it here costs every
    // future reader a re-read to reject it.
    //
    // EVERYTHING ELSE STAYS, INCLUDING A RETIREMENT WHOSE REASON NOBODY RECOGNISES. That is the
    // deliberate asymmetry: a pause vanishing would be a deletion wearing a softer word, and a row
    // vanishing for a reason the system cannot read would be worse still — a document gone from
    // the list on the strength of a word nothing understood. So the filter removes only what it
    // positively knows is an ending, and `rfcLine` says out loud when it could not tell.
    .filter((r) => r.retireGroup !== "ending")
    .sort((a, b) => {
      const w = (b.waiting > 0 ? 1 : 0) - (a.waiting > 0 ? 1 : 0);
      if (w) return w;
      const r = (RANK[a.state] ?? 9) - (RANK[b.state] ?? 9);
      if (r) return r;
      // Highest number leads, because an RFC's number is its age and the recent one is in play.
      // An id with no number in it (a mock, anything named rather than numbered) sorts to 0 and
      // therefore to the bottom of its group, which is right: it is not in play, it is furniture.
      return numberIn(b.id) - numberIn(a.id);
    });
}

/**
 * The line on the right of a row — WHERE THIS DOCUMENT IS, in its lifecycle's own word, plus what
 * it is still asking of him. The state and the ask are two facts and they are said as two: an
 * approval nobody ever presses no longer hides that the thing is built.
 *
 * No registry state yet means no word. A row that says nothing beats a row that guesses.
 */
export const rfcLine = (r) => {
  const state =
    r.state === "rejected"
      ? "rejected — closed"
      : // A ROW STILL HERE AFTER BEING RETIRED OWES AN EXPLANATION. A pause says its word, because
        // that word is the whole reason it is still readable. And a reason nobody recognises says
        // SO — not "retired" alone, which would read as a filed decision, and not the raw word
        // either, which would read as a group that exists. §4.2: nothing branches on `as=` for the
        // state, so the honest surface is one that admits it cannot place it.
        r.state === "retired" && r.retiredAs
        ? `retired — ${(reasonOf(r.retiredAs) || {}).label || `${r.retiredAs}, which is not a reason anything can read`}`
        : r.state || "";
  if (!r.waiting) return state;
  const ask = `${r.waiting} to approve`;
  return state ? `${state} · ${ask}` : ask;
};

export default rfcRows;
