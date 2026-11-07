# Testing the gate — press things here

::report{id="gate-test" as=account retain=24h}
::members{who=systemview-test}

A throwaway surface for testing the members gate, live. `systemview-test` — me — is on it as a **plain member**, not on `auto=`, so every decision below is HELD when it lands, and the pin in the top-right corner
is where it waits for you.

**What to try, in order:**

1. The approval below is already approved — its fire should be sitting in the corner now:
   `decisions · systemview-test`, with **tell** and **✓ caught up**.
2. Press **my chip** — that releases it through the engine; my session takes the wake, the chip
   leaves, and `told=systemview-test` lands on the block's line in this file.
3. Answer the question below — a fresh fire, a fresh held row, no wake until you press.
4. Open the ⚙ on the members line and put me on `auto=`, then answer the second question — that
   one should deliver the moment it lands, with no row in the corner at all.

:::approval{ask="Already approved — is this being held for systemview-test?" verdict=approved told=systemview-test}
the pre-landed decision, so the corner has something the moment you open this
:::

::question[Press me — does a fresh decision wait for your press?]{options="held|leaked" answer=held told=systemview-test}

::question[Put me on auto first, then press — does this one skip the corner?]{options="instant|held" answer=instant told=systemview-test}

Prose edits are the control group: edit this paragraph, save, and nothing should move anywhere —
no row, no wake, nothing. That is the rule the whole gate exists under.
