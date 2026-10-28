# MOCK — the second plan, serving the arc's other objective

::rfc{id=MOCK-PLAN title="MOCK — the plan that serves O2"}

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
