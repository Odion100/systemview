# A dead wire is an outage, not twenty-one regressions

::report{id="A dead wire is an outage, not twenty-one regressions" as=account retain=24h}

:::glance
- **agent** — systemview-test
- **run** — a board card
- **new features** — none
- **fixes** — runProofs keeps the unreachable list, names it, hands it to the engine and stops counting an outage as a failure · isDeadWire asks a structural question rather than sniffing a message that is never there
- **corrections** — my own duplicate isDeadWire export, caught by the ratchet inside the hour
- **decisions** — none
- **live** — the hub was restarted from ~/autobot — live; nothing rides the shell restart
- **checked** — 2610 window · 425 hub (+9) · 23 cli · verify green incl. ratchet and build · runProofs on RFC-078 through the live door twice, 20 passed / 5 failed before and after · the live outage case unverifiable from one process
:::

**`runProofs` on RFC-078 reported 21 of 21 failing, every field reading `undefined`, when the only
thing wrong was that the service had died.** Read at face value that is twenty-one regressions and a
missing method, and an agent that trusts it spends an hour debugging its own document.

**Nothing was missing conceptually, which is why nobody saw it.** `collectTests` has always answered
`{ lists, unreachable }`. `executeSpecs` has always taken `unreachable` and marked each row
`deadWire`. `runTests` has always counted `!r.passed && !r.deadWire` with `notRun` and `notUp`
beside it. `runProofs` destructured `{ lists }` alone, never passed the list on, and counted
`!r.passed` — **the same engine, one door honest and one not.**

| | |
|---|---|
| **fixed** | four lines in `api/proofs.js`: keep the list, name it in the answer, hand it to the engine, and stop counting an outage as a failure |
| **and a hole in the classifier itself**, found by reproducing rather than reading | a call that never connects leaves NO socket error — the failures are about `undefined`, so the message-sniffing rule matched nothing |
| **answered** | how the Test service is started, which nothing on this machine said. It is hosted in the hub's own process and its port changes every boot |
| **the ratchet caught my own bug within the hour** | a duplicate `isDeadWire` in an exports object — the same fault class I fixed in the markdown registry this morning |
| **tests** | 2610 window · 425 hub (+9) · 23 cli · `yarn verify` green including the ratchet and the production build |
| **arming** | the hub was restarted from `~/autobot`, so this is **live**. Nothing rides your shell restart |

---

## Press-list

- [ ] `runProofs({projectCode: "systemview-test", document: "RFC-078"})` — it takes about 140s and
      should answer **20 passed, 5 failed** with no `notRun` and no `unreachable`. That is the
      non-regression check: the fix must not invent an outage.
- [ ] Then stop the hub and run it again. It should say which service did not answer and count the
      proofs as `notRun`, not as failures.
- [ ] `yarn test:api` — the nine new assertions are in `api/proofs.test.js` under *"a dead wire is an
      outage, never a failure"*.

## The evaluation, written before the work

Recorded on the board before anything was built. **Do it as stated** on the first half, and the
card's second half needed its premise corrected:

> The machinery to say "the service is down" already exists and `runProofs` throws it away. […]
> `api/proofs.js:265` destructures only `{ lists }` from the same call, its `where` block has no
> `unreachable`, line 296 calls `executeSpecs` without it, and line 302 counts
> `failed: rows.filter(r => !r.passed)`.

## The fault, in two layers

::commit{sha=c62ec936}

:file[api/proofs.js]

**Layer one was the wiring**, and it is four lines. `runProofs` now keeps `unreachable`, puts it in
the answer so the reader knows *who* did not answer, hands it to `executeSpecs` so each row can be
classified, and counts `failed` the way `runTests` always has — with `notRun` and `notUp` beside it,
because a proof that never ran has no verdict and saying so is the whole point.

**Layer two only showed up when I built the reproduction**, and it is the more interesting half. I
wrote a `:::run` block against a service at `127.0.0.1:1` — which refuses instantly — expecting the
wiring fix to classify it. It did not. The row came back:

```
failed: 1, notRun: undefined
failures: [{ name: "typeError", expected: "boolean", received: "undefined", namespace: "results.a" },
           { name: "boolEquals", expected: true, namespace: "results.a" }]
```

**A call that never connects leaves no socket error in the step.** It records no result, every
evaluation then compares against `undefined`, and what surfaces is an *assertion-shaped* failure
with no `message` at all. `isDeadWire` read `f.message`, got `""`, matched neither the wire-noise
pattern nor the address, and said no. The address never appears because the thing that would have
mentioned it never got to speak.

So the classifier asks a **structural** question first — *does this spec call a service that did not
answer* — which needs no string to be shaped a particular way. The message rule stays beside it, so
the old signal is not traded away. A block spanning several services is still a failure: a partial
outage is no excuse for the half that worked.

## The second half: how the Test service is actually started

The card said *"nothing on this machine says how to start the Test service on :61020"*, and that is
true in the way that matters — nobody wrote it down. But there IS a way, established off disk:

- `systemview-test/` is a **hosted project**. `api/hosted.json` lists
  `{projectDir: <the systemview repo>, folder: "systemview-test"}`, and `api/hostProject.js` reads
  `service.json` + `methods/*.js` and stands the service up **inside the hub's own process**. There
  is no entry point to find because there is none to have.
- So the way to start it is to start the hub: `cd ~/autobot && systemview start 3000`.
- **Its port changes every boot** — `service.json` says `"port": 0`, so the OS assigns one. That is
  why no document could name `:61020`, and why writing a port into a note would be wrong by the next
  restart. It came up on `:64610` earlier tonight and on `:57652` after the restart that armed this
  fix. The route is always `/test/api`.

That went to the store rather than into a document, because it is a *how*, and the store is what
answers a how. The hub's boot log also prints a stale registration beside the live one, naming a
port that boot never bound — `api/hostProject.js`'s known case, not a second service.

## The ratchet earned its keep in under an hour

`yarn lint:ratchet` landed this morning. It failed this build with:

```
A RULE NOBODY HAS SEEN BEFORE:
  no-dupe-keys (1)
A new rule is the likeliest place for a real finding. Read it before baselining it.
```

**It was mine**: I had exported `isDeadWire` from `api/runTests.js` when it was already exported
twelve lines above — a duplicate key in an exports object, which is the *same fault class* as the
markdown registry collision I fixed this morning. Before the ratchet, that would have been one more
warning in a pile of 54 and nobody would have looked. Caught, in the build, within the hour.

## What built it

::commit{sha=29cdec16}
::commit{sha=f254a6a7}

The second is not this work: the hub restart that armed the fix also ran the janitor, which
collected a 12-hour account whose window had passed. That is an `account`'s designed end of life
rather than a loss — the reasoning is one `git show` away — but it landed in the tree because I
restarted the hub, so it is recorded here rather than left loose.

## Where the tests stand

| suite | ran | says |
|---|---|---|
| window | 2610 | green — and says nothing about this; no window code changed |
| hub | 425 | green — 9 new, all on this fault |
| cli | 23 | green |
| `yarn lint:ratchet` | — | clean, after it caught the duplicate export |
| production build | bare | compiles |
| **the live door, twice** | `Agent.runProofs` on RFC-078 | **20 passed / 5 failed before AND after**, with no `notRun`, no `notUp`, no `unreachable` either time |

**That last row is the one that matters most**, and it is the check a fix like this can fail
quietly: a classifier that is too eager would turn five real failures into "the service was down"
and hand back a clean sheet. Identical numbers, through the real hub, with the service up.

## What I could NOT do or verify

- **The executing reproduction is not in the suite**, deliberately, and it is the thing that found
  layer two. The SystemLynx client keeps retrying a refused socket, so the file never exits —
  measured at a 25s timeout with every assertion passing and the FILE cancelled. So the
  classification is pinned pure and instant, the door's wiring is pinned on the path that needs no
  execution, and the end-to-end run is in this account with its output rather than in a suite that
  would hang `yarn test:api`.
- **The live outage case.** I verified the service-UP side through the real hub twice. Verifying the
  DOWN side live means stopping the hub that hosts the service — the hub is what would be running
  the check, so there is no moment where one is up and the other is down. It is the first thing on
  the press-list for that reason: you can do in two commands what I cannot do in one process.
- **Nothing was seen rendered.** This is hub-side; the window's proof panel reads these fields and I
  have not watched `notRun` come out of it. `runTests` has rendered the same pair for weeks, which is
  evidence about the shape and not about this door.
- **The 5 failures in RFC-078 are real and untouched.** They were 5 before and 5 after, and nothing
  here was an attempt to fix them — they are proofs that fail for their own reasons.
