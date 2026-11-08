::report{id="One word, one meaning — the suites say assertions" as=audit retain=7d}

::members{who=systemview-test}

Your catch, twice over: a report said *"169 claims — four new"* about a document holding two
`::claim` blocks, because the suites it quoted sign off in that word — *"73 claims held"*, *"ALL
169 CLAIMS PASS"* — and the surface an agent reads after every run teaches the vocabulary it will
write with. In this system a **claim** is a block in a registered document: co-signable,
proof-carrying, counted by the claims bar. What the suites count are **assertions**.

## Measured, before and after

| | before | after |
|---|---|---|
| sign-off lines saying "claims" | 25, across 25 suite files | 0 |
| comment-prose uses in the assertion sense | ~60, across 17 files | 0 |
| a harness function named `claim()` | 1 (`tests/perf.js`) | renamed `assertion()` |
| skills using the word for assertions | 0 (checked — the one hit is the real claims bar) | — |
| corpus chapters | 0 (the chapter already states the distinction) | — |

**What deliberately stayed:** the ordinary English verb (*"claiming to have applied it"*), every
reference to real `::claim` blocks and their machinery (`metClaims`, the markdown-state fixtures,
the mark-door tests), and today's already-filed reports — your order: improve the system forward,
touch nothing filed.

**Every touched suite re-ran green under the new word** — worklist 73, context 169, registry 69,
jobs 39, job-path 33, defs 29, documents 29, compaction 25, nudge 24, announce 22, lanes 21,
fires 20, page-events 16, write 16, shot 13, parse 12, origin 10, board 9, skew 7, run-slots 7,
skill-staleness 7, perf 5, wake 4, text-blocks 4 — all assertions now, in both senses.

## The other half of the same conversation

The reach failure that produced the mixed vocabulary is hooked now: **`report-proof-doctrine`**
fires on any write to a `.systemview/report.*` file and injects one note — *behavioural claims owe
`::test` or `:::run`; a cmd is evidence, never the spec; assertion counts are never "claims"* —
carried by me, delivered at the moment of filing instead of waiting to be asked. The chapter
itself needed nothing: every rule was already in it, unreached.

## The commit

::commit{sha=b71981d project=autobot}

Rides your shell restart only in the sense that nothing loads tests at runtime — the suites are
run, not served, so the rename is live the next time anything runs them.
