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

const APPROVALS = /^\s*:{3,}approval\{([^}]*)\}/gm;

/**
 * WHAT STATE AN RFC IS IN, read from its approval blocks and nothing else.
 *
 * Three states, and the third is the point of the tab: `waiting` means a block carries no
 * `verdict=` at all — a decision nobody has made. A document with no approval block anywhere is a
 * DRAFT, which is different from one asking to be decided and must not be counted as such, or the
 * bubble would say every unfinished thought is waiting on him.
 *
 * REJECTED WINS OVER APPROVED when both appear, because a rejection is a decision that closes the
 * document and a closed RFC that reads "approved" is the dangerous direction to be wrong in.
 */
export function stateOf(text = "") {
  const blocks = [...String(text).matchAll(APPROVALS)].map((m) => m[1] || "");
  if (!blocks.length) return { state: "draft", waiting: 0, approvals: 0 };
  const waiting = blocks.filter((b) => !/\bverdict=/.test(b)).length;
  const verdicts = blocks.map((b) => (/\bverdict=([a-z]+)/i.exec(b) || [])[1] || "").filter(Boolean);
  const state = verdicts.includes("rejected")
    ? "rejected"
    : waiting
    ? "waiting"
    : verdicts.includes("approved")
    ? "approved"
    : "draft";
  return { state, waiting, approvals: blocks.length };
}

/**
 * The rows, ordered the way he reads them: **what is waiting on him first**, then drafts, then
 * everything decided. Within a group the highest number leads, because an RFC's number is its age
 * and the recent one is the one in play.
 *
 * A REJECTED RFC STAYS IN THE LIST. It is closed, not deleted — and it is the one state somebody
 * is most likely to reopen by accident, so it should be visible saying what it is.
 */
const RANK = { waiting: 0, draft: 1, approved: 2, rejected: 3 };

export function rfcRows(docs = []) {
  return docs
    .map((d) => {
      const id = rfcIdFromPath(d.path);
      if (!id) return null;
      const s = stateOf(d.text);
      return { key: d.path, path: d.path, id, title: titleOf(d.text, d.path), ...s };
    })
    .filter(Boolean)
    .sort((a, b) => {
      const r = (RANK[a.state] ?? 9) - (RANK[b.state] ?? 9);
      if (r) return r;
      return (parseInt(b.id.slice(4), 10) || 0) - (parseInt(a.id.slice(4), 10) || 0);
    });
}

/** The line on the right of a row — what this RFC is asking of him, in as few words as it takes. */
export const rfcLine = (r) =>
  r.state === "waiting"
    ? `${r.waiting} to approve`
    : r.state === "approved"
    ? "approved"
    : r.state === "rejected"
    ? "rejected — closed"
    : "draft";

export default rfcRows;
