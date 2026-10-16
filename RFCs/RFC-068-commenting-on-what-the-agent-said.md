# RFC-068 — Commenting on what the agent said

**Status:** design. Nothing here is built.
**Owner:** systemview-test. The thread store and `reply` are the hub's; the row is the shell's.

---

## 1 · The subject

**He has no way to point at something the agent said.** The agent points at his world constantly —
`:file` chips, `:report`, `:ns`, the TV, a lane row — and every one of those is a real, resolvable
reference. In the other direction there is nothing. His only instrument is prose, so disagreeing with
one paragraph of a long reply means rebuilding the reference by hand: *"that's because you said that
shit and I fucking corrected you"*, *"you said that it had never been used"*. Both of those were him
re-deriving a pointer that should have been one click.

**And the cost is not politeness, it is dropped work.** A long reply with four things worth answering
has two available shapes today: four interruptions, each derailing the turn it lands in, or one
paragraph in which he holds all four — and in practice the third and fourth get dropped and surface
six turns later. That happened repeatedly on 2026-10-08.

So: **he right-clicks a paragraph in the chat and starts a thread on it**, the same gesture a report
already has. He can mark several across a long reply and keep reading. They reach the agent when he
next speaks — or sooner, if he presses the button.

## 2 · The model — one record, two renderings

**His words, his doing. One stored thread; two presentations, because there are two readers.**

| reader | form |
|---|---|
| **him, in the window** | the comment appears **in the spot** — on the paragraph, in the scrollback, where it makes sense to someone who can see the whole conversation at once |
| **the agent** | it arrives **at the end**, with his next message, as a pointer: *on what you said at 14:32 — «excerpt» — his comment: …* |

**THE APPEND IS THE TRUTH; the in-place rendering is the convenience.** He marked it later, so it
lands later. This is the one rule the rest of the design hangs off, and it is the one thing the
obvious implementation gets wrong: splicing the comment into the transcript at the original position
would make the next compaction summarise it as though it had always been there, losing the fact that
it came afterwards. Nothing in this system rewrites what happened — a dead run stays where it died, a
bring-in receipt is not overwritten, a lane statement is dated and attributed. A comment is no
different, and it carries its own two timestamps either way: **when the thing was said, and when he
marked it.**

The two forms do not conflict precisely because nothing is rewritten. They are the same split every
other surface here already runs on: the window gets the interactive form, the agent gets the small
retrievable one.

## 3 · The anchor — the one genuinely new mechanism

Everything downstream of the anchor exists. The anchor does not, and it is not an oversight:

- **Report threads anchor on a heading.** `atoms/Markdown/comments.js` says so, and says the
  alternative was considered and refused: *"the heading/hash anchoring an 'any block is commentable'
  design would have needed."* A chat bubble has no headings.
- **The chat deliberately does not use the `Commentable` wrapper.** `AgentChat.js` records why: the
  full document renderer was rejected for bubbles because its document-sized headings, block margins
  and *"the right-click Commentable wrapper"* all fight a small coloured bubble.

So the anchor is **(message id, text excerpt)** rather than a heading hash. The excerpt is what makes
it survive a re-render — the bubble is re-rendered on every refresh and on transcript replay, so an
index into its DOM is not stable. The message id and its `ts` come free; every chat record already
carries both.

**An anchor that no longer matches is a real case, not an error.** The agent edits nothing, so a
bubble's text does not change — but a transcript can be truncated, and a session's in-memory events
are capped and spliced from the front. A comment whose anchor cannot be found still has its excerpt
and its timestamps, which is enough to deliver it; it loses only the ability to highlight in place.
Say that on the row rather than dropping the comment.

## 4 · What reaches the agent

A block appended to his next message, one entry per pending comment:

```
<comment on="msg-4f2a" said="2026-10-10T14:32Z" marked="2026-10-10T14:41Z">
  «the status verb needs its own branch parameter»
  — this is the third time you've said that. Do it.
</comment>
```

**The excerpt is an EXCERPT, not the paragraph.** Four comments on one long reply, each quoting its
paragraph back in full, means the agent spends a large part of the next turn re-reading its own
prose — and these replies are long. The excerpt plus the message id is enough: the agent can go and
read the rest if the comment does not stand on its own.

**Delivered as his, never as the harness's.** It rides in with his message and is attributed to him,
with the same care the hook pointer takes in the other direction: a `<context-hook>` is wrapped
precisely so the mechanism cannot draw as him typing. The inverse applies here — a comment must not
read as the harness editorialising.

## 5 · The rows — his acts become visible too

**Each comment is a row in the feed**, in the same vocabulary as a hook firing or context being
injected. Nothing in this system is allowed to happen invisibly, and today the feed draws what the
agent did and what the harness did; his own acts appear only as whole messages. This is the first row
that is his and is not a message.

It also gives him what he cannot get today: **before he sends, he can see three marks pending.** A
comment made mid-turn currently exists only in his head until he types it.

| the row reads | because |
|---|---|
| **pending** | he marked it; the agent has not been given it |
| **delivered** | it rode in with a message — timestamped |
| **answered** | there is a **reply in the thread** |

**`answered` is read off the thread, never claimed.** A reply written into the thread is state; "I
addressed that" in prose is testimony, and this system has a settled position on which it trusts.
This is also what makes *persist until addressed* mechanical rather than a promise: the row stays
amber until a reply exists — the same shape as a lane row nobody has spoken for, or a chore line no
closed run has checked off.

**Unanswered comments persist and are re-delivered.** Delivered-once is the failure mode worth
designing out: a comment made while the agent is mid-turn lands in a turn that is doing something
else, gets a courteous acknowledgement, and is never actually answered — which is exactly what he has
been working around by repeating himself.

## 6 · Sending — held by default, with a door

- **Held until he next speaks.** The default, and the reason the feature is worth building: it lets
  him read a whole reply, mark it up, and spend one message.
- **A button that sends now.** For when the marks *are* the message and he does not want to type one.
  It arrives as a turn with the comment block and no prose.

Either way the agent sees the same block. The button changes when, not what.

## 7 · What is reused, and what is new

| | |
|---|---|
| **reused** | the thread store and `reply` (`api/Comments.js`, `codeComments.js`, the `comments`/`reply` verbs); the feed's row vocabulary; the `until`-style persistence pattern |
| **new** | the `(message id, excerpt)` anchor; the right-click affordance on a bubble; the comment row and its three states; the append-at-send delivery |

The seam test: **the chat must be deletable without the thread store changing.** Threads on reports
and threads on messages are the same records with different anchors, or this is a second comment
system.

## 8 · What gets built, in order

1. **The anchor and the store** — a thread keyed by `(message id, excerpt)`, written through the
   existing comment store. Nothing visible yet.
2. **The right-click on a bubble**, and the in-place rendering of a thread on it.
3. **The row**, with `pending`.
4. **The delivery** — the block appended at his next message, and the flip to `delivered`.
5. **`answered` read off the thread**, and re-delivery of anything still unanswered.
6. **The send-now button.**

## 9 · Considerations

- **Silence starts to mean something.** Once marking a paragraph is cheap, an unmarked one reads as
  approved. Report threads already work this way and he uses them well — but the chat carries far
  more, much of it throwaway, so this is a bigger shift. Worth wanting on purpose, not inheriting.
- **A comment on a claim the world has overtaken.** My messages are claims about a moving system; a
  mark on a forty-turn-old paragraph arrives now. The two timestamps are what keep it honest, but
  there is a judgement call underneath: is an old comment a correction of the record, or a question
  about what has changed since? The agent should be able to tell, and the timestamps are what let it.
- **Comments that are questions versus comments that are corrections.** A correction should land
  harder. The lane status settled this shape already with `tone` — the same three words would serve.
- **Whether a thread on a message survives a compaction.** The store does, trivially. The open
  question is whether an unanswered thread should be *re-surfaced* after the boundary — the shelf
  mechanism (`post-compaction`) already exists for exactly that moment, and an unanswered comment is
  a strong candidate for it.
