# The row said met and could not say undefended

::report{id="The row said met and could not say undefended" as=account retain=24h}

:::glance
- **agent** — systemview-test
- **run** — a use-pass — runProofs on a document
- **new features** — none
- **fixes** — the registry row carries behavioral and specd, so the row and the window answer the same question the same way
- **corrections** — the markdown-state loop that pinned a run block and a cmd block as identical rows, split so specd can differ
- **decisions** — whether settled= should require its specs — deliberately not tightened, and on the card
- **live** — autobot electron/ — rides the shell restart
- **checked** — autobot markdown-state 44 (+2) · fourteen other autobot suites green · systemview not run, nothing in this repo changed; the live row unchanged until the shell restarts
:::

**RFC-076's registry row read `{total: 45, met: 44}` while not one of those 45 claims carried a
spec.** Every one of the 44 looked defended to an agent reading the row; the same document read
*"0 of 45 spec'd"* to a person at the window. The row carried the proof half and had no way to
express the contract half at all.

| | |
|---|---|
| **fixed** | the row carries `behavioral` and `specd`, so the row and the window answer the same question the same way |
| **the card was right about the file and wrong about the consequence** | *"can never settle"* is false — `settled` is a declaration that never consults specs, so RFC-076 could be declared settled tonight with nothing spec'd |
| **NOT tightened, deliberately** | making `settled=` require its specs changes a lifecycle state from an approved RFC whose §6 assigns the condition to no slice, and would flip live documents. That decision is his and it is on the card |
| **and it made his cmd ruling assertable** | a loop pinned a run block and a cmd block as identical rows. True for `met`, false for `specd` — the line the ruling draws, now split |
| **tests** | autobot `markdown-state` 42 → **44**, fourteen other suites green. Teeth proven by removing the field |
| **arming** | autobot `electron/` — **this rides your shell restart.** The rows will not say it until then |

---

## Press-list

- [ ] After the restart, `registry({projectCode:"systemview-test", kind:"rfc"})` — RFC-076's row
      should carry `behavioral: 45, specd: 0` beside `met: 44`.
- [ ] An all-experiential document should carry **neither** field rather than a zero.
- [ ] `node tests/markdown-state.js` in `~/autobot` — 44 assertions.

:::cmd
cd ~/autobot && node tests/markdown-state.js
:::

## The evaluation, written before the work

This came from a **use-pass**, not from reading the card first: `runProofs` on a document, to see
whether its spec collection agreed with the window's claims parser. They agreed — so no two-halves
fault there — and the pass turned up the asymmetry one level down.

> `blocks.cjs:492` publishes `state.claims = {total, met}` plus `unproved` when marked ≠ met. That is
> the PROOF half only. The window computes `specd` for itself in `claims.js`, so the window can say
> "0 of 45 spec'd" and an agent reading the row cannot — it sees 44 of 45 met and nothing suggesting
> every one of them rests on a command nobody re-runs.
>
> The file's own comment says the counts are kept "so a surface can say which half is missing" — and
> the half it kept is not the half this card is about.

**And the verdict came back `do something else` on the card's own proposal**, because the card's
premise does not hold: `settled = !!leaf.attrs.settled && claims.length > 0`. Specs are not in it.

## What was built

::commit{sha=5b62f1a project=autobot}

::file[~/autobot/electron/markdown/blocks.cjs]

**One vocabulary, not a second idea of what counts.** `SPECS` is the test/run set whose comment is
his ruling — *"the CMDs are not really specs. It's only run blocks and test blocks"* — `proofOwed` is
what the claim's own `kind=` asks for, and `insideOf` is the one definition of "in its fold". Nothing
new was invented; the question was simply never asked on this side.

**The fraction is over what OWES a spec**, so an experiential claim is absent from it rather than
counted as a hole — and both fields are omitted entirely when nothing owes one, so an
all-experiential document gets no fraction instead of a zero that invites the wrong question.

**Derived on the real file, which is the evidence that matters here:**

| | |
|---|---|
| before | `{"total":45,"met":44}` |
| after | `{"total":45,"met":44,"behavioral":45,"specd":0}` |

## The assertion that was wrong in a useful way

::file[~/autobot/tests/markdown-state.js]

A loop pinned a run block and a cmd block as producing identical rows, under a comment quoting
*"embedded, run blocks, whatever, we already know."* That was true for `met` and is now false for
`specd` — which is the other half of the same ruling and the whole reason this count exists. The loop
is split and carries the expected `specd` per block, so the cmd-is-not-a-spec line is pinned by a
test for the first time rather than living only in a comment.

**The two experiential assertions were left exactly as they were, on purpose** — they must keep
reading `{total: 1, met: 1}` with no fraction at all, and that is now a statement about the fix
rather than an accident of it.

## And the count the row could not produce before — every RFC at once

The sweep that was going to be the next question turned out to be one call per document through the
real `deriveState`, so it is here rather than carded:

| RFC | declares settled | met | spec'd |
|---|---|---|---|
| RFC-078 | no | 25/25 | **25/25** |
| RFC-075 | no | 25/26 | **25/25** |
| RFC-076 | no | 44/45 | **0/45** |
| RFC-073 | no | 7/55 | **0/55** |
| RFC-074 | no | 0/14 | **0/14** |

**Nothing declares `settled=`**, which answers the live-risk question: the declaration hole is real
and nobody has walked through it.

**And RFC-076 is not the outlier the card made it look like — RFC-073 is the same fault and bigger.**
Fifty-five behavioural claims, seven met, not one spec. The card about RFC-076 would have been worked
alone, and the document with the most undefended claims in the system is not the one it names. That
pairing is only visible because the row can now be asked the question across every document at once,
which is the whole point of putting the count on the row rather than leaving it in the window.

RFC-075 and RFC-078 are the counter-examples and worth saying out loud: both are fully spec'd, so
this is a real difference between documents rather than a standard nothing meets.

## Where the tests stand

| suite | ran | says |
|---|---|---|
| autobot `markdown-state` | 44 | green — 2 new, both on the contract half |
| `registry` · `markdown-announce` · `markdown-parse` · `markdown-fires` · `markdown-write` | 68 · 30 · 12 · 20 · 16 | green |
| `documents` · `attachments` · `job-path` · `nudge` · `hooks` · `board` · `lanes` · `compaction` · `run-slots` | 29 · 25 · 33 · 39 · ✓ · 9 · 21 · 25 · 7 | green, exit 0 each |
| systemview | — | **not run and did not need to be**: nothing in this repo changed |

## What I could NOT do or verify

- **The live row is unchanged until your shell restart**, because the derivation is autobot's. What I
  verified instead is the real RFC-076 file through the real `deriveState`, which is the same code
  the shell will run — but it is not the row, and I am not going to call it one.
- **I did not tighten `settled`.** The card's actual question — should `settled=` require its specs
  the way `resolved=` now requires its proof — is a lifecycle change from an approved contract that
  would flip live documents. It is on the card with the precedent quoted, and the card stays
  `partial` for exactly that reason.
- **Nothing here was seen rendered.** The window already computed `specd` and already shows it; this
  change is about the agent-facing row, and no surface was touched.
- **The settled-over-zero-specs sweep is DONE, and the answer is nobody.** All five claim-carrying
  RFCs read `settled: false` — nothing has been declared settled, so the hazard I handed him is
  latent rather than live, which is the thing worth knowing before deciding anything about it.
