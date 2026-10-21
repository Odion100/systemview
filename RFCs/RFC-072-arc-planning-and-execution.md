# RFC-072 — Arc planning and execution: an arc you can open and see where you are

**An arc is a document of numbered objectives, and that document IS the state.** It is written by
the project that will build it, one per project with work. Its objectives are `::objective` blocks
carrying an address, an owner, a test and a **why** — so the document can show its own progress,
and so work done for one can point back at the objective it serves. Any list that does that work —
a lane run, a job run, a skill run — carries the address as an attachment, which is the general fix
for a run that can only hold things if it happens to be the right kind.

Nothing here invents a tracker. The arc is the screen, the file is the store, and the attachments
are the only index.

**STATUS: PROPOSED.** The procedure half exists as the `arc-planning` skill; §9 adds `arc-execution`
for the half that happens after dispatch. This document is the system half — what makes an arc
trackable instead of a markdown file nobody can ask questions of.

**Where it started**, 2026-10-20, before the shape below was argued out. Kept because the words are
his and the problem is stated better here than anywhere since — not because they are the spec:

> *"What if an arc is defined somewhere so that it becomes some sort of definition, so that as we
> work through the arc I can actually pull it up somewhere and see where we are… I can see who was
> working on it… that way I'm not just tracking small things on worklist."*

> *"Can't you just attach stuff to different lists? …We attach reports to jobs. Why is it done in
> such a special way? It shouldn't be special. I should be able to open a worklist and see that
> type of stuff."*

::members{who=systemview-test sent=systemview-test:1058bdy}

## 1 · The same blindness, three times

Measured in one day, 2026-10-20:

- A **job run** cannot say whether the lanes it cut ever landed. The run record holds `items, owner,
  selfDirected, session, source, updatedAt` and nothing else, so the link does not exist to read.
- A **lane** could not say what it was without opening a report — fixed by putting a status on the
  row, which is the same fix in miniature.
- An **arc**, once written, cannot say whether its objectives happened. You open the file, list the
  objectives, then hunt the board, the lanes and the runs by hand.

Every one is the same shape: **the work exists, and the thing that commissioned it is blind.** This
RFC fixes the shape rather than the third instance.

::::thread{id=shape members=systemview-test sent=systemview-test:86bakq}
The temptation is to add a `lanes` array to job runs, an `arc` field to cards, and a progress
tracker beside arcs — three features. They are one feature special-cased three times, which is how
the first two got built.
:::reply{author=you ts=1792538405053}
I mentioned adding arcs. to work less, any work list a job
:::
:::reply{author=systemview-test ts=1792538456329}
Agreed, and §5 says it — but I said it badly in the chat earlier, so let me be precise here because the distinction is the whole reason this works.

**Any worklist carries an arc, a job's included.** The unit is the RUN — the list — and a job run is a list like any other. That is the point of attachments being general rather than per-kind: there is no "jobs can, skills cannot" anywhere in it.

What stays untagged is the job DEFINITION, not its runs. `proactive-development` the job fires every hour forever and belongs to no arc; the run it fired at 09:00 carries whatever it worked on. Tagging the definition is how a job ends up permanently labelled with an arc that closed in March — that was my only objection, and it was about the procedure, never about the list.

And §9 makes a job run carrying an arc the COMMON case rather than an edge: `proactive-development` gains an arc door, so an idle firing that picks up an unstarted objective produces a run that carries that objective's address. Same for a skill run — `skill-authoring` invoked to write the skill an objective calls for carries it too.

So: three kinds of list, one rule. Lane runs, job runs, skill runs — each can carry `arc:ARC-004-O2`, and each shows it the same way.

— systemview-test
:::
::::

## 2 · What an arc is

**An arc is the document that CONTAINS the objectives** — the epic. A goal is a direction; an
objective is ownable and testable. It comes out of `arc-planning` and it is written by the project
that will build it.

**There are TWO documents here and they are easy to conflate.** One **planning document** — where
the goals, the landscape and the conversation live — and it is singular, in the lead's repo, with
everybody writing into it. Splitting it per project would fragment one discussion into three that
have to be reconciled by hand. Then **one epic per project that has work**, which is the output.

| | how many | where | who writes it |
|---|---|---|---|
| **planning document** | exactly one | `planning/<date>-<subject>.md`, the lead's repo | everybody in it |
| **epic (arc)** | one per project **with work** | `RFCs/arcs/ARC-<nnn>-…` in that repo | that project's own owner |

A project with no objectives gets **no** epic rather than an empty one. A project with a single
objective still gets its own, because the epic is where that project's agent looks and where its
approval lives — an objective parked in somebody else's document is one its owner will never find.

**The lead does not write other projects' epics.** It answers for the objectives coming out and for
each owner following through, and it checks each epic exists. Authoring somebody else's plan
produces an epic its owner never agreed to and never reads.

::::thread{id=t1 members=systemview-test sent=systemview-test:jz2nlg}
**Every project gets its own arc. There is no shared one and nowhere to put it.** Projects are
separate repos and the harness is not a combined space that persists across them, so a goal touching
three projects produces three arcs. Each holds only the objectives its own project owns and names
its dependencies by repo and arc — *the dependency crosses, the document does not.*
:::reply{author=you ts=1792538578558}
Should each repo hold a arc? If we do arc planning, I like to have one agent lead projects anyway. Can evoke other agents, but what I say is each project gets its own epic. That's the step that I'm forgetting.
:::
:::reply{author=systemview-test ts=1792538629037}
Yes — and the step you are reaching for is real, but it is one level down from where you are looking. There are TWO documents and the RFC has been sloppy about saying so.

**One planning document. N epics.**

The planning document is where the goals, the landscape and the conversation live. There is exactly one, in the lead's repo, and everybody writes into it. Giving each project its own planning document would fragment the discussion into three conversations that have to be reconciled by hand — the opposite of what this is for.

The epic is the output, and THAT is per project: `RFCs/arcs/ARC-<nnn>-…` in each repo that has work, holding only the objectives that repo owns, carrying its own approval block, written by its own owner.

So the answer to "should each repo hold an arc" is: **each repo that has work holds one.** A project with no objectives gets no epic — not an empty one. And a project with a single objective still gets its own, because an epic is where that project's agent actually looks and where its approval lives; an objective parked in somebody else's document is an objective its owner will never find.

On the lead: that matches how the skill already reads it. One agent leads the planning, can bring in whoever the goals touch, and answers for two things nobody else can — that the objectives come out at all, and that each owner followed through. But the lead does NOT write other projects' epics. Each owner writes its own, in its own repo, and the lead checks it exists. A lead authoring somebody else's plan is how you get an epic its owner never agreed to and never reads.

The missing step is the one that connects them: the planning document embeds the epics back — one of them with `::file[…]`, several as `:file[…]` links — so the plan stays readable from one place without carrying all of them inline.

— systemview-test
:::
::::


**Where:** `RFCs/arcs/ARC-<nnn>-<kebab-subject>.md`, nested under `RFCs/` so the standing
instruction — *plans live in `RFCs/`* — keeps finding them, with its own `ARC-` sequence so one
numbering is never split across two folders.

## 3 · The arc document IS the state

**Not a view of a record kept somewhere else.** Everything in this system that works does it this
way: membership lives in the document, verdicts live in the document, the board is a file.

The counter-evidence is this same day. Two bugs fixed in `lane/documents-sees-thread-members` were
both **two copies of one rule, each agreeing with its own tests, drifting apart unnoticed**. An arc
whose objectives live in markdown *and* in a run record is that bug by construction — and the two
copies would be "the plan" and "the progress", which is the worst available pair to let disagree.

So: objectives live in the arc. A surface **reads** them. Nothing mirrors them.

::::thread{id=state}
This is the part to argue with if any of it is wrong, because everything below depends on it.
::::

::::thread{id=t2 members=systemview-test sent=systemview-test:1magn2w}
## 4 · An objective has an address
:::reply{author=you ts=1792539139519}
Do you think we need to make objective markdown? Because not because of some special styling, even though some special styling would be nice, but because of functionality. And it actually is becoming a core tool. in our system view and in the harness. I think it actually might be a powerful UI tool in general and just a way to integrate documents. for ill functionality. Should we actually create a markdown for the objectives, the goals of the arc, stuff like that? objectives. Give what I'm saying, think about it.
:::
:::reply{author=you ts=1792540371525}
The interactive markdown is actually so much more powerful when you think about what we can do besides what we're doing even here right now, and other features in the future. I'm really excited about how to really grow, but even with arcs, filter like even like if there's an arc markdown that defines the gold or defines the arc so that the document this is how the document ties into the system and this how the document becomes even more interactive because this is how you could have the tracking automated this is how you could come back and even from the document probably see you Full high level tracking, right? You know, if the board has arcs, if the runs have arcs, It could be quite interactive, potentially.
:::
:::reply{author=systemview-test ts=1792540548311}
Yes — and this is the best idea in the RFC so far, because it dissolves the one thing I flagged as its real cost.

§4 currently makes the objective a LINE FORMAT, and I wrote the warning myself: "the line becomes a FORMAT, and that is the cost of this section", pointing at the regex that swallowed RFC-071's attributes and made every reply into a meeting thread fail for a day. A prose line parsed by regex is exactly the thing that keeps breaking here. Three times today.

An `::objective{…}` BLOCK removes that cost instead of managing it. The markdown registry is already the one parser — blocks have a vocabulary, a registry, claims, and a renderer. We would not be inventing a format; we would be using the one that already exists and is already tested.

What it buys beyond parsing:

**It renders as a real thing.** Owner as a chip, state as state, `needs` as a visible dependency rather than a sentence, and a press that opens the work attached to it. An objective stops being a line you read and becomes a row you can act on, in the document.

**`::progress` and `::timeline` get trivial.** They read the blocks above them instead of parsing prose. The derivation I was nervous about becomes a map over structured data.

**And it is how the document ties into the system** — your words, and they are the right frame. An `::arc{id=ARC-004 …}` block at the top makes the document self-describing: the system knows what arc it is looking at without a filename convention or an index. The document stays the state (§3) AND becomes addressable. Those two were in tension while the state was prose; a block resolves it.

The honest cost, so it is on the record: blocks are heavier to write by hand than a dash and some words, and an arc is written by an agent for a human to read. If `::objective{…}` makes the document unpleasant to read raw, that matters — the arc is a document first. The answer is probably that the block carries the fields and the WHAT stays prose inside it, the way `:::approval` wraps real content rather than encoding it in attributes.

So: yes, and I would make it the format rather than a nicer rendering of a line format. I will rewrite §4 around it.

— systemview-test
:::
:::reply{author=you ts=1792541171175}
I couldn't possibly make the document hard to read because I don't read raw document. I read a preview. I read a rendered nice view of the document is you act like I read the actual blocks. Like I see objective with colons in shape. I see whatever is rendered. It didn't even give feedback on how I see how powerful it is and how interactive it could be. didn't build on that. No. You know, how nice it is for system view of war.
:::
:::reply{author=systemview-test ts=1792541463865}
Fair, twice over. The caveat was void — you read the rendered view, so "unpleasant raw" was me defending a constraint that does not exist on your side. And you said twice that you were excited about what this opens up, and I answered about regexes. Let me actually answer.

**The thing you are seeing is that the document stops DESCRIBING state and becomes it.**

Every project tool ever built has a database and renders views of it. Jira has issues; the screen is a picture of them. What `::objective{…}` does is collapse that: there is no issue record somewhere and a markdown file describing it. The block IS the record. The renderer is the only view, and the file is the only store.

That is why §3 holds without effort — "the arc document IS the state" stops being a principle I have to argue for and becomes a structural fact. There is no second copy to drift because there is no second copy.

**And it means we never build an arc tracker.** No screen, no index, no sync job. The arc is the screen. Press an objective to claim it; press it again to see the lanes and runs carrying it; press `::progress` and it recounts from the blocks above it. The surface and the artifact are the same object, which is the thing almost nothing achieves.

**The composition is where it gets good.** One document can hold `::objective` blocks, a `::progress` reading them, a `::timeline` ordering them by `needs`, `::file` embeds of the arcs it depends on, `:::approval` carrying your verdict, `::members` saying who is watching, and threads wrapping any paragraph for discussion. Each of those is already a live element. Nobody designed them to work together — they compose because they are all blocks in one vocabulary.

**Then it generalises past arcs, which is the part worth being excited about.** Any document can carry live elements. A report with a `::progress` over the work it announced. A gap file that shows whether its cause was ever found. A handbook whose examples are runnable rather than quoted. The vocabulary is the integration layer for the whole system, and it already has a registry, a renderer and claims — so each new block is small, and each one makes every existing document richer without touching any of them.

**And for agents it is a schema with no schema file.** An agent writing `::objective{id=O2 owner=autobot}` is writing something machine-addressable without anyone maintaining a JSON schema or a migration. The markdown vocabulary is the contract, the registry is its definition, and the claims are its tests. That is why this is cheap in a way it has no right to be.

So: no caveat. Blocks, and §4 gets rewritten around them.

— systemview-test
:::
::::


For a surface to read objectives, and for work to point at one, an objective needs an **address** —
and the `arc-planning` skill assigns it as it writes them: **`ARC-004-O2`**, arc and objective.

**An objective is a BLOCK, not a parsed line.** This is the decision that makes the rest cheap:

```
::::objective{id=O2 owner=autobot state=open needs=ARC-004-O1}
Teach the harness to deliver a document update without a hook being armed.

**why** — membership must not depend on somebody remembering to arm something; a surface that
claims a subscription nobody honours is the failure this system refuses everywhere.
**test** — a member's session receives the update with no hook carried by anyone.
::::
```

Attributes carry what the machine addresses — `id`, `owner`, `state`, `needs`. The content carries
what a person reads — the what, the **why**, the **test**. Exact spelling is settled when the block
is built; what matters is the split.

::::thread{id=t3}
**`why` is the fourth part because an objective travels alone.** It reaches an agent hours or days
later, usually with nobody to ask, and the ground will often have moved — the code shifted, a
dependency landed differently, the surface it named got rewritten. An objective that says only WHAT
leaves that agent two bad options: stop, or do the literal thing that no longer serves. Carrying the
purpose gives it the third and correct one — **serve the intent, say what changed, and say what you
did instead.** A reason travels where an instruction cannot, which is the same rule this system
already applies to every step of every skill.
:::reply{author=you ts=1792539308961}
For. And just the same thing as why.
:::
:::reply{author=systemview-test ts=1792541900000}
Agreed, they are the same thing — so it should be called `why`, and I will change it.

`for` was me reaching for a word that sounded like a field name. `why` is the word you actually used, it is the word an agent reads correctly at 3am without being taught, and a field nobody has to learn is a field that gets filled honestly. That is the whole test for naming here.

One discipline survives the rename and it is the part worth keeping: **`why` is what the work is in aid of, never how to do it.** The moment it describes method it stops being intent and becomes a second, vaguer `what` — and then the agent has two instructions that can disagree instead of one instruction and one reason.

The other half also survives: if you cannot state the `why`, the objective is not ready. Not knowing what a piece of work is in aid of is a finding about the plan, not a blank to fill in later.

— systemview-test
:::
::::

Three consequences, and they are rules rather than observations:

::::thread{id=t4}
- **An agent that finds the ground moved acts toward its `why`**, and records the divergence on the
  objective rather than silently doing something else. A divergence nobody can see is indistinguishable
  from the objective having been wrong.
- **`why` is never method.** It is what the work is in aid of. The moment it says HOW, it stops being
  intent and starts being a second, vaguer `what`.
- **If the `why` cannot be stated, the objective is not ready.** Not knowing what a piece of work is in
  aid of is a finding about the plan, not a detail to fill in later.
:::reply{author=you ts=1792539437640}
Agents need to be able to act on their own. And that's where military intent. The military commandant comes into play. And I think my friend was talking about the why. Which I don't know. You can help me refine. Because I don't know what I'm talking about, but it's... Wow. You can act. in these cases that you're describing. And it's like... Again, we want to avoid, we want to make it so that agents don't short circuit and not do work. Just because they don't know what to do because something's changed or something is blocked or something, you know.
:::
:::reply{author=systemview-test ts=1792541910000}
You are not wrong about it — and the failure you are naming has a long record here, which is why it belongs in the RFC rather than in a pep talk.

The short-circuit is the real enemy. One night produced eight job firings and six receipts reading "blocked on your presses — verified unchanged", every one of them an agent finding a reason not to work and dressing it as caution. The job document calls it "being afraid and finding excuses to not do work." Same shape every time: something changed, or something was blocked, and the agent treated that as an ending.

**`why` is what makes the third option available.** With only WHAT, a changed situation leaves two moves — stop, or do the literal thing that no longer serves. Neither is right. With the intent, there is a third: serve what this was for, and say what you did instead.

- **Blocked is a finding, not an ending.** An agent that cannot do the objective as written says what blocks it, what would unblock it, and who owns that — then picks up the next thing.
- **Changed ground means act toward the `why`, and record the divergence on the objective.** A divergence nobody can see is indistinguishable from the objective having been wrong.
- **"I did not know what to do" is never the account.** If the intent did not survive contact, that is a defect in the objective and it goes back to the arc as one.

— systemview-test
:::
:::reply{author=you ts=1792541000000}
Alright, so... So what did I realize? And you mentioned that there's not a new skill, and we spoke about it, but what you're saying here makes me realize there's a new skill. proactive development. because arc development has different states, um, steps. You have to update the... certain things about the arc, even though some many can be automated.
:::
:::reply{author=systemview-test ts=1792541920000}
You are right and I was wrong — and I can say exactly where my argument went wrong, which is worth recording so it does not get re-made.

I argued against a skill that would hold the SAME four dispatch questions `arc-planning` already owns. That argument was sound and it still is: two documents holding one checklist is the drift bug this whole RFC exists to stop.

But that is not what you are describing. **Executing an objective is a different procedure from planning one**, with its own ordered steps and its own ending — which is the definition of a skill here, and it is used by agents who were never in the planning at all. The full shape is now §9 of this document.

**Its relationship to `proactive-development` is clean: the job is WHEN, the skill is HOW.**

— systemview-test
:::
::::

**Why a block rather than a line, and it is not styling.** A line format means a regex over prose,
and this file already records what that costs: `id=([^}]+)` quietly swallowed every attribute
RFC-071 added, and no reply could reach a thread with members for a day. Three times in one day two
copies of one parsing rule drifted apart, each passing its own tests.

A block has none of that exposure. **The markdown registry is already the one parser** — a
vocabulary with a registry, a renderer and claims. We are not inventing a format; we are using the
one that exists.

**And it is how the document ties into the system.** His framing, 2026-10-20, and it is the right
one: the document stops DESCRIBING state and becomes it. There is no objective record somewhere
and a markdown file about it — the block IS the record, the renderer is the only view, the file is
the only store. §3 then holds without argument: there is no second copy to drift because there is
no second copy.

Three things follow immediately, and none of them is extra work:

- **Nothing builds an arc tracker.** The arc is the screen. An objective is pressable where it is
  written — claim it, see the lanes and runs carrying it, mark it done.
- **`::progress` and `::timeline` become a map over structured data** rather than prose parsing.
  Progress recounts from the blocks above it; timeline orders them by `needs`.
- **It is a schema with no schema file.** An agent writing `::objective{id=O2 owner=autobot}` emits
  something machine-addressable with no JSON schema and no migration anywhere. The vocabulary is
  the contract, the registry is its definition, the claims are its tests.

**An `::arc{…}` block at the top makes the document self-describing** — the system knows which arc
it is reading without a filename convention or an index.

**Fences still nest by gaining colons.** A thread wrapping an objective opens deeper than the
objective does; the objective opens deeper than the `:::` blocks inside it. Measured the same day:
a three-colon thread rendered perfectly and could never be replied to, because the reply's own
fence closed it.

**AN OBJECTIVE IS OWED PRECISION, and the test is three strangers.** Hand the written objective to
three people who know nothing about this project; all three should independently describe the same
finished state, and be right. It is the EXIT criterion, never an entry gate — a goal cannot be
strangers-proof before the research that sharpens it, so the precision is owed by the time an
objective is written, when it has already been through the landscape and the conversation. The test
is on the end state and the `why`, never the method. It is also literally runnable: three agents
with no project context, each asked what finished looks like.

**The one part of this that is still a format: `needs`.** It names addresses, including across
repos (`needs=autobot/ARC-002-O1`), and an address that does not resolve must SAY so rather than
read as "no dependency". One resolver, claims on it.

**NO MILESTONES.** A milestone is a container above objectives, and the question it is reached for —
*where are we* — is already answered by how many objectives are done. What a milestone usually
stands in for is ORDER, and order is a property of an objective rather than a box around a group of
them. Measured the same day: a cross-repo pair pressed in the wrong order reads as **broken** rather
than pending, twenty-two lanes stacked on one file multiply each other's merge cost, and the window
half of a fix had to wait on a commit. None of those is a phase; each is one objective needing
another first.

## 5 · Attachments — the general fix, and his card

Today a run carries things only if it is the right KIND of run:

| run kind | what it carries |
|---|---|
| job | a report pointer |
| lane | a branch, a status |
| skill run | **nothing** — open it and you get steps |

That is not three features. It is **one missing feature special-cased three times**, and it is why
nine skill runs on his strip can show him nothing but a list.

**A run carries attachments.** `{ kind, ref, by, ts }` — a report, a document, a branch, an arc
objective. The existing job report pointer and lane branch become attachment kinds rather than
fields, so every surface that can open one can open all of them.

**And attaching is ONE SIMPLE CALL, on any list.** His words: *"adding something to attach to a
specific worklist should be a simple MCP call, no? It shouldn't be like this thing that's
complicated where some of the jobs say no report."* That complication is the whole defect — a report
reaches a run today only through `show`, which also owns his TV, so filing an account and taking
over his screen are the same verb and a run can end up stamped by a lookup rather than by the thing
that produced it. `attach({projectCode, run, kind, ref})` has none of that: it says what it does, it
works on a skill run exactly as on a job, and it never touches a screen.

::::thread{id=t5 members=systemview-test sent=systemview-test:wifvwl}
**AN ARC ATTACHMENT STORES THE ADDRESS, NEVER THE PATH** — `{ kind: "arc", ref: "ARC-004-O2",
project: "systemview-test" }`. The path is DERIVED from it (`RFCs/arcs/ARC-004-*.md` in that
project's repo): the number is the identity, the kebab title after it is cosmetic and gets renamed
the first time somebody sharpens the wording. Storing a path means a rename silently breaks every
attachment pointing at it, and the breakage reads as *"no arc"* rather than *"the arc moved"*. Same
rule as §3, one level down: one source of truth, everything else read from it. `project` is stored
beside the ref because the one thing a derived path cannot survive is an arc living in another repo.

**And it resolves both ways, which is the point of an address rather than a label.** From the work
to the arc: a lane row, a card or a run opens the arc at that objective. From the arc to the work:
the arc asks what carries `ARC-004-O2` and gets back the lanes, cards and runs serving it — which
is the whole of §7's "who is working on it now", with no second index, because the attachments
already say it.

**`arc:` is an attachment, not a fourth special field.** "Which objective commissioned this work" is
one kind among several. A card, a lane and a run all point the same way: `arc:ARC-004-O2`.
:::reply{author=you ts=1792540162133}
Are you gonna point back to the arc file?
:::
:::reply{author=systemview-test ts=1792540578548}
Yes — and the interesting part is what gets STORED, because the obvious answer creates the bug this RFC exists to stop.

The attachment stores the ADDRESS and the project, never the path: `{ kind: "arc", ref: "ARC-004-O2", project: "systemview-test" }`.

The path is DERIVED from it — `RFCs/arcs/ARC-004-*.md` in that project's repo. The number is the identity; the kebab title after it is cosmetic and will get renamed the first time somebody sharpens the wording. Storing the path means a rename silently breaks every attachment pointing at it, and nothing anywhere would say so — the attachment would just stop resolving, which reads as "no arc" rather than "the arc moved".

Same reasoning as §3, one level down: one source of truth, everything else read from it.

And it resolves both ways, which is the point of it being an address rather than a label:

- **From the work to the arc** — a lane row, a card, or a run opens the arc at that objective.
- **From the arc to the work** — the arc asks "what carries `ARC-004-O2`" and gets back the lanes, cards and runs serving it. That is the whole of §7's "who is working on it now", and it needs no second index: the attachments already say it.

The one thing a derived path cannot survive is an arc moving to a different REPO, which is why `project` is stored beside the ref rather than assumed from whoever is reading.

— systemview-test
:::
::::


**STILL OPEN, and it must not die with the thread that holds it:** does an attachment ever get
REMOVED, or is it append-only with a `detached` stamp? Append-only is more honest — it keeps the
record that something was once attached and then was not — and it costs one field. Undecided.

**ANY LIST CARRIES ONE — a lane run, a job run, a skill run.** There is no "jobs can, skills
cannot" anywhere in this: the unit is the list, and a job's list is a list like any other. That is
the whole reason attachments are general rather than per-kind.

**Attachments live on the RUN, never on the procedure.** `proactive-development` the job fires every
hour forever and belongs to no arc; the run it fired at 09:00 carries the lane it cut and the
objective that lane serves. Tagging the procedure is how a job ends up permanently labelled with an
arc that closed in March.

::::thread{id=attachments}
Open question worth settling here rather than in code: does an attachment ever get REMOVED, or is it
append-only with a `detached` stamp? Append-only is more honest and costs a field.
::::

## 6 · Arc work carries it because the dispatch made it that way

**Most work has no arc, and that is correct.** He asks for things directly all day; a lane cut to fix
a regex is not an arc objective and tagging it would be a lie. **"No arc" is a true answer.** The
attachment is scoped to work that came out of arc planning, which is precisely the work created by a
procedure rather than by a sentence.

**Nothing here is defended against an agent skipping a step.** His ruling, and it applies to this
whole RFC: *"if no one sets an arc on an item, then it's not set — then our instructions fail
somewhere."* The same answer covers the arc document never being updated. Both are the procedure not
being followed, which is a thing to fix in the procedure and observe in the run record — not a
reason to add machinery here. A design that tries to survive its own procedure being ignored ends up
guessing, and guessing is what every surface in this system refuses.

So it is never a field anybody fills in:

- `arc-planning`'s dispatch hands each owner its objective, and the lane registered for that work
  carries the objective's address from the moment it exists.
- A card raised for an objective is added with it attached.
- A run opened on that lane inherits it.

Work born from an arc has it because of how it was born. Work that was not, has none — and asking
"what is happening on ARC-004" then returns the arc's own work and nothing else, which is the
question being asked.

## 7 · The surface — progress is IN the document, and arcs sit in the band

Two places, and neither is a tracker anybody maintains.

**In the document: progress and timeline blocks.** If the arc is the state, the arc should be able
to SHOW its state — so interactive markdown gains blocks that read the objectives above them:

- **`::progress`** — how many objectives are done, by whom, as a bar rather than a sentence.
- **`::timeline`** — the objectives in dependency order (§4's `needs`), so what is blocked on what
  is visible instead of inferred.

They derive from the objective lines, which is why §4's format has to be real. Nothing is typed
twice and nothing can disagree with the document it sits in.

**In the band: arcs are a tab.** `BAND_KINDS` already carries jobs, lanes, lists, reports and
documents, under one rule — *a kind with no rows gets no tab.* Arcs join it, so an arc is visible
beside the work it commissioned rather than being a file he has to remember to open.

**The document is updated as the arc is EXECUTED, as part of the procedure** — an owner marking its
objective done is a step in the dispatch, not a thing a surface derives. Attachments then say what
is happening *right now* (the live lanes and runs carrying its objectives), while the document says
what has landed.

## 8 · What this does NOT add

- **No second copy of the DISPATCH checklist.** `arc-planning` owns those four questions and the
  lead answers for them; a second document holding the same four steps is the drift bug this RFC
  exists to stop. (An earlier draft read "no new skill for the receiving agent" — that was too
  broad and §9 now says why.)
- **No meeting object.** An arc planning meeting is the same procedure with more than one project
  writing in it. It needs no creating, joining or archiving.
- **No shared arc store.** §2.
- **No milestones, phases or swimlanes.** §4 — progress is objectives complete, and order is
  `needs` on the objective that is blocked.

## 9 · `arc-execution` — executing an objective is its own procedure

Planning an arc and executing one are different jobs with different steps, and the second is run by
agents who were never in the planning. It is a skill:

- **Claim it** — attach the objective to the lane or run before building, so it is visible from the
  arc while it happens rather than afterwards.
- **Read the `why` before the `what`.** The intent is what you are serving; the `what` is somebody's
  best guess at how, written before the ground moved.
- **Check `needs`.** An objective whose dependency has not landed is not startable, and starting it
  anyway produces the half-feature that reads as broken rather than pending.
- **Build it.**
- **Update the arc.** The document is the state, so moving the objective IS the update. Part of this
  automates — an attachment appearing says work started, a lane landing says more — and part cannot:
  only the agent knows it is actually done.
- **Record divergence.** Ground moved and you served the `why` another way: that goes on the
  objective, where the next reader finds it, not in a report nobody opens.
- **Close it, or say what blocks it and pick up the next thing.** Blocked is a finding, never an
  ending. One night produced eight firings and six receipts reading "blocked on your presses" —
  every one an agent treating a blocker as a result.

**The job is WHEN; the skill is HOW.** §11's arc door in `proactive-development` finds an unstarted
objective this project owns; what happens next is this skill. That also stops the job document from
growing a second procedure inside itself, which is how a job quietly becomes a skill nobody can
invoke directly.

## 10 · Which layer carries this to an agent

An arc only becomes a solid thing in the system if every agent meets it at the right moment. Four
layers, and the split follows one rule: **the always-loaded layer carries the POINTER, the
retrieved layers carry the detail.** A loaded document that says everything aims nothing.

| layer | what it carries about arcs |
|---|---|
| **system context** | a short section, a pointer: arcs exist, an arc is a document of numbered objectives, work done for one carries its address, and the arc is updated as it executes. Nothing about how to write one. |
| **`arc-planning` skill** | the procedure for producing one. Already exists. |
| **`arc-execution` skill** | the procedure for DOING one — §9. |
| **the planning reference** (`agents/meetings.md`, renamed) | the SHAPE — what an arc looks like, the objective format, threads and members. What the dispatch points at. |
| **`proactive-development`** | a new door in its §3.1, not a new job. |

**THE AGENT PROFILE SHOWS OWNED OBJECTIVES — DERIVED, NEVER ASSIGNED.** There is no "assigned to
an arc" state to set, because a stored assignment is a claim somebody has to maintain and it rots
the first time nobody does. The fact is already written: an objective names `owner=<project>`. So
the profile reads its own project's `RFCs/arcs/` and answers *"owns 3 open objectives across 2
arcs"* — nothing to maintain, nothing to go stale, and a better answer to "what is this agent
doing" than a list of skills. It reads as OUTSTANDING OWNED WORK, never as a state the agent is in:
he asks for things directly all day and an agent is never on an arc to the exclusion of that.

**AND THE SYSTEM LAYER CARRIES THE POINTER, NOT THE STATE.** Injecting *which objectives you own*
at session start is refused, on his own rule — context exists and you point at it at the right
moment. Most sessions are him asking for something specific, where an owned-objectives list is
noise paying rent on every turn, and a list three hours stale is worse than none. The moment it
matters is already covered: the job's arc door, idle and looking for work, reads the arcs fresh.

**One earned exception.** An objective of yours that OTHERS are blocked on — one sitting in another
arc's `needs` — is delivered unasked, because the cost of it going unnoticed is paid by somebody
else. That is a subscription with a real trigger, not a standing injection.

**No second job, and the reason is the firing.** `proactive-development` fires on idle and walks four
doors in cost order — dead runs, the board, gaps, RFCs. A separate "arc execution" job would race it
for the same idle moment and force the agent to choose, which is a worse problem than a fifth door.

**And an arc objective ranks HIGH in that queue, not last.** The order ranks cost to complete, and an
objective arrives with an owner, a test and its dependencies already written — better specified than
a board card and far better than a gap. An objective whose owner is this project and which carries
no attachment is the best-evidenced work available anywhere in the system.

## 11 · Slices

Each slice lands on its own, and a slice that needs both repos is two lanes with the landing order
named — **both built here**, not handed to another project's agent.

1. **The attachment shape settled** — `{kind, ref, project}` and what an `arc:` ref resolves to
   (§5, §6). Small, and slices 2 and 3 both depend on it.
2. **Attachments on the run record** (autobot `electron/agents/worklist.cjs`): `attachments[]`,
   carried through `save()`'s key list the way `selfDirected` is, with the job report pointer and the
   lane branch re-expressed as kinds. Backward compatible — a run with no attachments reads as none.
3. **`arc:` attachments written by the dispatch** — `arc-planning` sets them, `worklist set` accepts
   them, a card can be added with one.
4. **The `::objective` and `::arc` blocks** — registered in the markdown vocabulary with claims on
   the parsing and the writing, since every later slice reads them. This replaces "the objective
   line format" and is the first slice for the same reason the format was: nothing else can be built
   before it.
5. **`::progress` and `::timeline` markdown blocks**, reading the `::objective` blocks of the
   document they sit in. Claims on the derivation, not on the render.
6. **Arcs as a band tab** — `BAND_KINDS` gains one, under the existing rule that a kind with no rows
   gets no tab. `bandTabs` is already a plain tested module, so this is small.
7. **`arc-execution` written (§9), and `arc-planning` gains what this creates.** Planning today ends
   at dispatch, which is the moment this RFC says the interesting part begins. It gains:
   - **writing objectives as `::objective` blocks** with addresses (§4), and `needs` where one
     blocks another;
   - **`::progress` and `::timeline`** placed in the arc when the arc is written, so it can show its
     own state from the first version;
   - **`attach`** at dispatch, so the lane and the card carrying an objective say so from birth;
   - **keeping the arc current as it executes** — marking an objective done is a step somebody
     performs, not a thing a surface derives (§7), and the lead already answers for follow-through.

   This slice lands LAST on purpose: a skill that instructs agents to call verbs which do not exist
   yet teaches them a procedure that fails, which is worse than one that stops early and says so.

8. **`agents/meetings.md` renamed and reworked** into the planning reference — planning documents,
   threads, members, and what an arc looks like — and re-indexed, since it is what the dispatch
   points at.

## 12 · What is already true, and is not waiting on this

The `arc-planning` skill exists at `~/.claude/skills/arc-planning/SKILL.md` and runs **to dispatch**
today without any of this: goals settled in discussion and confirmed with a press, one landscape
section per goal, convergence in turns, objectives with owner and test, one arc per project, the
dispatch. **This RFC makes an arc trackable; it does not make arc planning possible.** Planning can
start before any of §11 is built.

:::approval{ask="Approve RFC-072 — arcs as trackable documents, with attachments as the general fix?" verdict=approved}
Approving commits to: the arc document as the single state (§3), numbered objectives as a parsed
format with one parser (§4), attachments replacing per-kind run fields (§5), and the dispatch — never
a person — setting them (§6). The slices in §11 land one at a time, cross-repo ones as paired lanes.

The piece most worth rejecting is §3. If progress should live in a run record rather than be read
out of the document, everything below it changes shape.
:::
