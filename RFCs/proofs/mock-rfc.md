# MOCK — an RFC you can push around

::rfc{id=MOCK-RFC title="MOCK — an RFC you can push around"}

**This document exists to be messed with.** It is not a design and decides nothing; it carries the
blocks an RFC's lifecycle reads so every state can be walked by hand, in the order of RFC-076 §2's
table. The id says MOCK so nobody has to wonder. It also serves the mock arc's O1, so the arc's own
walk moves this leaf — that is the upward derivation being demonstrated, not interference.

## Walk it — one press per state, in the table's order

Watch the trail on the leaf above after each press.

**`draft`** — no verdict anywhere. Every other state needs the verdicts present, so draft is their
complement: pull the verdicts and everything above breaks at once.

:::cmd
node RFCs/proofs/mock.js rfc draft
:::

**still `draft`, with one of two approved** — the slice-1 defect, as a press. The verdict is read
off EVERY approval block and the weakest answer wins, so one approval of two moves nothing.

:::cmd
node RFCs/proofs/mock.js rfc half-approved
:::

**`approved`** — every block carries its verdict, and the claims are not all met.

:::cmd
node RFCs/proofs/mock.js rfc approved
:::

**`rejected`** — one reviewer saying no is the decision, whatever the other blocks say. The trail
redraws as draft → rejected: the stations it will never reach are not drawn as still coming.

:::cmd
node RFCs/proofs/mock.js rfc rejected
:::

**`built`** — the verdicts back, plus the dated STATUS heading at the end of the file. A press can
reach built (it writes the heading) and can never leave it backward — setAttr cannot unwrite a
heading, and the refusal says so by name.

:::cmd
node RFCs/proofs/mock.js rfc built
:::

**`settled`** — `settled=` lands on the leaf. The modification stopped because nothing is left to
modify; a declaration, never derived from quiet.

:::cmd
node RFCs/proofs/mock.js rfc settled
:::

**`retired`** — a hand with a reason. Pressing retire on the trail asks WHY instead of refusing;
this jumps straight there with `retiredAs=shelf`, a pause — so the document stays listed, showing
its reason. Change it to `cancelled` on the leaf and it leaves the drawer entirely.

:::cmd
node RFCs/proofs/mock.js rfc retired
:::

## The approval blocks the walk drives

:::approval{ask="MOCK — approve the first half?"}
Nothing happens when you press this. That is the point.
:::

:::approval{ask="MOCK — approve the second half?"}
The block the old code could not see: it read the FIRST approval only, so this one could sit
unanswered while the document called itself approved.
:::

## Every claim state at once — the styling surface

A claim is met when it is marked met **and** carries the proof its kind owes. Five rows, five things
a claims bar can say — if one renders wrong, it renders wrong here first.

::::claim[a behavioural claim, marked met, carrying a spec → counts as met]{id=m1 state=met by=systemview-test note="the cmd below is the spec"}
:::cmd
echo "pressable, re-runnable — that is what a spec means"
:::
::::

::claim[a behavioural claim marked met with nothing in it → reads UNPROVED, never met]{id=m2 state=met by=systemview-test note="marked, with no body to put evidence in"}

::::claim[a behavioural claim backed only by a picture → still unproved; shown is not a spec]{id=m3 state=met by=systemview-test note="a picture is evidence and it is not a spec"}
::file[RFCs/proofs/hww-trails.png]
::::

::::claim[an experiential claim with shown evidence → met; kind exempts the spec, never the proof]{id=m4 kind=experiential state=met by=systemview-test note="the eye settles this one"}
::file[RFCs/proofs/hww-retire-reasons.png]
::::

::claim[a claim marked NOT met → the valuable outcome]{id=m5 state=unmet by=systemview-test note="nothing happens, which is the finding"}

::claim[a claim nobody looked at → unchecked, never the same as met]{id=m6}

::claims

## When you are done

The teardown strips the leaf; the registry row follows, and the mock leaves every list and drawer.
Reversible, like everything here.

:::cmd
node RFCs/proofs/mock.js rfc off
:::

:::cmd
node RFCs/proofs/mock.js rfc on
:::



