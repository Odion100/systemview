::report{id="A hung spec now fails with a timeout, not a page of undefined" as=account retain=24h}

A proactive sitting, fired on idle. Two cards closed on EVIDENCE rather than on code, one real
build, one detector deliberately **not** shipped because the cheap version of it was wrong.

The headline is the build: the saved-test runner had no per-test deadline, so a method that hangs
hung the whole run with nothing said — and the row it eventually produced was worse than silence.

::members{who=systemview-test}

## The evaluation, recorded before the work

Both verdicts went on the board first, which is the only thing that makes this a decision rather
than a justification written afterwards.

| card | ending chosen | why |
|---|---|---|
| the dashboards mix up two projects' RFC-001 | **do not do it — already closed** | all three joins key on `docKey` and `crossProject.test.js` asserts each by name; the card's own status claiming them untouched was the stale thing |
| A hung spec method has no timeout and reports nonsense | **do it as stated** | completable in one sitting, it is our runner, and the right shape already exists in this repo — `TestService.CLI` wraps a child process with its own `timeoutMs` precisely because the runner has none |
| the chat stylesheet keeps silently beating the markdown mixin | **do something else** | the detector it asks for cannot be built from class names; one of its three findings was real, one deliberate, one my own false positive |

## What landed

::commit{sha=db8377fd}

A per-spec deadline, a minute by default, moved for a whole run with `SV_TEST_TIMEOUT_MS` and for
one test by its own `timeoutMs`. What a timed-out row does:

- says `timedOut: true`, and the summary counts how many hung — three methods that never answered
  is a different morning from three wrong assertions, and the summary used to read identically
- carries the timeout as its **only** failure. The undefined comparisons are not reported: nothing
  answered, so every evaluation is against `undefined`, and printing twelve of those is what made a
  dead fixture look like a broken assertion
- claims **no** assertions, because nothing ran
- **does not end the run** — the next spec runs on its own terms

::file[api/runTests.js]

One thing in there is measured rather than reasoned, and the comment says so: the deadline timer is
deliberately **not** `unref`'d. An unref'd timer lets the event loop empty before the deadline
fires, so the race never resolves and the caller waits forever on the thing meant to rescue it —
8 of these 14 claims cancelled exactly that way on their first run.

::commit{sha=b6b6fadd}

The fence cap now says which number is live. The mixin documents 180px with its measurement; the
chat declares 200px at the same specificity, later in source order, so 200 is what every chat fence
has always rendered at. Nothing was wrong on screen — the wrong thing was that neither side
mentioned the other.

## Where the tests stand

| what ran | where | result |
|---|---|---|
| `node --test api/runTests.test.js` | the hub's own suite | 14 pass — 8 new |
| `yarn verify` | window + hub + production build | 2302 window, **336 hub** (was 328), build green |

What a green suite does **not** cover: the deadline has never fired against a real hung service.
The claims drive it with an injected runner that returns a promise which never settles, because
there is no way to make a live service hang on command — the injection point exists for that one
reason and is documented as such. The first real proof will be the next run against a fixture that
is down: it should take a minute per hung spec and say so, instead of hanging the run.

## Walk it yourself

The runner is the hub's, so this needs the hub restarted before any of it is live:

:::cmd
cd ~/Systemly/systemview && yarn start
:::

- [ ] `node --test api/runTests.test.js` — 14 pass, including "a hung spec fails with the timeout,
      asserts nothing, and the run continues past it"
- [ ] run any project's specs with a fixture service down: the row says `timed out after 60s — the
      method never answered`, and the summary carries `timedOut`
- [ ] a document's `:::run` block gets the same deadline for free — `api/proofs.js` shares this
      engine, which is where it bites `runProofs` over the MCP

## What I did not do, said plainly

The stylesheet detector. The card's complaint is that *nothing detects* an organism beating a mixin
on source order, and the cheap detector — same class, same property, two files — reported three hits
of which **two were wrong**: one was a deliberate higher-specificity override, one had a different
ancestor chain and was never in a `chat-md` region at all. A tool that is wrong two times in three
is worse than no tool, because it trains its reader to ignore it. What a sound one needs is on the
board as its own card with the shape written out: compile the SCSS, walk every `@include` site (the
mixin has 4+ in AgentChat alone, plus CodeView and the workbench), compute specificity, and only
then call equal-specificity-plus-later-source-order a fight.

## This account's own commit

::commit{sha=5dbf8fd8}
