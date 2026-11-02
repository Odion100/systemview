::report{id="What is owed and where the plan is" as=planning retain=3d}

# What is owed and where the plan is

Two designs for one problem: **you cannot see what is owed to you, and the arc surface draws a
picture instead of telling you where the plan stands.** Both were asked to solve the problem rather
than the sentence. Both independently hit the same blocker — **documents that are not registered are
invisible to every surface**, which is the leaf doctrine arriving as a measurement rather than an
argument.

---

## The number on your screen is wrong in both directions

The band header currently says `⚑ 8 approval waiting`.

- **4 of those 8 are proof fixtures** under `RFCs/proofs/` — MOCK-RFC-2/3/4 and MOCK-RFC-SPEC.
- **4 real approval blocks, in 3 real documents, are not counted at all** — they are unregistered, so
  no row exists anywhere: `report.subscribe-on-markdown`, `report…RFC-072-Arc-planning`,
  `report…subscribe-every-block`.

So the only count you have of what is waiting on you is inflated by test data and missing real work.
The genuine total is **4 blocks across 3 documents**: RFC-073, RFC-076 (two), and the proofs-run
report.

## The rest of the real inventory

| | |
|---|---|
| Arcs | **1 real** — ARC-001: 7 objectives, 3 done, 1 doing, 2 open, **1 declared blocked**, **4 with no plan attached**, 1 owned by you |
| Objectives blocked, as drawn | **0** — the `⊘` glyph fires only for *needs-unmet*, and the one declared-blocked objective's need is already done, so it shows nothing |
| Gaps open | **0 real** (one fixture) |
| Claims across live RFCs | **140** — 73 met, **44 marked met with no proof**, 17 unchecked, 6 unmet |
| Reports retiring | **1** — this harvest account, ~11h left. Every other report is permanent or undeclared |
| Reports: disk vs registry | **51 files, 4 live rows.** 47 files have no row; **4 rows point at files that are gone** |

## The ranking rule

**What stops without you, then what expires, then what is quietly false.** Not date — every live
document here was written inside two weeks, so dates separate nothing.

- **T0 · Expiring** — the only tier where waiting *destroys* something. Today: 1.
- **T1 · Blocking something else** — an unverdicted approval, an objective with no plan. Weighted by
  fan-out: an unpressed RFC is not one item, it is every objective waiting behind it. Today: 8.
- **T2 · Blocking only itself** — an objective declared blocked, one owned by you, a gap with a proof
  in the file. Today: 3.
- **T3 · Decaying truth** — claims unchecked or marked met with no proof. **One row per document,
  never per claim**, or 44 unproved claims become 44 rows. Today: 4.

**~12 rows is the number to design for.** Not 3, not 60.

## The drawer

The header keeps its shape — right-aligned, `·`-joined, chevron last — and the two flag spans
collapse into one:

> `⚑ 7 owed · 4 can wait · 3 unregistered` · then `jobs · lists · lanes · reports` unchanged

- `⚑ N owed` is a **button** opening a new first tab.
- `N unregistered` rides only when nonzero. A count that omits silently is the one thing a count must
  not do.
- **`⊘` goes.** Two glyphs for two kinds of attention is what made you ask *"how do I know it's
  blocked?"* The reason moves into words on the row.
- **The inventory counts stay.** They answer a different question — what is *running* — and they are
  the only one-press door into those tabs. They move right of the flag.

Rows reuse the existing report-row classes, so the full-width hit area you already corrected carries
over:

```
⚑  RFC-076 — every registered document walks a lifecycle   2 approvals await a verdict
⚑  ARC-001-O6 — <title>                      you    open · no plan attached
⚑  MOCK-GAP — <title>                                a proof is in the file
   The lane harvest                          account  retires in 11 hours      ⟳
   RFC-073 — a document state lives in the system      15 unchecked · 29 marked, no proof
```

**A press opens the document and reveals the exact block** — the approval's line, the claim's line,
the objective's line. It does **not** write a verdict: the row is the address, the document is the
press, and the facilitation ladder is what signs. The one exception is not a verdict — an expiring
report's `⟳` restarts its clock.

**A row never leaves by hand.** The next poll re-derives it and it is gone because the fact changed
in the file. Nothing is dismissible; a dismissed obligation is one that comes back.

---

## The arc visual

What the current map fails at, measured on the live fixture:

- it shows **two progress numbers that never meet** — `14%` in the header and `31%` in the chips, 200
  pixels apart, so "where is this plan" has two answers
- **every edge in the picture is information-free** — the fan is arc→objective→plan, the identical
  shape for every arc that will ever exist. Meanwhile `timelineOf()` already computes real dependency
  order and per-objective `blockedBy`, and **nothing but its own test file reads it**. ARC-001 has
  three real edges that are computed and thrown away while fourteen meaningless ones are drawn.
- **"what is stopping it" is behind a hover** — the `blocked=` reason reaches the screen only as a
  `title=` on a 10px state word
- **a run leaves no trace** — running specs live in a local Set that is deleted on settle
- it spends **720 × 650 px** to carry seven state words and six chips

The replacement is a vertical ledger — the same seven objectives in ~260px:

```
 MOCK-ARC  approved                                        ▶ run 7 specs   ⟳
 objectives ███████░░░░░░░░ 1/7     claims ████░░░░░░░ 5/16     specs □□□□□□□
 ──────────────────────────────────────────────────────────────────────────────
  ✓ O3  Two plans serve one objective   MOCK-RFC-2  draft   2/2   ▸ ■
                                        MOCK-RFC-3  draft   0/2   ▸ ✕ claim 3
 ═══ the front line ══════════════════════════════════════════════════════════
  ◐ O4  An objective mid-flight         MOCK-RFC-4  draft   0/3   ▸ ◐
  ⛔ O6  A blocked objective          ⚠ waiting on a decision only the walk
                                        can fake  ·  no plan attached  + attach
  ○ O1  The half mock-rfc serves        MOCK-RFC    retired 2/6   ▸ □
  ○ O2  The half mock-plan serves  ⤣O1  MOCK-PLAN   draft   1/1   ▸ □
```

- **the left gutter is the whole glance** — done, doing, open, blocked; the only coloured column, so
  the picture reads as a column of glyphs before anything else resolves
- **the `⚠` column answers "what is stopping it"** — the reason as text on the row, plus the derived
  stoppers: no plan attached, every plan still draft, a need unmet, circular
- **three meters on one row** so they stop contradicting each other
- **per-spec squares** — queued, running, passed, failed, could-not-be-built — and clicking one
  expands the spec inline as the same card the panel draws

## Why the panel and the diagram feel disconnected

Four mechanisms, and the third is the bug you reported:

1. **Two engines.** `FullTestController` exists twice — `testing-utilities/` for the hub path and a
   separate 7.4KB copy in `src/organisms/TestPanel/components/`. Two files, two result shapes.
2. **The cards are built from the listing, never from the run.** The hub's per-spec rows are
   collapsed into one string.
3. **The press actively wipes the panel.** `proofsBus.run()` emits the listing *before* the run,
   which gives the panel's `built` memo a new identity, which fires `setResults({})`. So pressing run
   clears every card's pass/fail and never fills it back. **The run happened; the panel reset itself
   and showed an unrun list beside the word `running…`.**
4. The map's run state is a Set it deletes on settle.

**The fix from your seat is one keyed `progress` record on the bus** — the map's squares and the
panel's cards read the same datum, so they agree by construction instead of being kept in step.

## The streaming problem, honestly

`executeSpecs` already pushes a row per spec *inside* its loop — it just does not publish until it
returns. So no UI can show per-spec progress today; there is nothing to show it with.

Window-side needs no hub change at all: `SavedTests.runAllSeq()` already drives each card in sequence
and each already reports running → pass/fail. `SavedTestItem` already accepts a `recorded` prop and
already plumbs it through. **The door exists and is simply not wired.**

Hub-side, for agent-started runs: `onRow` into the run handle, a door that returns the id
immediately, and a 400ms poll. About 25 lines in two files — with one caveat, that the handle
eviction must skip a run still in flight.

---

## What both designs hit, and it is the same thing

Neither can be fully built on what the registry currently knows:

- **47 report files have no row, and 3 of them hold unpressed approvals.** That is the biggest hole
  and it sits upstream of the drawer.
- **4 registry rows point at files that are gone** and are silently dropped.
- **64 of 71 RFC files carry no leaf**, so nothing tracks them and nothing will ever retire them.
- **Nothing computes which objective's plan points at which RFC**, so fan-out — the thing that makes
  an unpressed RFC weigh more than one item — cannot be derived yet.
- **`approvalsIn` is exported, tested, and called by nothing.** The line-of-each-approval door already
  exists.
- **The fixtures must stop counting.** Half the current flag is test data.

## What each expects you to reject

**The drawer:** T3 on the list at all. Putting 44 unproved claims on the same surface as a decision
waiting on you may be wrong — claims may be the agent's debt, not yours. If so, T3 collapses to one
trailing count and its four rows go.

**The arc:** the front line. It imposes dependency order over the order you wrote, and most arcs have
no `needs=` at all — on a needs-free arc the line lands at a position derived from nothing. Fallback
is document order with no line; the gutter and the `⚠` column still answer the question.

Second risk on the arc: losing the fan. It does read as a plan-shape at a glance. A shape identical
for every arc conveys nothing, but it is a real loss.
