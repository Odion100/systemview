::arc{id=ARC-001 owner=systemview-test title="An RFC you can check, and an arc you can see"}

::members{who=systemview-test}

**Opened 2026-10-21**, out of the conversation that produced RFC-072 and then the claims
convention. Two things came out of it and they depend on each other: an RFC that can be checked
after the work lands, and an arc that shows its own state so the checking has somewhere to live.

## Where this stands

The count recounts from the objectives further down this same file, every render. There is no
stored total anywhere — delete every run record in the system and the number does not move, because
there is nothing for it to disagree with. `doing` is its own count rather than a half-filled bar:
an objective that is partly done is two objectives nobody has split yet, and the honest form of
"we have started" is not 50%.

Under it, the same objectives in order. That order comes from `needs` and nothing else — no phases
and no swimlanes, because order is a property of an objective rather than a box drawn around a
group of them. What matters is what happens when something cannot be resolved: the row is flagged,
never dropped. An objective missing from the list would read as *no such work*, the worst answer
available.

::progress

## The objectives

Each one carries a title you can scan, the owner, the state, what it needs, and in its body the
what, the **why** and the **requirements**. The `why` is there because an objective travels alone: it
reaches somebody hours later with nobody to ask and the ground often moved, and one that says only
*what* leaves them two bad options — stop, or do the literal thing that no longer serves.

Press a state to move it and the press writes into this file. `blocked` sits outside that cycle on
purpose: it is a statement about the world rather than the next step, which is why O6 reads blocked
while nothing in the order above considers it blocked by anything.

:::objective{id=O1 owner=systemview-test state=done title="The method has a home"}
The RFC lifecycle and the definition of a claim live in one cross-project corpus rather than in a
project handbook where only one repo can retrieve them.

**why** — the method was tribal: one agent's session, re-derived by the next. A handbook audit found
three method pages nobody had written.

**requirements** — `context("what is a claim in an RFC")` answers from `how-we-work` in any repo, and the
definition arrives as its own chunk rather than buried in a page about something else.
:::

:::objective{id=O2 owner=systemview-test state=done needs=ARC-001-O1 title="The procedure exists and fires"}
`rfc-authoring` carries the steps and retrieves the definition from the corpus rather than
restating it.

**why** — a definition in two places drifts; a procedure nobody can find never runs.

**requirements** — trigger eval, three passes: 97% on positives, 100% on negatives, with four near-misses
correctly routed to the skill that owns them.
:::

:::objective{id=O3 owner=systemview-test state=doing needs=ARC-001-O1 title="Claims written by somebody who did not build it"}
RFC-072 gets its claims from an agent briefed blind — no source, no git — grouped by the section
each was decided in, with the document's open questions refused rather than answered.

**why** — a claim written from the implementation cannot falsify the implementation. It passes by
construction while looking like evidence.

**requirements** — every claim traces to a section of the design, and the §5 question the RFC left open
appears under "not claimed" instead of among the claims.
:::

:::objective{id=O4 owner=systemview-test state=done title="The arc blocks get a live document"}
`::arc`, `::objective` and `::progress` were built and tested and had never rendered
anything real. This file is the first one.

**why** — a block with no document is a feature nobody has used. The surfaces that read an arc
cannot be wrong until something is there to read.

**requirements** — this document renders all four blocks, the counts match the objectives below them, and
the arcs band tab shows a row for it.
:::

:::objective{id=O5 owner=systemview-test state=blocked needs=ARC-001-O4 blocked="the board has no attachment door — a card cannot carry an arc, so half this objective has nothing to call" title="An arc attaches to the work serving it"}
A worklist and a board card both take `{kind: "arc", ref: "ARC-001-O4", project: "systemview-test"}`,
and the address resolves back to this file without a path being stored anywhere.

**why** — the address is the identity. Renaming this file's title must not break every pointer at
it, and "which objective commissioned this work" should be one kind among several rather than a
fourth special field.

**requirements** — attach from both surfaces, rename this file's title, and the attachments still resolve.

**blocked on, honestly** — `attach` is registered in autobot's worklist server and is not in any
running session: the shell has not restarted since it was added. The board surface has no
attachment door at all.
:::

:::objective{id=O6 owner=you state=open title="The twenty-seven lanes land or go"}
Twenty-seven of thirty-seven lanes read `OUT — proven not in this tree`: their work exists nowhere
but their own branch.

**why** — nothing but landing can clear them, and `lanes remove` correctly refuses. Every day they
stand, the chance that any of them still applies drops.

**requirements** — the lane list reads fewer than ten `OUT`, and the landing order in
`lane/a-landing-order-you-can-trust` has been walked or discarded on purpose.
:::

:::objective{id=O7 owner=systemview-test state=open title="Voice stops marking what it should read"}
A small table now reads row by row and an inline code span reads as the word it is. A blockquote
still folds into surrounding prose and a nested list still loses its nesting.

**why** — the spoken form drops distinctions the written form carries, so a line quoted back sounds
like the speaker's own words.

**requirements** — a reply containing a quote and a nested list is read with both distinctions audible.
:::

## What this cannot show you yet

Three things need conditions this arc does not have, and staging them would make a real tracker lie:
a need in another repo (renders as *elsewhere* — this document cannot see whether it is done), a
need that resolves to nothing (flagged with its reason rather than read as no dependency), and two
objectives that need each other (both emitted and marked circular rather than quietly dropped).
