# The SystemView hub drops repeatedly and is silently respawned, so a test run dies mid-flight

**Filed by buAPI's agent, 2026-10-16.** A clue, not a diagnosis — the cause is not established.
Filed because the symptom is invisible from inside the harness and it corrupts test results in a
way that reads as a code failure.

## What was observed

Over one working session the hub at `http://localhost:3000/systemview/api` became unreachable
**at least five times**, each time presenting to an agent as:

```
the SystemView hub is not reachable at http://localhost:3000/systemview/api — is it running?
```

and to `curl` as `000` (connection refused). Each outage lasted roughly a minute or two and then
resolved with no intervention.

## The clue

The hub is **a child of the Electron main process** and is being respawned:

```
pid 39809  etime 02:08  rss 126048  node /usr/local/bin/systemview start 3000
   parent 35148  …/Electron.app/Contents/MacOS/Electron
```

An uptime of ~2 minutes on a hub that had been serving requests for hours means it died and came
back. The harness absorbs the crash, so there is no error surfaced anywhere an agent can see —
only a window of refused connections.

## Why it matters more than an intermittent blip

**A full-project test run routes every call through the hub.** When the hub dies mid-run the CLI
terminates **with exit code 0** and a truncated log — no `TEST COMPLETE` block, no failure, no
non-zero status. Observed directly: a run ended at 315 lines, mid-test, exit 0.

Two consequences:

1. **An agent that trusts the exit code reports a passing sweep that never finished.**
2. **The dead run never reaches its teardown**, so mock users, teams and forums are left in the
   shared Atlas database. The next run's assertions then fail on residue — e.g. a Profiles suite
   expecting 1 forum and finding 8 — which reads as a regression in code that is fine.

The second one is the expensive failure: it sends someone hunting a bug that does not exist.

## What is NOT established

- Whether the crash is caused by load (a full buAPI run is ~226 tests and 15k lines of proxied
  output through the hub), by something in the harness, or by something else entirely.
- Whether agent activity is the trigger. The outages did cluster around long runs and around code
  edits that make nodemon restart all five buAPI services at once — but that is correlation from
  one session, not a cause.

## Where to look

- Whatever supervises the hub in the Electron main process: it restarts the child but appears to
  discard the exit reason. **Logging the exit code and last stderr on respawn would likely turn
  this whole gap into one line of evidence.**
- Hub memory during a long proxied run — RSS was 126MB on a fresh process; nobody has watched it
  across a full sweep.
- Related and already recorded: the hub holds a `Client.createService` instance cached by
  serviceUrl whose method map freezes at first construction. A mass service restart leaves it
  holding stale clients. That is known to cause `Module[method] is not a function`, not a crash —
  noted only so it is ruled in or out rather than rediscovered.

## Cheap mitigation available today, independent of the cause

Make the CLI exit **non-zero** when a run ends without a `TEST COMPLETE` block. A truncated run
currently cannot be told from a clean one by exit code, which is what lets the bad result through.


---

## CAUSE FOUND — 2026-10-18, by reading the launcher's filed stdout

`testing-utilities/FullTestController.js:16` ran every test with `.then(...)` and **no catch**. A
test whose method resolution throws — observed live in the log: `Basketball.Plugin.clearMockEvents:
"Plugin" publishes no method` (the stale cached client, exactly the related-and-recorded suspicion
above) — became an **unhandled rejection, and Node killed the hub** mid-run. 56 boots in one log
file; 54 died silently, 2 on the secondary wound (a respawn racing the dead hub's lingering socket:
`EADDRINUSE :::53766`).

**Fixed in the tree** (pending his commit + hub restart): the chain catches, the rejected test
records its error the way Test.class records its own, the run continues, the process lives. Proven:
a rejecting test in a three-test run no longer takes the process down and shows as `response_type:
"error"` in the results.

This gap dies when a full buAPI sweep survives a stale-client rejection live. The two mitigation
lanes (`lane/truncated-run-tells`, autobot `lane/hub-respawn-evidence`) still stand and still earn
their place — crashes have more than one cause, and the stamps make the next one a log-read too.
