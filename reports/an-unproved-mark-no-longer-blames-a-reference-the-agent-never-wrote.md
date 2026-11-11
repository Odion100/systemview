# An unproved mark no longer blames a reference the agent never wrote

::report{id="An unproved mark no longer blames a reference the agent never wrote" as=account retain=24h}

**Two messages about a claim were describing faults that had not happened.** One told its reader a
reference did not resolve when the reference resolved perfectly. The other told its reader a proof
was missing when the proof was in the file, one character outside a fence. Both are fixed, both
readers hear the true thing now, and the second fix is **not the one I set out to build** — I built
that one, ran it green, and reverted it on finding a note in the code that said why it was wrong.

| | |
|---|---|
| **fixed** | an unproved met-mark no longer opens with *"points at "c1" and it does not resolve"*. The caller says which kind of fault it is; `unresolved` stays the default so the five blocks that really do resolve something are untouched by construction |
| **fixed** | a claim whose fold closes early on a fence at its own depth now SAYS so — counted per document, said first to the reader, and sent to the author as a state fault |
| **reverted, deliberately, and this is the part worth reading** | my chosen fix for the second was to normalize fences on the read path. It worked and it was wrong: the renderer does not normalize on read, so the bar would have claimed a spec was in a fold the picture visibly draws it outside of |
| **measured on real data** | the new detector over every registered document — 38 readable, 12 carrying claims, **0 jammed**. No false positive anywhere, and it answers that this is not what stops RFC-076 settling |
| **tests** | 2632 window (+22) · 438 hub · 23 cli · `yarn verify` green bare, including the ratchet and the production build |
| **arming** | both are `src/`, so the **bundle is rebuilt and this is live**. Nothing rides your shell restart |
| **not done** | the registry ROW is still silent about a jammed fold. Carded with why it is harder there, and with the measurement that says nothing is on fire |

---

## Press-list

- [ ] Write a `:::claim` with a `:::cmd` inside it at the same depth and a `::test` after the cmd.
      The claim should say **"this claim's fold closes early — a fence at its own depth ends it…
      Widen the claim's fence by one colon"**, *above* the no-proof line. Add one colon to the
      claim's fence and its close, and the line should go away and the spec should count.
- [ ] Mark a claim met with nothing in its fold and wait a minute. The message should read
      **"the ::claim you wrote at "cN" is marked met with no proof embedded"** — no "points at",
      no "does not resolve".
- [ ] A `::commit` with a bad sha should still read exactly as it always has:
      *"a ::commit you wrote points at "…" and it does not resolve — no such commit"*. That pair is
      the whole point of the discriminator.
- [ ] `yarn test` — 22 new assertions across `blockFailure.test.js`, `claims.test.js`,
      `claimRows.test.js` and `blocks/Claim.test.js`.

:::cmd
cd ~/Systemly/systemview && yarn verify
:::

## Pick 1 — the evaluation, written before the work

Recorded on the board before anything was built. **Do it as stated**, with one widening the card did
not have:

> VERIFIED IN SOURCE. `Claim.js:90` reports `{kind:"claim", ref: attrs.id, reason:"marked met with
> no proof embedded…"}` and `blockFailure.js:31` composes every fault as `a ::<kind> you wrote
> points at "<ref>" and it does not resolve — <why>`. For an unproved met-mark the first clause is
> false in both halves: nothing points, and `c1` resolved perfectly.
>
> THE WIDENING. I read all six callsites rather than the one. Five are GENUINE resolution faults and
> their copy is correct. So rewording the one shared line would make five true messages false to fix
> one false message.

::commit{sha=0af8976b}

::file[src/atoms/Markdown/blockFailure.js]

**The default is what protects the five**, and that is the whole design. `file`, `test`, `report`,
`branch` and `commit` pass nothing and keep the sentence they had; `claim` passes `fault: "state"`,
which locates the block and then states the whole fact — because for that shape the whole fact is
all there is. An unknown shape falls back rather than throwing: a fault channel that breaks on its
own argument tells nobody about the fault it was called for.

**And the persisted key is the part that would have gone wrong quietly.** These keys live in
`localStorage`, so writing the shape into the key unconditionally would invalidate every key already
on your disk and re-report every still-broken block once — the reload-flood this file's own history
is about (*"All I do is refresh the page and you get that."*). The default shape is omitted from the
key, so every stored key stays byte-identical. A state fault does get its own key, and there that is
correct rather than a cost: the message changed, so the next one delivered is the fixed line.

::file[src/atoms/Markdown/blockFailure.test.js]

**Teeth proven, not claimed.** I made the state shape fall through to the resolution wording — the
original bug — and four assertions failed, including the one that goes through the real hook. Then
put it back.

## Pick 2 — the evaluation came back DO SOMETHING ELSE, twice

The card said a `:::cmd` at the same depth silently eats a claim's proof. It is right, and it
understates the fault twice. Reproduced in **both** parsers before anything was built:

| | window `claimsOf` | host `blocks.cjs` |
|---|---|---|
| same-depth | `hasSpec:false, owed:true, specd:0` | span 2→5, inside `[cmd]`, `{spec:1}` |
| correctly nested | `hasSpec:true, owed:false, specd:1` | span 2→7, inside `[cmd,test]`, `{spec:2}` |

**Understatement one: it is not just the bar.** A spec outside the fold is invisible to `specsOf`
too, so it never runs as that claim's spec and the claim can never *settle*.

**Understatement two: the window's parser already claimed a guarantee nobody was invoking.**
`claims.js` said *"normalizeFences guarantees an outer fence is LONGER than every inner one"* — and
`normalizeFences` was only ever called from the window's EDIT paths. Every document written in a
text editor, which is every RFC an agent authors, was parsed raw.

### And then I was wrong, which is the useful half

So I built the obvious fix: normalize on the read path, making the claimed guarantee true. It
worked — 174 existing assertions green, five new ones green, no regression. Then I went to do the
same in the host and found this, sitting above the function I was about to call:

> `electron/markdown/parse.cjs:108` — *"NOT applied inside `parse()`: the renderer does not normalize
> on read either, and two parses that differ in a pre-pass are two parses."*

**That is right, and my own measurement had already proved it.** remark-directive is what the host's
`parse` and the window's renderer both build from, and the same-depth claim's span is 2→5 — so the
renderer ends the claim at the cmd's fence and draws the test chip **outside the box**, on screen.
Normalizing on read would have made the bar report *"1 of 1 spec'd"* over a picture that shows the
proof outside the fold: the window contradicting itself, which is the same fault class as the
registry row reading 2 while the window read 4/7 met. I reverted it and corrected the evaluation on
the board rather than quietly changing course.

### What got built instead

::commit{sha=79002e23}

::file[src/atoms/Markdown/claims.js]

**Reported, not repaired.** The claim carries `jammed`, the document counts it, and the repair stays
one character in the document — which is the one place every parser and the renderer all agree to
read. The detector is structural, not a guess: an opening fence of exactly the claim's width, seen
before the close. It cannot fire on a correctly nested claim, and that is an assertion rather than a
hope.

::file[src/atoms/Markdown/claimRows.js]

**The jam is said FIRST, ahead of the proof line**, and the ordering is the point. Somebody told only
*"no spec — nothing re-checks this"* goes and writes a proof that is already in the file, one
character outside the fence. Telling a person to do work that is already done is worse than telling
them nothing.

::file[src/atoms/Markdown/blocks/Claim.js]

**The author is told, through the channel pick 1 had just fixed** — and as a `state` fault, which is
the two picks meeting: the claim resolved fine, it is the document's shape that is wrong, so the
resolution wording would have sent them hunting a bad reference they never wrote. **No grace period**,
unlike the unproved nudge beside it: that one waits because marked-and-unproved is a normal stage of
the prescribed order of work, and a jammed fence is never a stage of anything.

## What built the bundles

::commit{sha=ef2de013}
::commit{sha=963a6c60}

`src/` reaches your window by the swap and nothing else, so neither of these waits on anything.

## Where the tests stand

| suite | ran | says |
|---|---|---|
| window | 2632 | green — 22 new, all on these two faults |
| hub | 438 | green — unchanged by this; no hub code was touched |
| cli | 23 | green — and says nothing about any of this |
| `yarn lint:ratchet` | — | clean, no rule worse and nothing new |
| production build | bare | compiles |
| the rendered DOM | 1 assertion | the jam line is the first `li` in `.md-claim__owes` |
| real documents | 38 read | 12 carry claims, 0 jammed — no false positive anywhere |

**The DOM row is there because the rest of the table could not answer it.** A unit test on `owesOf`
proves a string is returned, never that anybody sees it — and "computed and wired to nothing" is a
fault I have filed against this codebase more than once this week. So the assertion renders the
jammed claim and reads the text out of the list element.

## What I could NOT do or verify

- **The registry row is still silent about a jammed fold**, and the host is NOT wrong — I measured
  that both parsers truncate identically, which is why the fix reports rather than repairs. What is
  missing there is only the diagnostic, so an agent reading the row rather than the window still
  gets no warning. Carded, with why detection is harder against remark's tree and with the explicit
  bound that it must not become the orphan heuristic `claims.js` forbids by name.
- **I did not look at this in YOUR window.** The evidence is the rendered DOM in jest plus the real
  bundle being built and swapped — not a screenshot of your screen. The jam line has never been seen
  by a human eye, including mine, because there is no jammed claim in any of the 38 documents to look
  at. That is the honest state: it is proven to render, and it has not been *seen*.
- **Nothing currently triggers it.** 0 of 12 claim-carrying documents are jammed. This is prevention
  for the next hand-written fold, not a live outage — and it is explicitly NOT the cause of the open
  "RFC-076 can never settle" card, which I checked while I had the instrument.
- **The five resolution callers are pinned by their default, not by a message-by-message review of
  what the hub sends.** `branch` and `commit` take their `why` off the hub at runtime; I read the
  callsites and the shapes, and asserted the composer's output for both. What I did not do is drive
  a real failing branch diff through the hub to read the sentence that comes out.
