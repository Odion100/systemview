# RFC-073 — a document's state lives in the system, not in the window rendering it

**Status: approved** (his press, 2026-10-25) · 2026-10-23 · extends RFC-071 (a document has members) and RFC-072 (arc planning
and execution) · the word `subscribe` is also RFC-051's, and §2 settles that


::members{who=systemview-test sent=systemview-test:87w3dj}
::rfc{id=RFC-073}

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
| **identity** | `{ id, kind, path, project }` — and, beside it, a derived `state` the parse may rewrite and anyone may wipe (§1.4) | the registry |
| **body** | objectives, prose, verdicts, state — everything you would read | the document |

**The registry never holds content as truth.** No copy of any prose, no objective list anyone reads
as the answer. What it holds as identity is *that `ARC-004` exists, is systemview's, and its body is
at this path* — and beside that, a derived `state` the parse rewrites and anyone may wipe (§1.4),
which is a cache with a timestamp, never a second answer.


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

**And a fourth: `::gap{id=…}`.** A gap is written INTO ANOTHER PROJECT'S REPO by the agent who hit
it there — a bug, or a feature that project is missing, found while doing work that needed it. It is
not the owner's own note (that is the board); it is a message from outside, filed where the fix
lives, for that project's owner to pick up. Same shape, one registry row in the project it was
written into; `kind` is a string, so the cost is the leaf and a line in `blocks.cjs` saying what DONE
means for it (§1.4). The body is free-form and may be one line: a gap needs only its leaf and its
completion (`resolved=`).


**New entries in `src/atoms/Markdown/registry.js`**, components beside `Arc.js`: `Rfc.js` and
`Report.js`, each a one-line self-describing header. They render the id and the relationship; they
have no press and no state of their own.


### 1.3 · Folders

**Folder conventions stop existing.** Not configurable — gone. The two `listFiles({dir})` calls in
`AgentChat.js` that find RFCs and arcs by directory are replaced by a registry read, and
`bandTabs.js`'s document family (`reports`, `rfcs`, `arcs`) is counted from the registry.


A document with no leaf is **not** a kind. It is a file, findable the way any file is findable, and
that is the honest answer — better than a tab inferred from a path that happens to match.

### 1.4 · Lifecycle, and the one cache that is allowed to be stale

**Every kind declares what DONE means for it**, in `blocks.cjs` beside the grammar — an RFC is done
at `verdict=` (and built at its `STATUS`), an arc when every objective is `state=done`, a gap at
`resolved=`, a report never (it is a view; it only gets old). The parse yields that answer like any
other; nothing in the registry says it.

**A list of forty documents cannot open forty files per paint**, so each registry row carries,
beside its identity, a `state` object the parse derives: done-ness, verdict, open objective count,
approvals waiting, and `parsed` (when). **One file, two kinds of field, and the boundary is the
field, not the file**: identity (`id kind path project at`) is written only by registration and
never derived from content; `state` is derived only by the parse, may lag, says when it was parsed,
and can be wiped (`state: null`) without losing the document. Nothing reads `state` as truth — only
as *what the last parse saw, at that time*. It is rebuilt by the parse that already happens on every
write (§3), so it lags only for a document edited where no parse ran — and that lag is **visible**:
`parsed` older than the file's mtime. A list re-parses stale rows lazily, bounded to what is on
screen; a refresh press re-parses one row on demand (his: *"the user could update it too, but you
could also get ahead of it"*). This is the caching he asked for, placed where `hooks.cjs:300`'s
warning does not apply — that warning is about caching a DEFINITION, which goes stale invisibly;
derived state keyed to the file says when it is stale.

**Retirement is the document's to say** — a `retired` attribute on its leaf, or the file going. The
registry row leaves only with the file; the lists filter on the state. "Approval waiting → approved →
built → retired" is four answers read off one document, never four rows written anywhere.

**When a row leaves.** A row whose `path` no longer exists is removed at the next check that touches
it — the list's `stat` (claim 4) or the session-start sweep — and the drawer's counts drop with it.
No timer for that: a deleted file is noticed the next time anything looks, which is the next time
it could matter.

**Done is not gone — there is a window, per kind.** A document that just completed stays IN THE
LIST for a while, drawn as done and still findable (his: *"keep it there, meaning you can still find
it in the list"*): a report for days, an RFC for weeks, an arc about as long — the window is one
number per kind in `blocks.cjs`, beside the done attribute. When the window passes, the document
leaves the list (`retired`, written by the sweep job of §4.2 or by hand) and is only reachable as a
file; and eventually the file goes — the sweep deletes a report, and an RFC or an arc is his to
delete. Three moves — done, out of the list, gone — and only the first is the document's own word;
the other two are the clock and the sweep.

> **AMENDED by RFC-076 (2026-10-28), and this paragraph is the part it overturns.** The windows and
> the retiring sweep were never built — `LIFECYCLE` sits in `blocks.cjs` imported by nothing — and
> they are now withdrawn rather than owed. **No timer moves a document's state.** A timer that
> retires something is a decision nobody made, attributed to nobody, with no reason attached;
> retirement became a hand carrying a REASON (`as=cancelled|superseded|shelf|sideline|out of
> service`), which is what tells the lists whether the document ENDED or is merely PAUSED. One
> exception survives and it is not a calendar: a report may carry `retain=`, whose clock starts when
> the human first OPENS it and which he can divert. What the sweep keeps is its other job —
> re-parsing documents nobody has open. **Read `RFCs/RFC-076-every-registered-document-walks-a-lifecycle.md`
> for what replaced this.** The counts at the bottom — approvals waiting, open arcs —
are read off `state`, so a document leaving a state leaves the count in the same parse, before any
window.

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

**And the thread SHOWS who is in the room, inherited or not.** Today a thread draws its people on
its edge (*in this thread: …*), and that is the part worth keeping: an audience you cannot see is
one you cannot trust. A thread with no `subscribe=` draws the document's members on its edge the
same way, marked as inherited (quieter, *from the document*); adding or removing a name there writes
`subscribe=` and the thread becomes explicit. The fallback is a rule for the engine and a chip row
for him — never an invisible default.

**A THREAD HAS `subscribe=`, NOT `members=`.** Membership exists for the gated channel — the pin, the
press, "behind" — and that channel exists for prose edits, the changes that do not fire. A thread has
no such changes: everything that happens in one is a reply, and a reply fires. There is nothing in a
thread for a gated channel to gate, so RFC-071's thread `members=` (and its `sent=`) retire in favour
of one attribute: who hears what lands here. The document keeps both words because it is the one
place with changes nobody is woken for. **Nothing already written breaks**: a thread still
carrying `members=` is read as `subscribe=` with the same names, and the next write rewrites it.

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
| `::gap` | `resolved=` appears | `gap resolved — <title>` |
| `::claim` | `state=` appears (`met` / `unmet`) | `c34 met — <statement>` · `c9 not met — <note>` |

The *fires when* column is the same list `blocks.cjs` keeps as each block's **answer attribute** —
one table, read by the parse for firing and by §1.4 for done-ness. **A claim's mark is tracked the
same way as everything else here**: `subscribe=` on a claim names who hears its mark, the document's
members are the fallback, `told=` is its receipt — an agent marking `c34 met` in a file announces it
like a verdict does, and an RFC whose claims are being walked is readable from
anywhere as *which are met, by whom*, off `::claims` (§1.4's state carries the count).

**Result blocks fire from the event the host already sends**. `:::cmd`, `::run`, `::test`,
`::branch` and `::commit` write nothing into the document and never will — their transcript is the
host's log. But when one finishes, the host **already emits an event to the chat** carrying the
result (a run's exit and log lines; `committed <sha> — <message>`). That event is the fire. Delivery
is routing the same event to the block's `subscribe=` names as a second recipient, beside the chat
it already reaches. No attribute, no detection, no parse: a recipient added to an event that exists.
Opt-in by `subscribe=`; nobody else is woken. Slice 8.


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
| every write would cost a parse | **the registry is the filter**: the host sees the path in the tool call or the watcher's event, asks the registry *is this one of ours* — a Map hit — and parses only a registered document. Everything else costs a lookup |
| nobody has the document open | the session watcher parses on the agent's write; the sweep parses on session start |
| agents write with Bash, not through a door | the watcher — `sessions.cjs:992`, gated on tools-in-flight, and **every** `tool_use` counts (`:1221`), Bash included |
| his press in the window is not a tool in flight | the render parses it, and `files:write` is the host's own door |
| no session is live for that project | the **session-start sweep** — a session asks the registry what is undelivered and addressed to it |
| do not monitor the world | **no new watcher.** The one that exists was built for *"a shell sed, a git checkout, an MCP tool writing files"* and is gated so it cannot be mistaken for watching him |
| the chat has no file | **the chat is parsed by the same engine** — the one thing parse-time adds |


The watcher, the write door, the render and the sweep are not the mechanism. They are the reasons a
parse happens. **Write is one cause of a parse; render is another; a session arriving is another.**

On a parse, in order:

1. **Register.** EVERY registration leaf (`::arc` / `::rfc` / `::report` / `::gap`) in the
   document → one row each, `{id, kind, path, project}`, each row's state derived by its own kind
   out of the one file. The id is the identity: a moved file updates its rows, never duplicates
   them; a leaf removed from the file takes its row and leaves the others; a file with no leaves
   left loses every row it had. The FIRST leaf is the document's PRIMARY identity — fires and
   audiences answer with one name. (Amended 2026-10-29: this step used to take only the first
   leaf — "a document is one thing" — a rule that entered the code from a brainstorm question,
   not a ruling. The fixture case is why it went: a spec-registered mock document carries the
   leaf of the kind it exercises, pressable because that leaf has a row.) **Registration does not
   scope subscribe** — it only says which documents a session sweeps on start.
2. **Find what fired.** For each firing block (§2.2): audience is `subscribe=`, else the document's
   `::members{who=}`; if `told=` does not cover it, emit `block.fired`.
3. **Deliver, then stamp.** The host builds the event through `documentUpdate.cjs` — the existing
   builder, taking the block's own one-line summary instead of `summarize()` — hands it to the
   session router (`sessions.cjs:828`, which already delivers by `members`), then writes `told=`
   back where the block lives. **The event points back at the thing**: it carries the document's
   `project` and `path`, the registry `kind` and `id`, the block's `line` and name, and the
   summary — a receiver that cannot open what fired is holding a sentence, not a notification. A
   fired chat block points at the message instead (its row key), same shape. **Stamp only on a successful hand-off**, or a failed delivery becomes
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
| `write.cjs` — *set this attribute on this line of this file*. Today that is `setDirectiveAttr` in SystemView's `Markdown.js`; it is the write that puts `verdict=`, `state=`, `sha=`, `told=` and a claim's `state= by= at= note=` into a document, and it must not have two implementations. **It is also the agent's door**: an agent marks a claim or moves an objective through it (an MCP verb over `write.cjs`), not by hand-editing the line — one writer, so a mark written by an agent is the same write a press makes | the surfaces: the band, the pin, the composer's queue |
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


So the window keeps the pending answers, and **the queue is drawn as chat entries** — each pending
answer (and a message typed during a compaction) is a row in the conversation with a *queued* look,
removable before send, that becomes an ordinary sent row when it goes. No chip strip, no new
component: the list already draws rows with different looks, and a queued one is one more look (his:
*"show the queue as chat entries the same way you would show another chat entry with a different
look"*). **The queue is not a second feature** — it is what delivery looks like when the audience is
the conversation it is already in.

**Queue is the default, not the law**. A block may say `wake=now` — an approval you want landing
the second it is pressed — and the queue itself carries a *send now*, so the choice is his at the
moment rather than the author's in advance. **And the same queue is where a message typed during a
compaction goes**: it rides the next turn the agent can take instead of being lost or bounced — the
cue he has wanted since compaction first ate a sentence, and it costs nothing once the queue exists.

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
2. **Filing a report registers it; showing it only opens it** (show is navigation and has
   nothing to do with whether a document exists). Whatever writes `.systemview/report.*.md` — the
   host's write door, which every agent path goes through — stamps `::report{id=}`; no skill has to
   remember. `show()` retiring into nav/open is its own cleanup and does not touch this.
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
with `docsIndex`. The MUST is not optional and does not live in the chapter: it is a step in each
authoring skill (`rfc-authoring` §3, `arc-planning` §5, the report writer itself), which fire at the
moment the document is made.

**No registration skill**. Existing documents are registered by their own agents when he says
so — a leaf written by hand, with the chapter saying what shape. The one new skill is
`gap-authoring`, because its outcome is a document: a `::gap` written into another project's repo.

### 4.2 · The skills this changes

| skill / job | change |
|---|---|
| `rfc-authoring` | §3 writes `::rfc{id= arc=}` into the file; the approval block is one line, and the commitments it approves live in a plain section the claims are extracted from |
| `arc-planning` | §5 already writes `::arc`; add that doing so registers it, and that the arc no longer needs to live under `RFCs/arcs/` |
| `arc-development` (job) | §3.2's doors stop being folder reads. §3.5's "tell the members" becomes mostly automatic — moving an objective to `done` fires it — and the job says so rather than instructing a send that now happens by itself |
| `doc-maintenance` | the handbook gains `registration.md`; the chapter is this RFC's §4 |
| `context-maintenance` | nothing. Named here so the next pass does not go looking |
| `gap-authoring` (new) | an agent working in project A hits a bug or a missing feature in project B → writes a `::gap{id=}` document INTO B's repo, in B's owner's terms: what was needed, what happened instead, what done looks like. B's owner finds it in B's list; `resolved=` closes it |
| `report-authoring` (new) | the shape of a report, the way `rfc-authoring` is the shape of an RFC: what it is for (a disposable view, never the artifact), its `::report{id=}` leaf, what it points at, and that it expires — so every skill that files one files the same thing |
| `document-sweep` (new job, on a chore line) | the judgment exit the reports backstop (`api/reportJanitor.js`) is only the floor under: each agent walks its own registered documents on a period, keeps what still speaks, retires or deletes the rest — never an RFC or arc, never a report a run record points at, never a document with an unanswered approval. Reads the registry's `state` (§1.4) instead of folders, so it is written after slice 1; his first pass by hand before slice 2 is the same job run once |

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

8. **Result blocks: route the existing completion event to `subscribe=`**. `::commit` first —
   the event exists today and is the one we can prove (it currently lands in the chat dressed as a
   message he sent rather than as a log line, which this fixes on the way) — then the same routing
   for `:::cmd`, `::run`, `::test`, `::branch`. Nothing written into the document; nothing above
   depends on it.

**Slice 2 waits for his pass, not for a sweep**. Nothing stamps a leaf into a document nobody
looked at: he tells each agent, each one walks its own reports and RFCs, writes the leaf on what is
worth keeping and deletes the rest. The folder reads go only after that.

## 6 · What this does NOT add

- **No output written into the document by result blocks** — ever. Their completion is delivered
  from the host's existing event (§2.2, slice 8), not from anything in the file.
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
- **No new kinds beyond arc, RFC, report and gap.** Planning documents, lanes and jobs are left
  alone; `kind` is a string in the registry, so a fifth costs one leaf, one `blocks.cjs` line, and
  nothing else.

## 7 · The piece most worth rejecting

**That the registry's identity is never derived from content, and its `state` is never read as truth.**

If `state` is ever treated as the answer — a list that trusts the cached verdict without looking at
`parsed` — the system has a second answer to every question, kept in sync by nothing, which is the
monitor this design was built to avoid. The whole thing rests on *parse the document when you need
to know*; the cache only saves the parse when the file has not moved since, and says so.

If that cost is wrong, §1.1 and §3 change shape completely.


## What approving commits to

1. **§1.1** — a registry at `~/.autobot/documents.json` holding `{id, kind, path, project}` as
   identity, never derived from content, deletable and rebuilt from documents.
2. **§1.2** — `::rfc{id= arc=}`, `::report{id=}` and `::gap{id= from=}` leaves beside the existing
   `::arc`, as registry entries in `src/atoms/Markdown/registry.js`.
3. **§1.4** — every kind declares its DONE attribute in `blocks.cjs`; each registry row carries a
   derived `state` beside its identity, stamped with when it was parsed, wipeable, re-parsed lazily
   when stale; identity fields are never derived from content.
4. **§1.3** — folder conventions for RFCs, arcs and reports are REMOVED, not made configurable. A
   document with no leaf is not a kind.
5. **§2** — `subscribe` is one concept with three `what`s; a block's `subscribe=` is an override
   naming exactly who, agnostic to membership, with `::members{who=}` as the fallback.
6. **§2.3** — the delivery receipt is `told=` IN the block, so a fire is self-describing and no
   baseline is stored anywhere.
7. **§3** — the PARSE is the fire: the engine emits `block.fired` for a block with an answer, an
   audience, and no covering `told=`; the host routes it through the existing `documentUpdate.cjs`
   builder and session router, then stamps. The session watcher, `files:write`, the render and the
   session-start sweep are the parses that already happen — no new watcher.
8. **§3.1** — the grammar capability is autobot's: `parse.cjs`, `write.cjs` (the attribute
   write-back) and `blocks.cjs` (what the grammar is) under `electron/markdown/`. SystemView's renderer
   imports them and keeps only components and surfaces; the regexes in `documentUpdate.cjs` are
   removed. One parser, one write-back, one block list — the platform's.
9. **§3.2** — in the chat a press QUEUES and rides the next message; it never opens a turn.
10. **§4** — five registration paths, written into `how-we-work/registration.md`, with `rfc-authoring`,
   `arc-planning` and the `arc-development` job updated; two new skills, `gap-authoring` and
   `report-authoring`, because each one's outcome is a document kind.
11. **§5** — eight slices in that order, registration first, slice 2 only after his agents have
    registered what they keep, the session sweep before `subscribe=`, the skill updates after the
    core, result-block routing last.

## Claims

::claims

Each one is *where you stand → what you do → what you should see*. Grouped by where you'll be
standing when you check it, and each slice in §5 names the ones it makes checkable.

**In the window — the band and the drawer** (slices 2, 3)

::claim[Put a markdown document carrying a `::rfc` leaf in `docs/designs/` → it appears on the band's RFC tab with no configuration anywhere. The leaf is what makes it an RFC; the folder is nothing.]{id=c1 told=systemview-test state=met by=you at=1792976964844}

::claim[Put a file in `RFCs/` with no leaf → it does not appear as an RFC. It is a file.]{id=c2 state=met by=systemview-test at=1792967172382 note="a file in RFCs/ with no leaf has no registry row and no tab row — the folder read is gone from the RFC/arc tabs" told=systemview-test}

::claim[Write a `:::approval` into any registered document and save → the drawer's *approvals waiting* count rises by one without a reload. Approve it → it drops by one, without a reload. Reopen the window → the same number. The count is read off the parse of registered documents — that is the whole list it counts; an approval in the chat is answered in place and is not in it.]{id=c3}

::claim[Open the RFC or arc list → every row shows when it was last parsed. A row whose file is newer than that (edited where no session ran) re-parses while it is on screen and updates in place; a row whose file is not newer does not parse at all — the list costs one `stat` per row on screen, never a parse, never a timer (§1.4). An arc row draws its objectives as a progress bar, done over total, from the same state.]{id=c4}

::claim[Set `retired` on a document's leaf → it leaves the active lists; `documents.json` still has its row until the file is deleted (§1.4).]{id=c5}
::claim[Delete a registered document's file → the next list open or session start drops its row from `documents.json`, and the drawer's counts drop with it; nothing waited on a timer.]{id=c6}
::claim[Approve and build an RFC → it stays in the RFC list drawn as done, findable, for its kind's window; after the window the sweep writes `retired` and it leaves the list; the drawer's approvals count dropped at the approval, not at the window.]{id=c7}

**In a document — what you write, and what appears on its line** (slices 1, 3, 5)

::claim[Write `::rfc{id=RFC-073 arc=ARC-004}` at the top of a document → it renders as a one-line header naming the RFC and its arc, with nothing to press.]{id=c8 state=met by=systemview-test at=1792962034278 note="Rfc.js renders the id and 'for ARC-004' as a one-line header; RegistrationLeaves.test pins identity-only, no button" told=systemview-test}

::claim[Write `::report{id=subscribe-and-registration}`, or `::gap{id=G-12}` → the same, for a report and a gap.]{id=c9 state=met by=systemview-test at=1792962034278 note="Report.js and Gap.js share the chrome; a gap shows 'resolved' only when resolved= is on its leaf — 8 leaf tests green" told=systemview-test}

::claim[Right-click in any document → *insert* lists every registration leaf — `::arc`, `::rfc`, `::report`, `::gap` — each with its fields (`id`, and `arc=` for an RFC); pick one → the leaf lands at the top of the document, filled; save → the registry has the row. No typing of a block by hand.]{id=c10 state=met by=systemview-test at=1792964285220 note="the right-click menu offers Register this document → four kinds with their fields; the plan lands the leaf at the top, id filled from the filename; 9 registrationLeaf tests green" told=systemview-test}

::claim[Approve a `:::approval` with no `subscribe=` on a document with members `buapi|systemlynx` → both receive one `document.updated`; afterwards the block's line carries `told=buapi|systemlynx`.]{id=c11 state=met by=systemview-test at=1792964285220 note="tests/markdown-fires.js: no subscribe= → pending = both members; announce stamps told= for who was reached + the writer" told=systemview-test}

::claim[The same with `subscribe=buapi` → buapi receives it; systemlynx receives nothing.]{id=c12 state=met by=systemview-test at=1792964285220 note="tests/markdown-fires.js: subscribe=buapi → pending [buapi]; systemlynx not in the audience" told=systemview-test}

::claim[The same with `subscribe=reviewer-x`, who is not a member → reviewer-x receives it.]{id=c13 state=met by=systemview-test at=1792964285220 note="tests/markdown-fires.js: subscribe=reviewer-x (not a member) → reviewer-x is the audience" told=systemview-test}
::claim[Mark a `::claim{subscribe=buapi}` met → buapi receives `cN met — <statement>`; the document's other members receive nothing; the claim's line gains `told=buapi`.]{id=c14 state=met by=systemview-test at=1792964285220 note="tests/markdown-fires.js: a met ::claim{subscribe=buapi} fires 'c1 met — <statement>' to buapi alone" told=systemview-test}

::claim[Approve on a document with no members and no `subscribe=` → nobody receives anything, and nothing errors or refuses.]{id=c15 state=met by=systemview-test at=1792964285220 note="tests/markdown-fires.js: no members, no subscribe= → no fire, no error" told=systemview-test}

::claim[Edit a paragraph so that no block fires → nothing is delivered by this mechanism; the pin's behind-count moves exactly as it does today.]{id=c16 state=met by=systemview-test at=1792964285220 note="tests/markdown-fires.js: a paragraph edit answering nothing fires nothing" told=systemview-test}

::::claim[Save the document again with `told=` covering the audience → no second delivery.]{id=c17 state=met by=systemview-test at=1792964285220 note="tests/markdown-fires.js + announce: told= covering the audience is silence — parsed repeatedly, one delivery" told=systemview-test}
The fire-scan suite, pass/fail shown — nobody reads assert-code:
:::cmd
cd ~/autobot && node tests/markdown-fires.js | tail -2
:::
::::

::claim[Hand-edit `told=` off the block and save → it delivers again. There is no other baseline.]{id=c18 state=met by=systemview-test at=1792964285220 note="tests/markdown-fires.js: told= hand-edited off → the block fires again; no other baseline exists" told=systemview-test}

::claim[Answer a `::question` with no `subscribe=` inside a `::::thread{subscribe=buapi}` on a document whose members are `systemlynx|buapi` → buapi alone receives it. The thread's audience won.]{id=c19 state=met by=systemview-test at=1792964285220 note="tests/markdown-fires.js: a question with no subscribe= inside thread{subscribe=buapi} on members systemlynx|buapi → buapi alone" told=systemview-test}

::claim[A `:::reply` carrying its own `subscribe=` → ignored; the thread decides who hears a reply.]{id=c20 state=met by=systemview-test at=1792964285220 note="tests/markdown-fires.js: a reply's own subscribe= is ignored — the thread decides" told=systemview-test}

::claim[Open a document whose thread still says `members=buapi` → the thread behaves as `subscribe=buapi`; the next save rewrites the attribute; nobody lost their audience.]{id=c21 state=met by=systemview-test at=1792964285220 note="tests/markdown-fires.js + docMembers tests: a thread saying members= answers as subscribe=; the next audience write lands subscribe= and removes members=" told=systemview-test}
::claim[Open a thread with no `subscribe=` on a document with members `buapi|systemlynx` → the thread's edge shows both names, marked inherited; add `reviewer-x` there → the thread's line gains `subscribe=buapi|systemlynx|reviewer-x` and the chips read as its own.]{id=c22 state=met by=systemview-test at=1792964285220 note="Thread.js reads subscribe= (legacy members= still answers), inherited chips drawn; adding writes subscribe=…|reviewer-x and drops members= in one save — Thread tests green" told=systemview-test}

**In the chat — press, queue, send** (slice 6)

::claim[Press two questions and an approval in the chat, then send one message → the agent receives one turn carrying all three answers, and no turn opened at any press.]{id=c23}

::claim[Before sending → the pending answers sit in the conversation as queued rows, drawn differently from sent ones, with no chip strip above the composer; remove one → it is not sent and its block is unanswered again; *remove all* clears the queue in one press; send → the rows become ordinary sent rows.]{id=c24}

::claim[Press a block carrying `wake=now`, or press *send now* on the queue → that answer lands as its own turn, immediately.]{id=c25}

::claim[Type a message while the agent is compacting → it sits in the queue and arrives on the next turn the agent can take; nothing is lost.]{id=c26}

::claim[Put `::question[…]{options="a|b" subscribe=buapi}` in a **chat reply** and answer it → buapi receives it, and the receipt is an event beside the message in the transcript, not an attribute.]{id=c27}

**On the host, with no window open** (slices 3, 4)

::claim[An agent writes `verdict=approved` into a file with a **Bash heredoc** — not Edit — with no window open anywhere → the members receive `document.updated` carrying the summary naming the ask AND the document's project, path, kind, id and the block's line — enough to open it at the block without a search.]{id=c28 state=met by=systemview-test at=1792964285220 note="tests/markdown-announce.js: the event carries project, path, docKind, docId, block, line and the block's own summary; the watcher and files:write both call the same announce door (live watcher pass needs the shell restart)" told=systemview-test}

::claim[The summary reads `approved — <ask>` for an approval, `answered "<answer>" — <label>` for a question, `O2 is done — <first line of what>` for an objective, `committed <sha> — <message>` for a commit, `<by> replied in <thread> — <first line>` for a reply, `gap resolved — <title>` for a gap.]{id=c29 state=met by=systemview-test at=1792964285220 note="blocks.cjs summaries: approved/answered/objective-done/committed/replied-in-thread/gap-resolved; fires + announce tests pin approval, claim, reply-in-thread, gap" told=systemview-test}

::claim[Make the session router fail the hand-off → `told=` is NOT stamped, and the next save delivers again.]{id=c30 state=met by=systemview-test at=1792964285220 note="tests/markdown-announce.js: nobody reached → told= NOT stamped; deliverToMembers returns exactly who it pushed to" told=systemview-test}

::claim[Render an approved block whose `told=` already covers its audience, then save it, then start a new session → exactly one delivery ever happened, and it was before all three.]{id=c31 state=met by=systemview-test at=1792964285220 note="tests/markdown-announce.js: the writer is stamped told without being woken; re-parse after coverage delivers nothing" told=systemview-test}

::claim[Approve a block in a project with **no live session**, then start one for that project → it receives the fire on start, with no write having happened in between.]{id=c32 state=met by=systemview-test at=1792964285220 note="tests/markdown-announce.js: sweepDocuments() parses the registry's rows and emits what is still owed; wired at session start" told=systemview-test}

::claim[Write to a file that is not in the registry → the host does a lookup and no parse; write to one that is → one parse.]{id=c33 state=met by=systemview-test at=1792964285220 note="tests/markdown-announce.js: unknown md with no leaf in its head = lookup + head-read, parsed:false; a registered one pays one parse" told=systemview-test}

::claim[Put a `:::approval` — a container — in a document and approve it with no window → it fires.]{id=c34 state=met by=systemview-test at=1792964285220 note="tests/markdown-announce.js: the fired block is a :::approval container — the regex dialect could never see one; the parse does" told=systemview-test}
::claim[An agent marks a claim through the write verb — `state=met by=<code> at= note=` — with no window open → the members receive `c34 met — <statement>`, and the document's `::claims` count moves; a mark written without `note=` is refused by the verb.]{id=c35 state=met by=systemview-test at=1792964285220 note="tests/markdown-announce.js: markBlock refuses a claim mark without note= (nothing written); a proper mark lands state= by=<caller> at= note= in one write; mcp__systemview__mark is the verb over it" told=systemview-test}

**In the files — the registry, the cache, the greps** (slices 1, 2, 3)

::::claim[Save a document carrying `::arc{id=ARC-004}` through `files:write` → `~/.autobot/documents.json` gains one row for it — `{ id, kind, path, project, at }` and a `state` the parse filled, with no title or prose in either.]{id=c36 state=met by=systemview-test at=1792964285220 note="tests/markdown-announce.js: the announce door (the same one files:write calls) registers identity + parse-filled state, no prose; RFC-073/074 registered live through it — his press via files:write needs the shell restart" told=systemview-test}
The registry's own row for this very document — identity plus the parse-filled state, no prose:
:::cmd
node -e "const r=JSON.parse(require('fs').readFileSync(process.env.HOME+'/.autobot/documents.json'));console.log(JSON.stringify(r.find(d=>d.id==='RFC-073'),null,1))"
:::
::::

::claim[Move that file to another folder and save it → the row's `path` changes and there is still exactly one row for `ARC-004`.]{id=c37 state=met by=systemview-test at=1792962034278 note="tests/registry.js: the same id re-registered from a new path is one row carrying the newer path" told=systemview-test}

::claim[Delete `documents.json`, then save any registered document → the file is rebuilt with that document in it, and nothing in the window errored while it was gone.]{id=c38 state=met by=systemview-test at=1792962034278 note="tests/registry.js: documents.json deleted, one parse of a registered document rebuilt it, nothing errored" told=systemview-test}

::claim[Set a row's `state` to `null` in `documents.json` → nothing breaks; the next parse rebuilds it; the row's identity fields are untouched (§1.4).]{id=c39 state=met by=systemview-test at=1792962034278 note="tests/registry.js: state wiped to null, next register() rebuilt it, identity fields untouched" told=systemview-test}

::::claim[Grep the registration writer for a field other than `id`, `kind`, `path`, `project`, `at` → none; `state` is written by the parse alone.]{id=c40 state=met by=systemview-test at=1792962034278 note="upsert's whitelist drops state (and any content field) naming it in dropped; register() alone writes state, after its parse" told=systemview-test}
The whitelist, and the line that names what it dropped:
:::cmd
grep -n "const FIELDS\|dropped" ~/autobot/electron/markdown/registry.cjs
:::
::::

::::claim[Grep `AgentChat.js` and `bandTabs.js` for `listFiles({dir` → zero hits for document kinds.]{id=c41 state=met by=systemview-test at=1792975343502 note="RFC/arc tabs and listReports all read documentsRegistry; the .systemview walk survives only as the fallback for a hub too old to answer" told=systemview-test}
The one hit left is the reports FRESHNESS print (change detection), not a list source — the lists read the registry:
:::cmd
grep -n "listFiles({ dir" src/organisms/AgentChat/AgentChat.js src/organisms/AgentChat/bandTabs.js
:::
::::

::::claim[Grep `documentUpdate.cjs` for `LINE(` and the attribute regex → gone; `membersIn` and `arcIn` read the parser's output.]{id=c42 state=met by=systemview-test at=1792964285220 note="documentUpdate.cjs: LINE()/attrOf gone; membersIn/arcIn parse the head through electron/markdown/parse.cjs; tests/documents.js 20 green" told=systemview-test}
The one hit is the comment announcing the retirement — the live code parses through `electron/markdown/parse.cjs`:
:::cmd
grep -n "LINE\|attrOf" ~/autobot/electron/apps/documentUpdate.cjs
:::
::::

::claim[`electron/markdown/parse.cjs`, `write.cjs` and `blocks.cjs` import no React and nothing from SystemView; `node -e "require('<path>/parse.cjs')"` parses a fixture containing a leaf, a container and an inline directive; SystemView's `directives.js` imports the parse and `Markdown.js` calls `write.cjs` for every attribute it sets, carrying neither of its own.]{id=c43}
::::claim[Grep the renderer and the agent tools for a second writer of block attributes → one: `write.cjs`; a press and an agent's mark go through the same function.]{id=c44 state=unmet by=systemview-test at=1792964285220 note="two writers still exist: write.cjs (host) and setDirectiveAttr (renderer) — kept one IN BEHAVIOUR by tests/markdown-write.js until RFC-053 §4's npm package lets the renderer import the platform's; both now target the end-of-line attr bag" told=systemview-test}
The fixture that keeps the two writers one in behaviour — until RFC-053 §4's package seam retires the renderer's copy:
:::cmd
cd ~/autobot && node tests/markdown-write.js | tail -3
:::
::::

::::claim[Grep the host for any stored previous-state of a document's blocks → none.]{id=c45 state=met by=systemview-test at=1792964285220 note="grep electron/markdown + documentUpdate for stored previous-state → none; told= on the block is the only baseline" told=systemview-test}
Zero hits is the answer — told= on the block is the only baseline:
:::cmd
grep -rn "previousState\|prevBlocks\|lastBlocks" ~/autobot/electron/markdown ~/autobot/electron/apps/documentUpdate.cjs || echo "none"
:::
::::

::claim[Grep the renderer and the host for a thread's `members=` or `sent=` as a live path → gone except the one-line read-as-`subscribe=` migration.]{id=c46 state=unmet by=systemview-test at=1792964285220 note="the audience half is done (threads read+write subscribe=, members= answers as legacy) but thread sent= is still the live behind-tracking — it retires with slice 2's registration pass, since fires only cover registered documents" told=systemview-test}

::::claim[Grep the host for a second `fs.watch` or any `setInterval` over documents → none beyond the session watcher that already exists at `sessions.cjs:992`, unchanged.]{id=c47 state=met by=systemview-test at=1792964285220 note="grep → no new fs.watch, no setInterval over documents; the one watcher is sessions.cjs's existing tools-in-flight-gated one" told=systemview-test}
The document machinery holds no watcher and no timer of its own — and the whole shell's fs.watch list is the terminal's log tail, the agent-definitions reload, and the session watcher that already existed:
:::cmd
grep -rn "fs.watch(\|setInterval" ~/autobot/electron/markdown ~/autobot/electron/apps/documentUpdate.cjs || echo "none — the session watcher is the only eye"; grep -rn "fs.watch(" ~/autobot/electron --include='*.cjs' | grep -v node_modules
:::
::::

::claim[Read the commits → registration landed before any surface read the registry; the folder reads went only after the agents' own registration pass; the skill updates landed last.]{id=c48}

**In the skills and the handbook** (slice 7)

::claim[File a report through the host's write door with no leaf written by anyone → `documents.json` gains a `report` row.]{id=c49 state=met by=systemview-test at=1792975299444 note="reports.js write() ensures the leaf AND upserts the registry row (api/documentsRegistry.upsertRow, same whitelist; state left to the shell's parse) — .systemview is watcher-blind so this door registers or nobody does; 30 hub tests incl. the suite-isolation fix" told=systemview-test}

::claim[Save a document whose leaf is already registered → one row, no error, no second row.]{id=c50 state=met by=systemview-test at=1792962034278 note="tests/registry.js: re-registering an already-registered document is one row, no error, updated=true" told=systemview-test}

::claim[`how-we-work/registration.md` exists, is indexed, and `context("how do I register an RFC")` returns it.]{id=c51 state=met by=systemview-test at=1792964285220 note="docs/how-we-work/registration.md written and indexed; context(\\"how do I register an RFC\\") returns its chunks (and markdown.md's leaves section)"}

::claim[`rfc-authoring` §3 instructs writing `::rfc{id= arc=}`; `arc-planning` §5 says `::arc` registers; `arc-development` §3.5 says the move fires by itself rather than instructing a send.]{id=c52 state=met by=systemview-test at=1792964285220 note="rfc-authoring §3 opens the file with ::rfc{id= arc=}; arc-planning says ::arc registers; arc-development §3.5 rewritten — the move fires by itself, no send step" told=systemview-test}

::claim[`gap-authoring` exists as a skill and its outcome is a `::gap` document in the registry.]{id=c53 state=met by=systemview-test at=1792964285220 note="gap-authoring created through definitions.createSkill; its outcome is a ::gap document in the OTHER project's repo, done at resolved=" told=systemview-test}

**Another app, same platform** (after slice 3)

::claim[A second app on the platform reads `documents.json`, calls `parse.cjs` on `ARC-004`'s body, and renders the objectives its own way → it shows the same objectives in the same states SystemView shows, and approving one there fires `block.fired` to the same audience with no code in SystemView involved.]{id=c54}

**Result blocks — the host's own event, routed** (slice 8)

::claim[Press a `::commit{subscribe=buapi}` → the chat shows `committed <sha> — <message>` as a log line (not as a message he sent), and buapi receives the same event; the document is unchanged.]{id=c55}

::claim[Run a `:::cmd{subscribe=buapi}` → buapi receives the completion event the chat received, with the exit and the log lines; nothing is written into the document. The same for `::run`, `::test`, `::branch`.]{id=c56}

:::approval{ask="Approve RFC-073 — a document's state lives in the system?" verdict=approved told=systemview-test}
The piece most worth rejecting is §1.1 with §1.4: identity never derived from content, and a derived `state` that is never read as truth.
:::

:::approval{ask="Approve the 2026-10-29 amendment — a document may carry several registration leaves, one row each?"}
The amendment changes §4's register step: every leaf registers, each row's state derives by its own
kind, teardown is per-leaf, and the first leaf stays the primary identity for fires and audiences.
Built and tested the same day (autobot registry suite, 48 claims — one file, two rows, each state
by its own kind; a torn-out leaf takes only its row). The piece most worth rejecting: whether the
PRIMARY-identity convention (first leaf answers for fires) should instead fire per-leaf — today one
name answers, which keeps audiences simple and may undersell a fixture whose mock leaf completes.
:::

## STATUS — built 2026-10-25 (slices 1, 3, 4, 5, 6, 8, the skills of 7, and slice 2's RFC/arc cutover — his ruling: the registered list IS the honest list)

::claims

Walked the same day it was built. Three marked NOT MET say where the seams are: two writers until
RFC-053 §4's package (c44), thread `sent=` stays as the behind-tracking until slice 2 registers the
documents it would replace it on (c46), and a report filed through the hub lands outside every door
the registry hears (c49). Unchecked claims are the live passes still owed: the window's queue under
his hands (c23–c26), chat blocks parsed by the host (c27), two live sessions receiving one fire
(c11's second half), the registration pass filling the list back out (c48), the reports tab's cutover (c49's seam), and a second app on the platform (c54). The
watcher/files:write paths run the new code only after a shell restart.
