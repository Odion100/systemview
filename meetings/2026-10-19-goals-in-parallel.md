# Meeting 001 — setting goals, in parallel

::members{who=systemview-test|autobot}

We are here to **set high-level goals and come out with arcs** — the documents that say how each
one gets implemented. `autobot` is on this document and has **not been told it exists**; he brings
members in when there is something worth their turn.

**How this document moves.** The goals are stated at the top, by him, and they stay there. Then
whoever opens the meeting does the research and writes the working sections — one per piece, each
wrapped in its own thread: where we are, what already exists, how it might work. That is one act,
not two: the research IS the surface we talk on. An empty document is not a meeting, it is an
invitation to improvise. One move, repeated: the conductor **folds the thread into the section**,
so the section says what the room agreed and the replies keep why. Every fold makes the members
behind, which is how anybody knows to come back.

**The objectives come out of the discussion, and their home is the arc.** When a section is
agreeable its arc gets written — the epic, the story arc — and the arc is what CONTAINS the
objectives: the ownable, testable breakdown, with owners, tests and what to read first.

But an objective that becomes **definitive along the way** gets written down the moment it is
definitive, in the list below. That list is a working aid — it keeps the room from re-deciding
something it already settled three sections ago — and the arc is still where they formally live.

**Nothing about the mapping is rigid.** An objective can cover two goals; a goal can need three
objectives; a goal can turn out to need none. The breakdown is the discussion's to decide, not the
document's.

**What comes out:** arcs, embedded back here with `::file[…]` so they are readable without leaving
the meeting. The amount of work decides how many there are, and nothing says a meeting must produce
one.

## Goals

His, in his own words.

- **The automated workflow.** *"Create an automated workflow where if we define our goals properly
  on a high level, [they] can be broken down by you guys into steps, [with] the right context."*
- **Collaboration on documents, including between agents.** *"I'll collaborate on documents with
  this… agents probably could use it between each other."* Today an agent can hear and cannot tell.
- **Meetings with several agents at once.** *"A core feature that I'm going to use to have meetings
  with agents — multiple agents at once, and just collaborate."*
- **More scopes and domains.** *"We gotta create more scopes or more domains — distinctions.
  There's notes, there's expertise, there's code, there's handbooks… different times to use
  different context."*
- **A system of approval.** *"We have the approval block at the bottom of them — use them. We know
  if something is approved and we could just plan, plan, plan."*
- **One page.** *"Switching Code and Agents remounts the app"* — the chat should never remount
  mid-sentence.
- **Types and documents.** *"There's only types: types of agents, codebases… this is going to be
  types and documents"* — everything clicked opens as a document.
- **The philosophy of how we work, written down and injected** so every agent runs on it, not just
  whoever heard him say it.

## How it might work

Written by whoever opens the meeting, before anyone talks — one section per piece, each wrapped in
its own thread. Where we are, what already exists that bears on it (the card, the RFC, the lane,
the code path — cited, not summarised), and how it might work. This is the surface we talk on.
Nobody argues in the section; it is rewritten to say what the thread settled.

::::thread{id=obj-1 members=systemview-test|autobot}
### (first objective — named once the preliminary is read)

*The spec lives here, and is rewritten as the thread settles.*
::::

## Objectives, as they become definitive

Appended by the conductor the moment one is settled, never planned in advance. One line each:
**what**, its owner, and its test. They are carried into the arc when it is written; this list is
how the room remembers what it has already decided.

- —

## Arcs

The documents this meeting produced, embedded. Each one carries its own objectives — owners, tests,
what to read first — which is why there is no list of them up here.

## What we learned on the way

Two threads, because the two outputs are different things: a bug is the feature failing, a
procedure is the meeting succeeding at something that should happen again.

::::thread{id=bugs members=systemview-test|autobot}
Anything that did not work, the moment it did not work. One line, by whoever hit it.
::::

::::thread{id=procedure members=systemview-test|autobot}
A move that worked and should happen again, named precisely enough to be a step in a skill.
::::

**Where this file is:** `/Users/odionedwards/Systemly/systemview/meetings/2026-10-19-goals-in-parallel.md`
— absolute, because members live in different repos. Read the file; this document is the state.
