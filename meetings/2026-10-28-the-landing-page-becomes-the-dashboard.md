::report{id=landing-page-evolves as=planning}

# The landing page becomes the dashboard, component by component

::::thread{id=t1}
A lane built the how-we-work page last night and it landed better than a teaching page usually
does — **the cards look like instruments.** That is the whole opportunity: they look functional
because the shapes are right, and right now they are drawings.

His read, and the brief for everything below: *"I like how a lot of these things look, but these
cards have the potential to actually be things tied into the system."* So this walks the page one
component at a time, with what it is now and what it becomes when it is fed the system. **Nothing
here proposes redrawing anything.**
::::

**Not a design to approve. A plan to argue with.**

::members{who=systemview-test}

## The one idea the rest hangs on

> **Every card gains a data source. Nothing about how it looks changes.**

The same component takes either a **fixture** or the **registry**. In *how it works* it is fed an
example and teaches; on the dashboard it is fed your actual documents and reports state. One
component, two feeds — so the page can never drift from the system it describes, because it IS the
system with the lights on.

That also disposes of a defect a blind review found in the lane's work: `derive.js` is a **second
implementation** of arc derivation whose own comment admits it disagrees with `lifecycleState.js`.
It does not get fixed. It gets **deleted**, and the card reads the one definition.

## The shape: real tabs, and you land on the dashboard

The strip across the top **looks like tabs and is not** — it scrolls the page. It becomes panes that
switch. *"Those things turn into tabs that actually don't navigate the page, but switch tabs."*

::image[RFCs/proofs/hww-hero.png]{caption="the hero and the strip that is not tabs"}

| tab | what it is | fed by |
|---|---|---|
| **Dashboard** | where you land — the same cards, live | the registry, the board, the lanes |
| **How it works** | the teaching page, and a **subset** of these sections | fixtures |
| **Arcs** | every arc, each drawn as the wiring card below | registry, by kind |
| **RFCs** | the trails, one row per document, at its real state | registry, by kind |

**And it needs the frame every document has** — a border and a background, which it has none of
today; in light mode it floats and reads as broken. **Not** the document header: no namespace badge,
no Edit/Save, because this is not a file you edit. (`.hww` also carries `max-height: calc(100vh -
110px)`, a magic number for one mount; with a real frame the pane owns the height.)

---

# Component by component

## 1 · The flow rail

::image[RFCs/proofs/hww-flow-rail.png]{caption="the flow rail"}

**Now:** an example walking itself, goal → arc → plan → claims → build → settled. Click a stage and
it stops.

**Fed the system:** *one real arc's progress.* The lit stage is where that arc actually is, the
greyed ones are what has not happened, and the card below the rail is **the real document at that
stage** — with its own open button. The example copy (*"You say what you want to a chat…"*) becomes
the actual planning report that started it.

**What it needs:** an arc id, and the chain from arc → objectives → plans. Which is the registry
plus the attachment read that does not exist yet.

## 2 · The four leaf cards

::image[RFCs/proofs/hww-leaf-cards.png]{caption="the four leaves"}

**Now:** four cards, one per kind, each showing the leaf you would write.

**Fed the system:** **counts, and a door.** *9 RFCs · 1 arc · 7 gaps · 4 reports* — each card opens
that kind's list. The syntax line stays, because that is still the thing you need to know to make
one.

**What it needs:** one registry read, filtered by kind. **This is the cheapest card on the page and
it is the one I would do first** — the drawer already does exactly this read.

## 3 · The press rule

::image[RFCs/proofs/hww-press-rule.png]{caption="a press does not set a state"}

**Now:** the rule, stated, with *"3 of the 26 claims belong to another agent"* as an example.

**Fed the system:** nothing. **This one stays a drawing on purpose** — it is the sentence the whole
design rests on, and an example that changes with your repo teaches a moving target. Keep it in
*how it works* and leave it out of the dashboard.

## 4 · The lifecycle trails

::image[RFCs/proofs/hww-trails.png]{caption="the trails"}

**Now:** four tabs, four trails, every state carrying its four answers — the fact it reads, what
moves it here, what a press can do, what it means.

**Fed the system:** **one row per document, lit at its real state**, and the state **pressable where
it is pressable** — which is not new work: that control shipped last night. A trail on the dashboard
is the same control pointed at a registry row instead of at a leaf.

The four answers stay underneath, so the thing that teaches you is attached to the thing you press.

::::thread{id=t2}
**Open:** on the dashboard, does pressing a state on a *row* press the real document — or open the
document and let you press it there? Pressing from a list is faster and further from the evidence.
::::

## 5 · The retirement reasons

::image[RFCs/proofs/hww-retire-reasons.png]{caption="endings and pauses"}

**Now:** the closed list, split into **endings** (leave the lists) and **pauses** (stay findable),
with *the reason replaces the gate* under it.

**Fed the system:** this is the **menu that actually pops** when you press `retired` on a real
document. The card is already the picker's design — it just is not wired to one. And the pause half
implies a surface that does not exist: *where do shelved documents stay findable?* That is a
dashboard section, not a teaching one.

## 6 · The report subtype table

::image[RFCs/proofs/hww-subtypes.png]{caption="the subtype table"}

**Now:** `as=` against what it is, what makes it done, and its clock.

**Fed the system:** **your reports, grouped by subtype**, each row saying what it is waiting on — a
planning report with nothing pointed at, a notice you have not read, an audit that has gone stale.
That is the most dashboard-like thing on the whole page and it already has its columns.

**What it needs:** reports to actually carry `as=`. Today almost none do. Which makes this card a
**backfill job** before it is a display.

## 7 · The arc wiring

::image[RFCs/proofs/hww-arc-wiring.png]{caption="the arc wiring, with attach a plan"}

**Now:** the one thing on the page that really derives — press a plan, the objective completes, the
arc settles upward, the wires light. `+ attach a plan` works, on fixtures.

**Fed the system:** your arc. Objectives are the real `::objective` blocks, the plans are the RFCs
whose leaf carries `arc=ARC-nnn-Ox`, and **`+ attach a plan` writes the attachment**. That is the
one genuinely new write in this whole plan, and it is small: the leaf already carries `arc=`.

::::thread{id=t3}
**This card is blocked, and the blocker is mine.** The status line reads *"O3 has no plan attached —
an objective with no plan is incomplete"*, and it separates `approved` from `inProgress` by exactly
that rule. **That is my inference, not a ruling** — it is listed as unsettled in last night's report,
in my own words.

While the card is a drawing that is a teaching error. **The moment it is fed your real arc it is a
lie about your work.** So settling it is a precondition, not cleanup.

**The question:** does `approved` mean something different from `inProgress` on an arc, or do they
collapse into one state?
::::

## 8 · Members and told

::image[RFCs/proofs/hww-told.png]{caption="the told demo"}

**Now:** the thinnest card on the page — one fake leaf line, three chips, two buttons.

**Fed the system:** **who is owed the current version of what.** This is a real thing you would read
every day and it is currently invisible: every document you are on, and whether the people on it
have been told about the version that is there now. As a dashboard tile it is one line — *"2
documents have changes nobody has been told about"* — and it opens the list.

**It should probably not survive into *how it works*** in its current form; it demonstrates the
mechanism without teaching the rule that makes `told=` interesting.

## 9 · The hook and job chain

::image[RFCs/proofs/hww-hook-chain.png]{caption="event, hook, skill, job, account"}

**Now:** five boxes and a pulse you can fire down them, with the fork — a skill is **offered**, a job
is **given** — called out as the whole difference in trust.

**Fed the system:** **the hooks that are actually armed**, what each last fired, and the accounts
their jobs filed. The teaching version is good and should stay; the live version is a different
reading of the same row and belongs on the dashboard.

**What it needs:** `hooksList` and `jobsList`, both of which answer today.

## 10 · The context layers

::image[RFCs/proofs/hww-context-layers.png]{caption="the three layers and the pipeline"}

**Now:** loaded / retrieved / pushed, grouped by **who pulls the trigger**, with the
note → curation → fold → retire pipeline under it.

**Fed the system:** the layers an agent is **actually** carrying — its real doc, its real skills, how
many notes and corpora, and **what it is paying per turn**. That last one is the honest dashboard
number: the cost of the always-loaded layer, which nothing surfaces anywhere right now.

The pipeline strip underneath becomes the live one: *how many notes, how many nominated, when the
last fold ran.*

## 11 · Living specs

::image[RFCs/proofs/hww-living-spec.png]{caption="living specs"}

**Now:** `::test[…]` against `:::run`/`:::cmd`, and why a proof that can fail is the sharpest alarm a
design can produce.

**Fed the system:** **your specs, and whether they still pass.** This is the card that makes
`current` vs `drifted` real — a list of living specs with a press that re-runs them. It is also the
furthest from existing, because the subtype has to exist on documents first.

## 12 · The doors

::image[RFCs/proofs/hww-doors.png]{caption="start something"}

**Now:** five doors that **copy the words to say to an agent**, plus `systemview init`. Honest — the
page says nothing on it writes to a repo.

**Fed the system:** mostly they should stay as they are. The one worth wiring is **Bring in a
project**, which is a command the terminal could just run. The rest are right as words: the system
genuinely works by telling an agent what you want.

**One regression to fix here regardless:** the page this replaced had a pressable `:::cmd` running
`systemview --help` — a door that actually ran. The new doors only copy. That was a deletion nobody
asked for.

---

## Slices, in landing order

1. **The frame** — border, background, no document header, the magic number gone. Smallest, and it
   is what reads as broken today.
2. **The strip becomes panes**, *how it works* one of them, dashboard the landing pane. No data yet;
   the dashboard can open empty and say so.
3. **The leaf counts** (§2) — one registry read, the cheapest live card on the page.
4. **Settle the arc question** (t3), then delete `derive.js` and point the wiring at
   `lifecycleState.js`.
5. **The trail rows** (§4) — same read, and the press already exists.
6. **The arc wiring** (§7), including `+ attach a plan` writing the attachment.
7. **The rest** — subtypes after the `as=` backfill, told, hooks, context, specs — each when its
   read exists.

## What this plan does NOT do

- **It does not redraw anything.** If a card has to look different to carry real data, that is a
  finding, not licence.
- **It does not make *how it works* live.** Fixtures stay fixtures there.
- **It does not add a write that is not already a press somewhere else.** Attaching a plan is the one
  new write, and only because the leaf already carries `arc=`.

## Open, and not mine to answer

::::thread{id=t4}
- **t3** — `approved` vs `inProgress`, which blocks the arc card.
- **t2** — pressing a state from a row, or opening the document to press it.
- Which sections survive into *how it works*? He named three that actually teach: the flow rail, the
  arc forking into its RFCs, and attach-a-plan. The rest may be reference behind a fold.
- Does the dashboard replace the empty-strip floor, or does the floor stay the teaching page?
- A fifth tab for **gaps**, or do gaps live as a count?
- Where do **shelved** documents stay findable (§5)?
::::
