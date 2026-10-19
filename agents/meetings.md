# Meetings — a document with people on it

A meeting here is not an event, a room, or a call. It is a **markdown document with members**: the
threads carry the conversation, and the pinned row in the document's top-right corner tells each
member when something they are on has moved. Nobody has to be present at the same time.

**Who is who.** *He* is the human who owns the project — the meeting is his, the goals are his
words, and the sends are his presses. *The opener* is the agent that creates the document and does
the research in it. *Members* are **project codes** (`buapi`, `autobot`) — a member is a room, not
a person, because that is what delivery takes. See `markdown.md` → `::members`.

**Behind is a state; a press is a send.** Editing the document makes its members *behind* — that is
computed, nobody announces it, and their corner shows it the next time they look at the document.
**Being behind does not reach anybody.** Reaching them is the press: a chip in the corner tells one
member, `all N` tells everyone behind, and only then does a turn land in their session. Writing
`::members{who=…}` declares membership and notifies nobody.

**An agent cannot press.** The send is a window control today, so an agent that writes into a
meeting waits for him to announce it. Plan around that: it is the current shape, not a detail.

**He has no address, and needs none.** Members are project codes; he is not one. He finds out the
meeting is ready because it is his repo and the document is open in his window — so when a meeting
needs him, say so in the chat, not by expecting a notification to reach him.

**What an arc is.** The deliverable. An arc is an **RFC** — `RFCs/RFC-<nnn>-<slug>.md` in the
project that owns the work, written after the room agrees a piece, carrying the ownable breakdown
(objectives, each with an owner, a test, and what to read first) and an `:::approval` block for his
verdict. The meeting embeds it back with `::file[…]` so it reads inline — **relative when the arc
is in this repo, absolute when it is in another**, which is the common case for a cross-repo goal.

## Why you would open one

Two reasons, and the second is not a lesser one.

- **To turn goals into arcs** — he states the goals, the room plans against the project as it is,
  and the pieces that earn a document get one.
- **To leave a record of the collaboration.** Two agents working something out together open one so
  the exchange LEAVES SOMETHING: a document saying what was considered, by whom, and what they
  settled. Otherwise it lives in two transcripts nobody reads again and all that survives is one
  agent's account, which is the weakest evidence here. A meeting whose only output is the record is
  finished, not failed.

**Whoever opens it conducts it.** Not a room set up for other people to use — the opener gets the
goals, writes the landscape, places the members, keeps each section current as plans land, closes
every piece and dispatches the work. Nobody else picks it up if they stop.

## Opening one

1. **Name the file.** `meetings/<YYYY-MM-DD>-<kebab-subject>.md`, in the repo whose agent is
   opening it. One copy, never mirrored into other repos — that is why the frame carries the
   absolute path, so members elsewhere can read it. The date and the subject are the identity;
   there is no meeting number to look up. **Not in `.systemview/` where reports go** — see below.
2. **Choose the members, and say why in the chat.** They are project codes, and only a CONNECTED
   project is one — an unknown code renders fine and delivers to nobody, which is the worst
   failure available here. The membership is a proposal like anything else: he can cut it.
3. **Write his goals in his words** — quoted. If you were handed a subject rather than goals, the
   meeting is NOT ready to open: say so and ask him for the goal. An agent that converts a request
   into a goal has made the decision the meeting exists to make.
4. **Write the landscape sections** — one per goal, headed by that goal, and a piece that cuts
   across several goals gets its own section named for the thing. The next chapter is what goes in
   one. **A document of empty headings is not an opened meeting.**

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
the meeting quietly produces nothing. If you cannot say how, say what you would have to find out
first: that is a plan, and "we should improve X" is not.

**Cite, do not summarise.** A file by `path` or `path:line`, a card by its title, an RFC by its
number, a lane by its branch. A claim with no address is an opinion.

## The two modes — `auto` and `managed`

**The difference is where the members go and who sends.**

| | `auto` | `managed` |
|---|---|---|
| **document** | nobody | **everybody** |
| **threads** | only who belongs there, each on `auto=` | everybody |
| **who sends** | `auto` does, with nobody pressing | **he** does, by pressing the corner chip |

`auto` is threads only, on auto — the whole mode, and the one a meeting runs in without him.
`managed` is agents on every part of the document, and he sends the updates.

### The markdown that places them

Document level — one line, under the lead paragraph, before the first section heading:

```markdown
::members{who=buapi|autobot}
```

A thread's own members live on its opening line, and `auto=` is the attribute that makes the mode:

```markdown
::::thread{id=plumbing members=buapi|autobot auto=buapi|autobot}
<<the thread for this goal>>
::::
```

Under `managed` the same opener carries no `auto=` — `::::thread{id=plumbing members=buapi|autobot}`
— and the sends wait for him.

- **`who=` and `members=` are pipe-separated project codes.** Only a CONNECTED project is a member;
  an unknown code renders fine and delivers to nobody, which is the worst failure available here.
- **Never write `sent=` by hand.** The surface stamps it when a send happens — it is the record of
  who heard which version, and writing it yourself tells the document somebody was told who wasn't.
- **A thread's `members=` narrows, it does not inherit.** Only those people go behind when that
  thread moves. Put the whole room on a thread only when the whole room is really in it.

### `managed` goes quiet when he steps away, and that is not silence from the room

An agent cannot press; the send is a window control. Members sitting behind with nobody told is the
normal resting state of a managed meeting. Keep writing your plan in its section — he sends when he
reads.

## A meeting is not a report — where it lives, and how it still reaches his panel

**It lives in the repo: `meetings/<YYYY-MM-DD>-<kebab-subject>.md`.** A report lives in
`.systemview/`, which is **gitignored** — a meeting there is never committed, so it exists on one
machine and dies with it. And `api/reportJanitor.js` **deletes any report older than 30 days**
unless a job run points at it. A meeting carries members, replies, verdicts and embedded arcs: it is
a project artifact like an RFC, not a disposable view like a report.

**It still goes on the reports panel, because that is where he looks.** The file stays in the repo:

```
show({projectCode, reportPath: "meetings/2026-10-19-a-subject.md"})
```

**Then reply to the PATH, never the title.** `show` files a *copy* of the content into
`.systemview/`, so the report title names a snapshot. `Reports.read` uses any argument ending in
`.md` verbatim, which is what makes the path land in the real document:

```
reply({projectCode, report: "meetings/2026-10-19-a-subject.md", threadId: "t1", text})
```

Reply to the title and the words land in the snapshot and are gone at the next `show`.

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
- **Send the address, not the content.** What the meeting is for, the path, which thread is theirs.
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
- **An objective that becomes definitive is written down the moment it is definitive** — one line:
  what, its owner, its test. Never planned in advance, never a list of what the meeting ought to
  decide.
- **Nothing about the mapping is rigid.** An objective can cover two goals; a goal can need three;
  a goal can need none.

## Closing one

A meeting is over when every piece has become one of three things, and the document says which on
the section's first line — `ARC → RFC-nnn`, `CARRIED → <where>`, or `PARKED → <why>` — so the
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

**A meeting that produced no arc still closes.** Every section carries `CARRIED` or `PARKED` and the
document stands as the record. An RFC nobody needs is worse than a record saying the room looked and
found nothing to build.

### The dispatch is instructed, not done for them

A board card belongs to the project whose board it is; an RFC belongs to the repo that will build
it. So the close ends by asking **every owner** the same four questions, and their answers land in
their own threads — which is what makes the dispatch auditable.

1. **Does your arc exist, in your repo?** `RFCs/` — an RFC is implementation detail; a plan without
   it is a report. Embedded back here with `::file`.
2. **How does this arc change your board?** `board({projectCode, add, title})`, titled, one line per
   piece too small to be an arc.
3. **Do you owe a gap to another project?** A gap goes in the **other** project's repo, never your
   own — that is the repo whose agent will find it.
4. **Anything a future session would otherwise rediscover?** `remember(text, scope, subscribe)`.

A close where only the conductor wrote anything is a meeting that produced one agent's homework.

## Writing the skill from one

Write a meeting skill from a meeting you **ran**, never from this page. The `procedure` thread in
each meeting is where the real steps are recorded as they happen; those are the skill's steps. This
page is the shape, not the evidence.

## The frame to copy

Everything inside the fence, and nothing on this page above it. Replace every `<<…>>`; keep the
prose that is not in `<<…>>` only if it is inside the fence.

```markdown
# Meeting — <<what this one is for>>

::members{who=<<project>>|<<project>>}

<<One or two sentences: what we are here to come out with.>>

**Where this file is:** `<<absolute path to this file>>` — absolute, because members live in
different repos. Read the file; this document is the state, never the summary you were sent.

## Goals

<<His, in his own words. Quoted, not paraphrased. They stay here and are not moved.>>

## Current landscape

<<One section per goal, and one for any piece that cuts across goals. The frame for a
single section is the next chapter down — write it here, repeated.>>

## Objectives, as they become definitive

<<Nothing here at the start. One line each as they settle: what, owner, test.>>

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

<<When this piece lands, its first line says so: ARC → RFC-nnn · CARRIED → where · PARKED → why.>>

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
