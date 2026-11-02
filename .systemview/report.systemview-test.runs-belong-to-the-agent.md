# Runs belong to the agent, not the session

::report{id="Runs belong to the agent" as=spec retain=30d}

Work owed to an AGENT used to die with the session it was given to. This is the spec for the fix:
the proofs for the fix — seven of them, each pressable, so somebody can come back in a month and
run it rather than taking my word from tonight.

## What it cost, before

You asked whether you could hand an agent an assignment and let it do `proactive-development` and
`arc-development` through the day, with the worklist nudge calling it back. The mechanism was
*almost* there and failed on one line:

```js
// electron/agents/nudge.cjs — pickNudge()
if (String(r.session || "") !== String(session || "")) return false;
```

A run was only ever nudged inside the session that opened it. The morning's assignment kept
nudging a session that was idle or gone, and the job that fired into a fresh one at noon could not
see it.

`openRunFor` carried the same assumption, and that half is worse because it is silent: a new
session writing the same source **minted a second run** and left the first open forever — the work
done under a fresh id while the original sat unfinished and nudging, with nobody able to tell a
resumed procedure from an abandoned one.

## The fix, and what it rests on

Both matches moved from the whole session key to the place inside it — `session:<projectCode>:<id>`,
and in this harness the agent slot IS the project code.

| | before | now |
|---|---|---|
| `pickNudge` | the session that opened it | whichever session of that agent is standing |
| `openRunFor` | mints a second run | resumes the agent's own open run |
| the `session` field | decided who heard about the run | a stamp: where it last ran, and where it died |

Last-toucher ownership needed no new state — `writeRun` already re-stamps `session` on every write,
so the session that picks a run up claims it by working it.

::commit{sha=af0a05a project=autobot}

## The proofs

Each one runs the suite and greps for the behaviour it is about, so a press proves THAT behaviour
rather than "the suite is green" — a pass prints the sentence, a regression prints nothing.

**A run opened in one session of an agent is nudged in another session of the same agent** — the
whole point. Without it, the assignment you gave this morning nudges a session that is gone.

:::cmd
cd ~/autobot && node tests/nudge.js | grep "reaches the agent in this afternoon"
:::

**A run belonging to a different agent is never nudged here.** The match widened to the agent, not
to everything on the machine.

:::cmd
cd ~/autobot && node tests/nudge.js | grep "the match is the agent, not every session"
:::

**A nudge about a run from another session says so, and stays quiet when the run is this session's
own.** The rest of that message assumes the agent is holding the list; one written by a session
that no longer exists has to be read cold.

:::cmd
cd ~/autobot && node tests/nudge.js | grep "arriving from elsewhere is announced"
:::

**A session whose key carries no project hears only about its own runs.** The terminal door's
`session:<key>` has no project in it, and treating every such session as one agent would have them
nudged about lists they never wrote.

:::cmd
cd ~/autobot && node tests/nudge.js | grep "unplaceable session is its own agent"
:::

**Writing the same source from a second session resumes the open run instead of minting a second.**
This is the silent half: without it the work happens under a fresh id while the original sits
unfinished forever.

:::cmd
cd ~/autobot && node tests/worklist.js | grep "resumed from whichever of its sessions"
:::

**Another agent cannot resume this agent's open run.**

:::cmd
cd ~/autobot && node tests/worklist.js | grep "another agent's run is not"
:::

**The session field follows the last session to touch the run**, so where it died is still on the
record — it stopped deciding who hears about the run, it did not stop being written.

:::cmd
cd ~/autobot && node tests/worklist.js | grep "the session field becomes a stamp"
:::

**The stalest-first sort has no proof here** and that is deliberate: it is existing behaviour with
existing coverage, and this change did not go near it. It is also the part that makes the whole
idea work — two open runs means the one nobody has touched longest is picked, so quiet owed work
wins over loud recent work.

## What this does not cover

- **Not live until the shell restarts.** `electron/` is cached by Node; nothing here is armed in a
  running session yet, and that restart is not mine to do. The claims above run against the files
  on disk, which is what a spec can honestly check from here.
- **Parallel sessions are bounded, not serialized.** The per-run nudge cooldown means one session
  is nudged per run per cycle, but two sessions that both pick a run up can still both write it —
  last write wins, the same rule the worklist has always had. If that bites, a lease is the next
  step and this is where the question was first asked.
- **No migration.** Existing run records are read in place; the session string they already carry
  is exactly what the new match reads.
