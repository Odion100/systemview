::report{id="The menu's gating can be asserted, and two cards were already closed" as=account retain=24h}

A second proactive sitting, fired on idle. One build, two cards closed on evidence — and the
pattern across both sittings is worth naming: **four of the five cards I opened tonight were
already done and their statuses were lying about it.**

::members{who=systemview-test}

## The evaluation, recorded before the work

| card | ending | why |
|---|---|---|
| a run block can only say `=` and `~` | **already closed** | all five operators land through the picker-derived named form, with claims |
| Nothing gated inside Markdown.js can carry a spec | **do it as stated** | the card named its own fix shape and the shape was right |

## What landed

::commit{sha=0896a75c}

`Markdown.js` cannot be mounted in a test — react-markdown is ESM and `transformIgnorePatterns`
excludes `node_modules` — so every affordance gated inside it was unspec'able. That component is
where a document's own verbs are decided, which made this the worst possible place for it. Found
while proving RFC-075's c4: *"add a proof"* is offered on a **leaf** claim and withheld on a
**container** one, and neither half could be asserted.

The six conditions are now `menuOffers()` in the pure module; the component renders them and
decides nothing.

::file[src/atoms/Markdown/menuOptions.js]

Two things the lift surfaced that the JSX had buried:

- **unwrap vs remove is a real distinction** and now says so — a wrapper comes off without taking
  its content, a leaf **is** its content, which is why one is armed and the other isn't.
- **the menu had two different reasons for offering no thread** and said them through one ternary on
  `at.start`. They are named states now: `nothing-to-wrap` off every block, `no-save` on a host that
  cannot keep replies.

## The two cards that were already closed

Neither needed code, and each needed its evidence written down:

- **the run-block grammar** — the card says `lengthEquals`, `isOneOf` and `includes` are unsayable in
  a document. They are not: `RunBlock.js` derives the legal validator NAMES from the authoring
  picker, so `✓ results.tags includes "forum"` compiles, and a validator added to the picker reaches
  documents for free. The length validators are translated to numeric assertions about `path.length`
  so `expected_type` is never guessed — a guess reads `mixed`, which skips the type check and is the
  vacuous pass this engine has been bitten by twice. Claimed in `runSteps.test.js`.
- **the cross-project id collision** (first sitting) — all three joins key on `docKey`, and
  `crossProject.test.js` asserts each by name.

## Where the tests stand

| what ran | where | result |
|---|---|---|
| `menuOptions.test.js` | the window suite | 9 pass, all new |
| `yarn verify` | window + hub + production build | **2311** window (was 2302), 336 hub, build green |

What this does **not** cover: the menu's RENDER. The claims assert what is offered, never that the
button appears — mounting is the thing that is impossible here, and that is the whole reason the
conditions moved. A wrong `className` or a dropped `onPick` would still pass.

## Walk it yourself

Window work, so it rides a bundle swap — no restart needed:

- [ ] right-click a `::claim[…]` leaf line → **Add a proof to this claim** is offered
- [ ] right-click a `:::claim` container → it is **not**, and the top verb reads *Remove this claim ·
      keeps the content*
- [ ] right-click a chart or a run block → *Really remove this…* arms on the first press
- [ ] right-click in the white space between blocks → *Nothing to wrap here* and *Insert at the end*

## The finding that outlasts both sittings

Four of five cards opened tonight were closed already, with `partial` statuses asserting work that
had since landed by another road. The board's count is its one promise, and a stale `partial` costs
more than a missing card: it gets re-picked, re-read and re-evaluated by whoever comes next — twice
tonight, by me. The statuses are now measured, with file, line and claim names, so the next reader
can disagree with evidence instead of re-deriving it.

## This account's own commit

::commit{sha=f1bece83}
