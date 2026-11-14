# RFC-079 — a block publishes itself to the registry

::rfc{id=RFC-079}

**DRAFT. Nothing here is approved and nothing is built.** It exists so the argument is not
re-derived — the conversation that produced it was 2026-11-14 and it reached a shape worth keeping.

## The problem

**The registry stores a few hand-picked things, and nothing keeps the picking in sync.**

The window renders 43 block types. Strip the layout ones — `callout`, `columns`, `tabs`,
`carousel`, `details` — and **22 carry state or an answer.** The host knows 13 of them and is blind
to 9: `decision`, `decisions`, `progress`, `claims`, `commit`, `record`, `members`, `ask`, `thread`.

And "knows" is not one thing. It is **three separate hand-maintained lists** in autobot
`electron/markdown/blocks.cjs`, each with its own membership:

| list | what it decides | members |
|---|---|---|
| `deriveState` | what the registry row says | per kind — `verdict` `approvals` `claims` `objectives` `resolvedDeclared` `hasProof` `subtype` `retain` `retired` |
| `FIRING` | what wakes a document's members | `question` `approval` `objective` `reply` `claim` `gap` |
| `SPECS` / `PROOF_KINDS` | what counts as evidence | `test` `run` `cmd`, plus the shown kinds |

A new block joins the system only when somebody remembers to add it to each one. Nothing enforces
it and nothing reports a block that is in none of them, so the failure is silent: the block renders,
works, and is invisible to every surface that is not the window.

**Measured, the same evening the question was asked:** `::decision` had shipped, was in daily use,
and appeared in none of the three. Making a decision woke nobody and no hook could fire on one. In
the same hour, `state.claims` turned out to be gated on `kind === "rfc"`, so a gap's claims were
invisible — fixed — and **a report carrying claims is still not counted**, which is the identical
list-maintenance bug standing in a kind nobody thought about.

**So the registry can only answer questions somebody pre-wired.** *"Which documents have an
unanswered question?"* is answerable. *"Which have an open decision?"* is not. Same shape; one was
remembered.

## The proposal — agnostic capture, interpretation on top

His, and it is the correction to the first version of this (see below):

> *"Wouldn't it be smart to agnostically capture the things about interactive elements — follow the
> same path in registering whatever they want to share and keep updated on the registry? It don't
> give a fuck if it's for showing you obligations or showing you anything else. You can calculate
> obligations from it or whatever."*

**A block declares what it publishes. The registry stores it. Everything else is a query.**

It is the pattern the document already uses, extended one level down: a document declares itself by
carrying a leaf; a block declares what it shares by carrying a publication. `deriveState`, `FIRING`
and any dashboard read from the one declaration instead of three lists.

**The first version of this proposal was an OBLIGATIONS INDEX — a per-block declaration of "carries
an answer in X, owes it to Y, settled when X is set" — and it was wrong in an instructive way.** It
baked one interpretation into the capture layer, so the next question that is not about obligations
would need the mechanism changed again. That is the three-lists mistake with fewer lists. It also
forced a claim's `met`, a decision's `decided` and an approval's `verdict` to be alike; where they
are not, one table becomes a table with exceptions. Agnostic capture dissolves that: each block
publishes its own shape, nothing is flattened, and the query does the interpreting — and a query is
cheap to change.

## Two constraints, or it collapses

**DECLARED, NEVER AUTOMATIC.** Not "publish every attribute". The block names what it shares, and
the declaration lives in the block's own module beside its parser, so what it publishes cannot drift
from what it does. Publishing everything makes the registry a copy of the document, and a copy is a
second place the truth lives.

**STRICTLY A PROJECTION, NEVER A SOURCE.** Everything regenerated on parse; nothing ever written to
the registry directly. Today's registry is already exactly this — counts and verdicts, recomputed
every parse — and that is precisely why *the document is the state* survives having a registry at
all. The moment anything writes a block's state to the registry instead of to the document, there
are two truths.

## What it buys, beyond tidiness

- **The unit stops being the document and becomes the element.** *"What is anyone waiting on me
  for"* spans a question, an approval, a decision, an objective and a claim — five unrelated code
  paths today, one query after. That is the dashboard question and the system cannot answer it now.
- **Hooks get finer without getting more specific.** `document.changed` fires because a row moved.
  With blocks published, a hook can say *something I owe just landed* without naming a block type —
  the universal part coming from the data rather than from the event being deliberately dumb.
- **A new block is wired the day it is written**, in one place, instead of in three somebody has to
  remember.

## Open — none of this is settled

::decision[Does a block publish a flat bag of declared attributes, or a shaped record the registry validates?]{id=d1 owner=systemview-test}

::decision[What bounds the published size — a field cap, a count cap, or nothing and we watch it?]{id=d2 owner=systemview-test}

::decision[Do the three existing lists get REPLACED by the declaration, or does the declaration feed them while they stay?]{id=d3 owner=systemview-test}

::decision[Where does the declaration live when the parser is autobot's and the blocks are systemview's?]{id=d4 owner=systemview-test}

::decisions

## What this does NOT propose

- No change to how a document registers itself. The four leaves are untouched.
- No new store. This is the registry row growing a section, not a second index.
- Nothing about what the window renders. A block that publishes nothing still works exactly as now.
