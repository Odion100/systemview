# MOCK — a plan attached and untouched

::rfc{id=MOCK-RFC-5 arc=MOCK-ARC-O5 title="MOCK — a plan attached and untouched"}

**This document exists to be looked at, not read.** It serves `MOCK-ARC-O5`: attached by address,
nothing started — the card is planned (solid border) and its count sits at zero.

## Claims

::claims

::claim[nothing has been checked here]{id=c1}
::claim[and that reads as unchecked, never as met]{id=c2}

## The spec a scoped run collects

A `:::run` block is a spec with no file behind it — the document IS the contract, so collecting
this plan's proofs means collecting this block. The `:::cmd` blocks above are NOT collected: a
cmd is a command to press, and running one headless would execute something nobody pressed and
call it a passing proof.

:::run{title="MOCK — O5 · attached and untouched"}
- Math.combine({ "a": 2, "label": "first" }, { "b": 3 })
  - results.sum = 5
  - results.inputs.a.label = "first"
:::
