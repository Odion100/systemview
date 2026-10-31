# MOCK — the first of two plans on one objective

::rfc{id=MOCK-RFC-2 arc=MOCK-ARC-O3 title="MOCK — the first of two plans on one objective"}

**This document exists to be looked at, not read.** It is one of the fixtures that give the mock
arc's `::progress` map something real to draw: it serves `MOCK-ARC-O3` by address, beside
`MOCK-RFC-3` — two chips under one card.

:::approval{ask="MOCK — approve this fixture?"}
A fixture's verdict decides nothing; it exists so the chip has a station.
:::

## Claims

::claims

::::claim[open the mock arc → this plan hangs under O3 on the map]{id=c1 state=met by=systemview-test note="MOCK — counted into the card's claims"}
:::cmd
grep -c "arc=MOCK-ARC-O3" RFCs/proofs/mock-rfc-2.md
:::
:::run{title="MOCK — O3 · the first of two plans"}
- Math.add { "a": 2, "b": 3 }
  - results.sum = 5
:::
::::

::::claim[the second chip stands beside this one]{id=c2 state=met by=systemview-test note="MOCK — two plans, one objective"}
:::cmd
grep -c "arc=MOCK-ARC-O3" RFCs/proofs/mock-rfc-3.md
:::
::::

## The spec a scoped run collects

A `:::run` block is a spec with no file behind it — the document IS the contract, so collecting
this plan's proofs means collecting this block. The `:::cmd` blocks above are NOT collected: a
cmd is a command to press, and running one headless would execute something nobody pressed and
call it a passing proof.

