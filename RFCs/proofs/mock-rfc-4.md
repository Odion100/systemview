# MOCK — a plan mid-flight

::rfc{id=MOCK-RFC-4 arc=MOCK-ARC-O4 title="MOCK — a plan mid-flight"}

**This document exists to be looked at, not read.** It serves `MOCK-ARC-O4`, the objective marked
`doing` — one plan, claims partly met, the most common shape a real arc wears.

:::approval{ask="MOCK — approve this fixture?"}
A fixture's verdict decides nothing; it exists so the chip has a station.
:::

## Claims

::claims

::claim[the met one]{id=c1 state=met by=systemview-test note="MOCK"}
::claim[the second met one]{id=c2 state=met by=systemview-test note="MOCK"}
::claim[the one still open → nobody looked, and unchecked is never met]{id=c3}

## The spec a scoped run collects

A `:::run` block is a spec with no file behind it — the document IS the contract, so collecting
this plan's proofs means collecting this block. The `:::cmd` blocks above are NOT collected: a
cmd is a command to press, and running one headless would execute something nobody pressed and
call it a passing proof.

:::run{title="MOCK — O4 · the plan mid-flight"}
- Math.multiply { "a": 6, "b": 7 }
  - results.product = 42
:::
