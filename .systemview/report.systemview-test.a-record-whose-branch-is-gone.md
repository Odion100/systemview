::report{id="A record whose branch is gone can finally be cleared" as=account retain=24h}

Third proactive sitting. One fix, in autobot, to a trap that cost you a hand-cleanup: deleting a
lane with plain git left a run record that **nothing in the system could reach**, nudging about a
lane that no longer existed.

::members{who=systemview-test}

## The evaluation, recorded before the work

The card offered two roads and I took the first: `lanes remove` learns to accept a branch that is
already gone, rather than inventing a second sweep verb. No new vocabulary is needed — the verb that
owns run records should be able to finish a cleanup somebody started by hand.

The cause, stated precisely, is what made it cheap: the handler builds its targets from **git**
(`hub.lanes`) and then filters them by the registration read. A record whose branch was deleted is
in neither list, so `targets` comes back empty and the record is unreachable at exactly the moment
it becomes wrong. But both sources are already in hand on that line — so an orphan is a **set
difference**, not a new door: a registered name git no longer has.

## What landed

::commit{sha=a5d2b9c project=autobot}

- **the listing names them** — *"1 run record whose branch is gone: lane/ghost"*, with the call that
  clears it. This is also the disagreement the card describes from the other side: the band's lane
  tab counts run RECORDS while this verb counts BRANCHES, so after a hand-cleanup the tab read
  "7 lanes" against a verb answering "none standing", and you were reading those rows correctly.
- **`remove` takes one by name**, and `remove: "all"` sweeps them alongside the standing lanes —
  both halves matter, because a cleanup that only handles one shape still leaves rows nobody can
  reach.
- **a cleared orphan says what died**: `RECORD ONLY, its branch was already deleted by hand`.
  "Cleared" over a line that deleted no work would read as work thrown away.
- **no verdict gate on them**, deliberately: a verdict asks whether the WORK is in the tree and
  there is no branch left to compare. Whoever deleted the branch already made that call; this is the
  record catching up with them.

::file[~/autobot/tests/lanes.js]

## Where the tests stand

| what ran | where | result |
|---|---|---|
| `smoke:lanes` | autobot, through the real tool handler | **21 claims** — 6 new |
| `smoke:worklist` · `smoke:jobs` · `smoke:hooks` · `smoke:context` | autobot | 69 · 39 · green · 165 |

The 6 new claims drive the real handler with the hub stubbed and the registration read left real,
which is the rule under test. One of them exists to stop the fix over-reaching: **a registered
branch that still exists is never mistaken for an orphan**, however its verdict reads.

What a green suite does **not** cover: the hub's own `removeWorktree` / `deleteBranch` are stubbed
here, so this proves the verb's rules and not git's behaviour. And the orphan path has never run
against a real orphan — the ones that caused this were deleted by hand weeks ago.

## Walk it yourself

This is `electron/`, so it **rides your next shell restart** — nothing presses it awake:

- [ ] `mcp__systemview__lanes({projectCode})` → any record whose branch is gone is named at the foot
      of the listing, with the reason it matters
- [ ] `lanes({projectCode, remove: "<that branch>"})` → the record goes, the line says RECORD ONLY,
      and your strip drops the row without you pressing anything

## The side-finding

The assignment run I was going to close honestly this sitting **was already closed**. What was stale
was my own session plan's third item pointing at it — the same class of thing as the four stale
board statuses from the earlier sittings, and the third time tonight that a surface claimed open
work that had already ended. The two remainders that genuinely need you — the tour replay and the
drawer rebuild — are a blocked card now, so they outlive any list that scrolls.
