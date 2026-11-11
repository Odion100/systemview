# The run grammar had drifted into two

::report{id="The run grammar had drifted into two" as=account retain=24h}

**A `:::run` fold's check lines are parsed in two places, and the two had stopped agreeing.** The
window grew a named assertion form — `path includes manager`, `path minLength 2` — built off the
validator names, so every validation the engine implements is writable there. The headless copy that
`runProofs` uses accepted five symbols and nothing else.

**So one document behaved differently at two doors.** It ran clean under your press and came back
from `runProofs` with *"2 assertions couldn't be read"*. Not silent — it names the count and what it
accepts — but the assertion did not run, and the agent who runs these most often was the one party
who could not write them.

| | |
|---|---|
| **fixed** | the headless grammar accepts the named form, so `includes`, `isOneOf`, `lengthEquals`, `minLength` and `maxLength` are writable at both doors |
| **measured before building** | a step with `includes` and `minLength` kept **1 evaluation of 3** headless and 3 of 3 in the window. It keeps **4 of 4** now |
| **and the duplication has a check** | the two files cannot share a module, so a parity test reads both and fails when they drift. Proven by planting a drift |
| **verified through the real door** | three named checks ran and passed via `runProofs`; the same fold with `minLength 99` failed with `expected: 99, received: 2` |
| **tests** | 2610 window · 438 hub (+8) · 23 cli · `yarn verify` green including the ratchet and the production build |
| **arming** | the hub was restarted from `~/autobot`, so this is **live**. The window already had the form; nothing rides your shell restart |

---

## Press-list

- [ ] Write a fold asserting array membership where the array stands:
      `✓ results.members includes systemview-test`. It should run under your press **and** under
      `runProofs` — that pair is the whole point.
- [ ] `yarn test:api` — eight new assertions in `testing-utilities/runSpec.parity.test.js`.
- [ ] A new card: the hub exited tonight and its log's last line was an unrelated connection error.
      One occurrence, not reproduced, carded rather than chased.

## The evaluation, written before the work

The card said the grammar has no array-membership form and that today's workaround is *"the door
projecting a pipe-wrapped string and a `~` match"* — a surface bending to suit the test, which is
backwards. **The card is right about the symptom and understates the cause**, and the verdict went
on the board before anything was built:

> THE GRAMMAR EXISTS TWICE. `RunBlock.js:206` has a `toEvaluations` and so does `runSpec.js:221`,
> and they have already drifted. […] So the card's "no array-membership form" is one of FOUR array
> validators that the window can express and `runProofs` cannot.

**And measuring corrected my own first guess**, which is why I measured. I assumed a check the
headless parser could not read was dropped in silence — a step that asserts nothing and goes green,
the worst shape there is. It is not: it reports *"2 assertions under "Math.add" couldn't be read —
write path = value or path ~ text"*. Nothing goes green on a dropped assertion. The fault is the
disagreement, not a false pass, and saying so is the difference between this report and a scarier
one that would have been wrong.

## What was built

::commit{sha=7c53cf00}

:file[testing-utilities/runSpec.js]

**The names are not a list anybody types.** The headless copy derives them from `VALIDATION_NAMES`,
which `stepClaims.test.js` already pins against every `name === "…"` that `validators.js` really
implements — so a validator added there becomes writable in a fold with nothing else to edit. The
window derives its own from `validationOptions`. Neither is hand-maintained, which is what lets two
files stay equal without being one file.

**The three length forms become a numeric claim about `path.length`** — the window's own
translation, not a second idea about what the words mean. `results.list minLength 2` is
`results.list.length min 2`, and that is what the failure message says when it fails.

:file[testing-utilities/runSpec.parity.test.js]

**Duplication without a check is drift with a delay.** The two files genuinely cannot share a
module — CRA's module scope will not import from outside `src/` — so the parity test reads both and
fails when their symbol operators, their length translation or their numeric-value list stop
matching. **Proven to have teeth** rather than assumed: I dropped `maxLength` from one side and
watched two assertions fail, then put it back.

## Verified through the real door, both ways

A probe document with three named checks, run through `runProofs` on the live hub:

| | |
|---|---|
| as written | **1 passed, 0 failed, no problems, 3 assertions run** |
| with `minLength 99` against a two-group answer | **0 passed, 1 failed** — `{name: "min", expected: 99, received: 2, namespace: "results.groups.length"}` |

The second is the one that matters. Three assertions running proves nothing on its own; an assertion
that fails when it should is what says they are real. The probe document and its registry row are
gone.

## Where the tests stand

| suite | ran | says |
|---|---|---|
| window | 2610 | green — unchanged by this; the window already had the form |
| hub | 438 | green — 8 new, all on the grammar and its parity |
| cli | 23 | green |
| `yarn lint:ratchet` | — | clean |
| production build | bare | compiles |
| the real door | `Agent.runProofs` | both ways, numbers above |

## What I could NOT do or verify

- **That the two parsers agree on BEHAVIOUR.** The parity test compares the shapes both files parse
  by, not what they do with them — two files could agree there and still differ in a branch. It is
  the cheap check that catches the way this actually went wrong: one side gaining a form the other
  never heard of. A real behavioural parity test would have to run the window's module in node,
  which the module scope forbids.
- **The window side of the probe.** I ran the fold headless, twice, and read the window's parser's
  source. I did not press Run on it, because the thing under test is the door that could not do it
  before.
- **Why the hub exited.** It did, once, mid-check, with no stack and no exit line — the log ends in
  the manifest replay's connection failures to services that are not running. Not reproduced across
  two further restarts and a dozen calls, and I cannot rule out a race with my own `stop`/`start` a
  minute earlier. Carded with exactly that caveat rather than diagnosed.
