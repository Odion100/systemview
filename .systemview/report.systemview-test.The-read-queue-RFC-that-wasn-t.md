# The read-queue RFC that wasn't

::report{id=read-queue-rfc-abandoned as=account retain=permanent retired=2026-11-02 retiredAs=out-of-service}

An `skill:rfc-authoring` run opened on 2026-10-28 to write the RFC for the read-queue / narration
design (what became `::cue`). He stopped it at step one, explicitly: **"I don't want no fucking
RFC — do it."** The run is abandoned by his order, not by neglect — this is its account.

What happened instead: the design went straight to code the same night, converged in conversation
rather than in a document —

- the **cue vocabulary** (say · highlight · point · press · call), his words, built as
  `::cue` markdown blocks: `src/atoms/Markdown/blocks/Cue.js`, `src/utils/cuePerform.js` (the one
  performer), `findCues`/segments in `src/utils/readAloud.js`, playback in `SpeakReply.js`
- arrival-play rides the existing `takeIfNew` — a new reply's cues play in order; history and
  documents never self-play; every row is a replayable command log
- `call` is designed, not wired — the block says so honestly
- the shell door (`Window.enqueueRead/readState/stopRead` in autobot `shellService.cjs`) predates
  the cue design and stands as the outside-a-reply path

Where the decision record lives instead of an RFC: the cue vocabulary and its rules are written
into the code comments at each file above, and the tour procedure that consumes them is
`~/.claude/skills/how-we-work-tour/SKILL.md`. If this design ever needs claims somebody can walk,
that is the moment to write the RFC he declined tonight — with the code already standing as its
implementation detail.