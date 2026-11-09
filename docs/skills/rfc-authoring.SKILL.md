---
name: rfc-authoring
description: Write, draft, number or revise an RFC — use this ALWAYS when one is being written, including for a short ask like "write up an rfc for this", "this design is settled, write it down as an rfc", or "write it up as a design doc". An RFC here is not a free-form design document: it has a required shape — implementation detail, slices in landing order, a verdict block naming what approving commits to, and claims written beside the design they check, pressed for completeness — and one written without this comes out missing the parts that make it checkable later. Also use it when someone asks for the implementation detail to be worked out before anybody builds, when an approved RFC still has no claims, and when work has landed and somebody needs to confirm it does what the RFC said it would. Do NOT use it to break work into owned objectives and dispatch them to agents — that is arc-planning. An arc is who builds what; an RFC is how it gets built.
---

# Writing an RFC

An RFC is the record of a decision about how something will be built: written before the code,
argued until settled, approved with a press, and then reduced to **claims** — statements somebody
can walk afterwards to find out whether the thing does what was agreed.

That last part is the reason this skill exists. From experience: RFCs piled up with verdicts on
few and almost none saying anywhere whether they were built — the ones that did spelled it three
different ways, some carrying both a `STATUS — built` and a `STATUS (original) — not built`. Every
one invented by whoever happened to remember. Approved designs that cannot tell a reader whether
they exist.

**The definition of a claim is not in this file.** It lives in the `how-we-work` corpus and is
retrieved — `context("what is a claim in an RFC and how do I write one")` — because every agent
reading *any* RFC needs it and only the author of one needs this procedure. One definition, or it
drifts into two.

## Executing this skill

**The worklist is how this skill starts, advances and finishes.** Not a log written afterwards: the
system reads the list to know whether the procedure was followed, and this skill is complete when
every item on it is done — nothing else marks it complete.

1. **Before step 1**, put your plan for this run on the worklist with `source: "skill:rfc-authoring"` —
   the real steps you are about to take, named for the work in front of you, covering the steps
   below without transcribing them. A copied-out procedure records nothing; a list of what you are
   actually doing shows how you read it, which is where a misread becomes visible before the output
   is wrong. `job:`, `skill:`, `lane:` and `assignment:` are the prefixes YOU write. There is
   a fifth the system reads — `correction:`, written by the assign verb when work is handed to
   ANOTHER agent, never chosen for a list of your own. Any other prefix is written to disk, draws
   no row, and is never nudged, so it runs unheld and invisible.
2. **Mark one active** as you reach it and **done** as you finish it. `set` REPLACES the whole
   list, so send every item every time — one omitted item is one deleted item. A list written once
   and never moved is indistinguishable from a procedure abandoned at step 1.
3. **The list is yours — every item is work you do.** Human confirmation is not on it: a step only
   somebody else can check off never reaches done, so the procedure could never complete.
4. **Attach what the run produced BEFORE the write that finishes it** — `attach({kind, ref})`, by
   address, never a path. The write that marks the last item done CLOSES the run, and `attach` is
   refused on a closed one, so the order is not style: attach late and the run is a finished
   procedure pointing at nothing.
5. **A run ends exactly two ways.** Every item done — or `attach` the account and then
   `status("abandoned — <why>")`. There is no third. A status of "blocked" does not stop the
   nudging, and neither does stopping quietly: an open run is nudged until it closes or is
   declared. If the work is genuinely waiting on him, that IS the abandoned path — say what it
   waits on and from whom, and reopen it later by writing the list again under the same source.
6. **If you stop early, leave the list where it stopped.** Do not tidy it, and never mark an item
   done to quiet a nudge. Where a procedure dies is the single most useful thing it can tell
   anyone — declare it (5) rather than dressing it.

## 1 · Check it is an RFC, and that it is not already written

Two checks before a word of design — and the registry aims both, because a document is an RFC by
its leaf, never by its folder (RFC-073). Listing a directory answers only for the RFCs that happen
to live there; the first one registered from somewhere else mints a duplicate number or a duplicate
design.

```js
registry({ kind: "rfc" })                                          // every RFC the system knows — max id + 1 is the next free number
context("<the subject, as a question>", { corpus: "<project>-doc-registry:rfcs" })  // a design may already exist — by MEANING, because a duplicate is never worded like the new ask
```

The corpus is the registry embedded, so it searches exactly the documents the system counts;
grep stays the tool for an exact symbol, never for "has this been designed".

An existing RFC on the subject is **amended or superseded, never duplicated** — two documents for
one design is two sources drifting. And `verdict=rejected` means **closed**: do not mine it, do not
cite it, do not reopen it as a draft.

Then the test that decides whether this is an RFC at all: **implementation detail.** Files, shapes,
the algorithm, the order things land in. A document that argues a position without committing to
how it is built is a report wearing an RFC's number — *"might as well have stayed a report… no
choices of exactly this sort of implementation."* If the mechanism is still open, you are at step 2
and the file does not exist yet.

## 2 · Converge first — the file records a settled argument

The RFC is written **from** a discussion, not instead of one. Where other agents belong in it, that
discussion is a planning document — `::report{as=planning}`, members on it, threads in it — and
they write there; otherwise it is the chat.

Two things to come out of it, because the file needs both and neither can be invented later:

- **the mechanism**, concretely enough to name files;
- **what would make this wrong** — the choice everything else rests on. That sentence goes in the
  approval block, and it is what turns a press into a decision instead of a formality.

## 3 · Write the file

`RFCs/RFC-NNN-kebab-title.md`, next free number. Title says what becomes true, not what the document
is about.

**It opens with its registration leaf** — `::rfc{id=RFC-NNN arc=ARC-nnn-Ox}` on a line under the title
(`arc=` only when it serves one). **`arc=` names the OBJECTIVE, not the arc** (RFC-076 §4.4): the
address is `ARC-004-O2`, because "which objective does this plan serve" is the question an arc's own
state is folded from — an objective with no plan is incomplete, so a plan attached to the arc at
large claims no objective and counts for nothing. The arc-only form still registers and still
reads; it just plans nothing, visibly. The leaf is what MAKES it an RFC: saving the file registers it,
the band lists it off the registry, and its approval fires to the document's audience when the
verdict lands. The folder stopped meaning anything (RFC-073).

**`::claims` — the progress bar — goes directly under the leaf**, where the reader lands, so the
document's state (met / not met / unchecked) is the first thing seen rather than found by scrolling.
It recounts every `::claim` block wherever they sit, derived and stored nowhere.

Sections, each earning its place:

- **THE OBJECTIVE, FIRST — what is being SOUGHT, never how it is reached.** His ruling:
  *"when we're working on an arc, the RFC comes from an objective. When we just work on the RFC
  alone, we gotta come up with our own objectives… the objectives that are being sought should be
  placed at the top of the RFC. That way as we change the spec underneath, at least we know that
  we're still accomplishing the objective."*

  On an arc it comes FROM the arc's objective — `arc=ARC-004-O2` on the leaf already names which, so
  the section restates that objective rather than inventing a parallel one. Standing alone, you write
  it, and it is yours to get right.

  **AND WRITE THE PHILOSOPHY IN BESIDE IT, in the document, because that is what the section is FOR.**
  A reader who meets an aim and nothing else has been told what we want and not what they may do
  about it. The objective is the one thing that does not move; while it holds, the **prose, the spec
  and the functionality** are all free to change toward it — a decided change moves the claim, and
  DRIFT means the claim is authoritative and the code is what is wrong. Say that in the section, in
  the document's own words. It is the sentence an agent returns to when a slice turns out not to fit,
  and it is the difference between a spec that can be corrected and one nobody dares touch.

  **THE FAILURE THIS SECTION FAILS BY IS WRITING MEANS IN AS ENDS**, and it reads as diligence.
  Measured on RFC-078: its first objective was *"a judgment reaches the agent at the moment it is
  making the mistake"* — a mechanism the document had just invented, written in as an end and then
  used to argue the mechanism could not be removed. His correction: *"the judgment reaching the agent
  was not the objective… your objectives are too specific."* A design that writes its own means into
  its ends can never be rolled back, because every reversal reads as a betrayal of something.

  **The test, applied to every sentence before you keep it:** could this be built a completely
  different way and the sentence still be satisfied? If no, it is a mechanism — it belongs in the
  design, where it can be withdrawn.
- **The problem, as what it costs now.** Not "X is missing" — what goes wrong today, measured if you
  can measure it. This is the section that is still read a year later, and it is **this RFC's
  operational intent**: the thing an implementer falls back on when a slice turns out not to fit.
  `context("what is operational intent and where does it already live")`. Write it so it can
  arbitrate — two defensible ways to build §N, and the cost paragraph picks one.
- **The design**, with the mechanism: the files, the shapes, the algorithm, what is derived and what
  is stored.
- **Slices** — what lands on its own, in order, and *why that order*. A slice that teaches agents to
  call verbs which do not exist yet is worse than one that stops early and says so, so dependencies
  go in the ordering and the reason goes in the text.
- **What this does NOT add.** The cheapest section to write and the one that stops scope being
  re-argued every time somebody reads the document.
- **The approval block**, last:

```markdown
:::approval{ask="Approve RFC-NNN — <the thing in one line>?"}
Approving commits to the design above — enough to reduce it to claims and build from it.

The piece most worth rejecting is §N. If <the alternative>, everything below it changes shape.
:::
```

**The press is on the DESIGN, not on a list.** You are backing the thing as argued in the prose, to
get it past draft — a first-level commitment, not a seal, because the spec goes on living (the
design can still move once claims are in play; which side moves is the adapt-to-each-other rule).
So the block does not re-enumerate the design as commitments the reader is asked to ratify
line-by-line: that list is a third copy of the design, the one nobody reads, and it quietly recasts
a holistic press as item-by-item ratification. Claims come from the design itself (step 5).

**And the "most worth rejecting" line is not a courtesy** — it is the author's own assessment of
where the design is weakest, which is what makes the press a decision instead of a formality. An
approval block that names no weak point is asking for a signature, not a verdict.

- **The empty `## Claims` section with its completeness approval — written NOW, in this same file,
  before a single claim exists. The progress bar is up under the leaf; this section is the press:**

```markdown
## Claims

:::approval{ask="Is this the complete list of claims for RFC-NNN?"}
Pressing this fixes the set of claims as the contract — as agreed now, editable later in the open
when the design moves. A behaviour missing from it is one we agreed not to check, so read for what
is NOT here.
:::
```

**The claims are still step 5 and still come after the first verdict — the SECTION is what lands early,
and the reason is arithmetic.** A document reads `approved` when **every** approval block in it
carries a verdict. With one block in the file, his press on the design makes the whole RFC read
approved while the claims have not been written — the document announcing a contract that does not
exist yet, and a drawer counting it as settled business. With both blocks present, the same press
leaves it at draft until the claims list is pressed too, which is the truth: **an RFC is not
approved until its contract is.**

So the file is born with two approval blocks and a `## Claims` section that is only the completeness
press — no claims in it, and none ever go in it: when they are written (step 5) they land beside the
design they check, not under this heading. Nothing is a claim before the verdict, which is why there
are none to write yet rather than a list waiting to be filled.

## 4 · Offer the verdict, and stop

Offer the RFC for his press — a `::file` chip to the document, one line on what it decides, and the
one choice most worth rejecting. **Then stop.** No verdict means draft; a draft authorizes nothing,
and building from one is building from your own opinion with a document-shaped alibi.

## 5 · Extract the claims — only after the first verdict

Walk the DESIGN, section by section. Each piece of it becomes **one or more** claims, at the
granularity where somebody can go and check it — one design section producing several claims is
normal, because a commitment is usually three checkable behaviours. The design is the source because
the design is what he approved; a claim with no design behind it is one nobody agreed to.

**And the claims are living specs, not a contract carved at approval.** Write each to be the best
current checkable statement of the design — because the design keeps moving, and when it does the
claim moves with it (design changed by decision → the claim and its spec adapt; code drifted → the
claim is authoritative). Extraction is the first walk, not the last.

The shape is **a sentence in the claim grammar — When / Upon / If for triggers, While / Never for
standing invariants, the comma carrying the arrow** (the definition and examples are the claims
chapter's: `context("what is a claim in an RFC and how do I write one")`) — and it has to
**survive being read out loud** —
no attribute syntax, no block names in the sentence; one written as *"the same `state=` `by=` `at=`
land on its opening line"* came back as *"the same state equals by Atlanta"* and the reader could
not recover it. Say each one aloud before you keep it. The failure mode is a claim that reads true
and cannot be checked:

| no | yes |
|---|---|
| Attachments are general | When you attach a report to a lane's run and to a card, both take it |
| The document is the single state | When you edit the state in the file, the row changes with no other write |
| The parser is shared | While this holds, there is one parser — grep finds no second |
| `::claims` counts marks, not proofs | A passing proof never moves the met count — only a press does |

**That last row is the one authors get wrong by sounding right.** A claim that reads as common
sense has not said what it protects against; write the guarantee, not the arithmetic.

If you cannot write the "do this" half, the decision was never concrete — which is a finding about
step 3, not a reason to write a vaguer claim.

**Declare the EXPERIENTIAL ones here, while you write the list.** A claim concluded by the human's
own eye — *"the dashed badge reads as an invitation"*, *"it could be bolder"* — carries
`kind=experiential`, and that is the only exemption from owing a living spec — **it is not an
exemption from owing a PROOF.** Every claim embeds evidence in its own body or it never reads `met`;
`kind=` only picks which kind counts, and an experiential claim still owes something shown (a
screenshot, the branch, a cmd). Everything else, silence included, reads behavioural and owes a
spec — which may be an existing test, one you edited, or a new one. Declare it NOW and nowhere later: an agent facing
a spec it would rather not write will discover the claim was experiential all along, while at
authoring nobody yet knows which proof is inconvenient — so the classification costs nothing to
make truthfully. The completeness press (§6) freezes it, which makes a later exemption a visible
edit to an approved contract. `context("what does a claim's proof owe")` for the doctrine.

**And you are not the only vote on your own classification — get a SECOND OPINION.** You are the
party with an interest: calling a claim experiential exempts you from writing its spec, which is
precisely the judgment an author must not make alone. It is one blind subagent pass over the bare
statements, and it reconciles visibly in the document. The procedure is
`context("a second opinion")` — follow it rather than improvising, because the part that makes it
work is counter-intuitive: the brief must not contain your own verdicts.

**Name a REVIEWER on the load-bearing claims — another AGENT, never a subagent of yourself.**
`reviewers=<projectCode>` on the claim line: the named agent renders as an unfilled badge until it
independently signs, and it HEARS the claim's marks (reviewers join the fire audience). A subagent
is your own context wearing a different hat — its signature is yours twice; a peer has its own
session and its name on the badge means a second mind looked. Earned, like proofs: the claims whose
marks will be doubted, not all of them.

**Each claim is a `::claim` block, never a numbered line.** A numbered list can be read and never
marked; a block can be pressed, and the press writes who checked it, when, and what they saw into
the line. The number you see is the block's place in the document, so never write one into the
statement; `id=` is the address and stays stable when claims move.

**AND THE CLAIMS GO AROUND THE WORDS — under the design they are claims ABOUT, not in a list at
the end.** A claim sits beneath the paragraph it checks:

```markdown
### 4.2 · The resolver answers `elsewhere`

<the design, as written>

::claim[Resolve a path owned by another project → the answer names that project, not this one]{id=c7}
::claim[Resolve a path owned by nobody → it comes back as a machine address, openable]{id=c8}
```

Appended at the end they are an appendix: a reader finishes the design and starts the document
again from the top working out which claim belongs to which paragraph, and the author writes each
one having already left the section it is about. Beside the words, the design and its contract are
read once, together — and **a section with no claim under it is visibly a section nobody agreed to
check**, which is the thing a list at the end can never show.

**The `## Claims` section holds the completeness press** — the one progress bar is under the leaf,
so this section is the press and nothing else:

```markdown
## Claims

:::approval{ask="Is this the complete list of claims for RFC-NNN?"}
Pressing this fixes the set of claims as the contract — as agreed now, editable later in the open
when the design moves. A behaviour missing from it is one we agreed not to check, so read for what
is NOT here.
:::
```

**WHAT THIS COSTS, AND IT IS REAL: completeness stops being readable in one breath.** The press
above asks one question — *what is NOT here* — and that was cheap to answer while every claim sat
in one place. Spread through the document, nobody can scan the set. So the author owes the press
something it can be judged on: **walk the document section by section before offering it, and write
the accounting in the Claims section BESIDE the press — never inside the approval's body.** He
presses the document, not a stuffed block; the body stays its two sentences (his ruling,
2026-11-08, after a forty-claim accounting landed inside one: "I'm approving the document, not
what's in this shit — I'm not even reading that"). A section with nothing to check is
a legitimate answer — prose, a non-goal, a restatement — but it has to be a stated one, because
the alternative is a contract that is complete only where somebody happened to be paying attention.

**Grouping does not disappear, it moves into the statement.** The old list grouped by WHERE
SOMEBODY STANDS — the window, a document, the chat, the host, the files — because the reader
walking claims after a slice lands walks one place at a time. Beside the design that grouping is
gone, so each claim's "do this" must name its own ground plainly enough to be walked from: *"in the
window, press…"*, *"on the host with no window, run…"*.

**A claims list written before the verdict is a list of proposals**, and proposals cannot be checked
against anything. That is why the CLAIMS are step 5 — while the empty section and its approval block
were written in step 3, so the arithmetic of `approved` was right from the first press. Fill in the
blocks where they belong and use the section that is already there; never append a second one.

**A PRE-BLOCK RFC — numbered claims, written before `::claim` existed — IS MIGRATED, NOT LEFT.**
RFC-072 carries 73 of them, which means that document cannot say whether it was built: a numbered
line has nowhere to put a mark, so `::claims` counts nothing and the STATUS heading would be a
sentence somebody typed. Converting is mechanical — each line becomes a block with an `id` and
moves under the section it checks — and it does not need a new press: the completeness approval
already on the document covered that list, and migrating is a change of FORM, not of contract. If
a line turns out not to be checkable as written, that is a claim to narrow and say so, not a
reason to leave 73 unmarkable.

**THEN EVALUATE — under each claim group: "Do these claims add up to the intent?"** The claims are
split through the document, so the evaluation splits with them: beneath each physical group of
`::claim` blocks, one short passage opening with that question in bold, answered in words — a
JUSTIFICATION, written by reading the claims against what their section promised. Never a
conditional restatement of the design ("if these hold, X happens" evaluates nothing — it is the
design wearing a different mood). Name what the group covers, claim by claim, and name what it
does not: a remainder can be legitimate — conduct bounded in another document, a wording decision
handed to the press — but it must be stated. **A gap the evaluation finds becomes a claim NOW,
before the press.** Measured on this step's first run (RFC-078): one author's forty claims, a
blind second opinion, and a per-section coverage walk all missed that nothing claimed a
switched-off nudge is actually OBEYED — control of the record was claimed, the machinery's
obedience to it was not; this evaluation caught it in its first group. The cross-group remainder —
what no single group buys — goes in the completeness approval's body, where the whole set is
judged.

## 6 · Offer the claims press

One thing is being decided and it is not quality: **is the list complete?** Say so when you offer
it, because completeness is only cheap to judge at this one moment — while the design is settled and
still in his head. Later it costs a re-read of the whole document, which is the cost this entire
mechanism exists to remove.

## 7 · Then it is work — and the claims are what closes it

Building is not this skill's: slices land one at a time, cross-repo ones as paired lanes, and work
owned by several agents becomes an arc (`arc-planning`). What belongs here is the ending.

**A proof owes two halves, and two lines per chip** — `context("what does a proof owe besides the
test chip")`. Both halves, because the half the human presses is not a courtesy and it is the one
that gets used; and above every chip, what it asks and what breaks without it, in English.

**Never a line listing what the proof does not cover** — a sanctioned place to record your gaps is a
sanctioned place to leave them. Where a spec does not answer the whole claim, **narrow the claim**:
the sentence moves, not the reader's expectations.

**Walk the claims against what was built, and MARK each one on its block.** Three states, and the
press — or, for an agent, writing the attributes onto the line — carries them:

- **met** — `state=met by=<you|projectCode> at=<ms> note="what was done and what was seen"`.
- **not met** — `state=unmet …  note="what happens instead"`. This is the valuable outcome.
- **unchecked** — no attributes. Nobody looked. Honest, and never the same as met.

**Your mark carries a statement, or it is not a mark.** An agent's word is only as good as what it
rests on, so `by=<projectCode>` without `note=` counts as unchecked. The human's press is its own
evidence and his note is optional — the rule is yours, not his. Mark the claims you can check
yourself (the greps, the host with no window) before the human gets there; he marks the ones that
need eyes. Both read off the same document, and an unmarked claim reads as UNCHECKED, visibly —
**silence is not a pass**.

**Where your mark will be doubted later, leave the PROOF** — verify, mark, THEN fold the distilled
one-press check into the claim (`:::claim[…]{…}` with result blocks as its body). The sequence, the
shapes and the approach are the claims chapter's: `context("how do I leave a proof on a claim")`.
Execution itself — landing the slices, walking the claims as a sourced run — is `rfc-execution`.

Then one STATUS heading, one spelling, at the end of the file — a dated declaration; the count is
the one bar under the leaf:

```markdown
## STATUS — built 2026-10-21
```

That bar draws met / not met / unchecked off every block in the file. An RFC reading "built" over a
failed claim is now a bar with a red segment in it, not a sentence somebody typed.

## Done when

- The file exists at `RFCs/RFC-NNN-*.md` with implementation detail, slices, and an approval block
  naming both what approving commits to and the piece most worth rejecting
- **It was born with BOTH approval blocks** — the design's and the claims-completeness one over an
  empty `## Claims` section — so one press could never make the document read approved while the
  contract was still unwritten
- The problem section is written as cost and can **arbitrate** — it picks between two defensible
  ways to build the design's weakest slice
- `::claims` — the progress bar — sits under the leaf, and the claims themselves sit beside the
  design they check (not in a list): each a `::claim[…]{id=}` block, an action with an outcome, its
  ground named in its own statement. The `## Claims` section is the completeness approval alone
- Every claim group carries its evaluation beneath it — "Do these claims add up to the intent?"
  answered in words, gaps promoted to claims and remainders named
- Both presses have been **offered** — his to press, and the procedure does not wait on them
- Or, if you came in for the check pass: every claim block you could check carries its mark and its
  statement, the rest read unchecked, and a dated `## STATUS` heading with `::claims` under it says
  what is true
