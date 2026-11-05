// A RUNNER THAT CANNOT FORMAT AN ASSERTION MUST NOT LOSE THE RUN.
//
// `validationMessage` dispatched straight into `errorMessages[name](...)`. Two names this engine
// emits by design — `assertedNothing` and `unknownValidation`, both from stepClaims.js — had no
// entry, so the call threw "errorMessages[name] is not a function"; the throw escaped the per-test
// printing and landed in the per-SERVICE catch in cli/runTests.js, which aborted the whole service.
// buAPI met it on `Chats.send`: two validation errors found, nothing printed about either, no
// summary, and a run that looked like an infrastructure fault rather than a red test.
//
// So these claims are about the formatter never being the thing that fails: every name the engine
// can emit prints, and a name NOBODY has written a formatter for prints too.
const assert = require("node:assert");
const { test } = require("node:test");
const validationMessage = require("./validtionMessages");
const { ALL_VALIDATION_NAMES, assertedNothing, unknownValidations } = require("./stepClaims");

// Derived, never listed. `ALL_VALIDATION_NAMES` is already pinned to validators.js by
// stepClaims.test.js, and the two feature names come off the functions that mint them — so adding an
// error name anywhere lands in this set without anyone remembering to come back here.
const EMITTED = [
  ...ALL_VALIDATION_NAMES,
  "typeError", // getErrors mints this one itself; it is never authored as a validation
  assertedNothing({ declared: 1 }).name,
  unknownValidations("string", [{ name: "nope" }])[0].name,
];

test("every error name the engine can emit formats into a message", () => {
  EMITTED.forEach((name) => {
    const message = validationMessage({
      name,
      namespace: "results.total",
      expected: "the expected value",
      received: "the received value",
    });
    assert.equal(typeof message, "string", `${name} did not format`);
    assert.ok(message.includes("results.total"), `${name} formatted without naming what failed`);
  });
});

test("a name nothing implements still prints — the whole service no longer dies with it", () => {
  const message = validationMessage({
    name: "somethingAddedLater",
    namespace: "results.x",
    expected: "a thing",
    received: "another thing",
  });
  assert.match(message, /results\.x/);
  assert.match(message, /another thing/); // what actually came back is the part an author needs
  assert.match(message, /a thing/);
});

// The two that crashed it, read back as an author would read them.
test("assertedNothing reads as the sentence it already is", () => {
  const message = validationMessage({ ...assertedNothing({ declared: 3 }), namespace: "results" });
  assert.match(message, /3 evaluations declared, none saved/);
  assert.match(message, /asserted nothing/);
});

test("unknownValidation names the typo and offers the names that do exist", () => {
  const [err] = unknownValidations("string", [{ name: "includes", value: "x" }]);
  const message = validationMessage({ ...err, namespace: "results.name" });
  assert.match(message, /"includes"/);
  assert.match(message, /strEquals/);
});
