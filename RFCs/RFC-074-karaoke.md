# RFC-074 — Karaoke: the sentence being read is shown

**Status: draft** · 2026-10-25 · extends the voice queue (`speechQueue.js`) and the spoken form
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
`playing.position.lines`. An effect on the row's container finds the rendered block covering those
lines — `[data-md-start]` elements where `start ≤ from && end ≥ to`, innermost match — and sets
`.md-karaoke` on it; the previous one loses it; `null` lines (the cut notice, nothing playing) clear
it. A `scrollIntoView({ block: "nearest" })` keeps it visible while he is not scrolling himself (the
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

:::approval{ask="Approve RFC-074 — karaoke: the sentence being read, shown?"}
Approving commits to: the spoken form keeping source lines per sentence and a chunk map aligned to the engine's own chunking (§1.1); the queue carrying `position` on the playing item, set by every caller of `speak()` (§1.2); the compact row showing the sentence as a subtitle with a one-pass ticker when it overflows, the full line showing it in place of the label (§1.3); the owning say row lighting the paragraph or block covering the sentence's lines, paragraph granularity, following with nearest-scroll unless he is scrolling (§1.4).

The piece most worth rejecting is §1.2 — the caller owning the map. If the engine should carry lines itself (speak a structured list instead of a string), the map moves into `speechEngine` and every engine has to learn markdown, which §1 of `voice.js` forbids.
:::
