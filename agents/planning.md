# Planning — the report, and the arc it produces

**Planning happens in a PLANNING REPORT — `::report{as=planning}`.** That is the kind, and it is
how the document registers and how anything finds it. It exists to produce an **arc**,
and an arc is a document too, so both are described here in one reference: split across two, the
dispatch was written in one and the thing it dispatched lived in the other.

**It is planning, and the document is a planning report** — not an event, a room, or a call. The
threads carry the conversation, and the pinned row in the document's top-right corner tells anyone
on it when something moved; nobody has to be present at the same time. What separates a planning document from the
accounts work leaves behind is not its kind but what it CARRIES: members, replies, verdicts and an
embedded arc make it a surface people ACT on, where most reports are read.

**Who is who.** *He* is the human who owns the project — the plan is his, the goals are his
words, and the sends are his presses. *The opener* is the agent that creates the document and does
the research in it. *Members* are **project codes** (`buapi`, `autobot`) — a member is a room, not
a person, because that is what delivery takes. See `markdown.md` → `::members`.

**Behind is a state; a press is a send.** Editing the document makes its members *behind* — that is
computed, nobody announces it, and their corner shows it the next time they look at the document.
**Being behind does not reach anybody.** Reaching them is the press: a chip in the corner tells one
member, `all N` tells everyone behind, and only then does a turn land in their session. Writing
`::members{who=…}` declares membership and notifies nobody.

**An agent cannot press.** The send is a window control today, so an agent that writes into a
planning report waits for him to announce it. Plan around that: it is the current shape, not a detail.

**He has no address, and needs none.** Members are project codes; he is not one. He finds out the
report is ready because it is his repo and the document is open in his window — so when the plan
needs him, say so in the chat, not by expecting a notification to reach him.

**What an arc is.** The deliverable, and it is its OWN kind of document — not an RFC. It carries an
`::arc` leaf, and inside it one `::objective` block per ownable piece, each with an owner, its
requirements and what the work is for. An RFC comes later and one level down: the plan an
objective's owner writes to serve it. The shape is in "What an arc looks like" below.

The report embeds the arc back with `::file[…]` so it reads inline — **relative when the arc is in
this repo, absolute when it is in another**, which is the common case for a cross-repo goal.

## Why you would open one

Two reasons, and the second is not a lesser one.

- **To turn goals into arcs** — he states the goals, the room plans against the project as it is,
  and the pieces that earn a document get one.
- **To leave a record of the collaboration.** Two agents working something out together open one so
  the exchange LEAVES SOMETHING: a document saying what was considered, by whom, and what they
  settled. Otherwise it lives in two transcripts nobody reads again and all that survives is one
  agent's account, which is the weakest evidence here. A plan whose only output is the record is
  finished, not failed.

**Whoever opens it conducts it.** Not a room set up for other people to use — the opener gets the
goals, writes the landscape, places the members, keeps each section current as plans land, closes
every piece and dispatches the work. Nobody else picks it up if they stop.

## Opening one

1. **Give it its leaf.** `::report{id="<Subject>" as=planning retain=7d}` at the top, with
   `::members` beside it. The leaf is what makes the document exist to the system — it registers on
   save, and from that moment the registry finds it, the band lists it, and anything can point at
   it. **A planning document with no leaf is not merely unlisted, it is invisible**, and then the
   only way anybody finds it is remembering where you put it.

   **Which is why the folder is not a decision.** Put the file where it belongs to a reader —
   `meetings/<date>-<subject>.md` in the repo whose agent is opening it, visible, never in
   `.systemview/`. One copy, never mirrored into other repos; the frame carries the absolute path
   so members elsewhere can read it. The leaf decides its life, not its directory: 7d is the
   deciding window, and promoting it to `permanent` is one of its legitimate endings, chosen at
   close rather than at opening.
2. **The members line carries you; he adds whom he wants.** (A member is a project code, and only
   a CONNECTED project is one — an unknown code renders fine and delivers to nobody.)
3. **Write his goals in his words** — quoted. If you were handed a subject rather than goals, the
   report is NOT ready to open: say so and ask him for the goal. An agent that converts a request
   into a goal has made the decision the planning exists to make.
4. **Write the landscape sections** — one per goal, headed by that goal, and a piece that cuts
   across several goals gets its own section named for the thing. The next chapter is what goes in
   one. **A document of empty headings is not an opened plan.**

## What goes in a landscape section

**Researched reality, then your proposal, then room for the plans.** In that order, and leaving any
of the three out breaks the section in a different way.

1. **Where the project is on this goal** — what exists and how it actually works, mostly the code,
   read the way you read before doing any other work. Not a survey of cards and RFCs: that
   describes what somebody intended rather than what is there.
2. **How it might work** — your own initial proposal as the opener, written out far enough to be
   disagreed with. A section with no proposal is a status report, and nobody can answer a status
   report. The proposal is what gives the room something to answer.
3. **The plans.** The landscape sets the plan up; the plans lay the **implementation detail** out —
   the files and paths, the order, the mechanism, what has to exist first, what is needed from
   somebody else. One per agent, each signed by whoever wrote it, nobody rewriting anybody else's.

**Detail is not optional, because the arc is written FROM these.** An RFC is implementation detail —
a plan without it is a report — so a section full of intentions cannot become an arc at close and
the planning quietly produces nothing. If you cannot say how, say what you would have to find out
first: that is a plan, and "we should improve X" is not.

**Cite, do not summarise.** A file by `path` or `path:line`, a card by its title, an RFC by its
number, a lane by its branch. A claim with no address is an opinion.

## `auto` and `managed` — the gate, per member

**They are not two modes of the document — they are the two lanes of one gate, per member.** Blocks
are the only senders: a decision block or a reply FIRES when its answer lands, general prose sends
no updates ever, and the members line decides WHEN each member hears a fire. A member on `auto=` is
told the moment it lands. A plain member's copy is HELD, and his press in the corner releases it.
So `auto` and `managed` describe members, not documents — one document can hold both at once.

### The markdown that places them

Document level — one line, under the lead paragraph, before the first section heading:

```markdown
::members{who=buapi|autobot auto=buapi}
```

`who=` is the room; `auto=` names which of them hear fires without a press. A thread aims its own
audience with ONE attribute — `subscribe=` — and anything it names is authored, so it is delivered
the moment something lands in the thread, no press involved:

```markdown
::::thread{id=plumbing subscribe=buapi|autobot}
<<the thread for this goal>>
::::
```

A thread with no `subscribe=` inherits the document's members — and inherits the gate with them:
its fires reach the `auto=` members at once and wait on his press for the rest.

- **`who=` and `subscribe=` are pipe-separated project codes.** Only a CONNECTED project is a
  member; an unknown code renders fine and delivers to nobody, which is the worst failure
  available here. (A thread still carrying the older `members=` answers as `subscribe=`; the next
  save rewrites it.)
- **Never write `told=` by hand.** The engine stamps it when a delivery lands — it is the record of
  who heard which fire, and writing it yourself tells the document somebody was told who wasn't.
- **A thread's `subscribe=` narrows, it does not inherit.** Only those people hear what lands
  there. Put the whole room on a thread only when the whole room is really in it.

### A managed member goes quiet when he steps away, and that is not silence from the room

The press is a window control. Decisions held with nobody told is the normal resting state of a
document whose members are plain. Keep writing your plan in its section — the corner shows him what
is held, and he releases when he reads.

## Where it lives, and how it reaches his panel

**It is committed in the repo, beside the code it plans** — visible, like any other document;
`meetings/` is the convention here, and `.systemview/` is machine state, never a home for one.

**Residence decides nothing about how long it lasts — the leaf does.** `api/janitor.js` reads the
**registry**, never a folder or a glob: it collects any registered document — report, RFC, gap or
arc — whose leaf says `retired=`, on no clock and no mtime. Even `retain=permanent` does not
protect one, because the retirement is the later fact. So nothing survives by sitting in the right
directory, and nothing is swept for being old.

**You still put it in front of him, because that is where he looks.** The file stays in the repo
and he is navigated to it — nothing is copied and nothing is snapshotted:

```
nav({projectCode, file: "<the path you wrote it to>"})
```

**And you reply to that same PATH.** `Reports.read` takes any argument ending in `.md` verbatim,
which is what makes the path land in the real document rather than in a title that names one:

```
reply({projectCode, report: "<that same path>", threadId: "t1", text})
```

## Inviting the room

**Membership does not announce itself.** Placing somebody on a thread notifies nobody — they are
told when something lands in that thread, which under `managed` waits on his press and under `auto`
needs the document open in a window. The invitation is a direct message, the one channel that needs
neither.

**Set the document up first, then invite.** The peer reads a document instead of a pitch. Asking
first makes somebody spend context on something that does not exist yet, and answering out of
somebody's summary is the weakest evidence here.

- **`ListAgents`** says who is running. A member is a **project code** (`autobot`); a session is
  that project's running one (`autobot-10`). Match by prefix.
- **`SendMessage({to, message})`** carries the **absolute** path — members live in different repos
  and a relative path resolves against the wrong one.
- **Send the address, not the content.** What the plan is for, the path, which thread is theirs.
- **A project with no running session has not been invited.** Say so rather than leaving a member on
  the document who was never reached: a membership nobody is honouring is the exact failure this
  surface refuses everywhere else.
- **Membership is a proposal.** A peer can decline, or name a different owner — a useful answer, and
  it changes the membership rather than being argued with in a thread.

## Running one

- **Your plan goes in the goal's section, under its landscape.** Signed with your project code,
  beside the others. Not in a thread, not in the chat. Several plans under one landscape is the
  normal state, not a conflict to resolve — and nobody rewrites somebody else's.
- **A plan carries implementation detail**, because that is what the arc gets written from: paths,
  order, mechanism, what must exist first, what you need from somebody else. If you cannot say how,
  say what you would have to find out first — that is a plan; "we should improve X" is not.
- **A thread is for telling the room something, and nothing else** — your plan changed, you
  disagree with one, you need a decision to go on. A reply there is what reaches them — by `auto`,
  or by his press under `managed` —
  which is the only reason the threads exist.
- **The landscape is rewritten as things settle**, by whoever opened it, so somebody arriving late
  reads the section instead of the whole thread. Every rewrite makes the members *behind* (their
  corner lights up), which is how anyone knows to come back.
- **A DECISION THAT LANDS IS WRITTEN DOWN WHERE IT LANDED**, as a `::decision` block — the same
  instant and for the same reason an objective is. See the chapter below; this is the part most
  easily left in the chat, and a decision that lives in a transcript was never made as far as the
  document is concerned.
- **An objective that becomes definitive is written down the moment it is definitive** — as an
  `::objective` block carrying what, its owner, its requirements and what it is for. A line could
  only be read by eye; a block carries an ADDRESS, which is what lets the work point back at it.
  Never planned in advance, never a list of what the planning ought to decide.
- **Nothing about the mapping is rigid.** An objective can cover two goals; a goal can need three;
  a goal can need none.

## Capturing what lands — `::decision`

**A planning document's whole job is that the discussion lands somewhere instead of scrolling
away.** Goals and landscapes are the setup; what makes it a record is the CHOICES, written where
they were made.

A `**DECIDE HERE:**` list cannot do that, and the reasons are specific rather than stylistic:

1. **No address.** Nothing can point at it — not an objective it blocks, not a commit that
   implements it, not a later decision that reverses it.
2. **No state**, in a document whose doctrine is that the document IS the state.
3. **Nothing can count it.** An arc has `::progress`, an RFC has `::claims`; a plan had nothing, so
   its first screen could not say how many choices were open or whose they were. Reading every
   section was the only way to find out, so nobody did.
4. **The answer erases the question.** Rewriting the section is right for describing a mechanism —
   but the road NOT taken was never in the file, so git cannot be the changelog for it, and it is
   the first thing anybody asks about a decision they did not sit in on.

```markdown
:::decision[Host's machine or sender's machine?]{id=d-runs owner=you}
**why it is a decision** — everything in this section changes with it.
**my position** — none; I can argue either, which is the tell that it is his.
:::
```

**The attributes are `markdown.md`'s** — `id` the address, `owner` who owes it, `by` who made the
call, `chose`/`over` the answer and the roads not taken, `state`, and `ratify`/`approved` for the
signature a decision may still owe. Read them there; they are not repeated here, because two copies
of an attribute table drift the week one of them gains a field.

**`::decisions` at the top recounts them** — a bar, the counts, and who still owes which, with every
id pressable through to its block. The number is derived on every render and stored nowhere, so it
can never disagree with the blocks below it. **Never type a count beside it.**

### Only a real choice earns a block

**Two answers, two different systems.** Everything else is detail that settles itself once the
section is written well, and it stays prose under an *also to settle* list. Nine sections times five
questions is forty-five presses, which is a gate nobody finishes — and a document of blocks with no
argument in it is worse than the prose it replaced.

### A SECTION SAYS ITS SUBSTANCE BEFORE IT SAYS WHAT LANDED

**His correction, 2026-11-12:** *"I don't know how a section could lead with decisions. There was a
distinction between what was there before, or what the conversation was, and then what things would
land."* A section that opens with its decision blocks has lost its own voice — the blocks absorb the
prose that explained why any of it matters, and a reader arriving cold meets a verdict with no case.

So the order inside a section is always:

1. **What is there** — the landscape, measured, cited.
2. **What the conversation was** — the argument, the positions, the thing worth disagreeing with.
3. **What landed** — the `::decision` blocks, under their own heading when there are several.
4. **What is still open** — kept apart from what landed, so neither reads as the other.

### An answer can be captured without being closed

A decision carrying `chose=` and `by=` while still open is a real and useful state: *said in the
room, not yet confirmed.* It is counted apart from plain open, because **"twelve open and all owed
by him" is a different sentence when one of them already holds his answer.** Write what he said the
moment he says it; closing it is a separate act and his.

## Closing one

A plan is closed when every piece has become one of three things, and the document says which on
the section's first line — `ARC → ARC-nnn`, `CARRIED → <where>`, or `PARKED → <why>` — so the
document can be read for what landed without reading every thread. Nothing is deleted.

**Each owner writes its own arc**, in its own repo. The conductor conducts the close; it does not
author somebody else's implementation detail into an RFC. An `ARC →` pointing at nothing is a
section that only looks finished.

### Embedding an arc, and attaching its decision

```markdown
::file[RFCs/RFC-072-a-thing.md]
::file[/Users/odionedwards/autobot/RFCs/RFC-014-another.md]
```

Relative in this repo, **absolute in another** — a relative path resolves against the wrong repo and
silently embeds nothing.

```markdown
:::approval{ask="Approve this arc?"}
…what is being decided, in full…
:::

::question[Which first?]{options="the hub-side timer|the navigator pill"}
```

`verdict=approved|rejected` and `answer=…` are written back into the blocks, so the document carries
the decision and there is nowhere else to check. **Quote any value containing a space** — an
unquoted space kills the directive silently and it renders as literal text.

**A plan that produced no arc still closes.** Every section carries `CARRIED` or `PARKED` and the
document stands as the record. An RFC nobody needs is worse than a record saying the room looked and
found nothing to build.

### The dispatch is instructed, not done for them

A board card belongs to the project whose board it is; an RFC belongs to the repo that will build
it. So the close ends by asking **every owner** the same four questions, and their answers land in
their own threads — which is what makes the dispatch auditable.

1. **Does your arc exist, in your repo?** Its own document with an `::arc` leaf, holding one
   `::objective` block per piece you own — embedded back here with `::file`. The RFCs that serve
   those objectives come after, and an RFC is implementation detail; a plan without it is a report.
2. **How does this arc change your board?** `board({projectCode, add, title})`, titled, one line per
   piece too small to be an arc.
3. **Do you owe a gap to another project?** A gap goes in the **other** project's repo, never your
   own — that is the repo whose agent will find it.
4. **Anything a future session would otherwise rediscover?** `remember(text, scope, subscribe)`.

A close where only the conductor wrote anything is a plan that produced one agent's homework.

## What an arc looks like

The planning document is where a shape is argued. The **arc** is what comes out of it: the epic that
holds the objectives. Every project that has work gets its own — projects are separate repos, and an
arc written somewhere central is one its builder does not have, cannot commit and will not find.

**An arc registers off its `::arc` leaf the moment the file is saved, and that is the whole of it.**
The leaf is the identity (RFC-073): no path makes a document an arc and no path stops one, so there
is nothing here to get right and nothing to be told. **Find one by asking**
— `registry({kind: "arc"})`, or `registry({kind: "arc", member: "<your project code>"})` for the
ones you are on, across every project. The arc registers off its leaf when the file is saved, so
the folder is tidiness; the id is the address. A reader who globs the folder instead gets silence
when an arc moves, and silence reads exactly like an arc that does not exist.

**The arc document IS the state.** No run record holds how far along it is, nothing mirrors it on a
board. That is what makes an arc trackable rather than a plan somebody has to go and ask about — and
it is why an arc says its own state from its first version rather than from the day somebody wires
a surface to it.

```markdown
::arc{id=ARC-004 owner=systemview-test title="Arcs become trackable"}

::progress
::timeline

:::objective{id=O1 owner=systemview-test state=done}
**what** — the attachment shape: `{kind, ref, project}`.
**requirements** — an arc attachment round-trips on a run record.
**for** — slices 2 and 3 both depend on it.
:::

:::objective{id=O2 owner=autobot state=open needs=ARC-004-O1}
**what** — attachments carried on the run record.
**requirements** — a skill run with an attached report opens it from the row.
**for** — nine of his lists show steps and no way to reach what they made.
:::
```

- **`::arc`** is a LEAF — one line, the same shape as `::members`. It says which arc this is.
- **`::objective`** is a CONTAINER — it wraps the prose a person reads, so it opens at three colons
  and closes. Getting those two the wrong way round is the commonest mistake against this
  vocabulary.
- **`::progress`** recounts the objectives in its own document every time, so it cannot disagree
  with the blocks above it. **`::timeline`** orders them by `needs`, so the reading order is the
  doing order; a circular dependency is emitted and says so rather than looping or vanishing.

### The address is the identity

`ARC-004-O2` — the arc's id and the objective's. The kebab title in the filename is **cosmetic** and
will be renamed the first time somebody sharpens the wording, which is why nothing ever stores the
path. Work points at the address: `attach({ kind: "arc", ref: "ARC-004-O2", project })` on the run
doing it, and the arc answers "what is serving O2" from the attachments, with no second index.

### `needs` has four answers, not two

`met` · `waiting` · `elsewhere` (another project — this document cannot know, and says so) ·
`unresolved` (nothing answers to that address). The fourth is the one that matters: an address that
does not resolve must SAY so rather than read as "no dependency", because a dependency that quietly
evaporates lets work start in the wrong order — and the one measured consequence of wrong order here
is a half-feature that reads as BROKEN rather than pending.

### Who does what

**`arc-planning`** conducts the discussion and ends at dispatch. **`arc-development`** — a JOB, not
a skill — begins there and is run by agents who were never in the planning: claim the objective,
read the `why` before the `what`, check `needs`, build, and move the state in the document. Blocked
is a finding, never an ending.

It is a job because a job is the only thing a hook can AIM. A hook supplies `with: { project, arc }`,
and a job whose inputs cannot be supplied is refused by name rather than firing at nothing — so an
arc can be driven unattended, by a hook pointed at that arc, with the run record to prove it ran.
A skill has no such door: its description is injected into every session, so the work could only
ever be CHOSEN, never given.

## Amending the skill from one

The procedure lives in `arc-planning`, and it is amended from a plan somebody **ran** — never
from this page. The `procedure` thread in each report records the real steps as they happen, and
those are what the skill is corrected against. This page is the shape; the thread is the evidence.

## The frame to copy

Everything inside the fence, and nothing on this page above it. Replace every `<<…>>`; keep the
prose that is not in `<<…>>` only if it is inside the fence.

```markdown
# <<what this planning is for>>

::members{who=<<you>>}

<<One or two sentences: what we are here to come out with.>>

**Where this file is:** `<<absolute path to this file>>` — absolute, because members live in
different repos. Read the file; this document is the state, never the summary you were sent.

::decisions

<<Leave this line exactly as it is. It recounts the `::decision` blocks below on every render —
a bar, the counts, and who owes which, each id pressable through to its block. Never type a
number beside it.>>

## Goals

<<His, in his own words. Quoted, not paraphrased. They stay here and are not moved.>>

## Current landscape

<<One section per goal, and one for any piece that cuts across goals. The frame for a
single section is the next chapter down — write it here, repeated.>>

## Decisions, as they land

<<Nothing here at the start, and usually nothing here at the end either — a decision belongs in
the SECTION where it was made, under a "What landed" heading, not collected in one pile. This
heading exists only for a choice that belongs to no single section.>>

## Objectives, as they become definitive

<<Nothing here at the start. One `::objective` block each as they settle — see "What an arc looks
like" below for the shape. A line could only be read by eye; a block carries an ADDRESS, which is
what lets the work point back at it.>>

## Arcs

<<Empty until one is written. Then one ::file embed per arc — relative if it lives in this repo,
absolute if it lives in another.>>

## What we learned on the way

::::thread{id=bugs members=<<project>>|<<project>>}
Anything that did not work, the moment it did not work. One line, by whoever hit it.
::::

::::thread{id=procedure members=<<project>>|<<project>>}
A move that worked and should happen again, named precisely enough to be a step in a skill.
::::
```

**Per-thread members narrow; they do not copy.** `members=` on a thread is its OWN subscription —
only those people go behind when that thread moves, and a reply there tells them, not the whole
document. Put the document's full list on a thread only when the whole room is really in that
conversation.

**A thread's prose is standing text, not a placeholder.** The lines inside `bugs` and `procedure`
are addressed to the room and stay in the live document; anything in `<<…>>` is yours to replace.

## The frame — one landscape section

One of these per goal, written under `## Current landscape` in the document frame above. Four
parts in this order and no others: where the project is, the proposal, the plans, one thread.

```markdown
### <<the goal, verbatim — or the name of the thing, when a piece cuts across goals>>

<<When this piece lands, its first line says so: ARC → ARC-nnn · CARRIED → where · PARKED → why.>>

<<Where the project is on this goal: what exists and how it actually works, cited.>>

<<**How it might work.** The opener's initial proposal — researched, specific enough to be
disagreed with. Rewritten as things settle, so it reads as the current answer rather than anybody's
opinion.>>

**Plans.**

**<<project>>** — <<that agent's own implementation detail for this goal: the paths it would
touch, in what order, by what mechanism, what has to exist first, what it needs from somebody else.
A signature line, never a `###` heading — a heading here joins the document's real outline.>>

::::thread{id=<<kebab-id, unique in this document; `bugs` and `procedure` are reserved>> members=<<project>>|<<project>>}
<<For telling the room about this goal. Nothing else goes in here.>>
::::
```

**The thread does not wrap the section** — it sits at the end of it, as a sibling of the landscape
and the plans. Wrapping was the earlier shape and it put the work inside the notification channel,
which is backwards: the plans are the document, the thread is how you say you changed one.

**Fences.** A `::::thread` wraps content, so it opens with four colons and closes with a line of
four. A block that takes no children (`::members`, `::file`) uses two and never closes. Getting the
depth wrong makes the block silently not render — see `markdown.md`.
