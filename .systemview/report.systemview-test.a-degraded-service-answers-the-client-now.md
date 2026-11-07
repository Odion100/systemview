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

## 2 · A leaf outside a document refuses now, instead of badging itself invalid

::commit{sha=7a0a3133}

Your words: *"what is this report thing that 100% doesn't render properly and doesn't seem to make
any sense?"* A `::report` leaf in a chat message was rendering the whole registration UI — subtype
picker, retention picker, and an **invalid** badge — in a message that has no path and can never be
registered.

**The card offered two shapes and one is impossible.** A leaf cannot *"render as the chip it should
have been"*, because it carries an `id`, not a path (`::report{id="A title"}`) — turning it into
`:file[path]` would mean guessing which file you meant. So it refuses by name and teaches the form
that would have worked:

> `::report` registers the document it opens as a report, and starts its retention clock — and this
> is not a document, so nothing here can be registered. To point at one, write `:file[path]`.

::file[src/atoms/Markdown/blocks/LeafElsewhere.js]

**All four leaves go through it, not just the one you saw** — `::rfc`, `::arc` and `::gap` had the
same hole. The mechanism already existed (`useInDocument()`, provided by `DocPanel` and
`Documentation`, false everywhere else), so this is a guard rather than a new idea.

Four claims, and the one that matters most is not about the badge: **a leaf in a message no longer
stamps the retention clock.** Rendering a leaf IS reading the report, so a mention in the chat could
spend hours of a 24-hour window before you ever opened the file.

Two existing suites now mount their leaves inside `InDocumentProvider`. That is truthful rather than
test-bending — a leaf under test is a leaf in a document — and it is also the measured trap: the
context defaults to **false**, so anything mounted bare gets the non-document path.

## Where the tests stand

| what ran | where | result |
|---|---|---|
| `yarn verify` | window + hub + cli + production build | **157 suites · 2319** window, 347 hub, 12 cli, green |
| the new claims | hub + window | 2 on the degrade, 4 on the refusal |
| the mutation pass | both | `setHeaders` removed → both degrade claims fail; the leaf guard removed → the refusal claims fail |

**What a green suite does not cover, and it is the honest centre again:** the runner fix is in
`api/`, so **`runProofs` is still broken in your live hub** — it has been since 11:05, and it is my
regression, not an old one. Nothing presses that awake.

## Walk it yourself

The hub half, and this one is a real repair rather than a nicety:

:::cmd
kill $(pgrep -f "systemview start 3000") && systemview start 3000
:::

- [ ] then `runProofs({projectCode: "systemview-test", document: "RFC-075"})` → rows, not one
      sentence about `setHeaders`
- [ ] the window half is already **served** (`main.ae88d3b8.js`) and rides the swap your tab takes
      when it costs you nothing. Then write `::report{id="x"}` in a message: a quiet refusal naming
      `:file[path]`, no invalid badge, no countdown

## What is on the board for you

- **should a leaf be able to say its retirement is a test artifact?** — from the last sitting, still
  yours; new vocabulary on a leaf is not mine to invent.
- **RFC-075's 27 unresolvable proofs** stays open, deliberately: each chip needs its own decision
  (write the saved test, or move it into a `:::run` block), and that is a sitting of its own.

## This account's own commit

::commit{sha=5faf2de5}
