# RFC-073 — a document's state lives in the system, not in the window rendering it

**Status: draft** · 2026-10-23 · extends RFC-071 (a document has members) and RFC-072 (arc planning
and execution) · the word `subscribe` is also RFC-051's, and §2 settles that


::members{who=systemview-test}
## The problem, as what it costs now

**Everything a document knows is computed at paint time, so the answer exists only while somebody is
looking at it.**

- **An arc has no existence of its own.** `::arc{id=ARC-004}` is a *half* attachment: the document
  claims an id and **nothing on the other side holds it.** There is no record of `ARC-004` anywhere
  but inside the file that names it. So "which arcs are open", "which objectives are blocked",
  "three approvals waiting for me" cannot be answered at any price without opening every file.
- **A decision reaches nobody unless a window is open.** Delivery is a renderer-side act:
  `useMembership`'s auto-timer and `MembersPin` are React, and `buildUpdate` is only ever called
  because one of them said so (`files-host.cjs:154`, `sessions.cjs:30`). An agent that writes
  `verdict=approved` into a file directly announces nothing. **A subscription that works only while
  somebody is looking is not a subscription.**
- **What a member does receive says nothing about what happened.** `summarize()` in
  `docMembers.js:74` produces `412 lines, 3 threads, 1 reply — changed since you were last sent to`,
  identical whether a typo was fixed or the arc was approved. The system can say *the document
  changed* and cannot say *a decision landed*.
- **Kind is inferred from location, and location is nobody's business.** RFCs are found by
  `RFCs/RFC-*.md` and reports by `.systemview/report.*.md`. `bandTabs.js:17` already admits it:
  reports are a document kind *"only because it lives in `.systemview`, not because the word
  'report' means anything to the band."* A project keeping its designs in `docs/designs` gets no
  tab, and **nobody should have to organise their filesystem the same way to get arcs.**
- **67 RFCs, five with a verdict.** The rot `rfc-authoring` was written against has the same root:
  an RFC is a file somebody has to find and read, not a thing the system holds.

## 1 · The design, in two halves

**An arc is an identity. The document is its body.** Both are true at once, and separating them is
the whole design:

| | holds | lives in |
|---|---|---|
| **identity** | `{ id, kind, path, project }` — and nothing else, ever | the registry |
| **body** | objectives, prose, verdicts, state — everything you would read | the document |

::::thread{id=t2}
**The registry never holds content.** No objective list, no progress count, no copy of any prose.
The moment it holds something the document also holds there are two answers and a sync problem. It
holds *that `ARC-004` exists, is systemview's, and its body is at this path.*
:::reply{author=you ts=1792923525363}
Look, you say the registry never holds content, right? But the truth is the registry should probably never That our registry should probably never. Relay on content or the system should never rely on registry content. But there's things that actually it may need to rely on. Right now every RFC is going to be open. How do you know if it's closed? One should it disappear from your list. arcs have objectives. You know, the system probably shouldn't rely on that as the final state. Maybe it's just have dates of when things were updated or something. maybe a button too. to make sure that it's updated. When you're looking at it, if it looks stale, maybe a system that automatically when showing the display. without obviously overwhelming the system, consistently read the state. for me. Again, if you're looking at it like a list of arcs, a list of RFCs, how many objectives it has, open, whatever, like that list, you can see the date. When there's opportunity for the system to know that it's still and update it. Again, it's not a big deal if it's still. the user could update it too, but you could also get ahead of it. Like if you're looking at a long list, again, without just flooding the system, obviously.
:::
:::reply{author=you ts=1792937324811}
For example approval Approval waiting. Approved. and implement it. eventually removed from the registry.
:::
::::


**Loading the document through markdown IS the state load.** So nothing caches state: ask the
registry *which files*, parse them for *what they say*. The parse is what the renderer already does
and what `documentUpdate.cjs` already does on the host.

### 1.1 · The registry

`~/.autobot/documents.json` — one array of records:

```json
[{ "id": "ARC-004", "kind": "arc", "path": "RFCs/arcs/ARC-004-arcs-become-trackable.md",
   "project": "systemview", "at": 1792778014773 }]
```

Four fields and a timestamp. **Deletable:** throw the file away and nothing is lost — it rebuilds on
the next write or the next open. It is a *lookup*, never an authority, and the same split hooks
already use: `~/.autobot/hooks/<name>.md` is the definition, `hooks-fired.json` beside it is
derived state that can be deleted without losing a hook.

**Read uncached**, for the reason `hooks.cjs:300` gives about its own directory: *"premature caching
here is how an edited hook stops taking effect and nobody can work out why."*

### 1.2 · The registration leaves

`::arc{id=ARC-004 owner=… title=…}` exists. Two more, same shape:

```markdown
::rfc{id=RFC-073 arc=ARC-004}
::report{id=subscribe-and-registration}
```

`::rfc`'s `arc=` is the relationship as state — so *"what is being built for this arc"* is a read
rather than a grep. Both are leaves at the top of the document, like `::arc` and `::members`.


::::thread{id=t3}
**New entries in `src/atoms/Markdown/registry.js`**, components beside `Arc.js`: `Rfc.js` and
`Report.js`, each a one-line self-describing header. They render the id and the relationship; they
have no press and no state of their own.
:::reply{author=you ts=1792930888076}
I just thought of another type of document that's going to end up needing to be registered and that's tickets. Or, you know, we haven't gotten that far yet, but once we actually working in a system, Maybe that's just already gaps. We already have gaps. And that's how we need to just refer to them. A gap can be a ticket or an improvement, and I like that. but they usually come from elsewhere. So yeah, maybe we need to build our register gaps. Meanwhile, they go have any folder they want now.
:::
::::


### 1.3 · Folders

::::thread{id=t1}
**Folder conventions stop existing.** Not configurable — gone. The two `listFiles({dir})` calls in
`AgentChat.js` that find RFCs and arcs by directory are replaced by a registry read, and
`bandTabs.js`'s document family (`reports`, `rfcs`, `arcs`) is counted from the registry.
:::reply{author=you ts=1792923360144}
Don't forget it. All existing reports will disappear for every agent. So we got to think about this process. I think that... Fold if still exists, so it's not a problem. I can always tell each agent. I can always tell each agent to... So to parse their stuffed and delete once not relevant and modify it.
:::
::::


A document with no leaf is **not** a kind. It is a file, findable the way any file is findable, and
that is the honest answer — better than a tab inferred from a path that happens to match.

## 2 · `subscribe` — and the two meanings it already has

**The word is taken, twice, and this RFC adds a third unless it is settled here.**

| where | what it means today |
|---|---|
| RFC-051 | a **subscriber of a chat room** — `join`, `leave`, `kick`, and a 15-minute reply window for a non-subscriber |
| `mcp__context__subscribe` | **context delivered at a moment** — `what / when / until` |
| this RFC | **a block's audience** |

All three are one concept: **a standing interest in a source of events, bounded.** Room, moment,
block. That is the claim this RFC makes, and the consequence is that the third one is **a new `what`
in a primitive that exists**, not a new primitive.

What it does *not* do is unify the implementations. `mcp__context__subscribe` delivers to **me**;
a block delivers to **somebody else**. Same triple, opposite directions — §7 says why that is left
alone.

### 2.1 · The rule

**`::members` is a feature of a document. `subscribe=` belongs to a block, wherever that block is.**
A members line sits at the top of a file and says who is on *that document* — it has no meaning
anywhere else, because there is nothing else for it to be on. `subscribe=` has no such home: it works
on a block in a document, in the chat, in a report on the TV, in a reply, because it belongs to the
block and not to the container around it. That is why membership can be the fallback and subscribe
cannot — inside a document there happens to be a membership to fall back on; in the chat there is
not, and a block there still has to know its audience. Membership is the document putting subscribe
to work on its behalf.

**A block's answer goes to its subscribers, and the subscriber's location decides the shape of the
delivery.**

| on a block | audience |
|---|---|
| `subscribe=buapi\|reviewer-x` | **exactly who is named.** Membership does not enter into it |
| nothing | **its thread's `subscribe=`**, when it sits in one — and otherwise **the document's `::members{who=…}`** |

**The audience resolves UPWARD.** A reply is the thing that happened; the thread it sits in is who is
in the room for it. So a block never has to name its own audience to have one: a question inside a
thread gets the thread's, a question at the top level gets the document's.

**A THREAD HAS `subscribe=`, NOT `members=`.** Membership exists for the gated channel — the pin, the
press, "behind" — and that channel exists for prose edits, the changes that do not fire. A thread has
no such changes: everything that happens in one is a reply, and a reply fires. There is nothing in a
thread for a gated channel to gate, so RFC-071's thread `members=` (and its `sent=`) retire in favour
of one attribute: who hears what lands here. The document keeps both words because it is the one
place with changes nobody is woken for.

**It is an override, not a filter.** `subscribe=buapi` on a document with three members means buapi
and nobody else, and it names a non-member just as happily. **The list is names; whether any of them
is on the document is irrelevant.** Membership is the fallback when nothing was named, and that is
the only place the two ever touch.

**Implicit membership is not the noise this replaces, and the ratio is the argument.** A document
takes fifty edits and produces three decisions. Notifying on edits is noise; notifying on decisions
is the document doing its job. **The line is decisions, not changes.**

**And a decision does not entitle anybody to a wake.** A verdict is recorded either way — somebody
comes back next week and finds it, which is already the feature working. Delivery is for whoever is
**blocked**. So an unsubscribed decision on a document with no members tells nobody, and that is
correct rather than a gap.

**`auto=` does not collapse — it is membership's subscription at document scope.** An explicit
`subscribe=` is automatic by definition: somebody authored it naming who needs to know, so there is
no press to wait for. `auto=` says the same thing about a member. One concept, two scopes. The
**plain member is the only human-gated path**, and that is what `MembersPin` is for.

### 2.2 · Which blocks fire, and what each one's answer is

Read off the attribute each block already writes:

| block | fires when | summary it hands over |
|---|---|---|
| `::question` | `answer=` appears | `answered "the hub" — which door should dictation own?` |
| `:::approval` | `verdict=` appears | `approved — Approve this arc?` |
| `:::objective` | `state=done` | `O2 is done — <first line of what>` |
| `::commit` | `sha=` appears | `committed 3c5fe32 — <message>` |
| `:::reply` | the block exists and is untold — its audience is its **thread's**, never its own | `buapi replied in t1 — <first line>` |

**Result blocks do not fire and do not queue:** `:::cmd`, `::run`, `::test`, `::branch` write
nothing into the document — their transcript lives in the host's session log — so there is no
durable answer to deliver later. They answer immediately by nature. `subscribe=` on them is
out of scope here (§6).

**Everything else has no audience:** pointers (`:ns` `:file` `:ui` `:help` `:report`), embeds
(`::diff` `::chart` `::image` `::logs` `::load` `::topology`), recounts (`::arc` `::progress`),
`::ask` (records nothing by design), and structure.

### 2.3 · `told=` — the receipt lives in the block

`::members` already does this: `sent=buapi:1a2b` is a per-member hash in the document saying what
each member last heard. A fired block records the same way, by name rather than by hash, because a
fire happens once:

```markdown
:::approval{ask="Approve this arc?" subscribe=buapi verdict=approved told=buapi}
```

**This is what makes a fire self-describing, and it removes the baseline entirely.** There is no
need to know what the document said before: **a block with an answer and an audience not covered by
`told=` is an undelivered fire**, visible in the document itself. No diff, no stored previous state,
no monitor.

It also means the document is the state for the *delivery* too, so a document copied to another
machine carries its own answer about who has been told.

## 3 · The mechanism — the PARSE is the fire; a write is one of the things that causes one

**A fire is a state a block is in, and exactly one thing ever holds a block: the engine.** Nothing
becomes visible — in a document, in the chat, on the TV, in a transcript replay — without being
parsed. So the fire is detected at parse: **a block with an answer, an audience, and no `told=`
covering that audience has fired.** The engine emits one thing — `block.fired` with *what, where, to,
one line* — and never delivers. The host routes it exactly as it routes `document.updated` today.

**This is the frame that reconciles every concern raised while designing it, and none of them was a
false problem — each one became a moment the engine parses:**

| the concern | what parses, and therefore fires |
|---|---|
| nobody has the document open | the session watcher parses on the agent's write; the sweep parses on session start |
| agents write with Bash, not through a door | the watcher — `sessions.cjs:992`, gated on tools-in-flight, and **every** `tool_use` counts (`:1221`), Bash included |
| his press in the window is not a tool in flight | the render parses it, and `files:write` is the host's own door |
| no session is live for that project | the **session-start sweep** — a session asks the registry what is undelivered and addressed to it |
| do not monitor the world | **no new watcher.** The one that exists was built for *"a shell sed, a git checkout, an MCP tool writing files"* and is gated so it cannot be mistaken for watching him |
| the chat has no file | **the chat is parsed by the same engine** — the one thing parse-time adds |

The watcher, the write door, the render and the sweep are not the mechanism. They are the reasons a
parse happens. **Write is one cause of a parse; render is another; a session arriving is another.**

On a parse, in order:

1. **Register.** A registration leaf (`::arc` / `::rfc` / `::report`) at the top → upsert
   `{id, kind, path, project}`. The id is the identity: a moved file updates the row, never
   duplicates it. **Registration does not scope subscribe** — it only says which documents a session
   sweeps on start.
2. **Find what fired.** For each firing block (§2.2): audience is `subscribe=`, else the document's
   `::members{who=}`; if `told=` does not cover it, emit `block.fired`.
3. **Deliver, then stamp.** The host builds the event through `documentUpdate.cjs` — the existing
   builder, taking the block's own one-line summary instead of `summarize()` — hands it to the
   session router (`sessions.cjs:828`, which already delivers by `members`), then writes `told=`
   back where the block lives. **Stamp only on a successful hand-off**, or a failed delivery becomes
   a silent one — and an undelivered fire stays visible to the next parse, which is the sweep's job.

**Idempotent by construction.** Parse the same approved block a hundred times — the window
re-renders, the watcher fires, the sweep runs — and it delivers once, because the receipt is in the
block. There is no "already handled" list anywhere.

### 3.1 · ONE parser — the engine, on the host too

**The host does not get its own parser. It runs the engine.** RFC-053 ruled this for markdown — one
grammar, one implementation, two hosts — and measured that the renderer core (`directives.js`,
`registry.js`) imports nothing from SystemView precisely so it could be shared. `directives.js`
depends on `unist-util-visit`; upstream of it is `unified` + `remark-parse` + `remark-directive`.
None of that needs a DOM. It runs in Node.

**The regexes in `documentUpdate.cjs` are retired by this RFC, and not for tidiness.** `LINE(name)`
matches `::name{…}` — a **leaf**. `:::approval` is a **container**. The existing host-side parse
cannot see an approval at all, so a fire scan built on it would never fire on the block this whole
design was argued from. A second dialect does not merely drift; here it is blind to half the grammar.

So: **the parse lives in autobot — `electron/markdown/parse.cjs`** — the directive plugin plus a walk
that returns every directive node with its name, kind, attributes and line, with no React in it.
**Capabilities belong to the browser, surfaces belong to the app** (RFC-053, and his rule in
`hostDictation.js`): the grammar is a capability every app on the platform will read, so it is
autobot's once, and SystemView's renderer imports it and puts React on top. The worker, the next app,
accounting — none of them writes a parser. `membersIn` and `arcIn` become two lines over its output,
in the same process that owns it.

**Three things make up the capability, and all three are autobot's:**

| platform — `electron/markdown/` | app |
|---|---|
| `parse.cjs` — the directive grammar, every block with its name, kind, attributes, line | the React component that draws each block |
| `write.cjs` — *set this attribute on this line of this file*. Today that is `setDirectiveAttr` in SystemView's `Markdown.js`; it is the write that puts `verdict=`, `state=`, `sha=` and `told=` into a document, and it must not have two implementations | the surfaces: the band, the pin, the composer's queue |
| `blocks.cjs` — **what the grammar is**: which blocks exist, leaf or container, and which attribute is a block's *answer*. RFC-053 drew this line — *one implementation of the grammar* — and this RFC moves the list across it. `registry.js` keeps only the component mapping | — |

**Every app's render is a parse by autobot's parser.** That sentence is the whole reason the chat, the
TV, a document and a future app all fire the same way — and the reason a project-management app
draws `ARC-004` as a board from the same registry, the same parse and the same `block.fired` as
SystemView draws it as a document. One suite, several faces; nothing re-derived.

This is also the direction the regexes came from being wrong: a shared capability that lives inside
one app is one every other process reaches for a shortcut around.

**One cost, stated.** A fired block can be anywhere in the file, so the scan parses the whole
document — not `headOf`'s 4000 characters. That is a full parse per write of a registered document.
Acceptable because it is per *write*, never per render and never on a timer; and the alternative is
a stored baseline, which is the second copy this design exists to avoid.

### 3.2 · The chat — a press queues, it does not wake

This is the half that made him stop using the blocks: *"you don't really get the response."*

**When the audience is the session the document is open in, delivery means riding the next
message.** Not a turn of its own — **a press is not a turn.** Four presses and one message is one
turn carrying four answers, not four turns each landing cold. And it is better for the agent, not
just cheaper: an answer arriving with the next sentence has the context it was about, where
`answer=b` arriving alone is a fact with no question attached.

So the window keeps the pending answers and the composer shows what is riding along, with each one
removable before send. **The queue is not a second feature** — it is what delivery looks like when
the audience is the conversation it is already in.

**Detection in the chat is not special.** A `::question{subscribe=buapi}` in a reply fires at parse
like one in an arc, because the chat is rendered by the same engine. What *is* different is where the
receipt lives: a document block takes `told=` on its line through `setAttr`; a chat block sits in a
transcript, which is append-only, so its receipt is an **event beside it** rather than an attribute
in it. Same fact, two homes — the one seam "anywhere" still shows, and it is a storage detail, not a
concept.

## 4 · What this produces that is not code

**His requirement, verbatim: every way registration can be done, explicitly explained.** There are
five, and all five must be written down or agents will invent a sixth:

1. **An authoring skill writes the leaf** into the document it just created — `rfc-authoring` writes
   `::rfc`, `arc-planning` writes `::arc`.
2. **`show()` registers a report automatically** when it files one. Reports are produced by many
   skills and no skill should have to remember; `mcp__systemview__show` is the single door they all
   go through.
3. **He inserts the block by right-click** and fills its parameters. The insert menu already does
   this for other kinds — `::rfc` and `::report` join that list, with fields for `id` and `arc=`.
4. **The host registers on write** whenever it sees a leaf, whoever wrote it and however.
5. **Re-registering is a no-op.** The block is in the file, so writing it again says the same thing.
   Nothing needs to guard against it, and an agent re-registering a document somebody else
   registered is not an error.

### 4.1 · Where the procedure is written, and why it is not a new skill

**Registration is one short step used by several skills, which makes it a corpus chapter, not a
skill.** A skill is a procedure with its own durable outcome; *"put the right leaf on the document
you just wrote"* is a step inside a procedure that already exists. A skill for it would be a
procedure nobody invokes, and its description would compete with the skills that actually do the
work.

So: **`how-we-work/registration.md`** — the five ways, the leaf shapes, and the rule that the
registry never holds content — retrieved by `context()` like every other chapter there, and indexed
with `docsIndex`.

### 4.2 · The skills this changes

| skill / job | change |
|---|---|
| `rfc-authoring` | §3 writes `::rfc{id= arc=}` into the file; the approval block is one line, and the commitments it approves live in a plain section the claims are extracted from |
| `arc-planning` | §5 already writes `::arc`; add that doing so registers it, and that the arc no longer needs to live under `RFCs/arcs/` |
| `arc-development` (job) | §3.2's doors stop being folder reads. §3.5's "tell the members" becomes mostly automatic — moving an objective to `done` fires it — and the job says so rather than instructing a send that now happens by itself |
| `doc-maintenance` | the handbook gains `registration.md`; the chapter is this RFC's §4 |
| `context-maintenance` | nothing. Named here so the next pass does not go looking |

**`proof-authoring`, `delegation`, `study`, `chore-round`, `skill-authoring` are untouched** — said
explicitly so scope is not re-argued.

## 5 · Slices, in landing order

**The order is forced by one rule: no slice teaches a verb that does not exist yet.**

1. **Registration, on the platform's parser.** `parse.cjs` lands in autobot and SystemView's
   renderer imports it; the two leaves; the registry; the upsert on write. The parser comes first in
   the first slice because everything after it reads through it — and it is a paired lane, one per
   repo, because the seam is the point. Nothing is
   delivered and nothing is removed — the folder reads still work. **Checkable on its own:** write a
   document with `::rfc{id=…}`, see the row in `documents.json`, move the file, see the path update
   and no duplicate.
2. **The surfaces read the registry.** `bandTabs.js` counts from it; `AgentChat.js`'s two
   `listFiles({dir})` calls go. **This is the slice that deletes folder conventions**, and it is
   second because it cannot land before there is a registry to read.
3. **`block.fired` at parse, `told=`, and delivery.** The engine emits; the host routes and stamps.
   Triggered by the parses that already happen — the session watcher and `files:write`. An agent
   writing `verdict=approved` with a Bash heredoc announces it, with no window open. Audience is
   `::members` only.
4. **The session-start sweep.** A session asks the registry which documents are addressed to it and
   parses them, so a fire that happened while nobody was running is delivered when somebody is. After
   3 because it delivers through 3's path; before 5 because an aimed subscription that can miss its
   audience is worse than none.
5. **`subscribe=` as the override.** Audience selection, including names that are not members.
6. **The chat's queue, and the chat's receipt.** A press rides the next message; the composer shows
   what is pending; a fired chat block's receipt is an event beside it in the transcript.
7. **`registration.md` and the skill updates.** Last on purpose: a skill that tells an agent to write
   `::rfc` before slice 1 lands is a skill teaching a verb that does nothing.

## 6 · What this does NOT add

- **No `subscribe=` on result blocks** (`:::cmd`, `::run`, `::test`, `::branch`). They produce
  information, not decisions, and nothing is written into the document to detect.
- **No roles.** `subscribe=reviewer` outlives `subscribe=buapi` and is the right end state, but
  nothing in the system resolves a role to an agent, so it would be a string that looks like it
  works.
- **No approval gate on the agent-side send.** Nothing gates it today, and adding one breaks the
  unattended path `arc-development` §3.5 depends on — a job firing at 3am has nobody to approve it.
  A gate would have to be per-door, human-initiated versus job-initiated, and that is its own design.
- **No new watcher, no polling.** The per-session `fs.watch` at `sessions.cjs:992` already exists
  and stays exactly as gated; nothing else watches anything. A document edited with no session live
  is picked up by the next parse — the sweep when a session starts, or the next render.
- **No unification of `mcp__context__subscribe` with this.** §2 claims they are one concept; it does
  not claim they should be one implementation. The directions differ (to me / to them) and merging
  them would be a third design on top of two working ones.
- **No `until` on a block subscription.** A block fires once, so it expires by firing. A *document's*
  subscription does not expire and that is probably why membership accumulates people nobody
  removes — a real problem, and not this one.
- **No change to `project` meaning a repo.** The registry's `project` is a repo code, which is a
  development-app assumption sitting in a platform record. A business suite will have things that are
  not repos — a client, a quarter, a ledger. `kind` is already a string, so those are cheap when they
  come; what `project` becomes for them is its own decision and not this one.
- **No new kinds beyond arc, RFC and report.** Planning documents, lanes and jobs are left alone;
  `kind` is a string in the registry, so a fourth costs one leaf and one registry entry when
  somebody wants it.

## 7 · The piece most worth rejecting

**That the registry holds identity and a pointer and nothing else.**

If it holds anything you would read — an objective count, a verdict, a title cached for a list — then
every surface gets faster and the system gains a second answer to every question, which has to be
kept in sync by something, which is the monitor this design was built to avoid. The whole thing rests
on *parse the document when you need to know*, and the cost of that is a full read per write and a
parse per question answered.

If that cost is wrong, §1.1 and §3 change shape completely.


## What approving commits to

1. **§1.1** — a registry at `~/.autobot/documents.json` holding `{id, kind, path, project}` and
   never content, deletable and rebuilt from documents.
2. **§1.2** — `::rfc{id= arc=}` and `::report{id=}` leaves beside the existing `::arc`, as registry
   entries in `src/atoms/Markdown/registry.js`.
3. **§1.3** — folder conventions for RFCs, arcs and reports are REMOVED, not made configurable. A
   document with no leaf is not a kind.
4. **§2** — `subscribe` is one concept with three `what`s; a block's `subscribe=` is an override
   naming exactly who, agnostic to membership, with `::members{who=}` as the fallback.
5. **§2.3** — the delivery receipt is `told=` IN the block, so a fire is self-describing and no
   baseline is stored anywhere.
6. **§3** — the PARSE is the fire: the engine emits `block.fired` for a block with an answer, an
   audience, and no covering `told=`; the host routes it through the existing `documentUpdate.cjs`
   builder and session router, then stamps. The session watcher, `files:write`, the render and the
   session-start sweep are the parses that already happen — no new watcher.
7. **§3.1** — the grammar capability is autobot's: `parse.cjs`, `write.cjs` (the attribute
   write-back) and `blocks.cjs` (what the grammar is) under `electron/markdown/`. SystemView's renderer
   imports them and keeps only components and surfaces; the regexes in `documentUpdate.cjs` are
   removed. One parser, one write-back, one block list — the platform's.
8. **§3.2** — in the chat a press QUEUES and rides the next message; it never opens a turn.
9. **§4** — five registration paths, written into `how-we-work/registration.md`, with `rfc-authoring`,
   `arc-planning` and the `arc-development` job updated. No new skill.
10. **§5** — seven slices in that order, registration first, the sweep before `subscribe=`, and
    the skill updates last.

## Claims

Each one is *do this → this should happen*. Grouped by the commitment it checks.

**§1.1 — the registry holds identity and a pointer, nothing else**

1. Save a document carrying `::arc{id=ARC-004}` through `files:write` → `~/.autobot/documents.json`
   gains one row `{ id, kind, path, project, at }` for it — and no title, count, or content field.
2. Move that file to another folder and save it → the row's `path` changes and there is still exactly
   one row for `ARC-004`.
3. Delete `documents.json`, then save any registered document → the file is rebuilt with that
   document in it, and nothing in the window errored while it was gone.
4. Grep the registry writer for a field other than `id`, `kind`, `path`, `project`, `at` → none.

**§1.2 — the leaves**

5. Write `::rfc{id=RFC-073 arc=ARC-004}` at the top of a document → it renders as a one-line header
   naming the RFC and its arc, with nothing to press.
6. Write `::report{id=subscribe-and-registration}` → the same, for a report.
7. Register an RFC with `arc=ARC-004` → asking the registry for `ARC-004`'s RFCs returns it.

**§1.3 — folders are gone**

8. Put an RFC carrying a `::rfc` leaf in `docs/designs/` → it appears on the band's RFC tab with no
   configuration anywhere.
9. Put a file in `RFCs/` with no leaf → it does not appear as an RFC. It is a file.
10. Grep `AgentChat.js` and `bandTabs.js` for `listFiles({dir` → zero hits for document kinds.

**§2 — subscribe is an override; members are the fallback**

11. Approve a `:::approval` with no `subscribe=` on a document with members `buapi|systemlynx` →
    both receive one `document.updated`.
12. The same with `subscribe=buapi` → buapi receives it; systemlynx receives nothing.
13. The same with `subscribe=reviewer-x`, who is not a member → reviewer-x receives it.
14. Approve on a document with no members and no `subscribe=` → nobody receives anything, and
    nothing errors or refuses.
15. Edit a paragraph so that no block fires → nothing is delivered by this mechanism; the pin's
    behind-count moves exactly as it does today.

**§2.3 — the receipt is in the block**

16. After a delivery → the fired block's line carries `told=` naming who was delivered to.
17. Save the document again with `told=` covering the audience → no second delivery.
18. Hand-edit `told=` off the block and save → it delivers again. There is no other baseline.
19. Grep the host for any stored previous-state of a document's blocks → none.

**§3 — the write is the fire**

20. An agent writes `verdict=approved` into a file with a **Bash heredoc** — not Edit — with no
    window open anywhere → the members receive `document.updated` with a summary naming the ask.
21. The summary reads `approved — <ask>` for an approval, `answered "<answer>" — <label>` for a
    question, `O2 is done — <first line of what>` for an objective, `committed <sha> — <message>`
    for a commit, `<by> replied in <thread> — <first line>` for a reply.
22. Make the session router fail the hand-off → `told=` is NOT stamped, and the next save delivers
    again.

**§3.1 — one parser**

23. Grep `documentUpdate.cjs` for `LINE(` and the attribute regex → gone; `membersIn` and `arcIn`
    read `parse.js`'s output.
24. Put a `:::approval` — a container — in a document and approve it with no window → it fires.
25. `electron/markdown/parse.cjs`, `write.cjs` and `blocks.cjs` import no React and nothing from
    SystemView; `node -e "require('<path>/parse.cjs')"` parses a fixture containing a leaf, a
    container and an inline directive; SystemView's `directives.js` imports the parse and
    `Markdown.js` calls `write.cjs` for every attribute it sets, carrying neither of its own.

**§3.2 — in the chat, a press queues**

26. Press two questions and an approval in the chat, then send one message → the agent receives one
    turn carrying all three answers, and no turn opened at any press.
27. Before sending → the composer shows the pending answers; remove one → it is not sent.

**§4 — five registration paths, written down**

28. `show()` files a report → `documents.json` gains a `report` row with nobody having written a leaf.
29. Right-click → insert → `::rfc` → the block appears with fields for `id` and `arc`.
30. Save a document whose leaf is already registered → one row, no error, no second row.
31. `how-we-work/registration.md` exists, is indexed, and `context("how do I register an RFC")`
    returns it.
32. `rfc-authoring` §3 instructs writing `::rfc{id= arc=}`; `arc-planning` §5 says `::arc`
    registers; `arc-development` §3.5 says the move fires by itself rather than instructing a send.

**§5 — the slice order held**

33. Read the commits → registration landed before any surface read the registry, and the skill
    updates landed last.

**§6 — what was not added**

34. Put `subscribe=buapi` on a `:::cmd` and run it → nothing is delivered.
35. Grep the host for a second `fs.watch` or any `setInterval` over documents → none beyond the
    session watcher that already exists at `sessions.cjs:992`, unchanged.

**§3 — the parse is the fire**

36. Render an approved block whose `told=` already covers its audience, then save it, then start a
    new session → exactly one delivery ever happened, and it was before all three.
37. Approve a block in a project with **no live session**, then start one for that project → it
    receives the fire on start, with no write having happened in between.
38. Put `::question[…]{options="a|b" subscribe=buapi}` in a **chat reply** and answer it → buapi
    receives it, and the receipt is an event beside the message in the transcript, not an attribute.

**§3.1 — one suite, several faces**

39. A second app on the platform reads `documents.json`, calls `parse.cjs` on `ARC-004`'s body, and
    renders the objectives its own way → it shows the same objectives in the same states SystemView
    shows, and approving one there fires `block.fired` to the same audience with no code in SystemView
    involved.

**§2.1 — the audience resolves upward**

40. Answer a `::question` with no `subscribe=` inside a `:::thread{subscribe=buapi}` on a document
    whose members are `systemlynx|buapi` → buapi alone receives it. The thread's audience won, not
    the document's.
41. A `:::reply` carrying its own `subscribe=` → the attribute is ignored; the thread decides who hears
    a reply, never the reply.
42. Grep the renderer and the host for a thread's `members=` or `sent=` → gone; a thread carries
    `subscribe=` and its replies carry `told=`.

:::approval{ask="Approve RFC-073 — a document's state lives in the system?"}
The piece most worth rejecting is §1.1: the registry never holds content.
:::
