# The guard was watching two of six announcers

::report{id="The guard was watching two of six announcers" as=account retain=24h}

**`docSend.callers.test.js` asserted that "exactly the two blocks" announce without recording it.
Six do.** Two import `sendUpdateTo` directly; four reach the same door through `routeResult`, which
lives inside `docSend.js` and so imports nothing an import-reading check can see.

**The run was ABANDONED mid-proof at his word** — he came back and turned proactive development off.
The guard itself is finished, proven and committed; the sweep that would have followed it did not
happen.

| | |
|---|---|
| **fixed** | the guard answers about both halves of the door — in-file callers of `sendUpdateTo`, and the importers of `routeResult` |
| **measured** | 2 importers of `sendUpdateTo`, 1 in-file caller, 4 importers of `routeResult`. The old guard saw 2 of those 6 |
| **teeth proven twice**, by planting each drift | a second in-file announcer → the old guard **passed clean**, the new one named it. A fifth `routeResult` importer → named too |
| **tests** | the 4 assertions in this file, green. **`yarn verify` did NOT run** — see below |
| **arming** | nothing. This is a test file; no bundle, no hub restart |

---

## The evaluation, written before the work

Recorded on the board (card 1794403704467) before a line of code. The card said the guard has a
blind spot inside its own file. **The verdict was DO SOMETHING ELSE, wider** — the card names the
smaller of two holes:

> SIX files announce through that door, not two. Two import `sendUpdateTo` directly
> (`blockFailure.js`, `CommitBlock.js`) and FOUR reach it through `routeResult` —
> `BranchBlock.js`, `CmdBlock.js`, `RunBlock.js`, `TestEmbed.js`. The guard's regex requires BOTH a
> docSend import AND the literal `sendUpdateTo`, so every one of those four is invisible to it.

A guard whose name claims more than its assertion checks is the same fault as `commitLinks` reading
records against the wrong repo and `armed` answering about the whole tree when asked about three
directories — a door answering a wider question than it was asked, confidently.

## What was built

::file[src/atoms/Markdown/docSend.callers.test.js]

Three things, and the third is the one that is a lesson rather than a check: **comments are
stripped before anything is matched.** The first version of the registry guard searched a whole file
for a line and failed on the comment explaining why the line was removed.

## Teeth, proven by planting rather than asserted

| planted | old guard | new guard |
|---|---|---|
| a second `export const` inside `docSend.js` calling `sendUpdateTo` | **passed clean** — ran it, 2 of 2 green | failed, naming `tellTheMembers` beside `routeResult` |
| a fifth importer of `routeResult` (`Approval.js`) | not covered at all | failed, naming `atoms/Markdown/blocks/Approval.js` |

Both plants were removed and `git status` re-read; the tree holds the guard and this report and
nothing else.

## What I could NOT do or verify

- **`yarn verify` did not run.** The change is a single test file — no `src/` module, nothing in the
  production build's graph, and eslint does not lint test files in the build. That is the reason it
  is a low risk, not a reason it was checked. The 4 assertions in the file ran green; nothing else
  did.
- **The sweep that should have followed.** This job's run closes when nothing further is
  completable, never because one thing finished. It stopped here because he came back.
- **Whether `routeResult` could ever be pointed at a document's members.** The guard makes doing so
  a visible act; it does not make it impossible, and nothing today does it.
