::report{id="The tour run closes with an account, because a card is not one" as=account retain=12h retired=2026-11-09 retiredAs=expired}

The `skill:how-we-work-tour` run has been nudging at 1/3 with *"Play the ENTIRE tour"* active. It was
declared abandoned hours ago **and the nudging never stopped** — this is the account that actually
ends it, plus the measured reason the first attempt did not.

::members{who=systemview-test}

## Why the run cannot be driven to done

A tour **speaks and presses in your window**: it narrates out loud, walks the bot, draws boxes and
clicks the window's own addresses. Playing it while nobody is sitting there is the one thing an idle
run must not do — it takes your window instead of borrowing it. So the active item is not work I can
finish unattended, however long the nudge asks, and the honest ending is a declaration rather than a
play.

**What the run already achieved** is its first item: the skill itself was amended, so the tour's
seven chapters and the honest note about the newer back three are written down for whenever you ask
for it. The play is one press away and it is yours to press.

## The measured reason the first declaration failed

The run carried both halves of the doctrine as I understood it — a status starting with the word
`abandoned`, and an attachment. It kept being nudged anyway, and the code says exactly why:

```js
// autobot electron/agents/nudge.cjs
function excusedOf(run) {
  const st = ...run.status.text...;
  if (!/abandon/i.test(st)) return false;
  const atts = Array.isArray(run && run.attachments) ? run.attachments : [];
  return atts.some((a) => a && a.kind === "report");   // <- a CARD does not excuse
}
```

**The excuse is `kind: "report"` specifically.** I attached a `card` — the blocked card that carries
what you owe a decision on — which is the right pointer for a reader and not an account. The
reasoning behind the narrow check is sound and worth restating rather than arguing with: the word
without a record is testimony, and a card is a thing to do, not a record of what happened. So the
nudging continued, correctly, until this document existed.

Comparison, which is what made it obvious: the two other abandoned runs on disk — `skill:walkthrough`
at 1/3 and `skill:job-authoring` at 7/9 — each carry a `report` attachment, and neither has been
nudged since. Same word, different attachment kind, different outcome.

**And it was already recorded.** A system note says it in one line: *"what ends a nudging run is the
word AND a REPORT — `kind: "report"` specifically, not any artifact"*, pinned by a claim in
`tests/nudge.js` named *"a branch is not an account"*. I had the answer in the store and attached a
card anyway, which is the failure here: not a missing mechanism, a pointer I did not open.

## What is left, and whose it is

- **The tour's remaining two items are yours to start** — say the word and it plays to *Living specs*,
  then offers the back half. The cue breakage that made the first attempt read raw directive text is
  fixed at the host seam and armed by your shell restart.
- **The blocked card stays on the board.** It carries the two things that need you — the tour replay
  and the drawer rebuild — and removing it when the run closes would delete the ask along with the
  record of the run.
- **The list is left exactly where it stopped**, 1/3, item two still active. Nothing was marked done
  to quiet the nudge.

## This account's own commit

::commit{sha=c05319bc}
