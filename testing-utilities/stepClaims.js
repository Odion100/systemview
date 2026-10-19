// WHAT A STEP ACTUALLY CLAIMED — how many evaluations it declared, and how many of them ran.
//
// THE GAP THIS EXISTS FOR (gaps/UNSAVED_EVALUATIONS_MAKE_A_STEP_PASS_VACUOUSLY, filed by buAPI's
// agent 2026-09-28): only evaluations carrying `save: true` are run, and a step whose evaluations
// are ALL unsaved therefore has nothing that can fail — so it is reported as a pass. They found it
// by authoring two regression guards that went green against the broken code, and green again with
// the fixes reverted. Nothing in the output distinguished that from a real pass: no warning, no
// count, no skip.
//
// A green suite is a claim that the assertions ran. Here the claim was false and no surface could
// tell, which makes it the exact failure a test suite exists to prevent.
//
// THE LINE THIS DRAWS, and it is the whole design: a step with NO evaluations is an ACTION — a
// Before-phase facilitator, a setup call — and those are legitimate and common, so they must not
// fail. A step that DECLARED evaluations and saved none of them is a different thing: the author
// plainly meant to assert something. That combination is never intentional, which is why it can be
// treated as an error rather than a warning.
//
// `vacuous` is structural and says nothing about enforcement. Whether to ENFORCE it belongs to the
// caller, because the authoring UI builds steps with unsaved evaluations by design (that is what the
// checkboxes are) — see validators.js, which enforces only when `editMode` is false.
const claimsOf = ({ savedEvaluations = [] } = {}) => {
  const list = Array.isArray(savedEvaluations) ? savedEvaluations : [];
  const declared = list.length;
  const asserted = list.filter((e) => e && e.save).length;
  return { declared, asserted, vacuous: declared > 0 && asserted === 0 };
};

// Shaped like every other error this engine records — `{ name, expected, received }` — so the
// runners, the exit code and the UI all render it through the paths they already have.
const assertedNothing = ({ declared = 0 } = {}) => ({
  name: "assertedNothing",
  expected: "at least one evaluation with save: true",
  received: `${declared} evaluation${declared === 1 ? "" : "s"} declared, none saved — this step asserted nothing`,
});

// WHICH VALIDATION NAMES EXIST, PER TYPE — because an unknown one is the same bug through a third
// door. Every validator is `validations.reduce((errors, {name, value}) => { if (name === "x" && …) …
// return errors; })`, so a name nothing matches is silently dropped and the step passes having
// asserted nothing. Found by doing it: writing `{name: "equals", value: 0}` instead of `numEquals`
// against a value of 2904 produced a green step, which is exactly how an author meets it.
//
// A HARDCODED TABLE DRIFTS FROM THE CODE IT DESCRIBES — so `stepClaims.test.js` parses
// validators.js for every `name === "…"` it really implements and fails if this table is not
// exactly that set. The table can be wrong for one commit; it cannot be wrong silently.
const VALIDATION_NAMES = {
  number: ["numEquals", "max", "min", "isOneOf"],
  string: ["strEquals", "isLike", "isOneOf", "lengthEquals", "maxLength", "minLength"],
  array: ["includes", "lengthEquals", "maxLength", "minLength"],
  boolean: ["boolEquals"],
  date: ["dateEquals", "maxDate", "minDate"],
};

// Every name the engine implements anywhere — what to offer when one is not known for this type,
// since the commonest version of this mistake is a name that is real for a different type.
const ALL_VALIDATION_NAMES = [...new Set(Object.values(VALIDATION_NAMES).flat())].sort();

// An unknown name is NOT silently ignored any more: it is reported where the step's other failures
// are. `null` means "nothing to say", so the caller stays a one-liner.
const unknownValidations = (type, validations = []) => {
  const known = VALIDATION_NAMES[type];
  // A type with no validators of its own (null, undefined, object) has nothing to check against —
  // the type mismatch itself is already reported by getErrors, and inventing names to reject here
  // would fail steps for the wrong reason.
  if (!known) return [];
  return (Array.isArray(validations) ? validations : [])
    .filter((v) => v && v.name && !known.includes(v.name))
    .map((v) => ({
      name: "unknownValidation",
      expected: `one of: ${known.join(", ")}`,
      received: `"${v.name}" — no validator by that name runs on a ${type}, so this assertion did nothing`,
    }));
};

module.exports = { claimsOf, assertedNothing, VALIDATION_NAMES, ALL_VALIDATION_NAMES, unknownValidations };

