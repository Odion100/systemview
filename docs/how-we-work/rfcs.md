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
- **Checked by a person.** A claim names no test and resolves to no assertion — but it may carry a
  **proof**: the check made pressable, folded inside the claim (RFC-075, its own section below).

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

## Checking the claims once the work has landed

Walk the list in order and **mark each block**. A press in the window, or for an agent the four
attributes written onto the line:

- **met** — `state=met by=<you|projectCode> at=<ms> note="what was done, and what was seen"`.
- **not met** — `state=unmet … note="what happens instead"`. This is the valuable outcome and it is
  why the list exists.
- **unchecked** — no attributes. Nobody has looked. Honest, and never the same as met.

**An agent's mark carries a statement, or it is not a mark.** An agent's word is only as good as
what it rests on, so `by=<projectCode>` without `note=` counts as unchecked. The human's press is
its own evidence — he looked — and his note is optional. An agent marks the claims it can check
itself — the greps, the host with no window — before the human gets there; the human marks the ones
that need eyes. Both read off the same document, so opening it shows which claims were verified, by
whom, and on what. An unmarked claim reads **unchecked**, visibly — **silence is not a pass.**

## A claim can carry its proof

**A proof is a claim's check made pressable** (RFC-075). A mark's `note=` is a sentence about work
that evaporated the moment it was done — to believe it next month somebody re-derives the check. The
proof is that check written down where the mark will be doubted: the claim grows a container —

```markdown
:::claim[Save a registered document → its row's state is re-derived]{id=c36 state=met by=you at=…}
:::cmd
node -e "…read the registry row…"
:::
:::
```

— rendered as the same one-line claim with a `proof ▸` fold. The children are **ordinary result
blocks** run in place (`:::cmd` holds its exit and log, `:::run` its steps, `::test` its verdict);
the claim adds no execution machinery, only an address. Right-click a leaf claim → *add a proof*
rewrites it as the container with an empty body — nobody retypes a statement.

**The sequence is verify → mark → proof, and the proof is written for the human.** Proof-first is
the unit-test trap reborn: the agent runs the thing it just authored and calls the exit code a
check. Verification stays primary and may be ugly — three greps and a file read; the proof is the
distilled one-press version of a check that already happened. And it audits the mark for free: an
agent that marks `met` and cannot say what you would press to see it made a softer check than its
`note=` claimed.

**The mark is mandatory; the proof is earned.** Write proofs where re-checking will matter —
load-bearing mechanisms, claims that can rot, anything somebody will want to press in three months.
Requiring proofs on every claim grows ceremonial proofs, which is the code-validating-code smell
this design exists to kill. A proof **passing is evidence, never a mark** — somebody still says met,
silence is still never a pass, and no runner or scheduler re-runs proofs: they run when pressed.

## Writing a proof — the approach

**Think outside the harness:**

- **The live system is the fixture.** Reach for a door before a harness: pass the object into a
  SystemLynx context and the method you could not test becomes a call. buAPI verifies itself this
  way systematically.
- **A claim that RESISTS a proof is a finding about the system.** It is pointing at a missing
  observable, and building that door through SystemLynx IS proof-writing — proof-pressure is how
  the system grows doors.
- **Readable-first.** The proof convinces the person outside the code, or it is a unit test wearing
  a fold. These documents are specs; the reader is not inside the code.

**What a proof can be** — every shape already renders and runs; the claim is only the place they
stand: a SystemLynx call (`:::run`), a command or a grep written down instead of retyped (`:::cmd`),
**a pointer at the lines** (an inline `:file[path#Lx-y]` link — a chip, never a wall of code in the
fold; `project=` reaches another repo), **a screenshot** (`::file` at an image), a wrapped test with
its pass/fail shown (`::test`), human instructions in the fold where the "run" is a press and eyes —
and most often a **composite** of several: *here's the thing* (link, screenshot) → *here's it doing
it* (cmd) → *here's the record it left* (a read).

**Lead with what the reader can see; a suite run is a supplement, never the proof** (his, round
one: *"this test doesn't do nothing for me"*). A test command convinces the person who can read the
test file — the exact unit-test trap this design exists to kill — so it rides LAST in the fold, for
the code-side reader, under an artifact the human can judge. When a cmd runs a test, anchor it with
a `:file` link at the lines it tests, and let the cmd follow. The anchor is a LINK, not an embed
(his reversal, round one, same day it was proposed): embedding the mechanism puts a wall of code in
the fold — the unit-test trap wearing a viewer. The chip points; the reader presses if they care.

**A screenshot is a MOMENT; a command is a RE-CHECK.** The screenshot says "this is what it looked
like when it was marked" and rots silently; the cmd answers *now*. The best folds carry one of
each. And a proof screenshot never points at `~/.autobot/shots/` — that folder prunes itself, so
the pointer dies in days. Copy it into the repo beside the RFC (`RFCs/proofs/`).

## A failing proof, and a delegated one

**A failing proof on a met claim is a finding, not an unmark.** It says the world moved under a mark
that was true when made — exactly the staleness the `::claims` recount cannot see, surfaced for the
cost of a press. For a **living** spec (see the lifecycle) that moment demands one of three answers:
update the spec, supersede it (`superseded=RFC-nnn` on the leaf), or retire it.

**A claim can declare its reviewers** — `reviewers=buapi` on the claim line. Each declared name
renders as a hollow badge until its signature lands in `by=`, the human's badge is always offered
implicitly, and `reviewers=` joins the claim's fire audience, so being named is being told. Use it
where writer ≠ verifier matters: the agent that built marks with its note; a *different* agent's
unfilled badge stands there until they have independently signed. **The reviewer is a PEER agent,
never a subagent of the builder** — a subagent is the builder's own context wearing a different
hat, so its signature is the same word twice; a peer has its own session and project code, and its
badge filling means a second mind looked. The authoring and execution skills both instruct naming
one on the load-bearing claims.

**Proof-writing may be delegated; verification may not.** A subagent is permitted, never required —
briefed with the claim, its mark, its `note=`, THIS section, and the project's door inventory; never
tools alone, or it writes harness-shaped proofs instead of doors. Writer ≠ verifier strengthens the
audit: a subagent that cannot produce a clean one-press proof has exposed a soft mark.

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

Once the claims have been walked, the RFC says what is true, dated, under `## STATUS` — and the
count under it is **derived**, drawn by `::claims` off the marks above, never typed:

```markdown
## STATUS — built 2026-10-21

::claims
```

One heading, one spelling, at the end of the file. Where a claim was not met, say which and what
happens instead — an RFC that quietly reads "built" while a claim failed is the same lie the
missing status sections were telling, with more confidence.
