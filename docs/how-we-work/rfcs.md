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
| 4 | **The claims** — drawn from the approved design, beside the parts they check, with their own completeness press | the contract the build will be checked against |
| 5 | **The build** — slice by slice, each landing on its own | commits |
| 6 | **The check** — walk the claims against what was built | claims marked met, or named as not |
| 7 | **The status** — what is built, what is not, dated | an RFC that answers for itself |

Steps 3 and 4 are **two separate presses on two separate days' worth of thinking**, and collapsing
them is the commonest way this goes wrong: claims written before the design is settled are
proposals, and proposals cannot be checked.

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
Approving commits to the design above — enough to reduce it to claims and build from it.

The piece most worth rejecting is §3. If progress should live in a run record instead, everything
below it changes shape.
:::
```

Two things earn their place in that body. **What approving commits to** — the DESIGN as argued, not
a restated list the reader is asked to ratify line by line; the press is holistic, and it is a
first-level commitment that gets the draft past draft, not a seal (the design goes on living). And
**the piece most worth rejecting**, which is how an approval stops being a rubber stamp: name the
load-bearing choice and what collapses if it is wrong.

**No verdict means draft.** It is not weak approval and it does not authorize anything.

## A rejected RFC is closed

`verdict=rejected` means **closed** — do not mine it, do not cite it, do not gate work on it. A
rejection is a decision, not a pause, and a rejected document that keeps getting quoted is a
decision being relitigated by whoever read it last.


## Claims — what is peculiar to an RFC

**The definition, the craft and the whole proof doctrine are their own chapter** —
`context("what is a claim and what does its proof owe")`. A claim is not an RFC's furniture; reports
and gaps carry them too, and one copy of that doctrine is the point. **How you lay them out in an
RFC — where the bar sits, how you extract them, the markdown — is the author's procedure, not this
chapter's:** `rfc-authoring`. This page is only what is TRUE of an RFC's claims, not how to write
them, because a second copy of the procedure is a second thing to keep in sync, and it does not stay
in sync.

Three things are an RFC's alone:

- **Nothing is a claim before the verdict.** Until then it is a proposal, and a proposal cannot be
  checked against anything. Claims are drawn AFTER the design is approved — from the design itself,
  because the design is what was approved.
- **The claims are living specs, not a contract carved at approval.** When the design moves — and
  it goes on moving — the claims move with it, by the same which-side-moves rule that governs
  documentation, test and functionality everywhere: decided change → the claim adapts; drift → the
  claim is authoritative. A claim is the best current checkable statement of the design, re-walked,
  never a line sealed once.
- **Completeness is pressed, and the set is the contract — as agreed now, not as a lock.** One
  press decides one thing, and it is not quality: is this the complete set? A behaviour missing is
  one both parties agreed not to check, not one that silently ate a feature — and a later design
  change edits the set in the open rather than being forbidden by it. The press is worth its own
  moment because completeness is cheap to judge at exactly one point: when the design is both
  settled and still in someone's head. Everywhere else it costs a re-read of the whole argument.

## STATUS — what the heading has to be honest about

When the claims have been walked the RFC says what is true, dated, under a `## STATUS` heading, and
the count beside it is **derived off the marks, never typed** — the how is `rfc-authoring`'s. The
doctrine is the honesty: where a claim was not met, STATUS says which and what happens instead. An
RFC that quietly reads "built" over a failed claim is the same lie the missing status sections
told, with more confidence.
