::report{id="RFC-075 was one name away from all its proofs" as=audit retain=7d}

::members{who=systemview-test}

The card said 27 saved tests do not exist. **All 27 existed** — what did not exist was a way to
reach them: the hosted `Test` folder's `methods/Plugin.js` declared a module named `Plugin`, the
systemview-plugin mounts its own on the same service, and the two fought — record declaring both
method sets, built client resolving one, every `runTests`/`runProofs` in the project reading "Test
did not answer". One name, month-old, same collision I built fresh at 21:40 yesterday.

## The distance, before and after

| RFC-075 | specs built | green | red |
|---|---|---|---|
| before | 4 of 31 | 1 | 3, plus 27 unresolvable chips counted as evidence by the bar |
| after the collision fix | 31 | 19 | 12 |
| after the walk | 31 | **30** | **1 — deliberate** |

## Every red got an authority call, every "document moves" ruling a blind second opinion

Ten A (a decision moved the world; the spec adapts), one B (drift; the claim stands):

- **Four doors read the chapter at its old address** — the doctrine moved `rfcs.md → claims.md` by
  decision (`ac3bbad4`, `f4cc7cc5`), substance intact under new headings. Repointed.
- **c8 and c18 were half-superseded by RFC-076's "marked is not met"** — dated supersession notes on
  both claims (the RFC's own precedent), specs now pin the decided law, and the surviving half is
  asserted explicitly: running a proof moves nothing, no exit code is consulted, proof-without-mark
  is not met.
- **c5's rejected station died by your ruling** (`17e557bf`, *"I will never reject an RFC"*) —
  declined stands in draft, the verdict on the approval block carries the ending. The wrapper flag
  and the claim's failure clause now say so instead of describing the design as a failure.
- **The rfc-execution record spec asserted files that retention deletes at 14 days** — a decided
  policy. It now asserts the per-source close stamp the system keeps on purpose.
- **The chunker spec caught a real one**: the chapter's proof section had outgrown one chunk, the
  sequence stranded in part 2 of 2. The section split at its natural seam ("Leaving the proof — the
  check made pressable"), the corpus reindexed, the subject owns its chunk again.
- **The lone B, and the sharpest finding:** RFC-074's c9 and c15 — the only two unmarked claims in
  its list — were deleted by `d2bf2d6c`, a commit about something else, from under an approval
  reading `verdict=approved` on *"is this the complete list"*. No note, no decision. **G-13** is
  filed: restore them or decide their removal on the record.

::file[gaps/RFC-074_TWO_CLAIMS_DELETED_FROM_AN_APPROVED_CONTRACT.md]

**L357 stays red on purpose** — it is the tripwire that caught the deletion, and re-pinning it to 59
would erase the evidence. It goes green when G-13 resolves, and nothing else should turn it.

## What ran

`runProofs({projectCode, document: "RFC-075"})` — the table above regenerates from that one call.
`yarn test:api` 365 green after the hostProject change. The hub was restarted three times (your
standing order), once discovering that an un-disowned background start dies with its shell —
`disown` is now part of the recipe.

## The commits

::commit{sha=133ac19d}

::commit{sha=74731581}
