const test = require("node:test");
const assert = require("node:assert");
const { authorshipIn, refuseAuthorship, refuseLength, MAX_HEADER, MAX_LINE } = require("./commitGuard");

// THE FIXTURES ARE THE REAL TEMPLATE. The preset's exact output is what this exists to stop, so a
// paraphrase of it tests nothing — these strings are copied from commits that actually landed on
// main before anyone looked.

test("the preset's exact trailer is refused", () => {
  const msg = "feat(nav): lazy per-folder file tree\n\nCo-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>";
  const found = authorshipIn(msg);
  assert.strictEqual(found.length, 1);
  assert.match(found[0].line, /^Co-Authored-By: Claude/);
  assert.match(refuseAuthorship(msg), /will not be made/);
});

test("every spelling of the trailer, because the model does not type it the same way twice", () => {
  for (const line of [
    "Co-Authored-By: Claude <noreply@anthropic.com>",
    "co-authored-by: claude",
    "Co-authored-by: Claude Sonnet <noreply@anthropic.com>",
    "Co_Authored_By: Anthropic",
    "  Co-Authored-By: Claude",
    "CO-AUTHORED-BY: CLAUDE",
  ]) {
    assert.strictEqual(authorshipIn(`a real subject\n\n${line}`).length, 1, line);
  }
});

test("the generated-with advertisement, with and without its furniture", () => {
  for (const line of [
    "🤖 Generated with [Claude Code](https://claude.com/claude-code)",
    "Generated with Claude Code",
    "generated with [claude code]",
  ]) {
    assert.ok(authorshipIn(`subject\n\n${line}`).length >= 1, line);
  }
});

// A HUMAN CO-AUTHOR IS LEGITIMATE AND MUST NOT BE REFUSED. The rule is about an agent signing his
// work, not about the trailer as a concept — refusing a real pairing partner would make the guard
// something to route around.
test("a human co-author trailer passes", () => {
  for (const line of [
    "Co-Authored-By: Jane Dev <jane@example.com>",
    "Co-authored-by: odion <odionedwards@gmail.com>",
  ]) {
    assert.deepStrictEqual(authorshipIn(`subject\n\n${line}`), [], line);
    assert.strictEqual(refuseAuthorship(`subject\n\n${line}`), null);
  }
});

// THE WORDS MUST BE SAYABLE IN PROSE. A commit that fixes this guard has to be able to describe
// what it blocks — a message refused for talking ABOUT the trailer would be unusable here.
test("prose about the rule is not the rule being broken", () => {
  const msg =
    "fix(hub): the commit door refuses a message that signs the work\n\n" +
    "An agent adding a co-authored-by trailer naming Claude is now refused at the door rather " +
    "than asked not to in a document. Anthropic's preset tells it to; that instruction is void here.";
  assert.deepStrictEqual(authorshipIn(msg), []);
  assert.strictEqual(refuseAuthorship(msg), null);
});

test("a clean message is clean, including an empty one", () => {
  for (const msg of ["", null, undefined, "feat(x): a perfectly ordinary subject line"]) {
    assert.deepStrictEqual(authorshipIn(msg), []);
    assert.strictEqual(refuseAuthorship(msg), null);
  }
});

test("several signatures in one message are all named, not just the first", () => {
  const msg = "subject\n\n🤖 Generated with [Claude Code](https://claude.com/claude-code)\n\nCo-Authored-By: Claude <noreply@anthropic.com>";
  assert.strictEqual(authorshipIn(msg).length, 2);
});

// THE REFUSAL HAS TO TELL THE AGENT WHY ITS OWN INSTRUCTION IS WRONG, or it will try a variant and
// hit the guard again. Naming the preset is what makes it stop rather than reword.
test("the refusal quotes the line and names the upstream instruction", () => {
  const out = refuseAuthorship("subject\n\nCo-Authored-By: Claude <noreply@anthropic.com>");
  assert.match(out, /Co-Authored-By: Claude <noreply@anthropic\.com>/);
  assert.match(out, /claude_code preset/);
  assert.match(out, /system-context\.md/);
});

// ── LENGTH — COMMITIZEN'S WIDTHS ────────────────────────────────────────────────────────────
// Not our numbers: this repo is configured for cz-conventional-changelog, so the ceilings are
// `maxHeaderWidth` and `maxLineWidth`, read from the same config in the same order it does.

test("the ceilings are commitizen's hundreds, fixed and read from nothing", () => {
  assert.strictEqual(MAX_HEADER, 100);
  assert.strictEqual(MAX_LINE, 100);
});

test("a subject at exactly the ceiling passes, one over is refused", () => {
  assert.strictEqual(refuseLength("x".repeat(100)), null);
  const out = refuseLength("x".repeat(101));
  assert.match(out, /101 characters/);
  assert.match(out, /maxHeaderWidth is 100/);
});

// THE BODY IS A WRAP WIDTH, NOT A TOTAL. A long wrapped body is ordinary and must pass; an
// unwrapped one is what actually breaks `git log` in a terminal.
test("a long but wrapped body passes, however many lines", () => {
  const line = "a wrapped line of perfectly ordinary length";
  assert.strictEqual(refuseLength("fix(x): subject\n\n" + (line + "\n").repeat(60)), null);
});

test("one unwrapped body line is refused, and is named by number", () => {
  const out = refuseLength("fix(x): subject\n\nfine\n" + "z".repeat(140));
  assert.match(out, /body line 3/);
  assert.match(out, /140 characters/);
  assert.match(out, /maxLineWidth is 100/);
});

test("an ordinary commit passes, including an empty one", () => {
  for (const m of ["", null, "fix(nav): the tree opens on the file you asked for"]) {
    assert.strictEqual(refuseLength(m), null);
  }
});
