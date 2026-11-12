# Two reds that meant nothing, and why nothing could notice them

::report{id="Two reds that meant nothing" as=account retain=24h}

:::glance
- **agent** — systemview-test
- **run** — a board card
- **new features** — tests/scripts.js — the script list checks itself against the disk
- **fixes** — the two dead `smoke:judges` and `smoke:nudges` entries removed, in their own commit
- **corrections** — none
- **decisions** — none
- **live** — nothing — these are repo scripts, live the moment the file is on disk
- **checked** — tests/scripts.js 3 assertions green (46 targets across 51 scripts, 34 of 34 test files wired) · tests/board.js 9 · tests/attachments.js 25; systemview's suites not run, this is autobot
:::

**`yarn smoke:judges` and `yarn smoke:nudges` have exited 1 with MODULE_NOT_FOUND for weeks.** The
revert that withdrew the judges automation (`a4c981e`) deleted their test files and left their
`package.json` entries behind. Two reds in a list of fifty-one that are supposed to mean something.

**The cost was never the two reds.** It is the next real failure, which now has to compete for
attention with two that have nothing to do with it. A red that is noise trains you to skim reds.

| | |
|---|---|
| **fixed** | the two entries are gone, in their own commit, because they belong to that revert |
| **and the reason they survived** | a script that cannot *start* is invisible to every suite, since no suite runs it. The list now checks itself against the disk |
| **swept** | all 53 scripts, 46 named targets — exactly those two were missing, nothing else |
| **arming** | nothing. These are repo scripts; they are live the moment the file is on disk |

---

## What I did, and the one place I went past the card

::commit{sha=6a2b43b project=autobot}

The card's instruction was exact and I followed it, including the part about where the change
belongs: *"it wants its own commit because it belongs to the revert, not to whatever work noticed
it."* That commit does one thing and says which revert it finishes.

::commit{sha=d2067ba project=autobot}

**Then I asked why it took weeks**, and the answer is the useful part: **nothing could notice.** A
script that fails *while running* is caught by whoever runs it. A script that cannot START is caught
by nobody, because no suite runs the other suites' entries — the list of things anyone believes is
being checked had two holes in it, and the holes were invisible by construction.

So the list checks itself. `tests/scripts.js` asserts that every `node <file>` a script names is on
disk, and **I proved it has teeth rather than assuming**: pointed `smoke:board` at a file that does
not exist, watched the suite fail, put it back.

It also *reports*, without failing, any file under `tests/` that no script runs — the other half of
a trustworthy list. That half does not fail on purpose: a helper or a fixture living there is
legitimate, and a suite that cries about those is the thing that trains you to skim.

:file[~/autobot/tests/scripts.js]

## Where the tests stand

| suite | ran | says |
|---|---|---|
| `node tests/scripts.js` | 3 assertions | green — 46 targets across 51 scripts, all on disk, 34 of 34 test files wired |
| `node tests/board.js` | 9 | green — ran a neighbour to be sure the package.json edit broke nothing |
| `node tests/attachments.js` | 25 | green |

**This is autobot, so systemview's suites are not involved** and I did not run them for this change.

## What it cannot claim, said here rather than implied by a green line

- **It runs nothing.** It says nothing about whether any suite passes — only that every file a
  script names exists. A script that runs and fails is this repo working as intended.
- **It reads only `node <file>` invocations.** A script that reaches its target another way — an
  env var, a shell expansion — is not checked. Five of the fifty-one name no file at all.
- **It cannot tell a deliberate deletion from an accidental one.** It will fail the moment somebody
  deletes a test without its entry, which is the point, but the fix is sometimes "write the file
  back" rather than "delete the line" and the suite has no opinion about which.

## Press-list

- [ ] `yarn smoke:judges` should now say there is no such script, instead of a stack trace.
- [ ] `yarn smoke:scripts` — the new one. It should be green in under a second.
