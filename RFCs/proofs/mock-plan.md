# MOCK — the second plan, serving the arc's other objective

::rfc{id=MOCK-PLAN title="MOCK — the plan that serves O2" arc=MOCK-ARC-O2}

This document exists so the mock arc can reach `settled` honestly: an arc settles when **every**
objective has a plan and every plan is settled, and that takes two plans for two objectives. The
arc's own walk writes this leaf — attach, settle, detach — so you never edit this file by hand.

The lesson it carries: the attachment is the **objective's address** (`arc=MOCK-ARC-O2`), never the
arc's. A plan naming only `MOCK-ARC` serves nothing, visibly.

## The one claim a settled plan has to carry

An RFC with no claims can never read built or settled — §5's floor, and this fixture tripped it the
first time it tried: `settled=` on the leaf moved nothing until this section existed.

::::claim[serve O2 → the mock arc can settle]{id=p1 state=met by=systemview-test note="the walk settles the arc through this document"}
:::cmd
node RFCs/proofs/mock.js arc settled
:::
::::

::claims

## The spec a scoped run collects

A `:::run` block is a spec with no file behind it — the document IS the contract, so collecting
this plan's proofs means collecting this block. The `:::cmd` blocks above are NOT collected: a
cmd is a command to press, and running one headless would execute something nobody pressed and
call it a passing proof.

:::run{title="MOCK — O2 · the plan that lets the arc settle"}
- Math.describe("mock", 2, true, [1, 3])
  - results.summary = "mock x2"
  - results.average = 2
  - results.scoreCount >= 1
:::
