// HAS THIS DOCUMENT CHANGED — one definition, read from both buildings.
//
// WHY IT LIVES HERE, IN CommonJS, UNDER src/. The window asks this question while he types and the
// hub asks it across a folder, and they have to give the same answer or the band's count argues
// with the chip in the document. They were two implementations and they drifted three times: the
// hub learned to ignore a thread's own bookkeeping and the window never did, so removing somebody
// from a thread made every DOCUMENT member behind. CRA will not import from outside `src/`, and the
// npm package does not ship `src/` — so this is a CommonJS module inside `src/shared`, imported by
// the window and required by the hub, with `src/shared/` added to the package's `files`. One file,
// no build step, no copy to drift.
//
// THE RULE, AND IT IS UNIVERSAL ACROSS BLOCKS: an update is owed when the document's CONTENT moves
// — prose edited, a reply added, a thread or a block created. Never when a SUBSCRIPTION moves.
// Subscriptions are not a thread feature: `subscribe=` already names an audience on `::commit`,
// `:::cmd`, `::run`, `::test`, `::branch` and `:::approval`, and every block added later will carry
// one too. So the audience attributes are stripped from EVERY directive line rather than one block
// shape being special-cased — a rule written per block is a rule that is wrong about the next block.
const AUDIENCE_ATTRS = ["who", "subscribe", "members", "sent", "auto"];

// WHICH ONE NAMES THE AUDIENCE, in the order to believe them: RFC-073 §2.1 renamed `members=` to
// `subscribe=` and both still appear in live documents, so the precedence is a fact about the
// vocabulary rather than a detail of whoever is reading a line.
const AUDIENCE_KEYS = ["subscribe", "members", "who"];

// THE BAG IS TOKENIZED, NEVER REGEXED THROUGH. A naive `(^|\s)key=` scan matches inside a QUOTED
// VALUE — a claim whose note said "told= is the baseline" once had a stamp written into the note's
// prose — so the inner bag is split into real pairs, quotes respected, and rebuilt. The writer
// (attrBag.js) and this hasher must agree about what an attribute IS, which is why they share one
// tokenizer instead of each carrying its own.
function parseAttrBag(inner) {
  const pairs = [];
  const re = /([A-Za-z_][\w-]*)=("[^"]*"|'[^']*'|[^\s}]*)|(\S+)/g;
  let m;
  while ((m = re.exec(inner))) {
    if (m[1]) pairs.push({ key: m[1], val: m[2] });
    else pairs.push({ key: null, val: m[3] });
  }
  return pairs;
}

const attrBagToString = (pairs) => pairs.map((p) => (p.key ? `${p.key}=${p.val}` : p.val)).join(" ");

// Colons, a block name, and — for a line that carries attributes at all — its bag closing the line.
// THE BAG IS THE BRACES AT THE END, never the first on the line: a claim's label may quote a block
// (`::claim[Write \`::rfc{id=…}\` …]{id=c8}`) and matching the first braces reaches into the example.
const DIRECTIVE = /^\s*:{2,}\s*[A-Za-z][\w-]*/;
const BAG = /\{([^}]*)\}\s*$/;

// WHAT THE AUDIENCE ATTRIBUTES DO NOT GET TO DO: move the hash. Everything else on the line still
// counts — `id=`, `state=`, `ask=`, a lifecycle stamp — so this is narrower than dropping the whole
// bag, which is what the hub used to do to thread openers. Dropping the bag means a real attribute
// change on that line stops counting, silently, for every attribute anybody adds later.
function stripAudience(row) {
  const line = String(row);
  if (!DIRECTIVE.test(line)) return line;
  const braces = line.match(BAG);
  if (!braces) return line;
  const pairs = parseAttrBag(braces[1]);
  const kept = pairs.filter((p) => !AUDIENCE_ATTRS.includes(p.key));
  if (kept.length === pairs.length) return line;
  // `{}` and not "" — the brace pair is part of the line's shape, and a document whose thread
  // openers collapse to bare `::::thread` would hash the same as one that never had attributes.
  return line.slice(0, braces.index) + `{${attrBagToString(kept)}}` + line.slice(braces.index + braces[0].length);
}

// WHAT COUNTS AS THE DOCUMENT, for "has this changed since you were told".
//
// The `::members` line goes ENTIRELY, rather than being stripped to `::members{}`: a document
// GAINING membership is not a change to the document either, and a line appearing would be one.
// Every other directive keeps its line and loses only its audience.
const bodyOf = (src) =>
  String(src || "")
    .split("\n")
    .filter((l) => !/^\s*::members\b/.test(l))
    .map(stripAudience)
    .join("\n");

// A SMALL, STABLE, NON-CRYPTOGRAPHIC HASH (FNV-1a). It is a change DETECTOR, not a signature:
// nothing security-shaped rests on it, and the cost of a collision is one unsent update, so 32
// bits of it in base 36 is the right size for something that has to sit in a markdown attribute
// and still be readable.
const hashOf = (src) => {
  const s = bodyOf(src);
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(36);
};

module.exports = { AUDIENCE_ATTRS, AUDIENCE_KEYS, parseAttrBag, attrBagToString, stripAudience, bodyOf, hashOf };
