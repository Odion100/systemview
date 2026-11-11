::report{id="The board lost 18 stale cards, and four doors that lied were fixed" as=account retain=24h}

# The board lost 18 stale cards, and four doors that lied were fixed

**The board went 154 → 136.** Eighteen cards were resolved against the tree with an address each and
cleared in one motion; the 136 that remain are `reviewed: 32`, `partial: 22`, `blocked: 3`, and 79
with no account yet. Every card touched carries a declaration of what its work owes.

**Four doors were found lying and three are fixed.** All four were found by USING a surface, not by
reading about it:

| what lied | what it said | fixed |
|---|---|---|
| the board door | `ok: true` while silently dropping a status | yes |
| `removeSettled`'s description | claimed it clears every card with a status | yes |
| a stranded subagent | `ended: false` forever; the window drew it `running` | yes |
| a job's run record | no report, while the report file sat on disk | yes |
| the hub's front door | answers the whole LAN unauthenticated | **no — see below** |

---

## The decision that is yours

:::approval{ask="G-16's browser half: close it now with an Origin allow-list, or carry it into the connect arc?"}
You ruled tonight that the local network runs unauthenticated, and that the fix belongs in the
connect arc rather than its own RFC. Both are written into
`meetings/2026-11-10-the-platform-connects.md` §7.

**That decision does not reach the browser half, and the browser half is live now.** The hub accepts
`content-type: text/plain`, which makes a POST a CORS-simple request needing no preflight, and
`Access-Control-Allow-Origin: *` lets the page read the answer. So any page open in any browser on
this machine can read and write arbitrary files. **A loopback bind cannot fix it, because the
browser is already on localhost** — which is why it is not covered by "the LAN is untrusted".

Approving means I close it ahead of the arc with an `Origin` allow-list on the hub. Rejecting means
it waits for the arc, knowingly.
:::

---

## 1 · Board readiness — your ask, and what the verdicts cost to get

Your words: *"there's a lot of things on the board that are probably stale — solved in another way,
or solved already explicitly."* Correct: of the 38 oldest cards verified, **18 were already done** and
nine of those had landed by a **different route** than the card proposed.

Four readers verified them against the tree, each writing to a file as it went — which is why the
work survived: one died when the machine slept and three more died on a session restart, and all
four files were complete.

::file[/tmp/board-audit-1.md]

**THE EVALUATION, AND WHERE IT CAME BACK NO.** One verdict was wrong and I applied it before
noticing. A reader called card `1792272202066` MOOT because its folder basis is gone — RFC-070
deleted, folder conventions abolished. But the card's content is that **document kinds should be
configurable**, which you and I re-derived from scratch on 2026-10-22 without either of us
remembering the card existed. Leaves make that easier, not moot.

I restored it, and `done` went back from 10 to 9 — the count telling the truth. **What caught it was
the `replaced:` field the board door returns on every status write**, not my own judgment; I read it
on every write from that point on. One more unexamined application and a design you agreed to would
have been deleted as stale.

**Scope of the number:** 38 of 154 cards were verified. The other 116 were not read, so "136 open"
is a count of cards, not a claim that 136 pieces of work are real.

## 2 · The board door answered `ok: true` and wrote half of what it was given

`report`, `title` and `status` were three `if/return` blocks in that order, so a call carrying a
status AND a declaration took the declaration, answered success, and discarded the status. Found by
doing it: three cards in a row got their `report` and none got the line meant to justify it.

Reading the card back off disk was the only way a caller could have noticed.

::commit{sha=2043a412}

They compose now — one serialization, not three, because the board file is read-modify-written whole
and two processes share it. **Three tests assert on the DISK rather than on the answer**, since an
answer can agree with itself.

::test[api/board.test.js]

And its MCP description claimed the dangerous behaviour the code was written to avoid:
`api/board.js:43` is `const DONE = ["resolved"]`, with a comment naming that narrowness as the whole
safety of a bulk delete. On a board answering `settled: 73, done: 1`, the described verb would have
destroyed 72 live cards.

::commit{sha=2cc3479 project=autobot}

## 3 · A subagent whose parent stopped was never marked over

`ended` had exactly one writer: a tool result for the spawning call. Correct for a subagent that
finishes, and the whole story for one that does not. **Three causes, all measured in one evening:**
your interrupt (the common one — it kills background subagents too; a reader of mine died at 19:35
on a keystroke), a compaction (five transcripts stopped writing at 19:07 together), and a dead
stream.

The cost was not one wrong row. `pickSubagentNudge` skips a candidate only `if (u.ended)`, so a
stranded entry nudged every cooldown **forever, with nothing able to satisfy it** — `TaskStop`
answers `No task found with ID`, because the live task registry had already dropped what the
liveness map still held. Three firings at 50, 56 and 62 minutes for an agent dead since 19:07. The
window's row is the worse half: it drew `running` with a liveness pill counting up.

::commit{sha=ba2989c project=autobot}

A second exit, fired only where the **parent** stops — interrupt, kill, re-init, or the pump's
`finally`. **Not at turn end**, which looks like the obvious boundary and is wrong: a background
subagent legitimately outlives its turn, so ending them there would mark live work dead. `why` is
kept and shown, because died-in-place is the record.

This closes a board card from **2026-11-01** that had already sighted it and already worked out the
fix was autobot's. Its window half is quoted into the autobot card verbatim, so clearing it lost
nothing.

## 4 · A job's run record never learned about its report — and the card's fix was the wrong one

Two stores hold one fact and for eleven days only one had a writer. `onReportFiled` stamped
`jobs/<job>/runs/` and was called from the verb that FILED a document. Filing stopped being a verb —
a report registers by its leaf when the file is written — and nothing replaced the caller, so
`systemview.cjs:404` went on capturing the hook into a const it never called.

**Measured on this run:** its own record read `report: undefined` while I was reading it, with every
job run since 2026-11-06 in the same state.

**THE EVALUATION CAME BACK "DO SOMETHING ELSE."** The card said restore the caller. The right caller
is `attach({kind:"report"})` — the moment a run says what it produced, and already required by
every job document before the write that closes the run. The signal was arriving at exactly the
point the stamp was missing. The two stores share a run id, which is what lets one write reach both.

::commit{sha=cbc36cb project=autobot}

The dead hook is removed, both halves, rather than left with a comment pointing at a verb that no
longer exists — the thing that made this regression unreadable from the code. Two of the four
assertions exist to keep it honest: a **branch** attachment stamps no report, and a non-job run
touches nothing.

**This report is its own proof.** Attaching it stamps this run's record, which is what the fix
restored.

## 5 · Your directly-asked work, landed the same night

Not this job's queue — recorded here because it is in the same trees and the same bundle.

The centre's tab store learned **panes**, with the invariants in one place so *"close all the tabs on
one side and it goes back to regular"* is a property of the store rather than five call sites that
could each forget it.

::commit{sha=f5907214}
::commit{sha=5887c4e7}

And **a close that opened two tabs** was traced to a feedback loop: `onFloor` was in the effect's
dependency array and is computed from `pane.tabs.length === 0` — a value the effect changes by
calling `openTab`. Your "cache somehow" was half right: `tabsPc` is `projectCode || "@none"`, so a
cold start seeded the floor into a real localStorage store no surface will ever show.

::commit{sha=0c6450bd}

## Where the tests stand

| suite | result | what it does not cover |
|---|---|---|
| systemview window | 2565 assertions, green | no suite mounts the chat renderer or `Documentation.js` — react-markdown sits at line 3 of that import graph |
| systemview hub | 369 assertions, green | — |
| `yarn verify` (bare) | green, production build included | eslint-as-error only runs here, not in jest |
| autobot | attachments · job-path 33 · nudge 39 · run-slots 7 · lanes 21 · compaction 25 · documents 29 · context · hooks — all green | — |

**What I could not verify, and it matters:**

- **The cold-start tab behaviour.** I reasoned the feedback loop from the code and proved the pure
  half (`tabForUrl` is a function of the URL alone — hand it the store and it answers the same
  thing). The end-to-end cold start needs your restart. If it still lands on How-we-work after one,
  that is a second cause and I want to know.
- **G-16's browser half is unfixed**, pending the approval at the top.
- **116 of 154 cards were never read.**
- **`commitLinks`: 14 commits, 0 carry a `Serves:` trailer, 0 dangling.** Correct rather than
  sloppy — nothing tonight landed a slice of a registered document, and the board cards that drove
  the work have no leaf to name. A trailer pointing at a card id would read as a link until somebody
  checked it.

## Arming

The window work is already in the served bundle. The hub fix needed a restart, which I did.

:::cmd
lsof -nP -iTCP:3000 -sTCP:LISTEN
:::

**Worth recording:** the hub is a yarn link to the working tree — so `api/` fixes do reach it on a
restart — but its parent is **pid 1**. Nothing supervises it, so a crash leaves no hub until somebody
notices.

**The three autobot fixes ride your shell restart.** No press arms them, and that same restart also
clears the stranded subagent ghosts still nudging out of memory.

- [ ] Restart the shell — arms all three autobot fixes and clears the ghost nudges in one action
- [ ] Press a card's status and declaration together; both should land (that was the dropped write)
- [ ] Interrupt me mid-turn while a background reader is out; its row should go quiet rather than
      counting up forever
- [ ] Answer the approval at the top

**No lane was taken.** Both trees were clean of uncommitted code and every piece is committed in
place; nothing is left loose.

## Still open and yours

The three arc decisions in `meetings/2026-11-10-the-platform-connects.md` — the identity fork (now
three-way), where a visiting agent RUNS, and whether the arc closes your 2026-09-09 refusal. Plus
two cards that are genuinely your pick rather than my work: the board's status picker, and whether
pressing a show line **re-runs** it or **reveals** its block.
