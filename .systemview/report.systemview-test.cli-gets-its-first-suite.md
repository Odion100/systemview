::report{id="The command surface gets its first suite, where the secrets are" as=account retain=24h}

Fifth proactive sitting. `cli/` had **zero** test files — not failing, none — while the window
carried 59 suites and the hub 6. It has one now, and the subject was chosen by where a wrong answer
is **silent**.

::members{who=systemview-test}

## The evaluation, recorded before the work

The card is "cli/ has no tests at all", which is a direction rather than a target, so the pick was
*which file earns the first suite*. Not the biggest — `chat.js` is 910 lines of command handler that
prints and exits, which needs a seam or a child-process wrap before it can be claimed at all.

**`manifestHeaders.js` instead, because it is where the credentials live.** It resolves per-origin
headers, dereferences `@file` pointers so tokens stay out of the manifest, and folds captured
`Set-Cookie`s into a session that rides to later CLI processes. Every one of those failing produces a
request that goes out unauthenticated, or a cookie that rides to a deployment it was never meant
for — and **nothing throws**. That is the profile worth claiming first.

## What landed

::commit{sha=ef1d477c}

Seven claims, **no mocking**: the module already takes an explicit manifest path, so a temp directory
is the whole fixture, and each scenario loads a fresh copy out of the require cache because its state
is module-level.

What they pin — each a thing with a wrong answer worth having:

| claim | the failure it catches |
|---|---|
| origin matching | a localhost credential riding to a remote host |
| an `@file` pointing at nothing | a header sent EMPTY, so the request looks credentialed and is not |
| a capture merging into the jar | a new cookie wiping the ones already there |
| `persist` only when it has news | and preserving `services`/`projectCode` while it writes |
| the project-wide cookie | riding only to origins the policy recorded — the guess it replaced leaked a localhost test cookie into a remote request |
| the policy with no manifest | bootstrapping one rather than refusing, and merging rather than replacing |

::file[cli/manifestHeaders.test.js]

## It was verified by MUTATION, not by passing

All seven passed on the first run, which is exactly when a new suite deserves distrust — a test that
asserts whatever the code happens to do is worth nothing. So three deliberate breaks went into the
module:

| mutation | claim that caught it |
|---|---|
| drop the cookie merge (a capture replaces the jar) | *a captured cookie MERGES into the jar* |
| send the empty header instead of dropping it | *an @file pointer is read and trimmed* |
| let the shared cookie ride to any origin | *the session cookie rides ONLY to recorded origins* |

Three breaks, three different claims, file restored, 7/7 again.

## Where the tests stand

| what ran | where | result |
|---|---|---|
| `yarn test:cli` | **new** | 7 pass |
| `yarn verify` | window + hub + **cli** + build | 2315 · 336 · 7 · green |

**`test:cli` runs INSIDE `verify`**, not beside it — a suite nobody runs is the same as the zero this
card was about. `CLAUDE.md`'s command list says so now too, though that file is gitignored, so that
edit is on disk and not in the commit.

## Walk it yourself

:::cmd
cd ~/Systemly/systemview && yarn test:cli
:::

- [ ] break the merge in `cli/manifestHeaders.js` (`const existing = null`) → claim 3 fails by name
- [ ] `yarn verify` → the cli line now appears between the hub's and the build's

## What is still untested there, in size order

`chat.js` (910) · `index.js` (529) · `runTests.js` (482) · `logs.js` (422). These are command
handlers that print and exit, so each needs either a seam or a child-process wrap — and the worked
example of the second already exists in this project as `TestService.CLI`, which shells out
precisely because the runner cannot reach inside a command.
