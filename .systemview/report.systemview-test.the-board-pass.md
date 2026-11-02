# The board pass — nine cards closed, and what each one actually was

::report{id="The board pass" as=account retain=1h retired=2026-11-02 retiredAs=expired}

**121 cards in, 114 out.** Nine closed with the commit that closed each, two new ones opened where
I found debt rather than fixed it, and one stamped `reviewed` because building it would have meant
inventing a mechanism you would have had to undo.

**Six of the nine were not what the card said they were.** That is the finding worth keeping from
this pass: a card describes a symptom somebody hit, and the cause underneath it was usually wider.

---

## The two you named, live

### Dark text on dark when a log row expands

Not a colour choice. The rule asked for `--sv-text-dim`, **a token defined nowhere in the theme** —
the ramp is text / strong / muted / faint — so it resolved to its fallback, `inherit`, and
inherited the drawer's deliberately quiet chrome. The body you opened the row to READ was painted
with the colour of the chrome around it.

Seven more sites used the same phantom token with hardcoded **light-mode** hexes, which in dark
mode is the same bug wearing a different number.

Then counting them turned up the real scale: **17 `--sv-` tokens are defined and 33 are
referenced.** Sixteen are phantom. Nothing in the toolchain catches this — Sass does not resolve
custom properties, the browser has no error for an unknown one, and the page looks finished.

::commit{sha=e143a167}

### The usage bar pinned full

It tracked the highest meter, so one meter at 100 held the fill full for hours — and a bar that
cannot move says nothing about the meters that still can. It now tracks the highest **under** 100.
Your explicit pick is still honoured even at 100: asking for a meter and being shown a different
one is the surface overruling you, which is worse than a still bar.

::commit{sha=ab5ff783}

## Then down the board

**Two answers to "which plan serves this objective".** `Progress.js` had its own `plansByObjective`
matching `startsWith(arcId + "-")`. It accepted anything after the arc id — and it **missed every
cross-repo plan**, because an address is `autobot/ARC-001-O2` and that does not start with the arc
id at all. An arc split across repos reported progress for only the half kept at home, with a bar
that looked right.

::commit{sha=3f4c6cbc}

**The kind colours had already drifted and nobody had seen it.** Six identical declarations — and
five carried dark-mode values while the tile legend did not. So in dark mode the page's own legend
was painting light-mode chips beside the dark things it was labelling. A legend that disagrees with
what it labels is worse than no legend.

::commit{sha=9e44f264}

**ARC-001 and RFC-053 could never leave draft.** Neither carried an `:::approval` at all, so the
registry read `approvals: 0` and no press existed anywhere that could have moved them — an arc with
three objectives done, reading DRAFT. Draft says the direction was never agreed, and for both of
these it was.

::commit{sha=fe4cdfdb}

**A green suite is not a green build.** `yarn verify` now runs both suites and a production build.
Measured rather than assumed: a `no-undef` in a file reachable from the entry point is
`Failed to compile`, and jest never sees it; an orphan file nothing imports is invisible to both,
which is correct. It builds to `build.check`, never `build.next`, so a failed run can never leave
behind something a later `mv build.next build` would publish by accident.

::commit{sha=dd4f9bac}

**Every meter in `src` goes through the floor now.** Seventeen still sized their own fill from a
percentage, so one of 300 rendered as zero pixels — a bar saying ZERO about something that is not.
All seventeen turned out to be COUNTS, and four had invented their own floors: `Math.max(1, …)`,
`(2, …)`, `(3, …)`, `(pct, 1.5)` — all in percent, all different, none enough on a short bar.

::commit{sha=50494456}

**`@none` is not a project, and the danger is that it is not empty either.** It passes every
truthiness check a surface writes, so "nothing is selected" silently becomes "a project that exists
nowhere", and that lookup comes back empty with no error — an ABSENCE. Six readers trusted the
route segment and **three were failing right now**: the chat's point router compares it to answer
"is the human looking at MY project", so `@none` made that false for every bot at once and every
unaddressed cue was dropped by all of them; the scratchpad turned "no project, show everything"
into "show services belonging to @none", which is nothing; and a report link would have opened
against it.

::commit{sha=3190a196}

## The one I did not build

- [ ] **A broken markdown block should tell the agent that wrote it.** Stamped `reviewed`, not
  built. The blocking fact is concrete: **`documents.sendUpdate` is the only door from the window
  to an agent's session, and it is document-shaped** — path, project, members. Your worked example
  was a `::commit` in a chat reply, which has none of those. Detection already works (the block
  sets its own error and renders it); the missing half is purely delivery. It needs a new door and
  a decision about who hears it — the writer only, or the document's members too. I did not invent
  one for you to undo.

## What this pass opened

- [ ] **16 phantom theme tokens** render light-mode fallbacks in dark mode. Named in full in
  `src/sass/themeTokens.test.js`; the list may only shrink and a new one cannot be added.
- [ ] **77 eslint warnings** stand between us and a strict build gate. `yarn verify` catches
  errors, not warnings, because turning on `CI=true` would fail on all 77 today.

## What `commitLinks` says about this very report

Its first real run flagged eight shas named here whose trailers say they serve *The walk — jobs,
then authoring* rather than this report. **The checker is right and I was sloppy.** The work was
board work; the trailer named the assignment I happened to be inside when I committed it.

That is the convention's first real lesson, and it is worth more than the eight rows:
**`Serves:` names the thing the work SERVES, not the run you are in.** The two are the same thing
often enough that getting it wrong is easy and invisible — until something reads both ends.

The links are left as they are. Rewriting eight commit messages to tidy a report is a worse trade
than leaving a flagged disagreement that says exactly what happened.

## Verified after the shell restart

`commitLinks` ran for the first time through the door an agent actually calls and immediately
caught twelve one-way links and eight disagreements — in this report and the walk report, not in
somebody else's work. The twelve are closed. The eight stay flagged, and the lesson is written
where it happened: **`Serves:` names what the work serves, not the run you are inside.**

::commit{sha=8db8b29 project=autobot}

## What I have not verified

- **Nothing was seen on your screen.** Every fix is tested and built and the bundle is published,
  but your window takes it when it costs you nothing. The dark-on-dark body, the usage bar and the
  legend are all things only an eye can confirm, and I have not had one on them.
- **The two guards are source reads, not renders.** `themeTokens.test.js` and the widened
  `meterWidth.callsites.test.js` check what the code says, not what the browser paints — which is
  the right instrument for "a token that does not exist" and the wrong one for "does it look
  right".
- **The 16 phantom tokens are recorded, not fixed.** Each still renders a light-mode fallback in
  dark mode today.
