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

:::approval{ask="MOCK — approve this arc's direction?"}
Press it or let the walk write it — either way the verdict is a fact on this block, never a state.
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

## When you are done

:::cmd
node RFCs/proofs/mock.js arc off
:::

:::cmd
node RFCs/proofs/mock.js arc on
:::
