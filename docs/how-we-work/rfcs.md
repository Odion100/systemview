# RFCs — a design you can check later

An RFC is the record of a decision about how something will be built. It is written before the
code, argued until it is settled, approved with a press, and then — this is the part that was
missing — **reduced to a list of claims somebody can walk afterwards to find out whether the thing
actually does what was agreed.**

The missing half is measurable. At the moment this chapter was written, the SystemView repo held
**67 RFCs**: five carried a verdict, eight said anywhere whether they had been built, and those
eight spelled it three different ways. Every one of those sections was invented by whoever happened
to remember. Fifty-nine approved designs could not tell a reader whether they existed.

## What makes a document an RFC

**Implementation detail.** That is the whole test, and it is the line between an RFC and a report:
*"there's no real details and implementation, might as well have stayed a report… it's really just
discussion level shit, no choices of exactly this sort of implementation, this sort of algorithm."*

So an RFC names the files, the shapes, the algorithm, the order things land in. A document that
argues a position without committing to how it is built is a **report** — valuable, and not this.

## Where an RFC lives, and what it is not

`RFCs/` in the project it concerns, one file, `RFC-NNN-kebab-title.md`, **committed**. It is a
project artifact with the same lifetime as the code it planned, reviewed alongside it.

A **report** (`.systemview/report.*.md`) is the opposite by design: a disposable view, pushed to the
TV, deleted when read. Never put a plan in a report — a plan that matters is an RFC or it is lost.

Cross-repo work gets **one** RFC in the repo where the design decision lives, and the other repo's
slice names it. Two RFCs for one design is two documents drifting.

## The lifecycle, end to end

| | what happens | what exists afterwards |
|---|---|---|
| 1 | **Discussion** — threads on a document, convergence turn by turn | agreement, nowhere durable yet |
| 2 | **The file** — written into `RFCs/`, with implementation detail | a draft: no verdict |
| 3 | **The verdict** — a press on its approval block | `verdict=approved`, and it is now binding work |
| 4 | **The claims list** — extracted from the approved design, with its own press | the contract the build will be checked against |
| 5 | **The build** — slice by slice, each landing on its own | commits |
| 6 | **The check** — walk the claims against what was built | claims marked met, or named as not |
| 7 | **The status** — what is built, what is not, dated | an RFC that answers for itself |

Steps 3 and 4 are **two separate presses on two separate days' worth of thinking**, and collapsing
them is the commonest way this goes wrong: a claims list written before the design is settled is a
list of proposals, and proposals cannot be checked.

## The verdict block

An RFC ends with an approval block carrying what approving commits to, and the press writes the
verdict into the attribute:

```markdown
:::approval{ask="Approve RFC-072 — arcs as trackable documents?" verdict=approved}
Approving commits to: the arc document as the single state (§3), numbered objectives as a parsed
format with one parser (§4), attachments replacing per-kind run fields (§5).

The piece most worth rejecting is §3. If progress should live in a run record instead, everything
below it changes shape.
:::
```

Two things earn their place in that body. **What approving commits to**, listed — this is also the
outline the claims list is extracted from, so a vague one costs twice. And **the piece most worth
rejecting**, which is how an approval stops being a rubber stamp: name the load-bearing choice and
what collapses if it is wrong.

**No verdict means draft.** It is not weak approval and it does not authorize anything.

## A rejected RFC is closed

`verdict=rejected` means **closed** — do not mine it, do not cite it, do not gate work on it. A
rejection is a decision, not a pause, and a rejected document that keeps getting quoted is a
decision being relitigated by whoever read it last.

## What a claim is

**A claim is one statement of something an approved design committed to, written so a person can go
check it against what was built.**

Six properties, each doing work:

- **It comes from a decision, not a discussion.** Nothing is a claim before the verdict — until
  then it is a proposal, and a proposal cannot be checked against anything.
- **One decision each.** If checking it means doing two separate things, it is two claims.
- **Written as something you do, with an outcome.** Not a property the system has — an action and
  what should happen.
- **Self-contained.** Checkable without reading the section it came from. This is the entire point:
  by the time anybody walks the list, the argument has gone cold and the document is long.
- **The set is the contract.** Completeness is what the press under the list decides. A claim
  missing from an approved list is a gap that was accepted, not one that silently ate a feature.
- **Checked by a person. It carries no proof.** A claim names no test and resolves to no assertion.

The word is deliberately the ordinary English one. A test assertion is a claim about the code; this
is a claim about the design. Same shape of statement, different checker — and when a claim later
gets discharged by a test, that test **is** the claim moved into code.

## Writing a claim

**Write the action, not the property.** The failure mode is a claim that reads true and cannot be
checked:

| no | yes |
|---|---|
| Attachments are general | Attach a report to a lane's run and to a card — both take it |
| The arc document is the single state | Edit an objective's state in the file; the band row changes with no other write |
| Progress is derived, not stored | Delete every run record for an arc; `::progress` still counts correctly |
| The parser is shared | Grep for a second objective parser; there is one |

The shape that works: **do this → this should happen.** If you cannot write the "do this" half, the
decision is not concrete enough to have been an RFC, and that is a finding about step 2.

**Granularity comes from the verdict block.** Each thing approving committed to becomes one or more
claims — rarely one, because a design commitment is usually three checkable behaviours. Four
commitments producing twelve claims is normal and healthy.

## The claims list, and the press under it

The list is appended **after** the verdict block, under `## Claims`, numbered, with its own
approval block beneath it. The press decides one thing and it is not quality: **is this list
complete?** Once pressed, the list is the contract, and anything a reader later finds missing is a
gap both parties accepted rather than one that disappeared.

```markdown
## Claims

1. Attach a report to a lane's run and to a card — both take it.
2. Detach it; the attachment stays on the record with a `detached` stamp rather than vanishing.
3. …

:::approval{ask="Is this the complete list of claims for RFC-072?"}
Pressing this makes the list the contract. A behaviour missing from it is one we agreed not to
check — so the thing to read for is what is NOT here.
:::
```

**Why the press is worth its own moment:** the cost this whole mechanism exists to remove is
re-reading six hundred lines of argument to invent the test list yourself, at the worst moment, and
missing some. Approving the list is the only point at which completeness is cheap to judge, because
it is the only point at which the design is both settled and still in someone's head.

## Checking the claims once the work has landed

Walk the list in order. Each claim gets one of three answers, written into the list:

- **met** — it was checked and it does that.
- **not met** — it was checked and it does not. This is the valuable outcome and it is why the list
  exists; record what actually happened beside it.
- **not checked** — nobody has looked. Honest, and never the same as met.

An unchecked claim left blank reads as met to the next person, which is the one failure that makes
the list worse than no list at all. **Silence is not a pass.**

## A claim is not an objective, a slice, or a test

Four nouns that each do different work, and conflating them is how a design ends up tracked twice:

| | what it is | who closes it | the evidence |
|---|---|---|---|
| **slice** | a landing unit — what ships together | whoever built it | a commit |
| **objective** | work somebody owns, in an arc | the owner, by pressing | their say-so |
| **claim** | an assertion the finished thing must satisfy | a person checking | what they found |
| **test** | one way a claim gets discharged | the suite | a passing run |

The claim outlives all three. Slices are gone once they land, the objective closes, the test moves
into the code — the claim is the only one still readable as *what we agreed this would do.*

## The STATUS section

Once the claims have been walked, the RFC says what is true, dated, under `## STATUS`:

```markdown
## STATUS — built 2026-10-21, claims 11/12 met
```

One heading, one spelling, at the end of the file. Where a claim was not met, say which and what
happens instead — an RFC that quietly reads "built" while a claim failed is the same lie the
missing status sections were telling, with more confidence.
