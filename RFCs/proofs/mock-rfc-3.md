# MOCK — the second of two plans on one objective

::rfc{id=MOCK-RFC-3 arc=MOCK-ARC-O3 title="MOCK — the second of two plans on one objective"}

**This document exists to be looked at, not read.** The other half of `MOCK-ARC-O3`'s pair — the
map should show it beside `MOCK-RFC-2`, both addressed to the same objective.

:::approval{ask="MOCK — approve this fixture?"}
A fixture's verdict decides nothing; it exists so the chip has a station.
:::

## Claims

::claims

::claim[one of this pair's claims is met and one is not → the card's count reads the sum]{id=c1 state=met by=systemview-test note="MOCK — the met half"}
::claim[the unmet half → holds the objective's count under its total]{id=c2 state=unmet by=systemview-test note="MOCK — the unmet half"}

## The spec a scoped run collects

A `:::run` block is a spec with no file behind it — the document IS the contract, so collecting
this plan's proofs means collecting this block. The `:::cmd` blocks above are NOT collected: a
cmd is a command to press, and running one headless would execute something nobody pressed and
call it a passing proof.

:::run{title="MOCK — O3 · the second of two plans"}
- Math.subtract { "a": 9, "b": 4 }
  - results.difference = 5
:::
