# A door that answered a wider question than it was asked

::report{id="A door that answered a wider question than it was asked" as=account retain=24h}

**`Agent.armed` is the door that answers "is my fix live?", and asked about three directories it
answered about the whole repo.** Every group it was asked about said zero; the headline said
`live: false`. I found it by using the door on the hub I had just restarted — the night after I
wrote it.

| | |
|---|---|
| **the fault** | `newer` and `live` were computed over *every* commit after the baseline, whatever paths the caller named. Three unrelated `docs(report)` commits made a fully-live `api/` read as not-live |
| **and a second one beside it** | the input is `paths`, the ANSWER calls them `groups`. Read the answer, pass `groups` back, and it was silently ignored. I did that twice before reading the handler |
| **fixed without reversing the older rule** | last night's assertion said an unplaceable commit must not become zero "or the group lines would disagree with the total". Both are honesty rules; one number was serving both |
| **the distinction neither version had** | a commit with **no file list** cannot support the claim "this did not touch `api/`" — so it is `unknown`, and an unknown blocks `live` rather than reading as a no |
| **verified through the live door** | the same call that answered `newer: 3, live: false` now answers `newer: 0, live: true` with `outside` naming what the scope excluded |
| **tests** | hub 442 → **444** · 2632 window · 23 cli · `yarn verify` green bare, ratchet clean, build compiles |
| **arming** | `api/` — the hub was restarted, so **this is live**. Nothing rides your shell restart |

---

## Press-list

- [ ] `armed({projectCode:"systemview-test", groups:["api","cli"]})` — `groups` should now be
      honoured rather than ignored, and the verdict should be about those two directories only.
- [ ] Commit something under `reports/` and ask it again. `live` should stay **true** while
      `outside.commits` counts what landed. That pair is the whole fix.
- [ ] `node --test api/armed.test.js` — eleven assertions, four of them new.

:::cmd
cd ~/Systemly/systemview && node --test api/armed.test.js
:::

## The evaluation, written before the work

Recorded on the board before anything was edited, and it came from a **use-pass rather than a card**:
the job's own instruction that gaps are found by use, pointed at the hub I had just stood up in an
unusual way — on the reasoning that if that hub were subtly half-booted, his window would be working
against a degraded backend. It was not (hosted projects registered on their fresh `port: 0`, manifest
replayed, `Hub.Agent` suite green against it). The door I used to check was the thing that was broken.

> Measured on the live hub: `armed({paths:["api","cli","testing-utilities"]})` → every group
> `newer: 0`, and `newer: 3, live: false`. The three newer commits are `docs(report)` files that
> change nothing the hub runs. So a reader asking the door's whole question is told no while the true
> answer sits in the groups array directly above it.

## What was built

::commit{sha=57727423}

::file[api/armed.js]

**The scope governs the verdict, and nothing leaves in silence.** `outside.commits` is what touched
none of the asked paths, `outside.uncommitted` the same on disk, `outside.unknown` a commit whose
file list was absent. Narrowing a number without saying what left is the fault this door exists to
report, which makes it the worst possible place to commit it — so the repo-wide picture stays
reachable: *"0 newer in what you asked about, 3 elsewhere."*

**The unscoped call is unchanged by construction**, not by my having remembered it: with no paths
there is one group, `""`, which every file is in — including a commit with no file list. That is
pinned by its own assertion rather than left to inspection.

::file[api/armed.test.js]

**Two assertions I wrote last night had to change, and I read them before overwriting them.** They
pinned the repo-wide totals *on purpose* — *"it must not silently become zero: the group lines would
then disagree with the total, and the reader would trust the group line."* That reasoning is right.
It is also the same honesty instinct as this fix, pointed the other way, and the collision was one
number doing two jobs. So the assertions now pin the **rule** rather than the old number, and the
intent they were protecting is carried by `outside` — which is a better home for it, because it is
named.

**Teeth proven** by restoring the unscoped verdict and watching two of the four new assertions fail.

## Where the tests stand

| suite | ran | says |
|---|---|---|
| hub | 444 | green — 4 new, all on the scope |
| window | 2632 | green — and says nothing about this; no window code changed |
| cli | 23 | green |
| `yarn lint:ratchet` | — | clean |
| production build | bare | compiles |
| **the live door** | `Hub.Agent.armed` | `groups` honoured, `newer: 3 → 0`, `live: false → true` |

## What I could NOT do or verify

- **The `outside.commits` count is proven by assertion, not yet by the live door.** I restarted the
  hub to arm the fix, so at the moment I checked it there was nothing newer and `outside` was all
  zeros — which demonstrates the scoping but not the narrowing. The second item on the press-list is
  exactly that gap, and it takes one commit to close.
- **Nothing here was seen rendered.** `armed` has no window surface yet — that is still the open card
  about the shell half — so this is an agent-facing door only, checked by probe and by suite.
- **I got this door's trailer wrong first.** `fecf294f` carried the previous run's report id; this
  work belongs to a different sitting. Amended to this report's id while unpushed and before any
  document recorded the sha. That is twice in two sittings for the same mistake — the id in a
  `Serves:` line is worth re-reading rather than copying from the last commit.
