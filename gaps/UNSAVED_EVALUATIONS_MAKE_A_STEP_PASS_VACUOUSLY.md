# An evaluation with `save: false` is dropped and the step still reports PASS

**Filed by buAPI's agent, 2026-09-28.** Found while authoring regression guards for two real bugs —
both guards passed against the **broken** code before I noticed.

## The behaviour

`agents/tests.md` documents the rule correctly:

> `save: true` — required, only saved evaluations run.

The engine honours the first half and says nothing about the second. An evaluation carrying
`"save": false` (or omitting the key) is skipped — and the step is then reported as **passed**,
because a step with no *run* evaluations has nothing that can fail.

So a test whose every evaluation is unsaved is indistinguishable, in the runner's output, from a
test that asserted everything and was right.

## How it bit

I generated two new test cases programmatically and defaulted `save` to `false`. Both went green
immediately. They also went green with the fixes **reverted** — which is the only reason I caught
it. The runner's output for the vacuous version:

```
✓ Profiles.Users.getPage — "…$geoWithin filters both the page and its count"   1265ms
```

...against code where `total_results` was provably `2904` instead of `0`. Nothing in the output
distinguishes that from a real pass: no warning, no "0 assertions", no skipped count.

## Why it matters more than an authoring mistake

This is the failure mode a test suite exists to prevent. A green suite is a claim that the
assertions ran; here the claim is false and there is no signal anywhere that it is false. Any
hand-authored or generated test file is exposed, and generated ones especially — one wrong default
in a generator silently neuters every case it writes.

It is also the same class the docs already single out one section earlier:

> **Empty evals on an error step = a vacuous pass.**

That warning exists because the team already recognises vacuous passes as a hazard. This is the
same hazard through a different door, and unlike the error-step case there is no way to notice it
from the output.

## Suggested shapes, cheapest first

1. **Report the assertion count per step.** `✓ … (4 assertions)` / `✓ … (0 assertions)` makes it
   self-evident and costs nothing. Even just surfacing zero would have caught this instantly.
2. **Warn when a step has `savedEvaluations` entries but none are saved.** That combination is never
   intentional — the author clearly meant to assert something.
3. **Fail a step that ran zero assertions**, or at least report it as SKIPPED rather than PASSED.
   Strongest, and consistent with how the UI already treats it: `tests.md` notes the UI enforces
   "a step with evaluations enabled needs ≥ 1 saved evaluation" — the file-authored path has no
   such guard, so the two paths disagree.

The UI rule in (3) is the tell: the product already believes this is invalid, it just isn't enforced
for tests written as files.

## Workaround in the meantime

Prove every new guard by reverting the fix and confirming the test goes RED. A guard that passes
both with and without the fix is almost always this. That is now how buAPI authors them, but it is
a discipline standing in for a missing check.

---

## FIXED — 2026-10-19, and there was a third door

All three suggested shapes are in, and the line they draw is the design: **a step with no
evaluations is an ACTION** (a Before-phase facilitator, a setup call) and must stay green, while a
step that **declared** evaluations and saved none of them is the combination that is never
intentional. The author plainly meant to assert something.

- **Enforced** (shape 3): a step outside edit mode whose declared evaluations are all unsaved
  records `assertedNothing` on the step, where every other failure lives — so both runners, the exit
  code and the UI inherit it with no change of their own. Edit mode is untouched: the authoring UI
  builds unsaved evaluations on purpose, and the runner path initializes with `editMode: false`
  (`transformTests.initializeSavedTests`), which is exactly the path whose green anyone believes.
- **Counted** (shape 1): the CLI prints `(2 assertions of 3 declared)` per step, and the hub's rows
  carry `assertions: N`, which is what an agent reads. Either one alone would have caught this.
- **A THIRD DOOR, found while writing the claims:** every validator is
  `validations.reduce((errors, {name, value}) => { if (name === "x" && …) … return errors })`, so a
  validation whose NAME matches nothing is silently dropped and the step passes having asserted
  nothing. Writing `{name: "equals", value: 0}` (it is `numEquals`) against a value of 2904 produced
  a green step — the typo version of this gap, and the one an author meets by accident rather than
  by default. An unknown name is now reported with the names that do exist for that type.

**Measured before enforcing, so nothing went red by surprise:** this project's six spec files
declare 40 evaluations, **0 unsaved**, and use one validation name (`boolEquals`) — nothing unknown.
Other projects should re-run that check on their own specs; a suite carrying either shape has been
asserting less than it claims, and the red is the truth rather than a regression.

| | |
|---|---|
| **lane** | systemview `lane/a-step-that-asserts-nothing-says-so` |
| **touches** | `testing-utilities/stepClaims.js` + its suite (new) · `validators.js` · `api/runTests.js` · `cli/runTests.js` · `package.json` (the engine's suite now runs with `yarn test:api`) |
| **tests** | 10 new claims — including one that parses `validators.js` and fails if the validator-name table drifts from what the code implements, because a hardcoded list would eventually reject a REAL name as unknown, which is worse than the bug it prevents |
| **not verified** | a live run of another project's suite. The claims drive the real `Test` class through `validate()`, which is the path a run takes, but the end-to-end proof is a buAPI sweep after this lands. |
