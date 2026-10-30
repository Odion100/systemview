# MOCK — an RFC you can push around

::report{id=MOCK-RFC-SPEC as=spec retain=permanent title="MOCK — an RFC you can push around"}

**At rest, this document is a SPEC.** It is the fixture for the RFC lifecycle: it decides nothing
and designs nothing — it carries the blocks an RFC's lifecycle reads, so every state can be walked
by hand in the order of RFC-076 §2's table. The walk below RAISES a mock RFC inside it, pushes that
RFC through every state, and tears it back down to this spec. While the test runs, the document
carries two leaves and two registry rows — each row deriving by its own kind (RFC-073), and the
spec row standing untouched through all of it. The id says MOCK so nobody has to wonder. While
raised, it also serves the mock arc's O1, so the arc's own walk moves this leaf — that is the
upward derivation being demonstrated, not interference.

::prompt[demo this fixture]{text="Run the full demo of the mock-rfc fixture, live in my window: raise it, walk the lifecycle forward with the facilitation ladder, show the gate and a backward path, and tear it down to the spec. Use the fixture's own commands and verify the stage before each beat."}

## Raise it — creation is the first state

An RFC's first state is EXISTING, and nothing can press a document into being — so creation is a
command, never a button on the trail. This turns the commented leaf below into the real thing:
watch a MOCK-RFC row appear beside this spec's own, with the trail armed on the leaf.

:::cmd
node RFCs/proofs/mock.js rfc on
:::

And its opposite — the teardown lives here beside the raise (and again at the bottom, where a
finished walk wants it): strip the leaf, the row follows, the document is a spec again.

:::cmd
node RFCs/proofs/mock.js rfc off
:::

::rfc{id=MOCK-RFC title="MOCK — an RFC you can push around" retired=2026-10-30 retiredAs=shelf arc=MOCK-ARC-O1 settled=2026-10-30}

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

::::claim[a behavioural claim, marked met, carrying a spec → counts as met]{id=m1 state=met by=systemview-test|you note="the run block below is the spec — it re-runs and can go red on its own"}
:::run{title="MOCK — a claim's own spec, collected and runnable"}
- Math.add { "a": 1, "b": 1 }
  - results.sum = 2
:::
::::

A `:::run` and not a `:::cmd`, and the difference is the one worth learning here: **only run blocks
and test blocks are specs.** A cmd is experiential facilitation — a command you press to feel the
thing work — so it is never collected into a headless run, because executing shell nobody pressed
and reporting it as a passing proof is the failure the distinction exists to prevent. If something a
cmd does needs defending, wrap it in a run block, which is what this claim now does.

::claim[a behavioural claim marked met with nothing in it → reads UNPROVED, never met]{id=m2 state=met by=systemview-test|you note="marked, with no body to put evidence in"}

::::claim[a behavioural claim backed only by a picture → still unproved; shown is not a spec]{id=m3 state=met by=systemview-test|you note="a picture is evidence and it is not a spec"}
::file[RFCs/proofs/hww-trails.png]
::::

::::claim[an experiential claim with shown evidence → met; kind exempts the spec, never the proof]{id=m4 kind=experiential state=met by=systemview-test|you note="the eye settles this one"}
::file[RFCs/proofs/hww-retire-reasons.png]
::::

::claim[a claim marked NOT met → the valuable outcome]{id=m5 state=unmet by=systemview-test|you note="nothing happens, which is the finding"}

::claim[a claim nobody looked at → unchecked, never the same as met]{id=m6 state=met by=you at=1793317773522}

::claims

## When you are done — back to a spec

The teardown strips the RFC leaf; its row follows on the next parse, and the document is just this
spec again — the spec row never flickered. Reversible, like everything here: the raise command at
the top brings it back.

:::cmd
node RFCs/proofs/mock.js rfc off
:::




## STATUS — built 2026-10-30
