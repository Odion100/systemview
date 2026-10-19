// A GREEN STEP IS A CLAIM THAT THE ASSERTIONS RAN. These claims are about the two ways that claim
// could be false with nothing anywhere to say so (gaps/UNSAVED_EVALUATIONS_MAKE_A_STEP_PASS_VACUOUSLY,
// filed by buAPI's agent 2026-09-28 — found because two regression guards passed with the fixes
// REVERTED):
//
//   1. every evaluation carries `save: false` — only saved ones run, so the step has nothing that
//      can fail;
//   2. a validation's NAME matches no validator — every validator is a reduce that ignores names it
//      does not know, so the assertion silently does nothing.
//
// The second one was found while writing these: `{name: "equals"}` on a number (it is `numEquals`)
// against 2904-expected-0 produced a green step.
const assert = require("node:assert");
const { test } = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const Test = require("./Test.class");
const { claimsOf, assertedNothing, VALIDATION_NAMES, unknownValidations } = require("./stepClaims");

// A step the runner's way: `editMode: false`, which is what initializeSavedTests passes.
const step = ({ save = true, name = "numEquals", editMode = false, evals = null } = {}) => {
  const t = new Test({
    editMode,
    namespace: { serviceId: "S", moduleName: "M", methodName: "m" },
    savedEvaluations:
      evals ||
      [{ namespace: "results.total", expected_type: "number", validations: [{ name, value: 0 }], save }],
  });
  t.results = { total: 2904 }; // the real bug's shape: 2904 where 0 was expected
  t.response_type = "results";
  t.validate();
  return t;
};

test("the vacuous pass is gone: declared evaluations, none saved, is an error", () => {
  const errors = step({ save: false }).errors;
  assert.equal(errors.length, 1);
  assert.equal(errors[0].name, "assertedNothing");
  assert.match(errors[0].received, /none saved/);
});

test("a saved evaluation still fails for its own reason, not for this one", () => {
  const errors = step({ save: true }).errors;
  assert.equal(errors.length, 1);
  assert.equal(errors[0].name, "numEquals");
  assert.equal(errors[0].received, 2904);
});

test("AUTHORING is untouched — the UI builds unsaved evaluations on purpose", () => {
  assert.deepStrictEqual(step({ save: false, editMode: true }).errors, []);
});

// An action step is the shape that would break every real suite if this were done carelessly: a
// Before-phase facilitator asserts nothing BY DESIGN, and must stay green.
test("a step with NO evaluations is an action, and stays a pass", () => {
  const t = new Test({
    editMode: false,
    namespace: { serviceId: "S", moduleName: "M", methodName: "setup" },
    savedEvaluations: [],
  });
  t.results = { ok: true };
  t.response_type = "results";
  t.validate();
  assert.deepStrictEqual(t.errors, []);
  assert.equal(t.shouldValidate, false); // it is not even asked to validate in a real run
});

test("one saved evaluation among unsaved ones is enough — the step did assert something", () => {
  const t = step({
    evals: [
      { namespace: "results.total", expected_type: "number", validations: [{ name: "numEquals", value: 2904 }], save: true },
      { namespace: "results.other", expected_type: "number", validations: [{ name: "numEquals", value: 1 }], save: false },
    ],
  });
  assert.deepStrictEqual(t.errors, []);
});

test("a validation name no validator implements is reported, not ignored", () => {
  const errors = step({ name: "equals" }).errors; // it is `numEquals`
  assert.equal(errors.length, 1);
  assert.equal(errors[0].name, "unknownValidation");
  assert.match(errors[0].received, /"equals"/);
  assert.match(errors[0].expected, /numEquals/); // and it offers the names that do exist
});

test("a name that is real for ANOTHER type is still unknown here — the commonest version of the typo", () => {
  const errors = step({ name: "strEquals" }).errors;
  assert.equal(errors[0].name, "unknownValidation");
  assert.match(errors[0].received, /on a number/);
});

test("claimsOf counts what was declared and what runs", () => {
  assert.deepStrictEqual(claimsOf({ savedEvaluations: [] }), { declared: 0, asserted: 0, vacuous: false });
  assert.deepStrictEqual(claimsOf({ savedEvaluations: [{ save: true }, { save: false }] }), {
    declared: 2,
    asserted: 1,
    vacuous: false,
  });
  assert.deepStrictEqual(claimsOf({ savedEvaluations: [{ save: false }] }), { declared: 1, asserted: 0, vacuous: true });
  assert.deepStrictEqual(claimsOf({}), { declared: 0, asserted: 0, vacuous: false });
  assert.equal(assertedNothing({ declared: 3 }).name, "assertedNothing");
});

test("a type with no validators of its own rejects nothing — the type mismatch is already reported", () => {
  assert.deepStrictEqual(unknownValidations("object", [{ name: "whatever" }]), []);
  assert.deepStrictEqual(unknownValidations("undefined", [{ name: "whatever" }]), []);
});

// THE TABLE CANNOT DRIFT FROM THE CODE IT DESCRIBES. A hardcoded list of validator names would be
// wrong the first time somebody adds one — and wrong SILENTLY, by rejecting a real name as unknown,
// which is a worse failure than the one this whole lane fixes. So the source is the authority: every
// `name === "…"` validators.js really implements must appear in the table, and nothing else may.
test("the name table is exactly what validators.js implements", () => {
  const src = fs.readFileSync(path.join(__dirname, "validators.js"), "utf8");
  const implemented = new Set([...src.matchAll(/name === "([A-Za-z]+)"/g)].map((m) => m[1]));
  implemented.delete("typeError"); // reported by getErrors itself, never authored as a validation
  implemented.delete("unknownValidation"); // this feature's own error name
  implemented.delete("assertedNothing");
  const tabled = new Set(Object.values(VALIDATION_NAMES).flat());
  assert.deepStrictEqual(
    [...implemented].filter((n) => !tabled.has(n)),
    [],
    "validators.js implements a validation name the table does not list — it would be rejected as unknown",
  );
  assert.deepStrictEqual(
    [...tabled].filter((n) => !implemented.has(n)),
    [],
    "the table lists a name no validator implements — it would be accepted while asserting nothing",
  );
});
