// A VERDICT WITHOUT SCROLLING TO THE BLOCK — what the press has to write, worked out away from the
// render so it can be tested.
//
// His ask, RFC-070 threads t1 + t5: hovering ✓/✗ chips at the top-right of any open document, *"a
// remote for the approval block, same setAttr write, one source of truth."* And the inversion he
// asked for in the same breath: on a document with NO block, *"the press writes block + verdict in
// one stroke, so nothing lives in the draft until he decides."*
//
// TWO CASES, ONE PRESS, AND THEY ARE NOT THE SAME WRITE. With a block present this is a remote —
// it must land on that block's own line, because a second verdict written anywhere else would make
// the document carry two answers and the whole point of `:::approval` is that the document IS the
// store. With no block, the press has to CREATE one, and where it goes decides whether the document
// still reads like a document afterwards.
//
// WHY THERE IS NO SECOND STORE AND NO NEW ATTRIBUTE: `verdict=approved|rejected` on the block is
// already what every reader checks (the band's unanswered scan, `tv`, the job document's
// binding-work rule). A chip that wrote its own field would be a second truth, and the first
// disagreement would be unfindable.

const BLOCK = /^(\s*):{3,}\s*approval\b([^\n]*)$/;

/**
 * Find the document's approval block, if it has one.
 * Returns `{ line, verdict, ask }` with a 1-BASED line — the base `setDirectiveAttr` counts in —
 * or `null`.
 *
 * THE FIRST ONE WINS. A document with two approval blocks is a document whose author meant two
 * different decisions, and a corner chip cannot know which; `multiple` says so to the caller so the
 * surface can refuse rather than guess at one.
 */
export function approvalOf(src) {
  const lines = String(src || "").split("\n");
  const found = [];
  for (let i = 0; i < lines.length; i += 1) {
    const m = BLOCK.exec(lines[i]);
    if (!m) continue;
    const attrs = m[2] || "";
    const v = /\bverdict=("[^"]*"|[^\s}]*)/.exec(attrs);
    const a = /\bask=("[^"]*"|[^\s}]*)/.exec(attrs);
    found.push({
      line: i + 1, // 1-based, because setDirectiveAttr does line - 1
      verdict: v ? v[1].replace(/^"|"$/g, "") : "",
      ask: a ? a[1].replace(/^"|"$/g, "") : "",
    });
  }
  if (!found.length) return null;
  return { ...found[0], multiple: found.length > 1, count: found.length };
}

/**
 * WHERE A NEW BLOCK GOES: at the END of the document, and the reason is not aesthetics.
 *
 * An approval wraps what is being decided, so inserting it mid-document would either swallow the
 * section it landed in front of or sit there wrapping nothing. At the end it wraps nothing either —
 * but at the end that reads correctly: the decision is about the document above it, which is how he
 * already writes them by hand ("the approval block at the bottom of them").
 *
 * Returns a 0-based insert position, because `insertAfterLine` counts from 0.
 */
export function verdictInsertAfter(src) {
  const lines = String(src || "").split("\n");
  let end = lines.length;
  while (end > 0 && !String(lines[end - 1]).trim()) end -= 1; // never after the trailing blanks
  return end;
}

const BODY = "The whole document above. Pressed from the corner, so nothing was wrapped by hand.";

/**
 * What the press must do. Pure — no document, no React, no write.
 *
 * - `{ kind: "attr", line, value }` — there is a block; set its verdict (or clear it).
 * - `{ kind: "insert", insertAfter, text }` — there is none; create it carrying the verdict.
 * - `{ kind: "refuse", why }` — two blocks, so the chip cannot know which decision is meant.
 */
export function verdictPlan(src, value) {
  const want = value === "approved" || value === "rejected" ? value : "";
  if (!want) return { kind: "refuse", why: "a verdict is approved or rejected" };
  const block = approvalOf(src);

  if (block && block.multiple) {
    return {
      kind: "refuse",
      // NAMED, not silent. A document with two decisions in it is a real thing he may have meant;
      // the honest answer is to send him to them rather than to pick one.
      why: `this document has ${block.count} approval blocks — press the one you mean`,
      line: block.line,
    };
  }

  if (block) {
    // PRESSING THE VERDICT YOU ALREADY GAVE CLEARS IT, the same rule the block's own buttons follow
    // — "I take that back" has to be expressible or the first press is a trap.
    const next = block.verdict === want ? "" : want;
    return { kind: "attr", line: block.line, value: next, cleared: next === "" };
  }

  // THE INVERSION: block and verdict in one stroke, so nothing sits in the draft until he decides.
  return {
    kind: "insert",
    insertAfter: verdictInsertAfter(src),
    text: `\n:::approval{ask="Approve this document?" verdict=${want}}\n${BODY}\n:::`,
    created: true,
  };
}

/** The label for the chip, so the corner says what pressing does rather than just showing a mark. */
export function verdictTitle(src, value) {
  const plan = verdictPlan(src, value);
  if (plan.kind === "refuse") return plan.why;
  if (plan.kind === "insert") return `${value === "approved" ? "Approve" : "Reject"} — writes an approval block into the document`;
  if (plan.cleared) return "Click again to withdraw";
  return `${value === "approved" ? "Approve" : "Reject"} — writes into the document's approval block`;
}
