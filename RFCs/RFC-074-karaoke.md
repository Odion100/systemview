# RFC-074 — Karaoke: the sentence being read is shown

**Status: approved** · 2026-10-25 · extends the voice queue (`speechQueue.js`) and the spoken form
(`spokenForm.js`); touches nothing the engine does not already report

## The problem, as what it costs now

The voice says a sentence and the screen says `reading`. The engine knows exactly which sentence
it is on — `speechEngine.speak()` chunks the spoken text into sentences, generates one ahead, and
calls `onposition({ index, total })` every time it moves — but the only thing that number reaches is
the scrubber on the open voice line. So:

- **The row under the hovering bot, and the row in the docked peek, say `reading · a reply`.** He
  hears words and the surface shows a label. When two replies are in line he cannot tell which words
  belong to which without opening the chat.
- **The chat itself does not know where the voice is.** Looking at the reply while it reads, nothing
  in it moves. The reply's blocks already carry their source lines (`data-md-start/end`, written by
  `Commentable` in `Markdown.js`) — the address exists and nothing points at it.
- **`spokenForm` knows which lines each sentence came from and throws it away.** `walk()` steps
  through the markdown by line index, flushes a paragraph or announces a block, and returns plain
  strings.

Three pieces that each hold half of the answer, none of them joined.

## 1 · The design

**One map, one field, two readers.** The spoken form keeps the source lines per sentence; the queue
carries the current position on the playing item; the subtitle row and the chat read it.

### 1.1 `spokenForm` keeps the lines — `spokenMap()`

`src/utils/spokenForm.js`. `walk()` already runs `for (let i …)` over the lines; every `push` happens
at a known `i` (prose paragraphs span `paraStart..i`, a block spans its open..close fence). Record it:

```js
// each spoken sentence, and the source lines it was made from (1-based, inclusive)
export function spokenMap(markdown, { maxChars, only } = {})
  → [{ text, lines: [from, to] }]
```

`spokenForm()` becomes `spokenMap().map(s => s.text).join(" ")` — same string as today, the cut at
`MAX_SPOKEN` applied to the map first; `CUT_NOTICE` is appended with `lines: null` (it came from
nowhere on screen). Existing `spokenForm` tests stay green; new ones cover the map.

**Chunk ↔ sentence.** The engine re-chunks the joined string with `spokenChunks(text)` (whole
sentences grouped to ~240 chars, long sentences split at a word). `spokenChunks` is deterministic,
so the caller computes the same array and aligns each chunk to the map by character offset in the
joined string: a chunk's `lines` is the span from the first sentence it overlaps to the last.

```js
// src/utils/spokenForm.js
export function chunkMap(map, chunks) → [{ text, lines }]   // one per chunk, same index as the engine
```

### 1.2 The queue carries the position — `setPosition(key, pos)`

`src/molecules/SpeakReply/speechQueue.js`. Beside `setPaused`/`setWarming`, one more setter on the
playing item:

```js
export function setPosition(key, pos) // pos = { index, total, text, lines } | null
```

`playing.position` is read through `view()` like the rest. Every path that calls `speak()` — the
row's press (`SpeakReply.js`), the row's auto-read, and the conversation-level auto-reader in
`AgentChat.js` — passes `onposition: (p) => setPosition(key, { ...p, ...chunkMap[p.index] })`. The
caller has the markdown, so it owns the map; the engine stays a thing that turns strings into sound.

### 1.3 The subtitle — the compact row shows the sentence

`SpeechLine.js`, compact branch. `speech-line__clabel` shows `playing.position.text` while reading,
the reply's label while loading/waiting (there is no sentence yet). The label stays as the `title`.

**The ticker.** The hovering bot's row (`.agent-chat__nowbox`) is narrow; the docked peek's row is
not much wider. A sentence that does not fit scrolls through once per sentence rather than
truncating: `overflow: hidden` on the label, the text in an inner span; when `scrollWidth >
clientWidth` (measured on position change) the span gets `--overflow: <px>` and a `transform`
animation from 0 to `-overflow`, duration proportional to the overflow (≈ 40px/s), linear, once.
Reduced-motion users get the ellipsis. The full voice line (open chat) shows the sentence too, in
place of `reading · <label>`, no ticker needed — it is wide.

### 1.4 The chat lights the paragraph

The say row that owns the reply (`AgentChat.js`, `r.key === playing.key`) reads
`playing.position.lines`. An effect on the row's container picks, first, the one innermost block
covering the whole chunk (`start ≤ from && end ≥ to`) — a callout announced as one sentence spanning
its fences lights WHOLE, not the paragraph inside it. Only when nothing covers it does it fall back
to every innermost block the chunk touches (`start ≤ to && end ≥ from`): the engine groups whole
sentences to ~240 chars, so a chunk routinely runs from the end of one paragraph into the next, and
without the fallback those sentences lit nothing. Blocks no longer touched lose the mark; `null`
lines (the cut notice, nothing playing) clear it. A `scrollIntoView({ block: "nearest" })` keeps it visible while he is not scrolling himself (the
chat's existing "he scrolled" guard, the one the stream uses).

`.md-karaoke` is a left edge in `--sv-blue` and a faint tint, the same vocabulary as a hook's `--on`
edge — not a highlighter-pen; it moves every few seconds and must not flash.

**Granularity is the paragraph, by design.** Kokoro returns samples per sentence and no word
timestamps. Several chunks map to one paragraph; it stays lit while the voice moves through it. A
block (`::ask`, a table, a code fence) is announced as one sentence and lights whole, which is the
true unit: "a table, four columns" points at the table.

## 2 · Slices

1. **The map** — `spokenMap`, `chunkMap`, tests. No surface changes; `spokenForm` output identical.
2. **The position on the queue** — `setPosition`, the three `onposition` call sites, `view()` test.
   Still no visible change.
3. **The subtitle + ticker** — compact row and full line read the position.
4. **The lit paragraph** — the say row's effect and `.md-karaoke`.

In that order because 3 and 4 both read what 2 carries, and 2 needs 1's shape; each slice ships
green on its own and the first two are invisible.

## 3 · What this does NOT add

- **Word-level highlight.** No timestamps exist; estimating them would drift against the voice.
- **Clicking a paragraph to seek there.** The scrubber already seeks by sentence; a click-to-seek
  is a later RFC if wanted — the map makes it possible, this does not build it.
- **Subtitles for a reading that is not a chat reply** (a document read from the TV). Same queue,
  same field; the TV has no row to light yet.
- **Any engine change.** `speechEngine` already reports what is needed.

:::approval{ask="Approve RFC-074 — karaoke: the sentence being read, shown?" verdict=approved}
Approving commits to: the spoken form keeping source lines per sentence and a chunk map aligned to the engine's own chunking (§1.1); the queue carrying `position` on the playing item, set by every caller of `speak()` (§1.2); the compact row showing the sentence as a subtitle with a one-pass ticker when it overflows, the full line showing it in place of the label (§1.3); the owning say row lighting the paragraph or block covering the sentence's lines, paragraph granularity, following with nearest-scroll unless he is scrolling (§1.4).

The piece most worth rejecting is §1.2 — the caller owning the map. If the engine should carry lines itself (speak a structured list instead of a string), the map moves into `speechEngine` and every engine has to learn markdown, which §1 of `voice.js` forbids.
:::

## Claims

::claims

Each one checked against the build of 2026-10-25. A mark carries who, when, and what was seen; an unmarked claim is unchecked, never met.

::claim[`spokenMap(md).map(text).join(" ")` equals `spokenForm(md)` for any reply → the recital is unchanged by the map.]{id=c1 state=met by=systemview-test at=1792958045531 note="`spokenForm.test.js`, 'reads exactly what spokenForm reads'"}
::claim[A paragraph written over lines 1–2 → its sentence carries `lines: [1, 2]`; a list item, a task and a `::leaf` carry their one line; a heading's pause and the heading share its line.]{id=c2 state=met by=systemview-test at=1792958045531 note="checked against the build of 2026-10-25"}
::claim[A `:::container` spans its fences; a container he did not tick still hands out its body's own lines, offset to the outer text.]{id=c3 state=met by=systemview-test at=1792958045531 note="checked against the build of 2026-10-25"}
::claim[A code fence → one announced sentence spanning the fence lines.]{id=c4 state=met by=systemview-test at=1792958045531 note="checked against the build of 2026-10-25"}
::claim[A reply over `MAX_SPOKEN` → the cut notice carries `lines: null`; the kept sentences keep theirs.]{id=c5 state=met by=systemview-test at=1792958045531 note="checked against the build of 2026-10-25"}
::claim[`chunkMap` with one chunk per sentence → each chunk's lines; one chunk covering three sentences → first sentence's `from` to last sentence's `to`; a sentence split at a word → both halves carry the same paragraph.]{id=c6 state=met by=systemview-test at=1792958045531 note="checked against the build of 2026-10-25"}
::claim[`setPosition(key, pos)` on the playing key → `view().playing.position` is `{index, total, text, lines}` and every subscriber hears it; on a key that is not playing → `false`, nothing changes.]{id=c7 state=met by=systemview-test at=1792958045531 note="`speechQueue.test.js`"}
::claim[Press listen, auto-read, the closed-chat reader, and box-select each pass `onposition` into the line.]{id=c8 state=met by=systemview-test at=1792958045531 note="by reading (`SpeakReply.js` ×2, `AgentChat.js` ×2) and live"}
::claim[Box-select → subtitle text, `lines` absent, nothing lights.]{id=c9}
::claim[Reading, docked → the peek's row shows the sentence being spoken; loading or waiting → the reply's first words.]{id=c10 state=met by=systemview-test at=1792958045531 note=", seen by him 2026-10-25 (chat closed, docked and hovering"}
::claim[Reading, hovering → the row under the bubble shows the sentence; one that overflows slides through once, ~40px/s after a 0.8s hold, and the next sentence starts from the left.]{id=c11 state=met by=systemview-test at=1792958045531 note=", seen by him 2026-10-25 (hovering"}
::claim[Reading with the chat open → the full line's go-to button reads the sentence instead of the label.]{id=c12 state=met by=systemview-test at=1792958045531 note=", seen by him 2026-10-25"}
::claim[Reading a reply in this chat → the one innermost block covering the sentence's lines wears `.md-karaoke` (a callout lights whole); a chunk no block covers lights every block it touches; blocks no longer touched lose it; the end of the reading clears it.]{id=c13 state=met by=systemview-test at=1792958045531 note="on screen 2026-10-25 for the covering case; the straddle fallback built after his catch, not yet seen"}
::claim[A `::ask` or a table being announced → the whole block lights.]{id=c14 state=met by=systemview-test at=1792958045531 note="the callout, seen by him: 'it looked really nice when it was grabbing the entire callout'"}
::claim[Another agent's reading → nothing lights in this chat (scope mismatch).]{id=c15}
::claim[The chat is following → the lit block is scrolled to with `nearest`, pinned so it does not count as him scrolling away; he has scrolled off → nothing moves.]{id=c16 state=met by=systemview-test at=1792958045531 note=", seen by him 2026-10-25 (chat closed, docked and hovering"}

:::approval{ask="Is this the complete list of claims for RFC-074?" verdict=approved}
Pressing this makes the list the contract. A behaviour missing from it is one we agreed not to
check — so the thing to read for is what is NOT here.
:::

## STATUS — built 2026-10-25

::claims
