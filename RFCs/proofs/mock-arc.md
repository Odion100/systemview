# MOCK — an arc you can push around

::arc{id=MOCK-ARC owner=systemview-test title="MOCK — an arc you can push around"}

An arc to mess with — and the one kind whose forward states **you cannot press**, because they
derive UPWARD from the plans attached to its objectives. The walk below moves the arc by moving the
PLANS (`mock-rfc.md` serves O1, `mock-plan.md` serves O2), which is the whole lesson: the arc's own
file never claims a state; the plans' settling is what settles it.

## Walk it — the table's order, and the file that changes is never this one

**`draft`** — no verdict. An arc nobody approved is a proposal; it stops nothing being built, only
the record from claiming the direction was agreed.

:::cmd
node RFCs/proofs/mock.js arc draft
:::

**`approved`** — the verdict lands and O1 gains a plan, O2 has none. An objective with no plan is
incomplete, so the arc holds here however done O1 gets — this is the state an arc sits in for most
of its life.

:::cmd
node RFCs/proofs/mock.js arc approved
:::

**`inProgress`** — every objective now has a plan, and one plan is still moving. The station wears
the fold's own numbers: complete over total.

:::cmd
node RFCs/proofs/mock.js arc inProgress
:::

**`settled`** — the last plan settles *in its own document* and the arc completes with no edit to
this file. Derived upward, never pressed: the one state on this kind nothing can fake.

:::cmd
node RFCs/proofs/mock.js arc settled
:::

**`retired`** — a hand with a reason, reachable from anywhere. `cancelled` here, which is an ending:
the arc leaves the active lists.

:::cmd
node RFCs/proofs/mock.js arc retired
:::

## The approval the walk drives

An arc runs the approval flow like an RFC — and `approval+` / `approval-` below make the NUMBER of
blocks part of the walk, because the verdict is every block's answer and the weakest one wins.

:::approval{ask="MOCK — approve this arc's direction?" verdict=approved}
Nothing happens when you press this. That is the point.
:::

:::cmd
node RFCs/proofs/mock.js arc approval+
:::

:::cmd
node RFCs/proofs/mock.js arc approval-
:::

## The objectives

:::objective{id=O1 owner=systemview-test state=open title="The half mock-rfc serves"}
Attached by its ADDRESS — `arc=MOCK-ARC-O1` on the plan's own leaf, never `arc=MOCK-ARC`.
:::

:::objective{id=O2 owner=systemview-test state=open title="The half mock-plan serves"}
Unplanned until the walk's inProgress step — which is what holds the arc at approved before it.
:::

:::objective{id=O3 owner=systemview-test state=done title="Two plans serve one objective"}
MOCK — exists so the map shows two chips under one card. `mock-rfc-2` and `mock-rfc-3` both carry
`arc=MOCK-ARC-O3` on their leaves.
:::

:::objective{id=O4 owner=systemview-test state=doing title="An objective mid-flight"}
MOCK — `doing`, with `mock-rfc-4` attached and its claims not all met.
:::

:::objective{id=O5 owner=systemview-test state=open title="Planned but untouched"}
MOCK — a plan attached (`mock-rfc-5`) and nothing started.
:::

:::objective{id=O6 owner=systemview-test state=blocked blocked="MOCK — waiting on a decision only the walk can fake" title="A blocked objective"}
MOCK — blocked is written, never derived, and it is unplanned: dashed on the map.
:::

:::objective{id=O7 owner=systemview-test state=open title="The one that makes the second row"}
MOCK — unplanned, here so the map wraps on any pane the others would have fit.
:::

::progress

## Run the specs — from the diagram, not the bar

**Click a node on the map above.** The menu offers *run specs*, and what it runs is the scope of the
node you pressed:

- the **arc** chip — this document plus every plan attached to any of its objectives
- an **objective** — only the plans pointed at that objective's address (press O3 for the two that
  share one)
- a **plan** chip — that document alone

The results land in the side panel's **Proofs** tab, and they land there whether or not the panel is
open when you press — so you can run from here, finish reading, and go look afterwards. The node
wears a dashed border while its run is in flight.

**And the same thing runs with no window at all** — the collector and the engine are the hub's, so
an agent asks `runProofs({ projectCode: "systemview-test", arc: "MOCK-ARC" })` and gets the same
rows this panel draws. That is the point of it living hub-side: the party who runs these most often
is the one who has no window.

### The arc's own spec

An arc document is collected like any other — it is not merely a container for its plans.

:::run{title="MOCK — the arc's own spec"}
- Math.add { "a": 4, "b": 4 }
  - results.sum = 8
:::

## When you are done

:::cmd
node RFCs/proofs/mock.js arc off
:::

:::cmd
node RFCs/proofs/mock.js arc on
:::
