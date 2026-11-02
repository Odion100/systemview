# The tour's shakedown run

::report{id=tour-shakedown as=account retain=permanent}

The first sourced run of `skill:how-we-work-tour` (2026-10-28, late) was never going to be the
tour — it was the shakedown, and it did a shakedown's job. Closed at 3/7 deliberately: the
remaining chapters are practice WITH HIM, and a tour spoken to an empty room violates the skill's
own bound (and the voice path's — it refuses an empty room by design).

What the run proved and fixed, each verified by photograph or measurement:

- **Chapter one toured live** as `::cue` beats — hero, intro, honest-line, rail — voice, box, bot
  and document-scroll all moving together.
- **The spotlight didn't render at all** on first press: `.hww-heads` wears `overflow: hidden` and
  clipped the outward outline — redrawn inward (`outline-offset: -3px`).
- **Point did nothing** under his ambient-animation-off setting: `force` passed the gate but every
  draw downstream still used the raw mode — fixed with an effective `draw` mode carried through
  goPoint, retries included; and point regained its document-pane scroll.
- **Row spacing** was eaten by the `!important` margin-zeroing on chat-wrapped blocks — weighted
  exception landed, gap ≈34px (26px chat floor + 4px), his eye owes the verdict.
- **The skill was rewritten from the experience** — cue vocabulary, stage verification before the
  first word, drain between chapters, never claim a beat without watching it land.

The real tour is a fresh run of the skill with him in the room, chapter one to Living specs. This
record is why that run will work on the first press.