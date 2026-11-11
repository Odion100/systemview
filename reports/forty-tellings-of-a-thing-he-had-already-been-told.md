# Forty tellings of a thing he had already been told

::report{id="Forty tellings of a thing he had already been told" as=account retain=24h}

**Forty block-fault messages landed in his chat in about a minute, while he was working on
something else. Every one of them was a fact he had already been told, re-sent because I changed
the shape of a persisted key.**

The faults themselves are true — those claims really are marked met with no proof embedded, and
that is already on the board twice. **What was broken is the once-only promise**, and it is the
second time this file has flooded him for the same structural reason.

| | |
|---|---|
| **fixed** | `fault` is out of the dedupe key. The key is the FACT — kind, ref, reason, audience — never the wording |
| **why it flooded** | the key appended `fault` when it was not the default; the unproved-claim nudge then gained `fault: "state"`, so every stored key for the commonest fault in the system stopped matching at once |
| **the pre-existing keys match again**, so the claims he was told about before go quiet rather than needing to be told a third time |
| **tests** | 2650 window · 448 hub · 23 cli · `yarn verify` green bare, including the ratchet and the production build |
| **arming** | `src/` only — **the bundle is rebuilt and swapped**. Nothing to press |

---

## Press-list

- [ ] Open RFC-073 or RFC-074-karaoke again. It should say **nothing** — those claims have been
      reported and the record of that survived.
- [ ] `yarn test src/atoms/Markdown/blockFailure` — three assertions on the key, including one that
      a fault shape nobody has invented yet still cannot split it.

## What I actually did wrong

::file[src/atoms/Markdown/blockFailure.js]

The file's own comment already stated the rule — *"a key format that changes silently invalidates
every key already on his disk"* — and I wrote an exception to it in the same sitting, on the
reasoning that a reworded message deserves one fresh telling. Then I pointed the **unproved-claim**
nudge at that exception. Unproved claims are the single most numerous fault in this system: RFC-073
alone carries more than twenty.

So the cost of the exception was not "five resolution blocks report once". It was forty messages in
his chat at the moment the new bundle swapped in.

**The sentence is not part of the fact.** `reason` already separates two faults on one block — a
claim's unproved nudge and its jammed-fence nudge carry different reasons and so get different
keys — and that is what a fault actually is. `fault` only chooses which sentence to compose.

## What this does NOT fix, and it is the bigger half

- **The claims are genuinely unproved.** RFC-073 and RFC-074 carry one-line `::claim` leaves, and a
  two-colon directive cannot hold a proof by syntax — so every one of them is structurally unable
  to count as met until it is grown to `:::claim` with evidence inside. That is already two board
  cards and it is real work, not a flood artifact.
- **Forty true messages would still be forty messages.** The dedupe makes each fact arrive once; it
  does not make a document with twenty unproved claims arrive as one line instead of twenty. That
  is the same shape as the report I filed on 2026-11-10 about structural findings burying a real
  one, and it is carded rather than fixed here.
- **Nothing was watched live.** The fix is pinned by assertion and by the key being byte-identical
  to what is already on his disk; I did not re-render those documents in a browser to watch the
  silence.

## What built it

::commit{sha=c8ad4110}
::commit{sha=b5348b90}

The second is the bundle. A report cannot hold the sha of the commit that writes it, so these land
in the touch after them and the newest commit is one-way.
