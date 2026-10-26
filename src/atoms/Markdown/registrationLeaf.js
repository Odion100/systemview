import { membersInsertAfter } from "./docMembers";

// RFC-073 c10 — REGISTERING A DOCUMENT IS A PICK, NOT TYPING A BLOCK BY HAND. The right-click menu
// offers the four registration leaves; picking one writes the leaf at the top of the document,
// filled. This module is the plan — WHERE the leaf goes, WHAT it says, and whether the document
// already has one — kept out of the click handler for the same reason docMembers is: a write that
// can land on the wrong line has to be claimable by a test.

// The four kinds a document can say it is (RFC-073 §1.2). `fields` is what the menu row names —
// the id always, and the one relationship an RFC may carry.
export const LEAF_KINDS = [
  { kind: "rfc", fields: "id, arc" },
  { kind: "arc", fields: "id, owner" },
  { kind: "report", fields: "id" },
  { kind: "gap", fields: "id" },
];

const LEAF_LINE = /^\s*::(arc|rfc|report|gap)\{/;

// The line an existing registration leaf sits on (1-based), 0 when the document has none.
// First one wins — a document is ONE thing, so the menu's register door closes once a leaf exists.
export const leafLineNo = (src) => {
  const i = String(src || "")
    .split("\n")
    .findIndex((l) => LEAF_LINE.test(l));
  return i < 0 ? 0 : i + 1;
};

// THE ID, FILLED FROM WHERE THE DOCUMENT LIVES — the one thing "filled" can honestly mean with
// nobody typing. A file pane's commentKey is `file-<path>`, a report's is `report-<ns>-<name>`;
// the basename usually carries the identity (`RFC-073-…`, `ARC-004-…`, `G-12-…`). A numbered id is
// taken whole; anything else falls back to the filename's stem, which is at least an id a human
// chose once. No key → empty, and the plan still writes `id=` for the caret to land in.
export const idFromKey = (commentKey, kind) => {
  const key = String(commentKey || "");
  const m = key.match(/^(?:file|report)-(.*)$/);
  if (!m) return "";
  const base = m[1].split("/").pop().replace(/\.(md|markdown)$/i, "");
  const numbered = base.match(/^((?:RFC|ARC|G)-\d+)/i);
  if (numbered) return numbered[1].toUpperCase();
  return kind === "rfc" || kind === "arc" ? "" : base;
};

// `{ already: { line, name } }` when a leaf exists (writing a second identity is refused here, not
// trusted to the caller), else `{ insertAfter, text }`. The leaf lands where `::members` lands —
// after the title and its lead, before the first heading — because identity is the document's head,
// never wherever the right-click happened.
export const addLeafPlan = (src, kind, commentKey) => {
  const at = leafLineNo(src);
  if (at) {
    const name = (String(src).split("\n")[at - 1].match(LEAF_LINE) || [])[1] || "";
    return { already: { line: at, name } };
  }
  const id = idFromKey(commentKey, kind);
  return { insertAfter: membersInsertAfter(src), text: `::${kind}{id=${id}}` };
};
