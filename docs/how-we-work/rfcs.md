# RFCs — a design you can check later

An RFC is the record of a decision about how something will be built. It is written before the
code, argued until it is settled, approved with a press, and then — this is the part that was
missing — **reduced to a list of claims somebody can walk afterwards to find out whether the thing
actually does what was agreed.**

**The vision, in one word: these documents are LIVING specs** (his, settled 2026-10-26). An RFC is
not a record that rots the day it is built — its claims keep answering: marks say who checked what,
proofs re-run and go red on their own when the system moves, the lifecycle trail says where it
stands, and a thread on it is a conversation the members actually receive. An arc lives the same
way: its objectives move IN the document as the work moves. A document that can only describe is a
story; these can still be ASKED.

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

A **report** (`.systemview/report.*.md`) is the opposite by design: a disposable view that carries
its own window and expires. Never put a plan in a report — a plan that matters is an RFC or it is lost.

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

**Built is landed AND still moving** — reviewed, amended, proofs pressed: a LIVING spec (RFC-075
§1.5), kept true against a system that keeps changing under it. **Then it SETTLES** (his, round
two): the modification stops because nothing is left to modify, declared with `settled=<date>` on
the registration leaf — never derived from quiet, because a document nobody touched out of neglect
would read as settled. The rfc trail is draft → approved → built → settled → retired, where
**retired** means leaving active service, not being wrong. A failing proof on a met claim is the
moment a spec stops describing the system — on a SETTLED spec it is the sharpest alarm the design
produces — and the answer is one of three: update the spec (it lives again), supersede it
(`superseded=RFC-nnn` on its leaf, so the pointer survives), or retire it (`retired=<date>`).
Without proofs that moment is invisible; with them it costs a press.

**All claims met is a moment, never a silent jump.** The `::claims` bar says "all met — awaiting
STATUS" and offers one press that writes the dated `## STATUS` heading; the registry re-derives and
the trail advances to built through a dated line, never behind anyone's back.

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


## Claims — what is peculiar to an RFC

**The definition, the craft and the whole proof doctrine are their own chapter** —
`context("what is a claim and what does its proof owe")`. A claim is not an RFC's furniture; reports
and gaps carry them too, and one copy of that doctrine is the point.

Two things are an RFC's alone:

- **Nothing is a claim before the verdict.** Until then it is a proposal, and a proposal cannot be
  checked against anything. So claims are extracted AFTER the design is approved, from the
  commitments the verdict block named — each one becoming one or more claims, at the granularity
  where somebody can go and check it. Four commitments producing twelve claims is normal.
- **The SET is the contract**, and that is what the press under the list decides. A claim missing
  from an approved list is a gap both parties accepted, not one that silently ate a feature.

## The claims list, and the press under it

The list is appended **after** the verdict block, under `## Claims`, **one `::claim` block per
claim** with `::claims` on top, and its own approval block beneath it. A numbered line can be read
and never marked; a block can be pressed, and the press writes who checked it, when, and what they
saw into the line. The press under the list decides one thing and it is not quality: **is this list
complete?** Once pressed, the list is the contract, and anything a reader later finds missing is a
gap both parties accepted rather than one that disappeared.

```markdown
## Claims

::claims

**In the window** (where you stand to check these)

::claim[Attach a report to a lane's run and to a card → both take it.]{id=c1}
::claim[Detach it → the attachment stays on the record with a `detached` stamp rather than vanishing.]{id=c2}

:::approval{ask="Is this the complete list of claims for RFC-072?"}
Pressing this makes the list the contract. A behaviour missing from it is one we agreed not to
check — so the thing to read for is what is NOT here.
:::
```

The number a reader sees is the block's place in the document — never write one into the
statement; `id=` is the stable address. Group the blocks by **where somebody stands** to check them
(the window, a document, the chat, the host with no window, the files), because the reader walking
the claims after a slice lands walks one place at a time.

**Why the press is worth its own moment:** the cost this whole mechanism exists to remove is
re-reading six hundred lines of argument to invent the test list yourself, at the worst moment, and
missing some. Approving the list is the only point at which completeness is cheap to judge, because
it is the only point at which the design is both settled and still in someone's head.


## The STATUS section

Once the claims have been walked, the RFC says what is true, dated, under `## STATUS` — and the
count under it is **derived**, drawn by `::claims` off the marks above, never typed:

```markdown
## STATUS — built 2026-10-21

::claims
```

One heading, one spelling, at the end of the file. Where a claim was not met, say which and what
happens instead — an RFC that quietly reads "built" while a claim failed is the same lie the
missing status sections were telling, with more confidence.
