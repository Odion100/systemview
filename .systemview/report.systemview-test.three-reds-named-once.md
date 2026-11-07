::report{id="Three reds, named once — and the guard found a fifth" as=account retain=24h}

Fourth proactive sitting. One refinement that moves no pixels, one pick measured and **refused**,
and two cards closed — one of them in the opposite direction to its own premise.

::members{who=systemview-test}

## The evaluation, recorded before the work

| card | ending | why |
|---|---|---|
| FullTestController exists twice | **not now** | both copies are live — three window consumers, plus the hub and the CLI. Unifying two result shapes across five callers is a refactor, and the job's own rule is that denting is the wrong pick |
| no danger colour, so three places invent one | **do it as stated** | bounded, measurable, and it changes no pixels if the tokens land at the values already on screen |
| a rejected document reads like a draft | **already answered, oppositely** | his ruling tonight makes that reading CORRECT |

## What landed

::commit{sha=f98a93eb}

The count was **five**, not three or four:

- `--sv-danger` and `--sv-red` were referenced in two stylesheets and **defined nowhere**, each
  reference carrying its own hardcoded fallback — which is the only reason nothing ever broke
- `#a2503f` was written out **ten times across three files**, because there was nothing to reach for
- and the fifth was found by the guard on its first run: a navigator placeholder with its own
  `#c0504d`

**Three tokens, not one**, because they say three different things — and that is why "add a danger
colour" would have been the wrong fix:

| token | what it means |
|---|---|
| `--sv-danger` | a destructive **verb** — delete, clear, remove. About what a press does |
| `--sv-red` | a **failure that happened** — an error row, a refused call |
| `--sv-dead` | a thing that **cannot go anywhere** — a dead end on a trail, an address that does not resolve, an utterance that could not be spoken |

Each landed at the value its fallback already used, so **nothing on screen moved**. Naming a colour
is not the moment to change one. The fallbacks came off the five references as well: a fallback on a
token that IS defined re-states the value in five more places, which is the drift the card is about.

::file[src/sass/theme.scss]

## One correction to the card

It says an undefined `var()` was silently resolving to nothing — *"which is how a 'this does not
resolve' style ends up invisible"*. Not here: every reference carried a fallback, which is exactly
why nothing broke. The defect was real and it was the other half — five places inventing one colour,
with no name to share.

## Where the tests stand

| what ran | where | result |
|---|---|---|
| `themeTokens.test.js` | the window suite | 10 pass — 3 new, folded in rather than a second suite |
| `yarn verify` | window + hub + build | **2315** window (was 2312), 336 hub, production build green |

The claims live in the suite that already owned this subject, and **two names left its
known-phantom debt — 16 → 14** — a list that file already asserts may only shrink.

A hex literal is a literal, which is what makes a grep a **sound** check here. That is worth saying
beside last sitting's refusal: the cascade-collision detector was rejected because class names
cannot tell a fight from a higher-specificity override, and this one ships because there is nothing
to judge — a hardcoded colour either is or is not written down.

## Walk it yourself

Window work, so it rides a bundle swap:

- [ ] nothing should look different anywhere — that is the claim. A dead trail station, a failed
      utterance, a refused call and a delete verb all keep their exact colours
- [ ] `grep -rn '#a2503f' src/` → two hits, both in `theme.scss` (the token and its comment)
- [ ] add a hardcoded `#c0504d` anywhere in a stylesheet and `themeTokens.test.js` names the file

## This account's own commit

::commit{sha=bfc6e122}
