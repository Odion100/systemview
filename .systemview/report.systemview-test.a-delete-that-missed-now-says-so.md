::report{id="A delete that missed now says so, and an invisible run says it is invisible" as=account retain=24h}

# A delete that missed now says so, and an invisible run says it is invisible

**Two verbs in this harness reported success for nothing, and both are fixed.** `forget` answered
*"Forgot &lt;id&gt;"* while deleting nothing; a worklist write accepted a source no surface can read and
said not one word about it. Fourteen new claims, each counting the thing rather than reading the
verb's own report. **Green:** `smoke:context` 165, `smoke:worklist` 69 (a live session), `yarn verify`
exit 0 — 155 suites / 2292 window claims, 328 hub, production build.

**And one thing I went looking for and did not expect to find:** a commit about a planning document
also deleted four other documents, one of which is named in the code as a source of truth. I restored
the proof fixture; the three meeting records are yours to rule on, and the card says why.

## The decision that is yours

::question[The three meeting records deleted inside d2bf2d6c]{options="restore all three — git checkout d2bf2d6c^ -- meetings/|repoint the lifecycle page's header at RFC-076 and let the meetings go|leave it, I deleted them on purpose"}

`src/organisms/HowWeWork/howWeWork.data.js` opens by naming
`meetings/2026-10-27-the-lifecycle-of-every-kind-we-register.md` as *"the current definition, which
outranks both the older handbook chapters and the code"* — and that file is not in the tree. Its 568
lines were not folded into `docs/how-we-work` (there is no lifecycles chapter), so the page's stated
authority cannot be read by anyone. I did not restore it on my own judgement, because
`meetings/2026-10-28-the-landing-page-becomes-the-dashboard.md` is being deleted in your working tree
right now — which reads like a deliberate prune, and a prune is not mine to undo.

## 1 · `forget` refuses an id it cannot resolve

::commit{sha=be72d60 project=autobot}

The measured failure, 2026-11-01: fifteen calls passed the four-character id **every surface prints
in brackets**, all fifteen answered *"Forgot …"*, and the store held 26 notes before and 26 after.
The full slug worked first time — so the id was never the agent's mistake, it was what the agent was
shown.

- **The short id resolves.** An unambiguous suffix is exactly what a bracket prints, and the answer
  says which note it resolved to.
- **Several matches are refused WITH the candidates**, because picking one would be a guess at which
  note to destroy.
- **A miss is an error** naming the nearest ids — never a cheerful no-op.
- **The deleted note's subscription goes with it**, instead of standing and pointing at content that
  no longer exists.

Every claim counts `listNotes` before and after. A prune that cannot show the count moving has
demonstrated nothing, which is the whole lesson of the original failure.

::commit{sha=02b9a5e2}

And the window's own delete had the same silence one layer up: the store now refuses, and an uncaught
rejection left the row sitting there with nothing said. It gets its own error slot — not the search
error, which also gates the results table.

:::cmd
cd ~/autobot && npm run -s smoke:context
:::

## 2 · A source nothing can read says so, and the door stops inviting one

::commit{sha=cb4a4ca project=autobot}

Three prefixes are readable — `skill:` `job:` `lane:` — because the strip draws rows by them and the
nudge chases runs by them. An unknown one passed the write in **total silence**, which is how
`assignment:run-the-proofs` sat four-of-thirteen and un-nudged from 29 October.

**Two halves, and the second is the cause.** The reminder now names what an unreadable source costs;
and the door's own `source` description — the thing an agent reads at the moment it writes — invited
*"any name you choose"* while every skill carried a paragraph warning against exactly that. The
skills were patching a lie the tool was telling.

It stays a **reminder, not a refusal** (your design: an unknown source may be a namespace made up on
purpose). What it owed was a sentence about what the write bought.

The reminder is now a named function with the registries handed in — it was an inline closure no
test could reach, which is precisely why its silent branch survived. Six claims, beside the existing
one that says the row is correctly absent.

## 3 · The orphan, swept — and what it was carrying

Deleted through the system's own `deleteRun`, with a copy at `/tmp/orphan-run-rmvub659x02.json`. It
was mine, opened 29 October in this same session. Four of its thirteen items were done; the rest had
**landed under other names**, which is the point — nobody could tell:

| its item | where it actually is |
| --- | --- |
| worklist cog in the drawer · attachments visible · 12h sweep · spotlight | done, marked done |
| the retention window belongs in worklist settings, not a constant | landed — `keepHours` is a field in `nudgeSettings.js` |
| hub-side collector + runner, by test\|run only | landed — `api/proofs.js`, and `SPECS` is the one definition |
| MCP door `runProofs({projectCode, document\|arc\|objective})` | landed — the verb exists and I use it |
| Proofs tab in TestPanel | landed — `ProofsPanel.js` |
| mount SpecMap on the arc document, wire `onRun` per scope | **superseded** — no `SpecMap` exists; `DocProofs` on the leaf and `PlanLedger` carry it |
| the diagram shows the running, per node | **unverified** — `is-running` exists in `PlanLedger` and `ActionsPanel`, not proven on the arc diagram |
| the arc-level fixture, every plan carrying a run block | partly — mock-arc 1, mock-plan 2, mock-rfc 2 run blocks, end-to-end unproven |
| the fixture nit: a cmd called "the spec" | the wording is now right, and the file it names was missing — see below |

## 4 · The fixture four documents still pointed at

::commit{sha=c9ec7074}

Chasing that last item is what found this. `RFCs/proofs/mock-rfc.md` — 147 lines — was deleted inside
`d2bf2d6c`, a commit about a planning document, whose message never mentions it. Every pointer at it
survived:

::file[RFCs/proofs/the-proofs-run.md]

- `the-proofs-run.md`, a **permanent** spec, lists it in its fixture table with a `::file` chip that
  resolved to nothing
- `mock-arc.md` teaches the upward derivation with it — *"mock-rfc.md serves O1"*
- `the-lifecycle-walk.md` names it as the rfc the walk walks
- RFC-076 tells the reader to open it and press retired
- `mock.js`, the inventory, describes it resting as a spec with its leaf commented out

A fixture nobody can open is a spec nobody can re-run. Restored verbatim from `d2bf2d6c^`; the hub
suite is 328 green with it back.

## Where the tests stand

| what ran | where | what it said | what it does not cover |
| --- | --- | --- | --- |
| `smoke:context` | autobot | 165 claims, 8 of them new | the window panel — nothing renders it in any suite |
| `smoke:worklist` | autobot | 69 claims, 6 new; spawns a real session | the reminder's delivery through a live `set` reply, only the function behind it |
| `yarn verify` | systemview | exit 0 — 155 suites / 2292, hub 328, build | the render of the panel's new error line |

## What I could not verify

- **The panel's error line was never rendered in a test or in your window.** No suite mounts
  `ContextManager`, and your tab is on the previous bundle (served `main.78321be9.js`). It is seven
  lines whose only failure mode is the line not appearing.
- **Autobot's three changes ride your next shell restart** — nothing presses them awake.
- **Two of the orphan's items are unproven, not landed** (the table above says which). I did not open
  the arc diagram to check `is-running` per node.
- **The evaluation order, honestly:** `forget`'s verdict was stamped on its card after the fix, not
  before. The worklist one was recorded before — and it came back *do something else*, which is the
  more useful half: the card asked for a refusal, and a refusal would have contradicted your own
  ruling that an unknown source gets a reminder.

## Walk it

- [ ] `forget` something with its bracket id — the answer names the full slug it resolved to
- [ ] `forget("zzzz")` — refused by name, and `context()` shows the store unchanged
- [ ] Write a worklist with `source: "whatever:thing"` — the reply now says it draws no row and is never nudged
- [ ] Open `RFCs/proofs/the-proofs-run.md` — the first fixture chip resolves again
- [ ] Decide the meetings question above; the rest of that commit's damage is undone
