# A document can be listened to, in the voice of the agent in the room

::report{id="A document can be listened to" as=account retain=24h}

**Right-click any block in a document → 🎧 Listen to this.** It reads that block aloud in the voice
of the agent whose chat is open — not the document's project — because the voice is already per
chat and the reader is the agent you are talking to, not the repository the file lives in.

| | |
|---|---|
| **built** | one menu item, the only one in that menu that writes nothing |
| **reads the SOURCE, not the rendered node** | `spokenForm` — the same converter the chat reads replies with — so state pills, badges and fold summaries a reader never said are not spoken |
| **offered where editing is not** | a read-only document, another project's repo, a block whose host cannot save. Listening is not an edit, so it is not gated like one |
| **follows neither the scroll nor the bot** | `readLine`'s own prescription for this exact case: *"a quiet 'read me this while I work' wants neither yanking the scroll nor a bot photobombing the pane"* |
| **tests** | 2660 window (+10) · 448 hub · 23 cli · `yarn verify` green bare, including the ratchet and the production build |
| **arming** | `src/` only — the bundle is rebuilt and swapped. Nothing to press |

---

## Press-list

- [ ] Right-click a paragraph in any document → **🎧 Listen to this**. It should read in the voice
      of the chat you have open, and the page should not move.
- [ ] Right-click inside a `:::claim` or a fold. It should read the statement, not the word
      "unproved" or the fold's summary line.
- [ ] Try it on a document in another project's repo. The item should be there — everything else
      in that menu will not be.

## What was already built, and what was not

**Almost all of it existed.** `sv:read` already puts anything into the one speech queue, reads the
text at START time rather than enqueue time, and takes `follow: {scroll, avatar}` per batch. The
voice has been per chat since 2026-10-21 — his ruling, *"the voice reading an agent's replies is
part of how that agent sounds"*. So the new part is small and it is a decision rather than a
mechanism: **which scope the existing voice lookup is made under.**

::file[src/utils/listeningScope.js]

One open chat is the whole intended case and needs no tie-break. The other two branches exist
because the window permits them and each is stated rather than left to fall out — with several
chats open the one he is on wins, otherwise the first by name: **arbitrary but stable**, so a wrong
answer can be noticed and corrected instead of sounding like a different bug every time.

## A crossed trailer, said plainly

::commit{sha=55ca9786}
::commit{sha=984efb40}

**Both of those carry `Serves: The board was unreachable outside the shell`, which is the wrong
document** — they serve this one. I wrote the trailer before this report existed, which is the
exact failure note `xci5` already records and whose cure is "write the report FILE before the first
commit". Fixing a trailer two commits back is a rebase, and a rebase of history he has not seen is
his, so they stand mislabelled and this paragraph is the correction.

## What I could NOT do or verify

- **Nothing was heard.** `yarn verify` is green and the scope rule is pinned by seven assertions,
  but speech synthesis does not run in jest and I did not press the item in a browser — my headless
  Chrome has no voices installed, and his window is not mine to drive. **The first press is his.**
- **One sentence at a time was not built.** `spokenMap` returns sentences with their line numbers,
  which is what would light the block up as it is read — the karaoke the chat already does. This
  sends the block as one piece. That is a smaller feature than it sounds and it is not here.
- **The several-chats-open tie-break is a guess at his intent**, not a measurement of it. It is
  stated in the code and in the tests so that correcting it is one line.
