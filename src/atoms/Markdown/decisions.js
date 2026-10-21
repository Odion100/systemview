// A WRITE-BACK IS A DECISION, AND A DECISION IS NEWS — the pure half of that, so it can be proven.
//
// WHAT WAS WRONG. `:::approval` writes `verdict=approved` into the document and stops. The whole
// handshake was "read it back off the document later", which means somebody has to think to look.
// Measured this run with the documents verb: `RFCs/RFC-072-arc-planning-and-execution.md` reads
// *behind: systemview-test* — the RFC was approved, the verdict is in the file, and the agent that
// wrote the RFC found out because he said so in the chat. A decision nobody is told about is a
// decision that has not been made yet, as far as the room is concerned.
//
// HIS FRAME, AND IT IS WHY THIS IS NOT AN APPROVAL FEATURE: *"it's not just approval… as we update
// many more parts of the document, the interactive markdown, you got to think about them following
// the same system."* So the unit is the WRITE-BACK — `verdict=` on an approval, `answer=` on a
// question, a ticked task — and each one rides the delivery path that already exists rather than
// getting its own.
//
// WHY A PRESS JUMPS THE QUEUE. Prose keeps the 20-second quiet and the pinned send, because an
// unfinished paragraph is not a decision and announcing every keystroke is the flood that rule
// exists to prevent. A press is different in kind: it is complete the instant it happens, it is
// never half-made, and it is the thing the other members were waiting on.

const firstWords = (s, n = 90) => {
  const t = String(s || "").replace(/\s+/g, " ").trim();
  return t.length > n ? `${t.slice(0, n - 1)}…` : t;
};

/**
 * WHAT THE PRESS SAYS. The old sends were all shaped "a thread you are in moved" — and autobot
 * filed that as a bug the first time it received one, because "moved" sent it to open a document
 * and work out what had changed. A decision can say exactly what happened in one line, so it does.
 *
 * `kind` is the block, `attrs` its attributes, `value` what was just written, `by` who pressed.
 * An empty value means the press CLEARED it — "I take that back" is expressible in these blocks
 * and must be expressible in the message, or the room is told the opposite of what happened.
 */
export function decisionSummary({ kind, attrs = {}, value, by = "" } = {}) {
  const who = String(by || "").trim();
  const said = (text) => (who ? `${who} ${text}` : text);
  const ask = firstWords(attrs.ask || attrs.label || attrs.question || "");

  if (kind === "approval") {
    if (!value) return said(`withdrew a verdict${ask ? ` on: ${ask}` : ""}`);
    return said(`${value}${ask ? `: ${ask}` : " something in this document"}`);
  }

  if (kind === "question") {
    if (!value) return said(`cleared an answer${ask ? ` to: ${ask}` : ""}`);
    return said(`answered ${value}${ask ? ` to: ${ask}` : ""}`);
  }

  if (kind === "task") {
    const label = firstWords(attrs.label || "");
    return said(`${value ? "ticked" : "unticked"} a task${label ? `: ${label}` : ""}`);
  }

  // An unknown block still produces a true sentence rather than an empty one — a send with no
  // summary is the "moved" problem wearing a different hat.
  return said(`changed ${kind || "something"} in this document`);
}

/**
 * IS THIS WRITE A DECISION? Not every `setAttr` is. Dragging a slider is a value being explored,
 * and announcing it would be the keystroke flood the quiet period exists to stop — so the list is
 * explicit and short rather than "anything that writes back".
 */
export const DECIDING = { approval: "verdict", question: "answer", task: "checked" };

export const isDecision = (kind, key) =>
  !!kind && Object.prototype.hasOwnProperty.call(DECIDING, kind) && DECIDING[kind] === key;


// THE WORDS A TICKED TASK IS ABOUT. An approval has `ask=` and a question has its label; a GFM
// checklist has neither — it is `- [ ] rebuild the bundle`, with the text in the line rather than
// in an attribute. So the label is read off the source line, using the SAME shape `toggleTaskLine`
// matches, because a label that disagreed with what was toggled would quote the wrong task.
//
// Markdown is stripped rather than rendered: this ends up inside a sentence pushed into somebody's
// session, where `**bold**` and a link's brackets are noise. The text is what was decided; the
// formatting was for the page it came from.
const TASK = /^(\s*(?:[-*+]|\d+[.)])\s+)\[([ xX])\]\s*(.*)$/;

export function taskLabelOf(source, line) {
  const lines = String(source || "").split("\n");
  const i = Number(line) - 1;
  if (!Number.isInteger(i) || i < 0 || i >= lines.length) return "";
  const m = TASK.exec(lines[i]);
  if (!m) return ""; // not a task line — say nothing rather than quote a paragraph
  return String(m[3] || "")
    .replace(/`([^`]*)`/g, "$1")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/(\*\*|__|\*|_|~~)/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

const decisions = { decisionSummary, isDecision, DECIDING, taskLabelOf };
export default decisions;
