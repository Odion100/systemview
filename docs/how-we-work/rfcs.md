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

**AND IT HAS TO SURVIVE BEING SPOKEN.** No attribute syntax in a statement, no block names — those
belong in the note, where they are being described rather than said. Read it out loud before you
keep it. One written as *"the same `state=` `by=` `at=` land on its opening line"* came back as
**"the same state equals by Atlanta"**, and the reader who hit it could not recover the sentence at
all: *"mark a container clean. Hmm. I don't know."* A claim nobody can read aloud cannot be walked,
cannot be voiced, and cannot be quoted in a mark's announcement — which is three surfaces, not a
style preference.

**And a claim that reads as common sense has not said what it protects against.** *"`::claims`
counts marks, not proofs"* invites the obvious answer — of course it does, why would it not — and
the thing worth writing down was the risk it rules out: a proof exiting zero must never advance the
document toward *built*, because only a person's press may do that. Same fact, and now a reader can
tell why anyone claimed it. If the statement sounds unarguable, you have written the arithmetic and
not the guarantee.

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

## The proof doctrine — two obligations, never a menu

**A claim carries two different obligations, and they are not interchangeable.** Proof kinds are
not a menu to pick the best item from — they serve different purposes, and **a fold owes both.**
They answer different questions and neither one answers the other's:

| | answers | for whom | when |
|---|---|---|---|
| **the confirming half** | *is this true — can I see it?* | the human deciding whether to believe the mark | now, at the moment of reading |
| **the living spec** | *will it still be true with nobody watching?* | the change loop | every month after |

- **The living spec** — a SystemLynx test. It captures the CONTRACT (each step a verb with real
  inputs, its outputs typed and validated) and the IMPLEMENTATION WALK (the steps a user actually
  takes: sign up, then add this, then the thing under test — buAPI's `Basketball/specs/tests/` is
  the model, 53 of them, each threading saved values step to step). It re-runs forever and goes
  red on its own — and the machinery already exists: these are SystemView's own saved service
  tests (the `savedEvaluations` format that `TestSummary` renders and the document's `:::run`
  block speaks); SystemLynx keeps its own `specs/tests` the same way. Nothing new to build. This
  is what makes the document a spec rather than a story, and it is the durable half: red is
  information, because it only rots when the system itself changed.
- **The confirming half** — the `:::cmd` he can press, the `:file` link, the disposable fixture to
  try the gesture on, the fixture document to open. **This is OWED by default, not a courtesy**,
  and it used to be called "review facilitation" and demoted: *"honest work, never the spec."*
  That was wrong and it was corrected by the person it is for — *"by default you got to try to give
  me something I can easily see and confirm, right, running confirm or something. That's separate
  from the spec."* The half that gets used is not the lesser half. A claim that is fully `spec'd`
  and hands the reader nothing to do has met one obligation of two.

  **And it must be available WHERE THE CLAIM IS.** A confirming half that sends him to another
  document, or that describes a gesture this document cannot perform, is not one: a claim reading
  *"right-click a leaf claim and grow a proof"* in a document where every claim already has a proof
  gives the reader nothing to right-click. Put a disposable fixture in the fold, with a `:::cmd`
  that resets it, so the gesture can be done here and done twice.

Where the claim's altitude has no live door (a fold rendering, a badge's look), the confirming half
plus a pinned render case IS the honest proof — say so rather than faking a Lynx shape; ceremonial
spec-proofs are the unit-test trap wearing the right brand.

**That paragraph is about a proof's SHAPE, never a second exemption.** A fold rendering is still a
behavioural claim; it just gets a thinner defence. The temptation is to read "no live door" as
licence to skip the obligation, and there is exactly ONE exemption — the next section's — so a
claim whose altitude is awkward owes a pinned case, not silence.

## Every proof says what it asks — in English, above the chip

**A chip is not a proof; a chip plus its two lines is.** A method name carries all the meaning and
delivers none of it: `leavesInTheOtherRfcsStillParse` stacked under a claim reads as thoroughness
and tells a reader nothing. So above every `::test` and `:::run`, two lines in plain English:

- **what it asks** — the question, as a question. *"Parses the other two RFCs and checks their 61
  leaf claims kept their statement, number and leafness."*
- **what breaks if it stops holding** — why anyone wrote it. A proof with no stated consequence is
  a proof nobody can judge the loss of.

**And there is no third line listing what the proof does not cover.** That was tried and withdrawn
the same night by the person it was written for: *"I don't want to hear what it doesn't cover. That's
just an excuse. That's the short-circuit trap."* He is right — a sanctioned place to write down your
gaps is a sanctioned place to leave them, and an agent that may disclaim will disclaim instead of
finishing. Caveats are not evidence.

**The obligation that replaces it: THE SPEC COVERS THE WHOLE CLAIM, OR THE CLAIM IS WRONG.** When
the two disagree, the claim is what moves. A claim saying *"grep the shell and the hub"* defended by
a spec that scans only the document machinery is not a claim with a documented gap — it is a claim
that overstates, and the fix is to narrow the sentence until the spec answers all of it. Narrowing is
cheap, honest, and leaves a reader nothing to interpret; a disclaimer leaves them a claim they must
mentally subtract from.

A **negative** proof follows the same rule rather than an exception: it states what it hunted as part
of *what it asks*, because "zero hits" is not a finding until the reader knows the list. That is the
question it asked, not a limitation of it.

**A claim with several sentences gets its chips said apart.** Three stacked chips under a
three-sentence claim hide which evidence holds which sentence — and hide the sentence held by
nothing. Name the pairing, and where a clause is defended by neither, say so ON the claim rather
than at the end of a note.

**Say which door a spec is.** A spec that loads the real module and calls it, a spec that runs the
project's own suite and asserts named cases, and a spec that mocks its dependency are three
different strengths wearing one shape. From outside, all three are a method name — so the reader
concludes "invented for the test", reasonably, from the only information given.

## The narrow case: when the document IS the fixture

**Only when a project's subject is the document surface itself** — SystemView claiming things about
how claims render, which is a reflexive situation almost nothing else is in. A claim about an API
endpoint, a pipeline, a build is never in it, and a claim about a render in another document is not
in it either.

In that one case the confirming half is a sentence pointing at the page: *"this claim has a proof; it
is drawing as one line; the ▸ is right there — open it and you have done the check."* The document is
the fixture, and it is a better fixture than a harness because every reader reproduces it by opening
the file.

**And the instruction that did not have this answer made an agent invent evidence.** RFC-075's c1
claims a claim with a proof still draws as one line. The reader was looking at one. The rule said
every behavioural claim owes a living spec, there was no third answer, so a jsdom harness got built
with its own fake document to model the thing already on screen — *"you're saying that this expands,
and that alone probably would mean it needs no spec."* A rule with no honest answer for a case
produces a dishonest one.

**The guard, because this is the most abusable paragraph here.** It is available ONLY for what the
reader can confirm by looking at this document. The moment a claim reaches past the page — another
file, a service, a count, a behaviour over time — it is back under the two obligations, and *"just
look at it"* is the short circuit wearing this paragraph as cover. The test: could a reader with no
tools and no shell finish the check from the page alone? If not, this does not apply.

**For the window half, prefer `:::run` over `::test`.** A run lives only in its fold and only runs
where the document is, which is the exact shape of a claim that is only true in a window. Reaching
for `::test` because addressable sounds more durable is backwards here: there is nothing to address
from outside the room the claim is about.

## A claim declares which obligation it is under

`kind=experiential` on the
claim line says the human's own eye concludes it — no spec can be written, and none is owed.
Anything else, including silence, reads **behavioural** and owes a living spec: silence never buys
a pass, exactly as an unmarked claim never reads met. Declare it while writing the list, because an
agent facing a spec it would rather not write will discover the claim was experiential all along —
at authoring nobody yet knows which proof is inconvenient, so the classification costs nothing to
make truthfully, and the completeness press freezes it. A `kind=` added afterwards is a visible
edit to an approved contract.

**What a surface may say about it.** `claims.js` derives *carries a spec* from the fold holding a
`::test` or `:::run` — never from a `:::cmd`, because a cmd running the suite and a cmd running
`grep` are indistinguishable at parse level and a heuristic behind a lifecycle gate is worse than
an honest absence. So the bar reads *"6/12 spec'd"* and never *"proved"*: **presence is
enforceable, substance is a reviewer's call.** A claim that asserts behaviour, reads met, and has
nothing addressable behind it is a commitment defended by nobody — which is what `settled` has to
mean something against.

## Who writes the living spec

**The executor writes the spec.** Whoever takes on the work writes its living spec — they know the
doors, and leaving the contract behind is part of taking the work on. The spec is NOT the whole
proof: the reviewer confirms through whatever the fold serves them — screenshot, link, cmd — and
may run the spec or never touch it; their signature does not depend on it. (Proof-writing is
headed toward being its own skill, because a contributor can come in OUTSIDE rfc-execution to do
exactly this.)

## `::test` or `:::run` — a test is addressable, a run lives only in its fold

Two blocks, and their natural definitions already point at the durable one:

- **`::test` — the library spec.** The contract lives as a FILE in the project's `specs/tests/`,
  where the whole suite runs it and it keeps answering long after the RFC settles; the claim's
  fold carries `::test` pointing at it, pass/fail shown where the commitment was made. A flow
  another claim, a service, or next month will lean on is always this. The block EMBEDS the saved
  test and never copies it, so editing the test updates every document pointing at it — one
  definition, by construction.
- **`:::run` — the in-fold walk, the narrow case.** A sequence of live calls that only means
  anything as THIS claim's verification; it lives in the fold, and the document's durability
  carries it. If you find yourself writing a run another claim could use, it was a test wanting a
  file.

**The distinction that decides it: a test is ADDRESSABLE; a run exists only where it is written.**
A saved test can be asked for from anywhere, any time — say "run buAPI's tests" in a chat and
`runTests({projectCode, namespace})` answers; another document can point at it; an agent who never
opens the RFC still gets its verdict. A `:::run` can only ever be pressed in the fold it sits in.

**And addressable means it is actually ASKED — a test rides the change loop.** Every code change
runs the tests; that is the standing rule, not a habit. So a claim proved by a test is defended
continuously: break its contract next month and the suite goes red in front of whoever broke it.
A claim proved only by a run is defended by nobody until somebody opens that document and presses
— so it can read `met`, green mark and note intact, while the thing it claims has been false for
weeks. **The real cost of choosing a run for a durable contract is not that asking is less
convenient; it is that nobody will ask.** One definition, or it drifts: never a library spec
copy-pasted into a fold, never a real contract buried where the suite cannot reach it.

## Getting a live door — the routes, by where you stand

**How to WRITE a saved test is already documented — do not re-derive it:** `context("how do I
write a saved test")` for its sections, steps, and the rule that the top-level namespace IS the
file it saves to; `context("the ::test block")` for the label grammar that points at one.

- **A SystemLynx project** — direct. Every module's methods are already callable; the spec is a
  sequence of the real calls, threading saved values step to step (buAPI's `specs/tests/`).
- **JavaScript, not yet SystemLynx** — still direct, and this is the step people over-think.
  **SystemLynx hosts OBJECTS and calls their methods** — `Service.module("Name", theObject)` and
  every method on it is callable remotely, synchronous or async. You are not writing a harness or
  an adapter; you are handing over the object you already have, and the live system becomes the
  fixture. (Write real glue only where the thing is not an object you can hold — the CLI needed a
  child process because its own state had to stay isolated: `test/service/CLI/index.js`, "change
  CLI code, re-run the test.")
- **Another language** — no route yet, and SAY so rather than faking one. The vision is SystemLynx
  counterparts per language, connecting to SystemView and capturing the callable methods; until
  then that claim's altitude has no live door, and the honest proof is the reviewer half.

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

## A screenshot is a moment; a command is a re-check

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
