const test = require("node:test");
const assert = require("node:assert");
const { servesOf, shasIn, sameSha, audit } = require("./commitLinks");

// WHAT THESE PIN. The link between a commit and the work it served has to be readable by a machine
// in BOTH directions or it is decoration — so: the trailer is parsed by git's own rule and not
// approximately, the document's side is read off its `::commit` blocks, and the audit can say
// which of the four ways they disagree.

test("the ids a commit serves come off the trailer block", () => {
  assert.deepStrictEqual(servesOf("feat: a thing\n\nwhy it is good\n\nServes: ARC-004-O2"), ["ARC-004-O2"]);
  assert.deepStrictEqual(
    servesOf("x\n\nServes: RFC-073\nServes: G-12"),
    ["RFC-073", "G-12"],
    "repeated trailers are how one commit serves several",
  );
  // THE VALUE IS THE WHOLE LINE. A report's id is its TITLE — spaces, commas and all — so a
  // parser that split on either would shred the id of the very documents this reaches for.
  assert.deepStrictEqual(
    servesOf('x\n\nServes: Do the skills match, and where do they not?'),
    ["Do the skills match, and where do they not?"],
    "a report id is a title: commas and spaces are part of it, never separators",
  );
  assert.deepStrictEqual(servesOf("x\n\nserves: rfc-073"), ["rfc-073"], "the key is case-insensitive, the id is not");
});

// THE RULE THAT MATTERS, because the lenient version is worse than nothing: a parser that scans
// the whole message would read `Serves: ARC-004-O2` out of a commit QUOTING the convention — which
// this repo's own commits do — and attribute work to a document nobody touched.
test("only the final trailer block counts — Serves in prose is prose", () => {
  assert.deepStrictEqual(servesOf("feat: x\n\nI wrote Serves: ARC-004-O2 in the doc as an example.\n"), []);
  assert.deepStrictEqual(
    servesOf("feat: x\n\nServes: ARC-001\n\nand then more prose after it"),
    [],
    "a block that is not last is not a trailer block",
  );
  assert.deepStrictEqual(
    servesOf("feat: x\n\nsome prose\nServes: ARC-001"),
    [],
    "git needs the blank line — a trailer glued to a paragraph is part of the paragraph",
  );
});

test("a commit that serves nothing answers empty, never throws", () => {
  assert.deepStrictEqual(servesOf(""), []);
  assert.deepStrictEqual(servesOf(null), []);
  assert.deepStrictEqual(servesOf("fix: a typo"), []);
});

test("the document's side is its ::commit blocks", () => {
  assert.deepStrictEqual(shasIn("::commit{sha=921e8c88}"), ["921e8c88"]);
  assert.deepStrictEqual(shasIn('text ::commit{message="x" sha="4ce4444"} more'), ["4ce4444"]);
  assert.deepStrictEqual(shasIn("::commit{message=\"not done yet\"}"), [], "an unpressed offer carries no sha");
  assert.deepStrictEqual(shasIn("::commit{sha=aaa1} and ::commit{sha=aaa1}"), ["aaa1"], "the same sha once");
});

// GIT ABBREVIATES, and the two sides are written by different hands at different lengths — a
// document stamped with a short sha against a full-length log would read as a total mismatch.
test("an abbreviated sha and a full one are the same commit", () => {
  assert.ok(sameSha("921e8c88", "921e8c8812ab34"));
  assert.ok(sameSha("921e8c8812ab34", "921e8c88"));
  assert.ok(!sameSha("921e8c88", "4ce4444"));
  assert.ok(!sameSha("", "921e8c88"));
});

const doc = (id, text, path = `RFCs/${id}.md`) => ({ id, kind: "rfc", path, text });

test("agreement is both directions pointing at each other", () => {
  const r = audit({
    commits: [{ sha: "aaa1111", subject: "feat", message: "feat\n\nServes: RFC-073" }],
    documents: [doc("RFC-073", "body\n\n::commit{sha=aaa1111}")],
  });
  assert.strictEqual(r.agreed, true);
  assert.strictEqual(r.linked, 1);
  assert.deepStrictEqual([r.unlinked, r.dangling, r.oneWay, r.unclaimed], [[], [], [], []]);
});

test("ONE WAY — the commit names the plan and the plan does not carry the commit", () => {
  const r = audit({
    commits: [{ sha: "aaa1111", subject: "feat", message: "feat\n\nServes: RFC-073" }],
    documents: [doc("RFC-073", "body with no commit block")],
  });
  assert.strictEqual(r.agreed, false);
  assert.strictEqual(r.oneWay.length, 1);
  assert.strictEqual(r.oneWay[0].id, "RFC-073");
  assert.strictEqual(r.oneWay[0].path, "RFCs/RFC-073.md", "the finding says where to go and fix it");
});

test("DANGLING — serving an id no registered document has", () => {
  const r = audit({
    commits: [{ sha: "aaa1111", subject: "feat", message: "feat\n\nServes: RFC-999" }],
    documents: [doc("RFC-073", "")],
  });
  assert.strictEqual(r.dangling.length, 1);
  assert.strictEqual(r.dangling[0].id, "RFC-999");
  assert.strictEqual(r.oneWay.length, 0, "a dangling id is not also counted as one-way");
});

test("UNCLAIMED — the document names a sha whose commit points somewhere else, or nowhere", () => {
  const r = audit({
    commits: [{ sha: "aaa1111", subject: "feat", message: "feat\n\nServes: G-12" }],
    documents: [doc("RFC-073", "::commit{sha=aaa1111}"), { id: "G-12", kind: "gap", path: "G-12.md", text: "::commit{sha=aaa1111}" }],
  });
  assert.deepStrictEqual(r.unclaimed.map((u) => u.id), ["RFC-073"], "only the document the commit did not name");
});

// A COMMIT WE WERE NOT HANDED IS NOT A FINDING. The audit runs over a window of history; a sha
// older than the window is absent, and reporting absence as a broken link would make every audit
// noisier the further back a document reaches.
test("a sha outside the window of commits is left alone", () => {
  const r = audit({ commits: [], documents: [doc("RFC-073", "::commit{sha=deadbee}")] });
  assert.deepStrictEqual(r.unclaimed, []);
  assert.strictEqual(r.agreed, true);
});

test("UNLINKED is counted but does not break agreement — a typo fix serves nothing", () => {
  const r = audit({ commits: [{ sha: "aaa1111", subject: "fix a typo", message: "fix a typo" }], documents: [] });
  assert.strictEqual(r.unlinked.length, 1);
  assert.strictEqual(r.linked, 0);
  assert.strictEqual(r.agreed, true);
});

test("one commit serving several documents is checked against each", () => {
  const r = audit({
    commits: [{ sha: "aaa1111", subject: "feat", message: "feat\n\nServes: RFC-073\nServes: ARC-004-O2" }],
    documents: [doc("RFC-073", "::commit{sha=aaa1111}"), { id: "ARC-004-O2", kind: "arc", path: "a.md", text: "" }],
  });
  assert.strictEqual(r.oneWay.length, 1);
  assert.strictEqual(r.oneWay[0].id, "ARC-004-O2");
});
