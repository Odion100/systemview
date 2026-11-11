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
| **tests** | 2666 window (+16) · 448 hub · 23 cli · `yarn verify` green bare, including the ratchet and the production build |
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

**The chat he was LAST IN decides, and openness decides nothing.** His correction, before the first
version had been on screen an hour: *"it has to be the tab that I was last in, because right now I
have all of you guys open on the dock… everyone is docked and the side panel is minimized on the
edge. So in a way, everyone is out."*

That sentence kills the rule I first wrote. "Is this chat open" is a true fact that **stops
discriminating the moment every chat is open**, which is his normal state — and the tie-break under
it, stable as it was, would have read him a document in whichever agent sorted first. Openness is
presence; what picks an agent is **attention**.

So two moments stamp the room, and the weaker one matters most: **sending** is unambiguous, and
**focusing the composer** is the cheapest honest proxy for "I am in here" when he is only reading.
A chat minimised to the dock edge still wins, because being out of sight is not being out of the
room — which is exactly the state he described.

The openness branches survive underneath, and now only run before anything has ever been stamped on
a machine.

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
- **He pressed it once and it answered in my voice** — but by the ROUTE branch, not by the rule: he
  was on a systemview-test page with my chat open, so the weaker fact happened to be right. That is
  the kind of pass that hides a bug, and it is why the rule changed rather than being left alone.
- **The stamp has never been read from a cold machine.** Before anything is stamped, listening falls
  through to the openness branches — correct by assertion, unseen in a window.
