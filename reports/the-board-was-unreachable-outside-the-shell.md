# The board was unreachable from any window that is not the shell

::report{id="The board was unreachable outside the shell" as=account retain=24h}

**A use-pass found it, not a read.** I opened the board in the centre in a plain browser tab on the
hub and it sat on **"opening…"** forever, under the line *"no live service for this project — the
board can't be saved from here"* — while the code pane beside it was reading files perfectly well.
Both halves of that line were untrue.

**The cause, read after the symptom:** `hasHostFiles()` tests for the **shell bridge**
(`window.systemview.files`). `hostFiles` stopped routing through that bridge — every verb it has
asks the hub, which knows the shell's registry. So the guard had become a question about a
mechanism that is no longer the mechanism, and it answers *no* in any window that is not the
Electron shell.

**It had already been caught once.** `AgentChat.js` carries an explicit note where the same guard
was removed from the report picker, for the same reason, with the same symptom — *"the guard made
the picker permanently empty in any tab where the shell bridge was absent, while the nav happily
listed reports beside it."* Two instances were left standing, plus a dead import.

::image[reports/the-board-in-a-plain-tab.png]{caption="the same plain tab afterwards — 138 cards, the counts, the OWES pills, and 'saved' in the header"}

| | |
|---|---|
| **what landed** | the guard is **deleted**, not merely unused · the board, the TV's reader and the report editor reach the hub from any window · the invented note replaced by a real refusal |
| **tests** | 2601 window · 369 hub · 15 cli · `yarn verify` green including the production build |
| **the real check** | the board drawn in a plain browser tab of my own, never your window |
| **also settled** | one board card closed by USE without a line of code — it already works |
| **lane** | none. The tree was clean, so it is committed in place |

---

## The evaluation, written before the work

On the board as **"the board sits on 'opening…' in any window that is not the shell"** before any
code. Ending chosen: **do it as stated by the code that already got it right** — drop the guard at
both remaining call sites, drop the dead import, and replace the invented note with a refusal driven
by an actual failed write.

**One thing I changed from the stated fix:** I did not leave `hasHostFiles` exported-but-unused. It
is deleted. The failure mode here is not a bug in the guard — it is somebody reaching for it a third
time, and the first two times cost a surface each. A door nobody can open cannot be opened by
accident.

**And the line the board printed deserved its own decision.** What stood there was printed from a
guard rather than from anything that had been tried, so a window that could save perfectly well said
it could not. It now says nothing until a write actually fails, and then says what the write came
back with.

::commit{sha=dc03a2b1}
::commit{sha=31cc9a17}

**What is still allowed, so this is not read as "the bridge is forbidden":** after a *successful*
hub write, `writeFile` tells the shell to parse the document (RFC-073 §3). That is an announcement,
not a gate — the file is already written, and outside the shell there is simply no announcement. The
fault was never using the bridge; it was asking it for permission.

## The other finding: a card that was already done

**"a file chip with line numbers should land me on the lines"** — *"Markdown doesn't easily get me
to the file location."* It lands. I pressed a `:file[src/atoms/Markdown/claims.js#L43-70]` chip in
RFC-075 and watched: the file opened in its own tab, the URL carried `?flines=43-70`, the editor
scrolled to 1058 of 5119, the range drew as a marked band, and the find bar showed an `L43–70 ×`
chip to let it go again.

**Ten minutes of pressing it beat a day of building it.** The card is stale and comes off the board
with this report as its account.

## Where the tests stand

| suite | ran | says |
|---|---|---|
| window (`yarn test`) | 2601 assertions, 170 files | green — 2 new here |
| hub (`yarn test:api`) | 369 | green |
| cli (`yarn test:cli`) | 15 | green |
| production build | in `yarn verify`, bare | compiles |

**The two new assertions are SOURCE-level and that is deliberate, not convenient.** Neither `Board`
nor `AgentChat` can be mounted in this suite at all — both reach react-markdown, which is ESM outside
`transformIgnorePatterns` — and the failure mode is not a rendering bug. It is the guard being
written back in a third place, which no amount of rendering the other two would catch. The same
shape as `meterWidth.callsites.test.js`, for the same reason.

:file[src/utils/hostFiles.callsites.test.js]

## The rest of the use-pass, and what it did NOT find

I walked the window the way you would, in my own headless Chrome, with a collector installed for
console errors, unhandled rejections and failing fetches:

- **the dashboard** — scrolls inside its box (715 of 1891), 32 tiles, no errors
- **stats** — draws, with the hub's real numbers
- **this morning's report** — all 8 `::commit` records resolve to their real messages, no dead chips,
  no unknown blocks, and both screenshots render
- **nothing threw.** The collector came back empty across the whole walk

**One thing I nearly filed as a fault and did not:** the second image in that report never finished
loading. It carries `loading="lazy"` and sat 3234px below the fold — scrolling to it loaded it in
under a second. That is the feature working, and a gap filed on it would have been noise.

## What I could NOT verify

- **Your window.** This all ran in a browser of my own on the same hub. I never drove yours.
- **Whether you have ever seen this fault.** You work inside the shell, where `window.systemview`
  exists, so the board has always loaded for you. What was broken is every other window — a plain
  tab on the hub, which is how this package is used outside the harness.
- **The board's WRITE path from a non-shell window.** I verified the read and the header reaching
  "saved"; I did not add a card from that tab, because the board it would write to is the real one.
- **The refusal line itself.** It renders only after a write genuinely fails, and I had no honest way
  to make one fail without breaking something real.

## Press-list

- [ ] Open the board in the centre as you normally do — it should be unchanged for you.
- [ ] If you ever open SystemView in a plain browser tab (`localhost:3000`), the board, the TV's
      reader and the report editor now work there too.
- [ ] `:file[path#L40-70]` chips: press one in any RFC. It should land you on the lines with a
      dismissable range chip — that is the card this report retires.
