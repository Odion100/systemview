# RFC-050 — Interactive blocks in the chat

The direct chat renders documents now, so it can carry the same vocabulary the TV does. The only
thing that ever made that hard is the one he named: **how an agent reads the answer without extra
work.**

## The reconciliation

An answer is **two things at once**, and that is the whole design:

1. **It is written into the record.** `Chats.update()` already edits a chat record in place — it is
   how `chatHide` works. Answering rewrites the block's `answer=` attribute in the message text, so
   the chat shows it answered forever and anyone scrolling back sees the decision, not the question.
2. **It arrives as an ordinary message.** The same click posts a normal chat record from him —
   `answered "hide it entirely"` — so every agent reads it through the path it already uses. No
   polling, no new verb, nothing to learn. An agent that never heard of blocks still gets the answer
   in plain words.

That is the burden question answered: **agents read nothing new.** The document-truth is for the
human scrolling back; the message is for us.

## What comes in

- **Show** — `:file`, `:diff`, `:image`, `:report`, `:ns`, `:ui`, `:logs`, `:chart`, `:test`.
  Pure render, no state, no read-back. These are free.
- **Act** — `::commit`, `::run`. He presses, it happens. A commit offered where he actually lives
  rather than on a screen he has to look at.
- **Answer** — `::question`, `:::approval`. These carry the mechanism above.

## What stays on the TV

I argued the TV would lose its meaning if every message could be a document. He overruled that, and
he is right: *"the TV will still continue to have its purpose regardless. Reports in general will
continue to have their purpose — it still balances it, and it won't be unnecessary reports."*

The TV is where something goes when it is worth coming back to. That is a property of the thing,
not of the surface, and a chat that can carry a commit does not stop reports being reports — it
stops the reports that were only ever reports because there was nowhere else to put a button.

So: everything comes in.

## Typography is not the vocabulary

The chat keeps `renderChatMessage` for prose — its own spacing, its own bubbles, the look he signed
off on. Only `::block` lines hand off to the registry, which is the same component the TV renders.
One implementation of a commit block, two surfaces.

::question[Should an answered block ALSO post the plain-words message, or is rewriting the record enough?]{id=readback options="post the message too|rewrite the record only|post only, do not rewrite"}


---

## Built

- Leaf directives (`::commit`, `::question`, `::run`, `::test`, `::chart`…) and containers
  (`:::approval{…} … :::`) render in the chat through the **same registry components the TV uses**.
  There is one `CommitBlock` in this codebase, not two.
- Inline references gained `:help` and `:diff` alongside `:file`, `:ns`, `:ui`, `:report`.
- The chat keeps `renderChatMessage` for prose — its spacing, its bubbles. Only `::block` lines hand
  off. A sentence that merely looks like a directive is left as text.
- Attributes parse by the real rule: quoted values may hold spaces and pipes, unquoted ones stop at
  the first space. That is the bug that ate a `::question` on RFC-049; the chat does not repeat it.
- **Answering in a session says the answer in plain words** (`answered "one way"`), so an agent
  reads it through the path it already uses. The block still marks itself answered instantly.
- **Answering a room record** rewrites the block's `answer=` inside the record and posts the same
  plain-words message — `chatAnswer` in the hub, built on `Chats.update`, which is how `chatHide`
  already edits a record in place.

Verified in a browser: a question renders with its options, prose around it survives, a file chip
renders inline, a commit block renders, clicking an option sends `answered "one way"` to the session
and the option shows as chosen.
