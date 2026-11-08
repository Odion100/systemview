::report{id="A use-pass found three things five card-reading sittings did not" as=account retain=24h}

Sixth proactive sitting, and the first one that **used** a surface instead of reading about it. The
job names that door as the richest evidence and sets one surface per run as the floor; five sittings
had skipped it. Three findings, one fix, and one of them is a correction to my own earlier report.

::members{who=systemview-test}

## What was exercised

`runProofs` — the door an agent uses to check a project's living specs without opening the window.
Dry run first, then a real one, then `probe` to decide which side of a disagreement was wrong.

## 1 · The run died on one stale reference, and took 27 proofs with it

::commit{sha=8b26406a}

```
runProofs({projectCode: "systemview-test", document: "RFC-075"})
→ http://localhost:64194/test/api: the registry says this service publishes
  Plugin.fixturesRunning, but the service does not.
```

That is the whole answer. Twenty-seven collectable specs, none of them touching that method, never
ran — and `probe` confirmed which side was wrong: the service genuinely lacks it, so the record was
written from an older build.

**The doctrine it broke is written in the same file it broke.** `executeSpecs` says *"A DEAD WIRE
DOES NOT STOP THE RUN. Bailing on it would end a suite on a socket nobody was testing."* A
mismatched registration is the same shape and was fatal.

So the runner's client now asks for a **degraded** service rather than refusing: it carries exactly
the surface the registry *declared*, so the engine indexes it like any other, and every method on it
rejects with the mismatch message. Specs that touch it fail saying precisely why; everything else
runs. Both answers name it once at the top as `mismatched`.

`serviceClient` still throws — that is right for a `probe`, where you asked for one method and the
loudest answer is the useful one. Only the runner's path degrades, and only on `registryMismatch`.

Three claims, including the one worth arguing with: **the method that is fine fails too.** The record
this service was built from cannot be trusted about *any* of its surface, so a spec leaning on it has
to fail saying that rather than pass against a shape nobody can vouch for.

## 2 · RFC-075's own proofs point at 27 tests that do not exist

The dry run says it plainly: *would run 27 tests* … *28 specs could not be built*. Twenty-seven of
those are RFC-075 `::test` chips naming saved tests nobody wrote — `Test.Proofs.growProof`,
`Test.Window.claimRow`, `Test.Retrieval.chunkByHeading` and twenty-four more.

The RFC whose entire subject is *"a claim carries its proof"* is the document with the most
unresolvable proofs in the project. Each chip reads as evidence on the page. It is on the board as
its own card with the two honest endings per chip — write the saved test, or move it into a
`:::run` block — because the third option, leaving them, is the exact failure that RFC exists to
prevent.

## 3 · My own earlier report told you to arm it the wrong way

The first sitting's account said the runner change needed `yarn start`. **That would have stood up a
second hub.** Measured: the hub you are running is `/usr/local/bin/systemview`, a yarn link into
this very repo's `cli/index.js`, and it has been up since **Monday 3pm** — so every `api/` change
since then is on disk and not in that process. The report now carries the real arming step, and
replacing the text rather than annotating it is why that correction leaves no trace in the document.

This also means **nothing from sittings one or six is live in your hub yet** — not the per-spec
deadline, not today's degrade. And the restart is yours rather than mine: that process also serves
the window you are working in.

## Where the tests stand

| what ran | where | result |
|---|---|---|
| `node --test api/runTests.test.js` | the hub's suite | 17 pass — 3 new |
| `yarn verify` | window + hub + cli + build | 2315 · **339** · 7 · green |

**What a green suite does not cover, and this is the honest centre of this report:** the fix is
unproven live. I re-ran the same door after committing and got the identical error, because the
running hub still holds Monday's code. The claims prove the degraded service's shape and its
refusals; only your restart can prove the run survives.

## Walk it yourself

:::cmd
systemview stop
:::

Then START it from the Hub's apps page — both halves yours. A `pkill` + `nohup` line skips the
clean shutdown and REPARENTS the hub outside the harness's supervision, so the apps page stops
owning it; the note that says so predates this report and I handed you the wrong recipe anyway.

- [ ] then `runProofs({projectCode: "systemview-test", document: "RFC-075"})` → rows instead of one
      error string, with a `mismatched` line naming `Plugin.fixturesRunning`
- [ ] the specs touching that service fail with the registry sentence; the rest report normally

## This account's own commit

::commit{sha=9d242390}
