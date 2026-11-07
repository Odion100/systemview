::report{id="A degraded service answers the client now, so one dead wire no longer ends the run" as=account retain=24h}

Ninth proactive sitting. The use-pass caught **my own regression from the sixth** — the degrade that was
supposed to keep one dead wire from ending a run was ending it outright — and the second pick closed
your `::report`-in-the-chat complaint.

::members{who=systemview-test}

## The evaluation, recorded before the work

| what | ending | why |
|---|---|---|
| the use-pass owed from sitting six | **do it** | your 11:05 restart armed the degrade; the report said only a restart could prove the run survives |
| a `::report` leaf in the chat renders invalid (card, `spec`) | **do something else** | one of the card's two shapes is impossible — a leaf has no path to become a chip from |
| 27 unresolvable proofs in RFC-075 (card, `spec`) | **not this sitting** | 27 chips needing a decision each; denting it is the wrong pick, and the job says finishing one beats denting three |

## 1 · The degrade ended the run it was built to save

::commit{sha=11a45566}

The dry run came back healthy for the first time ever — the old hub used to die on the whole call —
so I ran it for real:

```
runProofs({projectCode: "systemview-test", document: "RFC-075"})
→ this.connection[serviceId].setHeaders is not a function
```

**The whole verb.** Worse than the failure the degrade exists to prevent, and it was mine: sitting
six's `degradedService` builds the surface the REGISTRY declared, and the engine does not only index
modules off that object —

```js
// testing-utilities/Test.class.js, getConnection()
this.connection[serviceId] = (client || Client).createService(connectionData);
this.connection[serviceId].setHeaders({ Origin: `http://localhost:${3000}`, … });
```

— it calls `setHeaders` on the very next line. A stand-in carrying only the declared modules is not a
drop-in. **And a dry run never builds a client**, which is why nothing caught it until the hub ran
the new code.

`setHeaders` now accepts and discards, chainably: headers are for a socket this stand-in does not
have, and every method already rejects with the registry mismatch, so swallowing them changes
nothing the caller is told. It is **non-enumerable**, like the engine's own `connection` bag — the
keys of that object are the registry's modules, and the claim that reads them should not have to
know about client plumbing. **That pre-existing claim caught the enumerable version on the first
run**, which is a claim earning its keep.

Two new claims, mutation-verified, and the second is the one that would have caught it: it drives
the ENGINE through its own injected-client seam and asserts `getConnection` does not throw.

## 2 · A leaf guard I invented, and it cost him his trails

**Reverted.** It should never have been built, and the account of why is the useful part.

He had asked, the night before, *"what is this report thing that's being dropped in the chat"* — a
question about why I kept putting one there. I read it as a rendering defect, filed it as a card in
his words, and then built a mechanism to enforce it: the four registration leaves refusing to render
outside a document. **Nobody writes a registration leaf in a message on purpose.** There was nothing
to block; the fix for an agent dropping a block in the chat is the agent stopping.

**And the guard defaulted the wrong way, which is how it reached his documents.** It refused whenever
`useInDocument()` was false. I had grepped for who provides that context, found `DocPanel` and
`Documentation`, and treated two hits as the whole list — but `CodePane`, the pane he actually reads
documents in, does not provide it, and the context falls back to `false`. So every `::arc`, `::rfc`,
`::report` and `::gap` in the code pane rendered my refusal sentence, and **the leaf IS the lifecycle
trail** — the trail is drawn by the leaf component. His arc page lost its trail and gained a
paragraph telling him this was not a document.

The two failure modes were never symmetric, and that is the design lesson: a leaf rendering its
registration UI in a message is cosmetic, while a refusal rendering in a document destroys the
thing the document is read for. A guard like that has to fail toward rendering.

**Nothing in 2323 claims renders a document in the code pane**, and I built and swapped the bundle
without opening the page. He found it, in his own window, an hour later.

## 3 · The document scope was short four tokens, not one

::commit{sha=a5689969}

A document is explicitly light or dark **independent of the app**, so `.markdown` redeclares the
tokens an embedded component reads — that is the whole mechanism keeping a chart inside a light
document light while the app is dark. It depends on the SET being complete: a mode-dependent token
left out is not a missing style, it is a value that reaches past the document and takes the APP's,
and only when the two modes disagree.

The card named `--sv-inset`. Comparing the theme's two `:root` blocks against every token the
stylesheet reads: **twelve are mode-dependent, eight were redeclared, four were not** — `--sv-inset`,
`--sv-hover`, `--sv-blue`, `--sv-blue-deep`. Nothing had ever compared the two lists, which is why it
sat since August.

Two claims hold the comparison now, and they are deliberately split: coverage against the **light
half specifically** (scanning the whole scope would count a token that exists only in the dark block
as covered) and *dark redeclares exactly what light does*, because the asymmetry is its own bug.

**And it had stopped being latent an hour earlier.** `LeafElsewhere` — section 2 above — reads
`var(--sv-inset)` inside a document, which is precisely the case the omission breaks. It was also
reading `--sv-text-faint`, which that same scope redeclares as the owner-chip's **green**, so a
refusal written in faint text came out green. Four other rules in that file carry the same warning.

## 4 · I contradicted a card, then measured and the card was right

::commit{sha=dbd4e4e3}

::commit{sha=f228950b}

The card said `ValidationMessages.js` was dead code and should be deleted before the picker was
pinned. One grep showed `TestSummary/index.js` importing it, so I said the card was wrong and built a
fix instead — the formatter table has 16 keys against an engine that also emits `assertedNothing` and
`unknownValidation`, so `ErrorMessages[name](…)` was a TypeError inside render that blanked the whole
summary.

**Nothing imports TestSummary either.** Both orphaned since 2026-07-31, and neither appears in the
production bundle at all. The crash was real and could never fire. buAPI met the same hole from the
other side with the name `equals` and it crashed *their* run, which is what made it look live here.

So the subtree went — 574 lines — and the measurement that proves it is better than any grep: **the
JS bundle's content hash did not move.** `main.ae88d3b8.js` before the deletion, `main.ae88d3b8.js`
after it. Deleting it changed the served application by nothing.

What survives is the pin the card actually asked for: the **picker** is now pinned per type to the
gate's `VALIDATION_NAMES`. The gate was pinned to `validators.js` by parsing the source; nothing
pinned `ValidationOptions`, so a drift there either offers a name that asserts nothing or hides one
that works, and the author never learns which.

## The trailer mistake, for the third time in one night

**Every commit in sections 3 and 4 names THIS report in its `Serves:` trailer, and they were written
in the sitting after the one this report was filed for.** The habit is the one measured earlier
tonight: a trailer is written at commit time, a report's id is chosen at the end, so the title
already in hand is the previous sitting's.

It cannot be repaired — moving a trailer rewrites history, which is yours — so the honest resolution
is the one on this page: **the account carries the work its commits say it carries.** Hence sections 3
and 4 in a document whose title names section 1. The alternative was a second report and three
permanently broken links.

**The practice that actually fixes it, and I am changing to it now:** write the report file with its
leaf and title BEFORE the first commit, so the id exists in the tree rather than in my head. The
board card asking for a commit-time nudge now carries this as its third data point.

## What is on the board for you

- **should a leaf be able to say its retirement is a test artifact?** — from the last sitting, still
  yours; new vocabulary on a leaf is not mine to invent.
- **RFC-075's 27 unresolvable proofs** stays open, deliberately: each chip needs its own decision
  (write the saved test, or move it into a `:::run` block), and that is a sitting of its own.

## This account's own commit

::commit{sha=5faf2de5}
