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
