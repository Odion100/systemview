const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");

// ONE GRAMMAR, TWO FILES — and this is what keeps them one.
//
// `:::run` check lines are parsed in two places: the window's `src/atoms/Markdown/blocks/RunBlock.js`
// (React, browser) and the headless `testing-utilities/runSpec.js` (CJS, what `runProofs` uses).
// They cannot share a module — CRA's module scope will not import from outside `src/` — so the
// duplication is structural, and duplication without a check is drift with a delay.
//
// IT HAD ALREADY DRIFTED. The window grew a NAMED form (`path includes manager`, `path minLength 2`)
// off the validator names; the headless copy kept five symbols. So one `:::run` fold ran clean under
// a press in the window and came back from `runProofs` with *"2 assertions couldn't be read"* —
// one document, two doors, two answers. Measured 2026-11-11: a step with `includes` and `minLength`
// kept one evaluation of three headless and three of three in the window.
//
// WHAT THIS CAN AND CANNOT SAY. It compares the SHAPES both files parse by, not their behaviour —
// two files could agree here and still differ in a branch. It is the cheap check that catches the
// way this actually went wrong: one side gaining a form the other never heard of.
const read = (rel) => fs.readFileSync(path.join(__dirname, "..", rel), "utf8");
const WINDOW = read("src/atoms/Markdown/blocks/RunBlock.js");
const HEADLESS = read("testing-utilities/runSpec.js");

// The alternation inside the symbol matcher, e.g. `>=|<=|==|=|~`.
const symbolOps = (src) => {
  const m = src.match(/match\(\s*\/\^\(\\S\+\)\\s\*\(([^)]+)\)\\s\*\(\.\+\)\$\//);
  return m ? m[1].split("|") : null;
};

test("both copies accept the same SYMBOL operators", () => {
  const w = symbolOps(WINDOW);
  const h = symbolOps(HEADLESS);
  // A null here means the regex moved and this check stopped seeing anything — which would pass
  // forever while saying nothing, the failure mode every guard in this repo is written against.
  assert.ok(w && w.length >= 4, `the window's operator list was not found: ${JSON.stringify(w)}`);
  assert.ok(h && h.length >= 4, `the headless operator list was not found: ${JSON.stringify(h)}`);
  assert.deepStrictEqual(h, w, "a symbol one door accepts and the other does not is a document that behaves differently depending on who runs it");
});

test("both copies accept the NAMED form, matched the same way", () => {
  const named = /\/\^\(\\S\+\)\\s\+\(\[A-Za-z\]\[A-Za-z0-9\]\*\)\\s\+\(\.\+\)\$\//;
  assert.match(WINDOW, named, "the window's named matcher");
  assert.match(HEADLESS, named, "the headless named matcher — absent until 2026-11-11, which is the drift this file exists for");
});

test("both copies translate the length names to the same numeric claim", () => {
  const table = (src) => (src.match(/LENGTH_TO_NUMERIC\s*=\s*\{[^}]*\}/) || [""])[0].replace(/\s+/g, " ");
  const w = table(WINDOW);
  assert.ok(w.includes("lengthEquals"), "the window's translation table was not found");
  assert.strictEqual(table(HEADLESS), w, "`minLength 2` has to mean the same claim at both doors");
});

test("both copies agree which names take a NUMBER on the right", () => {
  const nums = (src) => (src.match(/NUMERIC_VALUES\s*=\s*\[[^\]]*\]/) || [""])[0].replace(/\s+/g, " ");
  const w = nums(WINDOW);
  assert.ok(w.includes("numEquals"), "the window's numeric list was not found");
  assert.strictEqual(nums(HEADLESS), w);
});

test("the headless names come off VALIDATION_NAMES, so a new validator needs no edit here", () => {
  // The window builds its table from `validationOptions`; this copy builds it from
  // `VALIDATION_NAMES`, which `stepClaims.test.js` already pins against every `name === "…"` that
  // `validators.js` really implements. Neither is a list anyone types, which is what makes the two
  // of them able to stay equal without being the same file.
  assert.match(HEADLESS, /require\("\.\/stepClaims"\)/);
  assert.match(HEADLESS, /Object\.entries\(VALIDATION_NAMES\)/);
});

// AND THE BEHAVIOUR, on the side that can be imported — the four array validators the card was
// about, every one of them unreachable headless until now.
test("the four array validators are expressible, and land with the right expected_type", () => {
  const { toEvaluations } = require("./runSpec");
  const got = toEvaluations([
    "results.list includes manager",
    "results.list minLength 2",
    "results.list maxLength 9",
    "results.list lengthEquals 3",
  ]);
  assert.strictEqual(got.length, 4, "all four, or the card is only half closed — " + JSON.stringify(got));
  assert.deepStrictEqual(got[0], {
    namespace: "results.list",
    expected_type: "array",
    validations: [{ name: "includes", value: "manager" }],
    save: true,
  });
  // The three length forms become a numeric claim about `.length`, which is the window's own
  // translation — not a second idea about what the words mean.
  assert.deepStrictEqual(got.slice(1).map((e) => [e.namespace, e.expected_type, e.validations[0].name, e.validations[0].value]), [
    ["results.list.length", "number", "min", 2],
    ["results.list.length", "number", "max", 9],
    ["results.list.length", "number", "numEquals", 3],
  ]);
});

test("the symbol forms are untouched by the named one", () => {
  const { toEvaluations } = require("./runSpec");
  const got = toEvaluations(["results.sum = 3", "results.name ~ man", "results.n >= 2", "results.ok = true"]);
  assert.deepStrictEqual(
    got.map((e) => [e.expected_type, e.validations[0].name, e.validations[0].value]),
    [["number", "numEquals", 3], ["string", "isLike", "man"], ["number", "min", 2], ["boolean", "boolEquals", true]],
  );
});

test("a word that is not a validator name is NOT swallowed as a named form", () => {
  const { toEvaluations } = require("./runSpec");
  // `results.a banana 3` has the named SHAPE and no validator called `banana`. It must fall through
  // to the symbol matcher, fail to match, and be reported as unreadable — not quietly become an
  // assertion nothing runs, which is the exact hazard `unknownValidations` exists to catch one
  // layer down.
  assert.deepStrictEqual(toEvaluations(["results.a banana 3"]), []);
});
