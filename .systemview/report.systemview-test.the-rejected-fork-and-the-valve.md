::report{id="The rejected fork is drawn, and the valve says what it did" as=account retain=24h}

# The rejected fork is drawn, and the valve says what it did

**Four things landed in one sitting, all of them cards I had filed and nobody had picked up.** A
rejected RFC keeps its shape and lights the road it took; the how-we-work chapters now teach that a
design can end in no; the compaction valve writes its own record so "did it ever arm?" stops
depending on your eyes; and dashboard B's owed rows stopped travelling on a plain click. Six
commits, every one carrying its `Serves:` trailer. **Green:** the window suite at 155 suites /
2292 claims, the hub at 328, a production build, and autobot's valve suite at 25.

**Not seen in your window, and that is the design.** The served bundle is `main.8668222c.js`; the
one running in your tab is `main.cc0a6ab5.js`, because the window holds the swap until it costs you
nothing. So the fork's RENDER is proven by a mount claim and not by my eyes. Autobot's half rides
your next shell restart.

## The one decision that is yours

The arrow rule has no answer on a dot, which is why B's owed columns are done and A and C's are
not. A's `Mark` is a 10px pulse whose tooltip card renders INSIDE the button; C's standing tile is
a field of 6px dots whose own key line reads *press it to open*. An arrow does not fit either, and
every way out costs something different.

::question[What travels on a dot]{options="the dot selects and the selection draws a row carrying the arrow|the dot stays the door — a dot IS the explicit symbol and the rule was about rows|the dots become reading only, and travel lives on the rows beside them"}

## 1 · A rejected verdict forks at approval — the trail keeps its shape

::commit{sha=b0aa235a}

Gaps were fixed yesterday to hold their shape on an ending and light the road taken (*"the bar is
supposed to just light up on rejected — that's the direction it went"*). `rfc` and `arc` still
carried the old swap: rejecting one replaced the drawing with a two-station `draft → rejected`
trail, so the whole lifecycle vanished under the press.

::file[src/atoms/Markdown/blocks/lifecycleState.js]

`rejected` now hangs off the APPROVAL station as a dead end — drawn on every rfc and arc, not
summoned by the press — so the trail behind it stands where it was and the fork says the ending
exists before anybody is standing in it. Two things that are not cosmetic:

- **Retired after a rejected verdict still redraws** (`draft → rejected → retired`). The full trail
  would wear `built` and `settled` as walked on a design nobody built. This is the gap's
  road-out-of-a-dead-end case, inherited deliberately.
- **The fork never enters `TRAILS`.** `pressTo` clears everything past its target off that order, so
  a station sitting between `approved` and `built` there would make approving an RFC unwrite the
  `## STATUS` heading that means built. The drawing and the pressable order are now different
  things, and a test says so.

## 2 · The valve writes its own record

::commit{sha=9bc1eab project=autobot}

**This is the one found by use, tonight, twice.** Auto-compaction only `emit`ted to the renderer:
`agents.log` held nothing but `compaction.after` hook lines, and the call ledger records tool calls.
So when you said *"it never fired"* neither of us could confirm or refute it — the chip in the
window was the only witness, and it lives somewhere nobody is watching at 3am.

Every transition now lands on disk with the reading that caused it: **armed** (which path, what
window), **cleared**, **stopped** (by whom, for how long), **fired**. Transitions only — a
per-second line would drown the breadcrumbs the file exists for.

**The HOLD is the line worth most.** Over soft with nothing counting down — because the maintenance
pass has not closed since the crossing, or a stop is still snoozed — is exactly the state that reads
as a broken valve. It now says why, once per reason, cleared when fill drops back under soft so a
re-crossing speaks again.

Fixed in passing, and it was a real leak: `tests/compaction.js` wrote its fixture lines into your
real `agents.log`, because `ledger.cjs` resolves `ROOT` once at require time. The suite now pins its
own temp dir before the require.

:::cmd
cd ~/autobot && npm run -s smoke:compaction
:::

## 3 · The chapters teach their own fork

::commit{sha=9f6a598a}

The tutorial drew a life that can only succeed — `draft → approved → built → settled → retired` —
while the gap chapter makes a point of teaching its two endings. A design argued out and declined is
part of the method; it is what makes the verdict a decision rather than a formality.

::file[src/organisms/HowWeWork/howWeWork.data.js]

Both decidable kinds now carry the `rejected` fork with the four answers every station owes, and it
says plainly that the station is not pressed from the trail: a verdict is a signature on the block
the reviewer pressed. The drift tripwire that holds the page to the code now compares it against
what the code **draws** (`stepsFor`, forks included) rather than the pressable order — otherwise the
tripwire reports the design as rot.

## 4 · B's owed rows travel by the arrow

::commit{sha=c37bea1d}

The filter work turned `openDoc` into real navigation (*"it actually should travel — not open it up
on the side"*), which left every row still wired to it yanking the window on a plain click.

::file[src/organisms/Dashboard/tiles/b/OwedTile.js]

The body folds when there is something to fold and otherwise reads; the arrow is a sibling, never a
child; a sub-row opens at its own block. The frozen `DashboardB` page keeps its own copy — it
renders nowhere and exists as the record of what the tile came from — so the difference is NAMED in
the fidelity test beside the two rulings the standing tile already took, rather than made twice in
code nobody can see.

## Housekeeping — two commits that are not features

::commit{sha=0b8ecb9 project=autobot}

Residue I had left uncommitted in your tree: the `SPECS` comment rewritten to the contract-level
reason. It served RFC-075 and had been sitting modified since the doctrine pass.

::commit{sha=c598d432}

The rebuilt bundle. And this document's own commit, recorded because a `Serves:` trailer with
nothing pointing back is a link until somebody checks it:

::commit{sha=1e68fd12}

**And one thing in your tree that is NOT mine:** `meetings/2026-10-28-the-landing-page-becomes-the-dashboard.md`
shows as deleted-unstaged. I did not delete it and I have not committed or restored it —
`git checkout -- meetings/2026-10-28-the-landing-page-becomes-the-dashboard.md` brings it back if
the deletion was an accident.

## Where the tests stand

| what ran | where | what it said | what it does not cover |
| --- | --- | --- | --- |
| `yarn verify` | systemview | 155 suites / 2292 claims, hub 328, production build clean | nothing about the RENDER in your window — the swap is held |
| `npm run smoke:compaction` | autobot | 25 claims, including all four log lines | the live path through a real session; the four claims use a hand-built session |
| `lifecycle.test.js` mount | systemview | the dead end is marked and the rest of the lifecycle stays drawn | pixels — no screenshot was taken of either surface |

## What I could not verify

- **The render.** Both window changes are proven by claims, not by looking: your tab is still on the
  previous bundle and forcing a swap is the one thing I will not do.
- **The valve's new lines in the wild.** They are pinned by the suite, and the first REAL one cannot
  appear until the shell restarts and fill crosses 60 again.
- **A's and C's dot surfaces were measured, not changed** — the question above is why.
- **The evaluation order, honestly:** the trail card and the tiles card were stamped with their
  verdict before the work. The valve card was written AFTER its fix, because the finding came out of
  the compaction that interrupted the sitting; its verdict was stated in the chat before the edit,
  which is the weaker record of the two.

## Walk it

- [ ] Open any rejected RFC or arc leaf — the trail keeps all five stations and only the diagonal into `rejected` wears the accent
- [ ] Open a rejected-then-retired one — three stations, `draft → rejected → retired`, because the rest was never walked
- [ ] How we work → the lifecycles tab → the RFC and ARC chapters now hold a `rejected` station with its four answers
- [ ] Dashboard B's owed columns — hover a row: the arrow appears, the row body does not travel, a single-obligation row is no longer a button at all
- [ ] After the shell restarts: `grep compaction ~/.autobot/logs/agents.log` — armed, held, stopped and fired, with the reading beside each
