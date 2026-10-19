# RFC-071 — A document has members: the meeting is a document with people on it

**His direction, 2026-10-19:** *"Maybe I just need a document, use the threads in the document, have
a conversation about the document. That's the meeting. Maybe I can add them on a document level for
updates. And it's really just separate features that I actually can use to help me have group
meetings."*

**STATUS: BUILT, 2026-10-19** — all five slices of §9, and the chain proved live by his own press
(the chip wrote `sent=systemview-test:1cbg93o` into this file and the hub's count went 1 → 0).
The only thing left is not code: each agent that should receive updates has to CARRY the standing
hook, which is an arming decision per agent. Built on his direct instruction (*"you have enough to
go ahead and start implementing"*); the approval block below is unpressed.


::members{who=systemview-test sent=systemview-test:1evgm2o}
## 1 · What this is, and what it refuses to be

::::thread{id=t1}
It refuses to be a **meeting object**. A meeting as a thing needs creating, joining, ending,
archiving, listing, and a home on disk — six pieces of new machinery for a concept that dissolves
the moment you look at it, because what you actually want is *these people, talking about this
document, while it changes*. That already has a name: the document.
:::reply{author=you ts=1792419716019}
At the end of the day, these are hooks, right? You know what I mean? We got to think, like, how does it fit in our system? We already have a system where we already know hooks are going to grow to be able to listen to any web page. You know what I mean? So we shouldn't just be implemented through the same system.
:::
:::reply{author=you ts=1792419750481}
So yeah, I mean UI and functionality, but underlined implementation.
:::
:::reply{author=you ts=1792425420727}
TAS TAS TAS TAS TAS TAS TAS TAS
:::
:::reply{author=you ts=1792425810451}
Let's get dirty.
:::
::::


So this RFC adds exactly one noun — **membership** — at two levels, and nothing else:

- **document membership** — an agent is *watching* this document. It hears about the document, not
  about every sentence in it.
- **thread membership** — an agent is *in this conversation*. A reply in that thread is for it.

A "meeting" is then an emergent thing: open a plan, put three agents on it, talk in threads, press
send when it's worth their turn. His first instinct was a right-click → "create meeting chat", and
the reason this is better is his own second instinct: *"these features aren't directly meeting, but
they facilitate having the meeting among multiple agents."*

## 2 · What already exists, verified on disk

::::thread{id=t3 members=systemview-test}
| piece | where | state |
|---|---|---|
| threads **in** the document | `src/atoms/Markdown/blocks/Thread.js` | `:::thread{id=…}` wraps anything; replies are written INTO the file as `:::reply{author= ts=}`. Not a sidecar — read the document and you have the conversation. |
| writing an attribute back | `src/atoms/Markdown/context.js` — `setAttr(line, key, value)` | rewrites the attribute inside that directive's own `{…}` and hands the whole document to the surface to save. This is how `:::approval` records a verdict today. |
| where that works | `CodePane` markdown preview (`onSourceChange` → `writeFile`, conflict-guarded) | a document in the centre takes a press **today**; the chat's renderer is read-only by design and its blocks say so |
| delivery at a moment | `autobot electron/agents/hooks.cjs` — an event, a declarative `when`, a pointer, carried per agent | **the mechanism this uses** (his t1). Ambient events already fan out to hooks and not to feeds. |
| delivery to another agent | `api/index.js` — `relayToVisitors` → `Chats.fanout` / `Chats.visit` | live and proven, and NOT what this uses: it carries content into a room, where a hook points an agent at what to read |
| live file editing | the doc pane re-reads on change | the thing that makes a shared document worth talking over at all |
| who an agent IS | a project code (its room) | membership names a ROOM, because that is what delivery already takes |
:::reply{author=you ts=1792422716514}
Okay, in new thread.
:::
:::reply{author=you ts=1792422781769}
So I added you as a member to this thread and it doesn't display above the thread that you remember. Is that only one spot in the document that they're showing? And is it random? I thought this was associated with the below thread.
:::
::::


**Nothing in the delivery half is new.** What is new is a narrower subscription — to a document, or
to a thread, rather than to a whole room — and a surface for it.

## 3 · Membership lives in the markdown

`::members{who=buapi|systemlynx}` — one block, at the top of the document, rendered as chips.

| why | |
|---|---|
| the document says who is on it | no second store to consult, the same argument that killed the reply sidecar |
| it travels with the file | a plan moved into a lane, a report filed, an RFC opened anywhere still knows its members |
| it is versioned | you see membership change in a diff before you commit it |
| it is removable by hand | it is markdown; if the UI is wrong, delete the line |
| the write mechanism exists | `setAttr` — the exact call `:::approval` makes |

**Thread membership is an attribute on the thread**, not a second block:
`:::thread{id=extraction members=buapi}`. A thread with no `members` inherits the document's.

**The cost of this choice, stated plainly:** a membership change is a file write, so it shows up in
`git status` and in the dirty state of an open pane. That is a feature for a plan under discussion
and a nuisance for a document somebody is editing at the same time — §7 covers the collision.

## 4 · Two levels, two costs — this is the whole design

A group chat where every message wakes every agent is a group chat nobody uses twice: every wake is
a real turn, with real tokens, on somebody's bill. His words: *"not every time I talk into the chat
I want everybody updated."*

| | thread member | document member |
|---|---|---|
| hears | every reply in that thread, as it is posted | nothing, until an update is SENT |
| costs | a turn per reply | a turn per send |
| who decides | posting the reply | pressing **send update** |
| default | none — membership is always explicit | none |

**Addressing and waking are separate acts, on purpose.** Addressing is *this is for you*; waking is
*take a turn now*. A reply in a thread addresses its members and wakes them. An update addresses
document members and wakes only the ones named in the send. Collapsing the two is what makes this
unaffordable the first time four agents sit on one plan.

::::thread{id=t2}
## 5 · The dirty state, and send update
:::reply{author=you ts=1792420043245}
Keeping in mind that the thread now may need to become scrollable and stuff and just a little bit more neat.
:::
::::


**The human is the clock.** The document goes **dirty** for a member the moment its content changes
after that member's last send — not on every keystroke, and nothing is delivered on its own.

- the chip for a dirty member carries a mark (`buapi •`)
- **send update** appears when any member is dirty; it offers the members, pre-ticked by dirtiness,
  so sending to one of three is a two-press act
- after a send, that member's mark clears — per member, never globally, since they were last updated
  at different times

**Auto-update is a per-document toggle, opt-in, never the default** — `::members{auto=true}`. The
reasoning is the bundle swap's: a change that interrupts is a change that costs somebody something
they did not ask to spend. (If this is wrong, it is wrong in the direction of being annoying rather
than expensive.)

### 5.1 · What a member actually receives

**The change, never the document.** A send delivers:

- the document's name and path (a `::file[…]` chip — one click to open it)
- **what changed since that member's last send** — a unified diff of the file, bounded; if it
  exceeds the bound, the section headings that changed plus the count
- the threads that gained replies, by id

A member can read the whole document any time — it is a file, and every agent has `readFile`. Sending
the whole file on every change is how this gets expensive enough that you stop using it, and it
arrives as a wall nobody reads.

### 5.2 · Where it lands — THROUGH THE HOOK SYSTEM

**His correction on the first draft (t1), and it changes the plumbing:** *"At the end of the day,
these are hooks, right? We already have a system where we already know hooks are going to grow to
be able to listen to any web page… so we should just be implemented through the same system. UI and
functionality, but underlying implementation."*

He is right, and the fit is exact. A hook already is *"an event that points an agent at a procedure,
at the moment it matters"* — which is this feature's whole sentence. Building a second delivery path
beside it would be the drifting-copy mistake this system keeps paying for.

**One new ambient event**, in `electron/agents/hooks.cjs`'s vocabulary:

```js
{ name: "document.updated",
  what: "a document someone is a member of was updated — a send, or an auto-update",
  fields: ["path", "project", "members", "by", "threads", "summary"] }
```

**Ambient** (`sessions.emitAmbient`), like the page events: it belongs to no session, so it fans out
to hooks and not to anybody's feed. The shell emits it; the page/panel never does — the same rule
page events already live by, for the same reason (a surface that could emit its own trigger could
forge a hook it was never granted).

**One standing hook per agent, not one per document.** The match is on the event, not on a path:

```yaml
on: document.updated
when: { members: { contains: "<the agent's project code>" } }
do: skill:read-a-document-update
```

So membership stays in the markdown — the document decides who matches — and adding a member is
still just editing the file. Ten documents do not mean ten hooks; an agent carries one.

**The pointer carries no content, which is the hook system's rule and happens to be the right
answer here anyway**: the event says *this document you are on moved, here is its path and what
changed*, and the agent reads the file itself. That is §5.1's "deliver the change, not the
document", arrived at from the other direction — the agent's own read is always current, and
nothing has to be copied into a message.

## 6 · The surface

| where | what |
|---|---|
| **top of the document** | the member chips, quiet and transparent until hovered — the same weight as the comment affordance. Add, remove, see who. |
| **a thread** | a members affordance beside the 💬 corner — inherits the document's, overrides locally |
| **codebase navigator** | **filter by member** — "what is buAPI on?" — reading `::members` off the files it already lists |
| **the band** | a dirty document is a row: *3 documents have updates to send*. The same place the mailbox already flags an unanswered approval. |
| **read-only surfaces** | the chat's renderer is not editable; chips render, presses say so, exactly as `:::approval` does today |

## 7 · The edges that will bite

| edge | the call |
|---|---|
| **two writers, one file** | `setAttr` saves the whole document. The pane is already conflict-guarded on write; membership presses go through the same guard, and a refused write says so rather than silently losing a member. |
| **a member that is not a connected project** | refuse at the press with the known rooms named — the same rule the board's title resolver follows. A chip pointing at nobody is worse than no chip. |
| **an agent setting membership on its own report** | allowed — he asked for it (*"agents could then use those features for other things, like when they create reports"*) — but it renders exactly like his own, and he can remove it. No invisible membership, ever. |
| **a member in a room that is attached** | `chatRelay` already handles the attached case; an update to an attached room is delivered to the session, not written to the room file |
| **membership on a document with no threads** | fine. Watching a file is a use on its own. |
| **the document is deleted or renamed** | membership dies with the file, because it lives in it. Nothing to garbage-collect. |

## 8 · What this does NOT include

- **No meeting lifecycle.** No start, no end, no attendance, no minutes. The document is the record.
- **No notification policy engine.** Two levels and one press; if that is not enough, the next RFC
  can say why.
- **No cross-document meetings.** One document is the unit. His own read: *"using one document seems
  easy, straightforward implementation."*
- **No membership on arbitrary blocks.** The engine could carry it on any directive, and he named
  that possibility first — but the only two he wants are the document and the thread, and every
  extra attachment point is a surface that has to explain itself.

## 9 · Order of work, if approved

1. ~~`::members` block + `members=` on `:::thread` — render only, no delivery. Chips, add, remove.~~
   **BUILT, 2026-10-19** — `src/atoms/Markdown/blocks/Members.js` + 8 claims; thread membership
   inherits the document's and says when it is inherited; a long exchange scrolls (his t2).
2. ~~The dirty state and **send update**~~ **BUILT** — per-member last-send hash in the same line,
   `send update` for everyone behind or one chip for one of them; the HOST emits the ambient
   `document.updated` (autobot `files-host.cjs`, 4 claims), the window never does.
3. ~~The navigator's filter.~~ **BUILT** — `Agent.documents({projectCode, member})` walks the
   folder (7 claims), an agent-facing `documents` tool asks it ("what am I on?"), and the codebase
   navigator grows one pill per member, composing with the text box and `.md` like every other
   filter there.
4. ~~The band row for documents with unsent updates.~~ **BUILT** — `documents` is a band kind; only
   documents where somebody is behind become rows.
5. ~~The `auto=true` toggle, last, deliberately.~~ **BUILT** — a press on the members line, off by
   default, and it waits 20s of stillness before sending, because a send per keystroke is the exact
   expense this design exists to avoid.

Each is landable on its own and useful on its own, which is the test that this is parts rather than
a feature with a lifecycle hiding inside it.

## 10 · Open — his calls, not mine

- **Does a thread reply wake its members immediately, or land where they read it on their next
  turn?** I have assumed immediate (a thread reply is a conversation), with document updates on the
  send. If turns are too expensive for that, both become sends.
- **Is `auto=true` worth building at all**, or is the press always right?
- **Should the band row appear for documents YOU are not looking at** — i.e. is "unsent updates" a
  project-wide number, or only the open document's business?

:::approval{verdict=approved}
Press ✓ to make this binding work, ✗ to reject it. Unpressed, it is a draft and nothing is built
from it.
:::
