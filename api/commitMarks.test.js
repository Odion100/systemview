const test = require("node:test");
const assert = require("node:assert");
const { marksFromDiff, markLookup } = require("./commitMarks");

// THE FIXTURES ARE REAL `git diff --unified=0` OUTPUT. A hand-written approximation of a diff is
// the one fixture that cannot catch the bug this parser exists to avoid — `,n` is omitted when n
// is 1, and an invented fixture that always writes the count tests a format git never emits.

test("a one-line addition — the count git OMITS", () => {
  // `+12` with no `,1`. Reading the absent group as 0 marks nothing at all, which is the whole
  // failure: the commonest change in any commit is a single line.
  const m = marksFromDiff("@@ -11,0 +12 @@\n+  const x = 1;\n");
  assert.deepStrictEqual(m.added, [12]);
  assert.deepStrictEqual(m.removed, []);
});

test("a run of added lines marks every one of them", () => {
  const m = marksFromDiff("@@ -40,0 +41,3 @@\n+a\n+b\n+c\n");
  assert.deepStrictEqual(m.added, [41, 42, 43]);
});

test("a pure deletion has no line of its own — it is the gap it left", () => {
  // Nothing was added, so there is no line in THIS file to mark. `+7,0` means the removed run sat
  // after line 7.
  const m = marksFromDiff("@@ -8,3 +7,0 @@\n-gone\n-gone\n-gone\n");
  assert.deepStrictEqual(m.added, []);
  assert.deepStrictEqual(m.removed, [{ after: 7, count: 3 }]);
});

test("a deletion at the very top anchors at 0, not 1", () => {
  // The off-by-one that looks right everywhere else. `after: 1` would draw the gap below the first
  // surviving line instead of above it.
  const m = marksFromDiff("@@ -1,2 +0,0 @@\n-first\n-second\n");
  assert.deepStrictEqual(m.removed, [{ after: 0, count: 2 }]);
});

test("a one-for-one replacement is an added line and NO gap", () => {
  const m = marksFromDiff("@@ -5 +5 @@\n-old\n+new\n");
  assert.deepStrictEqual(m.added, [5]);
  assert.deepStrictEqual(m.removed, []);
});

test("three lines becoming one keeps the shortfall — the count is the point", () => {
  // Collapsing this to "changed" would throw away that two lines are gone. The bar that says
  // nothing is exactly what this avoids.
  const m = marksFromDiff("@@ -5,3 +5 @@\n-a\n-b\n-c\n+one\n");
  assert.deepStrictEqual(m.added, [5]);
  assert.deepStrictEqual(m.removed, [{ after: 5, count: 2 }]);
});

test("one line becoming three is all additions and no gap", () => {
  const m = marksFromDiff("@@ -5 +5,3 @@\n-a\n+x\n+y\n+z\n");
  assert.deepStrictEqual(m.added, [5, 6, 7]);
  assert.deepStrictEqual(m.removed, []);
});

test("several hunks in one file, ascending and deduplicated", () => {
  const diff = [
    "diff --git a/src/x.js b/src/x.js",
    "index 1111111..2222222 100644",
    "--- a/src/x.js",
    "+++ b/src/x.js",
    "@@ -3,0 +4 @@",
    "+added near the top",
    "@@ -20,2 +21,0 @@",
    "-cut",
    "-cut",
    "@@ -40 +39,2 @@",
    "-replaced",
    "+with",
    "+two",
    "",
  ].join("\n");
  const m = marksFromDiff(diff);
  assert.deepStrictEqual(m.added, [4, 39, 40]);
  assert.deepStrictEqual(m.removed, [{ after: 21, count: 2 }]);
});

test("a new file is entirely added", () => {
  const m = marksFromDiff("@@ -0,0 +1,4 @@\n+a\n+b\n+c\n+d\n");
  assert.deepStrictEqual(m.added, [1, 2, 3, 4]);
});

test("a binary file says so, which is not the same as changing nothing", () => {
  // An empty mark set over a binary file would render as a blank, unchanged preview of something
  // that cannot be previewed at all.
  const m = marksFromDiff("diff --git a/logo.png b/logo.png\nBinary files a/logo.png and b/logo.png differ\n");
  assert.strictEqual(m.binary, true);
  assert.deepStrictEqual(m.added, []);
});

test("an empty diff is an answer, not a failure", () => {
  // A commit can touch only a file's mode, and the caller may ask about a path the commit never
  // went near. Both are "nothing changed here", and neither is an error.
  for (const empty of ["", null, undefined, "diff --git a/x b/x\nold mode 100644\nnew mode 100755\n"]) {
    const m = marksFromDiff(empty);
    assert.deepStrictEqual(m.added, []);
    assert.deepStrictEqual(m.removed, []);
    assert.strictEqual(m.binary, false);
  }
});

test("a line of prose that looks like a hunk header is not one", () => {
  // The body of a diff can contain anything, including the text of a diff. The header match is
  // anchored at the start of the line and the leading `+` of an added line defeats it.
  const m = marksFromDiff("@@ -1,0 +1 @@\n+// see @@ -99,5 +99,7 @@ for the old shape\n");
  assert.deepStrictEqual(m.added, [1]);
});

test("the lookup folds several gaps at one boundary into their total", () => {
  const look = markLookup({ added: [2, 3], removed: [{ after: 5, count: 1 }, { after: 5, count: 2 }] });
  assert.strictEqual(look.isAdded(2), true);
  assert.strictEqual(look.isAdded(4), false);
  assert.strictEqual(look.gapAfter(5), 3);
  assert.strictEqual(look.gapAfter(6), 0);
});

test("the lookup survives being handed nothing", () => {
  const look = markLookup();
  assert.strictEqual(look.isAdded(1), false);
  assert.strictEqual(look.gapAfter(1), 0);
});
