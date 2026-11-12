# A guard asked the shell for permission to use the hub

::report{id="The board was unreachable outside the shell" as=account retain=24h}

:::glance
- **agent** — systemview-test
- **run** — a board card
- **new features** — none
- **fixes** — the stale hasHostFiles gate deleted at both call sites and its dead import with it · the board's invented refusal line replaced by one driven by a write that actually failed
- **corrections** — this report's own headline — the symptom was my headless browser's, not one his shell can have
- **decisions** — none
- **live** — not stated
- **checked** — 2601 window across 170 files · 369 hub · 15 cli · verify green incl. the production build · the write path from a non-shell window and the refusal line both unverified
:::

**`hasHostFiles()` tested for the shell bridge (`window.systemview.files`) to decide whether the
hub could be written to.** `hostFiles` had stopped routing through that bridge — every verb it has
asks the hub — so the guard had become a question about a mechanism that is no longer the
mechanism. It was deleted, at both remaining call sites, along with a dead import.

**THE SYMPTOM I REPORTED WAS NOT ONE HE CAN HAVE, and the original headline of this report was
wrong.** I found it in a plain browser tab of my own, where the board sat on *"opening…"* forever.
SystemView runs in the Electron shell and nowhere else — his words, 2026-11-11: *"this application
shouldn't run in any browser besides this; this is a special application."* `window.systemview.files`
is present there, so the guard passed and the board worked. **Nothing he uses was broken.**

| | |
|---|---|
| **the real value, stated honestly** | a false gate is removed. The guard was dormant rather than harmless: the day the preload stops exposing `files`, the board dies in his shell under a line nothing had tried |
| **the precedent** | `AgentChat.js` carries a note where the same guard was removed from the report picker for the same reason. Two instances were left standing |
| **and one line that WAS invented** | the board printed *"no live service for this project — the board can't be saved from here"* from the guard rather than from anything attempted. It now says nothing until a write actually fails, and then says what came back |
| **what this did NOT fix** | any behaviour in his window. There was none to fix |
| **tests** | 2601 window · 369 hub · 15 cli · `yarn verify` green including the production build |

---

## The lesson, which is worth more than the fix

**My headless browser is an instrument, not the product's environment.** A fault that only appears
in the instrument is first a question about the instrument's fidelity, and only then a finding. I
ran a use-pass in a plain tab, hit a real stale guard, and wrote it up as though the surface he uses
had been down — "the board was unreachable" reads as an outage he lived through.

The finding was true and the headline was a lie about who it happened to. A report whose title
overstates the blast radius costs exactly what a wrong report costs: he read it, did not recognise
his own system in it, and had to come and ask.

## The evaluation, written before the work

On the board as **"the board sits on 'opening…' in any window that is not the shell"** before any
code. Ending chosen: **do it as stated by the code that already got it right** — drop the guard at
both remaining call sites, drop the dead import, and replace the invented note with a refusal driven
by an actual failed write.

**One thing I changed from the stated fix:** I did not leave `hasHostFiles` exported-but-unused. It
is deleted. The failure mode here is not a bug in the guard — it is somebody reaching for it a third
time, and the first two times cost a surface each. A door nobody can open cannot be opened by
accident.

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
