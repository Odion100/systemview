import { unfenced } from "./unfenced";

// DECISIONS — THE RECORD OF A CHOICE, AND DELIBERATELY NOT AN APPROVAL.
//
// His, 2026-11-12, and the whole shape falls out of it: *"it's not a matter of approval… it's a
// matter of record. In the future it will matter and of course it's different from approval because
// MAKING A DECISION DOESN'T MEAN YOU HAVE THE APPROVAL. And when you think about it in an
// organization, it's different."*
//
// So this is not `::approval` with more attributes. An approval is one party SANCTIONING something
// and it gates the document. A decision is one party CHOOSING, it gates nothing, and whether anyone
// ever ratified it is a separate and often absent fact. The two can disagree in both directions:
// a decision made without authority, a decision made and never ratified, an approval given for a
// decision somebody else made. A block that collapsed them would make an organization's most
// common state unrepresentable.
//
// WHY A BLOCK AND NOT PROSE. A planning document today says `**DECIDE HERE:**` and then a numbered
// list, and that form can do none of the four things the record is for:
//
//   1. It has no ADDRESS, so nothing can point at it — not an objective it blocks, not a commit
//      that implements it, not a later decision that reverses it.
//   2. It has no STATE, in a document whose whole doctrine is that the document IS the state. Nine
//      sections of prose and no way to see what is still open.
//   3. Nothing can COUNT it. An arc has `::progress`; an RFC has `::claims`; a planning report had
//      nothing, so its first screen could not say what was still owed and by whom.
//   4. And the answer ERASES the question. Rewriting the section is right for describing a
//      mechanism — but `over=` is the road not taken, and that was never in the file, so git
//      cannot be the changelog for it. It is also the first thing anybody asks in a year.
//
// A PLAIN MODULE, like `claims.js` and `objectives.js`: no React, a line scan, so it answers for a
// document being typed into and is testable without mounting anything.

// `::decision[the fork, in one line]{attrs}` — leaf or container, two or more colons. The label is
// the QUESTION and it stays the question after the choice is made: a record that overwrote its own
// fork with the answer would lose the thing that makes it worth keeping.
const DECISION = /^\s*:{2,}decision\[(.*)\](?:\{([^}]*)\})?\s*$/;

export const STATES = ["decided", "reversed"];

// TOKENIZED, NEVER REGEXED THROUGH — a naive `(^|\s)key=` scan matches inside a QUOTED VALUE, so a
// `chose="state= stays"` would read as the state. Same rule both attribute writers learned.
const attrOf = (attrs, key) => {
  const re = /([A-Za-z_][\w-]*)=("[^"]*"|'[^']*'|[^\s}]*)/g;
  let m;
  while ((m = re.exec(attrs || ""))) {
    if (m[1] === key) return m[2].replace(/^["']|["']$/g, "");
  }
  return "";
};

export const names = (raw) =>
  String(raw || "")
    .split(/[|,]/)
    .map((s) => s.trim())
    .filter(Boolean);

// OPEN IS THE EMPTY STATE, and it is the honest default: a fork somebody wrote down and nobody has
// answered. Three states and no more — `blocked` was considered and left out, because a decision
// waiting on somebody is OPEN with an owner, and inventing a second word for it would let the same
// situation be filed two ways.
export const normalizeState = (raw) => {
  const s = String(raw || "").trim().toLowerCase();
  if (s === "decided" || s === "made") return "decided";
  if (s === "reversed" || s === "overturned" || s === "superseded") return "reversed";
  return "open";
};

// THE NEXT STATE A PRESS WRITES. Reversal is reachable only from decided — you cannot overturn a
// choice nobody made, and offering it on an open fork would invite a record of a reversal that
// never happened.
export const nextState = (state) => (normalizeState(state) === "decided" ? "reversed" : normalizeState(state) === "reversed" ? "open" : "decided");

/**
 * Every `::decision` in a document, in the order written, with the line it sits on so a press knows
 * where to write back.
 *
 * `awaiting` is the field his distinction lives in: a decision that has been MADE and still owes
 * somebody's ratification. It is only ever true when `ratify=` names someone — a decision nobody
 * has to sign is not pending anything, and defaulting every decision to unapproved would paint a
 * planning document amber for a question nobody asked.
 */
export function parseDecisions(source) {
  const lines = unfenced(source).split("\n");
  const out = [];
  for (let i = 0; i < lines.length; i += 1) {
    const m = DECISION.exec(lines[i]);
    if (!m) continue;
    const attrs = m[2] || "";
    const state = normalizeState(attrOf(attrs, "state"));
    const ratify = names(attrOf(attrs, "ratify"));
    const approved = names(attrOf(attrs, "approved"));
    const chose = attrOf(attrs, "chose").trim();
    out.push({
      n: out.length + 1,
      line: i + 1,
      question: m[1].trim(),
      id: attrOf(attrs, "id"),
      state,
      // TWO PARTIES, NOT ONE ATTRIBUTE WEARING TWO MEANINGS. `owner` is who OWES the answer while
      // the fork is open; `by` is who actually made the call. They are usually the same name and
      // they are not the same fact — a decision taken by somebody it was not assigned to is
      // exactly the thing an organization's record has to be able to show.
      owner: names(attrOf(attrs, "owner")),
      // WHAT WAS CHOSEN, and WHAT IT WAS CHOSEN OVER. `over` is the half that only a record can
      // carry: the rejected road is never in the document after the section is rewritten, and it is
      // the first thing anybody asks about a decision they did not sit in on.
      chose,
      over: names(attrOf(attrs, "over")),
      // DECIDED WITH NOTHING SAID IS A STATE, NOT AN ERROR — rendered as such, the way an
      // unexplained blocked objective is. A reader cannot otherwise tell "nobody wrote what was
      // chosen" from "there was nothing to choose".
      unsaid: state === "decided" && !chose,
      // THE MIRROR OF `unsaid`, and it came out of the first live meeting that used this block: an
      // OPEN decision already carrying the answer somebody gave in the room. It is a legitimate
      // state — captured, not confirmed — and counting it as plainly "open" told him 12 were owed
      // by him when one of them had his own words in it.
      answered: state === "open" && !!chose,
      by: names(attrOf(attrs, "by")),
      at: Number(attrOf(attrs, "at")) || 0,
      ratify,
      approved,
      awaiting: state === "decided" && ratify.length > 0 && !ratify.every((r) => approved.includes(r)),
    });
  }
  return out;
}

/** The count a `::decisions` block draws. Derived every render; stored nowhere. */
export function decisionsOf(source) {
  const all = parseDecisions(String(source || ""));
  const decided = all.filter((d) => d.state === "decided");
  return {
    all,
    total: all.length,
    open: all.filter((d) => d.state === "open").length,
    decided: decided.length,
    reversed: all.filter((d) => d.state === "reversed").length,
    // AWAITING RATIFICATION — made, and still owed a signature. The number that exists only because
    // a decision and an approval are different acts.
    awaiting: decided.filter((d) => d.awaiting).length,
    // MADE AND NOT EXPLAINED. Counted separately rather than folded into `decided`, because a
    // decision with no `chose=` is a record of the wrong half: it says the choice was made and not
    // which way, which is worse than leaving it open.
    unsaid: decided.filter((d) => d.unsaid).length,
    // ANSWERED IN THE ROOM, NOT YET CLOSED. Subtracted from what is genuinely waiting on somebody,
    // because "12 open and all owed by him" is a different sentence when one of them already holds
    // his answer.
    answered: all.filter((d) => d.answered).length,
  };
}

/**
 * Who still owes an answer — ids grouped by the `owner` on the open ones.
 *
 * THE UNNAMED ARE A GROUP OF THEIR OWN, never dropped. An open decision with no owner is the
 * commonest real state (a fork noticed while writing, assigned to nobody yet) and the one most
 * worth seeing, because nothing will ever chase it.
 */
/**
 * EVERY DECISION AS A PRESSABLE CHIP, IN DOCUMENT ORDER, CARRYING ITS STATE.
 *
 * The owed line answers "whose answer is missing", so it holds only what is OPEN — which means
 * every chip in it is the same state and colour there would say nothing. His ask was the other
 * question: *"you have basically [a chip] to each decision… it would be helpful if you could tell
 * which ones [are] decided or not. I think color would…"* — so this is the whole set, which makes
 * the roll-up a MAP of the document rather than only a list of what it still owes.
 *
 * `tone` IS THE BAR'S OWN VOCABULARY, deliberately: the chips take the colour of the segment they
 * belong to, so the bar and the row cannot disagree and the row IS the legend. Nothing has to be
 * explained, which is the same reason the bar was built out of the counts' colours in the first
 * place.
 *
 * THE ORDER OF THE TESTS IS THE PRECEDENCE AND IT IS NOT ARBITRARY. A reversed decision reads
 * reversed whatever it once chose. `unsaid` beats `decided` because a choice with no `chose=` is
 * the wrong half of a record and must not wear the colour of a finished one. `awaiting` beats
 * `decided` because the signature is the outstanding thing. `answered` beats `open` because an
 * answer sitting in an unclosed fork is not the same as silence.
 */
export function decisionIndex(source) {
  return parseDecisions(String(source || "")).map((d) => ({
    id: d.id || `#${d.n}`,
    line: d.line,
    n: d.n,
    // WHOSE IT IS, ON THE ROW RATHER THAN IN A GROUP HEADING. `owner` owes the answer while the
    // fork is open; `by` made the call once it closed — two different facts, and which one applies
    // is decided by the state rather than by preferring one attribute.
    who: (d.state === "open" ? d.owner : d.by).join(", "),
    tone:
      d.state === "reversed"
        ? "reversed"
        : d.state === "decided"
          ? d.unsaid
            ? "unsaid"
            : d.awaiting
              ? "awaiting"
              : "decided"
          : d.answered
            ? "answered"
            : "open",
  }));
}

export function owedBy(source) {
  const out = new Map();
  parseDecisions(String(source || ""))
    .filter((d) => d.state === "open")
    .forEach((d) => {
      const who = d.owner.length ? d.owner : ["nobody named"];
      // THE LINE TRAVELS WITH THE ID, because the id on its own can only be read — and his ask is
      // that it be PRESSED: *"I think you should be able to click one of those and then bring you
      // right to the block. It becomes an easy communication method when we're talking in a
      // conversation and you try to capture something — now I know exactly what it is, I come here
      // and I can find it easily."* An address you can say out loud and then press is the whole
      // point of giving a decision an id in the first place.
      const row = { id: d.id || `#${d.n}`, line: d.line, n: d.n };
      who.forEach((w) => out.set(w, [...(out.get(w) || []), row]));
    });
  return out;
}
