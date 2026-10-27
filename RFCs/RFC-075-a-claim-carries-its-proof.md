# RFC-075 — A claim carries its proof

::rfc{id=RFC-075}

**Status: approved** · 2026-10-26 · extends RFC-073 (claims as blocks, the mark, the fire) · the
conversation this records is his: *"the whole thing is to make these documents specs"*

::members{who=systemview-test sent=systemview-test:5z7jxw}
## The problem, as what it costs now

**A claim can be marked; it cannot be re-checked without re-deriving the check.** RFC-073 carries 56
claims, 31 marked — and every mark's `note=` is a sentence about work that evaporated the moment it
was done. c40's note says *"upsert's whitelist drops state"*; to believe it next month, somebody
re-reads `registry.cjs` and re-invents the grep. The verification happened once, cost real time, and
left behind only prose. Checking is expensive, so re-checking never happens, so a claim marked met
in October is a claim *believed* in December.

**And his standing objection to the alternative:** unit tests are code validating code — *"you got
to understand the code, so you're in the same place."* A test file proves something to the person
who can read the test file. These documents are specs; the person reading them is not inside the
code, and the thing that convinces him cannot be a second codebase.

Meanwhile the system already owns the answer. buAPI verifies itself systematically through
SystemLynx — pass an object into a context and every method is callable, so the **live system is the
fixture** and a check is a call, not a harness. The chat and every document already render blocks
that RUN and keep their results in place: `:::cmd` holds its exit and log, `::run` holds its steps,
`::test` holds its verdict. The pieces exist; no claim can hold them.

## 1 · The design

**A proof is a claim's check made pressable.** The claim stays the sentence anyone reads; the proof
is what you press to see it true — folded inside the claim, run where it stands, its results kept in
the blocks that ran.

### 1.1 · The container form

`::claim` stays a leaf — all 56 existing claims untouched. A claim that has a proof is the **same
name grown a container**:

```markdown
:::claim[Save a registered document → its row's state is re-derived]{id=c36 state=met by=systemview-test at=… note="…"}
:::cmd
node -e "console.log(JSON.parse(require('fs').readFileSync(process.env.HOME+'/.autobot/documents.json')).find(r=>r.id==='RFC-073').state)"
:::
:::
```

- **Renders exactly like the leaf, folded**, with one affordance: `proof ▸`. Expanded, the children
  are the proof — one block or several. Fifty-six claims never become fifty-six walls.
- **The proof's blocks are the EXISTING result blocks** — nothing new runs anything. A `:::cmd`
  inside a claim is the same `:::cmd` as anywhere: pressed there, run there, exit and output kept
  there. The claim adds no execution machinery; it adds an address.
- **The mark does not move.** `state= by= at= note=` live on the claim's opening line, written by
  the same press and the same `setAttr` as today. The host's fire detection (`blocks.cjs` FIRING)
  reads the same attribute off the same line — a container claim fires exactly as a leaf claim does.
- **Retrofitting is a gesture**: the document right-click on a leaf claim offers *add a proof*,
  which rewrites the leaf as its container form with an empty body and the caret inside. Nobody
  retypes a statement to give it a proof.

### 1.2 · The sequence — verify, mark, then write the proof

**The proof is written AFTER the mark, and it is written FOR HIM.** His ordering, and it is
load-bearing twice:

- Proof-first inverts into the mechanism validating itself: the agent runs the thing it just
  authored and calls the exit code a check — the unit-test trap reborn. Verification stays primary
  and may be ugly (three greps and a file read); the proof is the distilled one-press version of a
  check that already happened.
- The proof audits the mark for free. An agent that marks `met` and cannot write the proof — cannot
  say what you would press to see it — made a softer check than its `note=` claimed.

**Two signatures, one pressable fact.** The agent verifies, marks (`by=<projectCode>`, `note=`), and
leaves the proof. He presses the proof, sees it, and marks with his own press (`by=you`). The mark
rules of RFC-073 §claims are unchanged: a proof passing is **evidence, never a mark** — somebody
still says met, silence is still never a pass.

**Proof-writing may be delegated; verification may not.** Verification stays the marking agent's own
hands — but the proof is distillation, and a subagent handed the claim, its mark and its note either
produces a clean one-press proof or cannot, and *cannot* exposes a soft mark the verifier would not
catch in their own work; writer ≠ verifier strengthens the audit. The brief is fixed (his: *"the
sub-agent still needs to be passed all the right context"*): the claim, the mark, the note, the
chapter's approach section, and the project's door inventory — SystemLynx context. A subagent
briefed with tools alone writes harness-shaped proofs; briefed with the chapter it writes doors.
Permission, not procedure — one line in the skill.

### 1.3 · Earned, not doctrine

The **mark is mandatory** on every claim — that rule does not move. The **proof is earned**: written
where re-checking will matter — load-bearing mechanisms, claims that can rot, anything he will want
to press again in three months. Requiring proofs on every claim grows ceremonial proofs, which is
the code-validating-code smell this design exists to kill. When the verification was already one
clean command, mark and proof are the same motion — the command just stays behind in the fold.

### 1.4 · What a proof can be

Every shape already renders and runs today; the claim is only the place they stand:

| shape | block | example (real, from RFC-073) |
|---|---|---|
| a SystemLynx call | `:::run` | c36 — `Agent.documentsRegistry({projectCode, kind:"rfc"})` → a row with `state` |
| a command | `:::cmd` | c38 — delete `documents.json`, save a registered doc → rebuilt |
| a grep | `:::cmd` | c40/c44 — the greps that marked them, written down instead of retyped |
| a wrapped test | `::test` / `:::cmd` | c17 — `node tests/markdown-fires.js`, pass/fail shown, nobody reads assert-code |
| a window probe | instructions + eyes | c8 — open the document; the leaf is one line with nothing to press |
| human instructions | prose in the fold | c10 — right-click → register → pick → the row lands. The "run" is his press |
| a pointer at the lines | `:file[path#Lx-y]` inline | this RFC's c3 — the FIRING entry linked, `project=` reaching the other repo |
| a screenshot | `::file` at an image | this RFC's c1 — the fold open in his pane, filed durably in `RFCs/proofs/` |
| a composite | several blocks in order | *here's the thing* (link, screenshot) → *here's it doing it* (cmd) → *the record it left* (read) |

Round one taught the ordering (his: *"this test doesn't do nothing for me"*): **lead with what the
reader can see** — a suite run convinces the person inside the code, so it rides last in the fold as
a supplement, anchored by a `:file` link at the lines it tests, and is never the proof by itself.
And the anchor is a LINK, not an embed (his reversal, same day): a wall of code in the fold is the
unit-test trap wearing a viewer — the chip points, the reader presses if they care. A screenshot is
a *moment* (what it looked like at marking, filed in the repo — never the self-pruning shots
folder); a cmd is a *re-check* (still true now). The strongest folds carry one of each.

The table is the easy half; the CHAPTER carries the approach (his: *"they got to know how to think
outside the box"*): the live system is the fixture, so reach for a door before a harness;
readable-first — the proof convinces the person outside the code or it is a unit test wearing a
fold; and hard-to-test is where the philosophy earns it — pass the object into a context and the
method you could not test becomes a call.

A claim that RESISTS a proof is a finding about the system, not about the claim: c11 (*"buapi
receives one `document.updated`"*) is unprovable today because delivery is not observable from
outside — writing its proof forces an observable (the ambient history as a callable). Proof-pressure
is how the system grows doors, and the doors are SystemLynx work, where the rest of the system's
self-verification already lives.

### 1.5 · A claim declares its kind — amendment, 2026-10-26

**This section is an amendment to an approved RFC, not a new one.** The subject is this document's:
what a claim's proof owes. Nothing above is retracted; what follows adds the declaration that makes
the obligation checkable.

**A proof answers two obligations, and they are not a menu.** §1.4's table reads as a list to pick
from, and that is what produced this document's own state: fourteen `:::cmd` blocks and not one
living spec. The two obligations:

- **The living spec** — `::test` pointing at a saved test in the project's spec library, or `:::run`
  for a walk that only means anything here. It captures the contract and the implementation walk,
  and it **rides the change loop**: every code change runs the tests, so breaking the contract next
  month goes red in front of whoever broke it.
- **Review facilitation** — the screenshot, the `:file` link, the cmd. These serve the human's
  confirming moment. Honest work, never the spec.

**A test is ADDRESSABLE; a run exists only where it is written.** `runTests({projectCode,
namespace})` answers in any chat, the suite runs it, another document can point at it. A `:::run`
can only ever be pressed in the fold it sits in. So anything the system should be able to ask about
later has to be a test — and the cost of choosing a run for a durable contract is not that asking
is inconvenient, it is that **nobody will ask**.

**The declaration.** A claim says what kind of assertion it makes, and silence is the strict side:

```markdown
::claim[press ✓ → state= lands on the line]{id=cEXAMPLE}                 behavioural (default)
::claim[the dashed badge reads as an invitation]{id=cEXAMPLE2 kind=experiential}
```

- **behavioural** — asserts behaviour, owes a living spec. Absence reads behavioural, exactly as an
  unmarked claim reads unchecked: silence never buys a pass.
- **experiential** — concluded by the human's own eye. No spec can be written for it, and forcing
  one produces the worthless translation (`expect(badge).toHaveClass("--invite")` is true and claims
  nothing the claim claimed). The exemption must be WRITTEN.

**Declared at authoring, frozen by the press.** An agent facing a spec it would rather not write
will discover the claim was experiential all along; at authoring nobody yet knows which proof is
inconvenient, so the classification costs nothing to make truthfully. The claims-completeness press
freezes it — a `kind=` added afterwards is a visible edit to an approved contract.

**What is derived, and what is not.** `claims.js` reads `kind=` and walks each container claim's
body: a claim **carries a spec** when its fold holds a `::test` or `:::run`. A `:::cmd` is NOT
counted — a cmd running the suite and a cmd running `grep` are indistinguishable at parse level,
and a heuristic behind a lifecycle gate is worse than an honest absence. So the surface says
*"6/12 spec'd"* and never *"proved"*: presence is enforceable, substance is a reviewer's call.

**OPEN, and deliberately not decided here.** A window-altitude claim has no live door — its real
change-loop defence is the project's own suite (`Claim.test.js` runs on every change), and `::test`
addresses SystemLynx namespaces, not jest files. Under this amendment those claims read *no spec*
forever, which is true in the doctrine's terms and may still be a false alarm. Either a third
declared kind (*pinned* — no live door, defended by the suite) or a way for `::test` to address a
project suite would resolve it. **This document's own claims are all behavioural and none carry a
spec**, so it is the first evidence either way.

### 1.6 · A failing proof on a met claim is a finding

Proofs rot usefully. A proof pressed months later that no longer passes does not unmark the claim —
it says the world moved under a mark that was true when made. That is exactly the staleness the
`::claims` recount cannot see today, surfaced for the cost of a press.

And it names a lifecycle state RFC-073 did not model (his): between built and retired a spec can
be **living** — kept true against a system that keeps moving, which is what an RFC written alongside
an arc becomes. A failing proof is the moment a living spec stops describing the system, and the
answer is one of three: update the spec, supersede it (`superseded=RFC-nnn` on the leaf, one line in
the lifecycle table when wanted), or retire it. Without proofs that moment is invisible; with them
it costs a press.

## 2 · The mechanism

- **Grammar: nothing.** `remark-directive` already parses `::claim` (leaf) and `:::claim`
  (container) as the same name with different `kind` — the engine and the host's `parse.cjs` see
  both today. No new block name, no `blocks.cjs` change: FIRING reads the mark off the opening
  line's attributes for either kind.
- **`src/atoms/Markdown/blocks/Claim.js`** — renders `kind === "container"` with the same row plus
  the `proof ▸` fold; children render inside the fold through the normal registry, so a `:::cmd` in
  a claim is the live component, not a quotation. Fence nesting is already handled
  (`normalizeFences`): a claim holding a `:::cmd` is a 4-colon container, the same arithmetic as
  threads.
- **`src/atoms/Markdown/Markdown.js`** — the right-click on a leaf claim gains *add a proof*: rewrite
  the leaf line as the container's opening line, insert the closing fence, leave the fold open with
  the caret in the body.
- **The registration leaf shows the lifecycle** (his, folded at execution: *"the blocks for RFC and
  reports are literally just labels — make the interactive component about the LIFE CYCLE of the
  document"*): `::rfc` / `::arc` / `::report` / `::gap` stop being bare labels — the leaf renders
  its kind's lifecycle with the document's current state lit, read from the registry's derived
  state. No new state machinery; the registry already derives it, the leaf finally shows it.
- **The claims chapter** (`docs/how-we-work/rfcs.md`) and **`rfc-authoring` §7** gain the sequence:
  verify → mark → leave the proof where the mark will be doubted. The agent-facing sentence is one
  line; the shapes table and the approach live in the chapter, not the skill.
- **The fire side is untouched**: a mark fires to its audience as RFC-073 built; a proof RUN fires
  nothing (running a check is not news — the mark that may follow it is).

## 3 · The idle nudge — an open sourced run points its agent back

His correction framing this right: the nudge is about **sourced runs generally** — any worklist
run carrying a source (a skill's, a job's, a lane's) that its agent stopped mid-list — and the RFC
EXECUTION run, the whole skill run, is the case that makes it urgent: an agent that stops at *"I did
slice one"* with the run open has today only the human to notice. Proofs do not own this machinery;
this RFC merely commits to landing it.

**This is already built, whole, in a lane**: autobot `lane/an-unfinished-run-nudges-its-agent`
(`1e89ca0` — `electron/agents/nudge.cjs`, 128-claim test): an unfinished run nudges its agent on
idle; selection is the run's **source** (job and skill runs, never the sourceless session plan); the
nudge count lives on the run so it can give up; movement resets it. Its window half is systemview
`lane/the-worklist-settings-cog` (lands second — landed first, the cog honestly renders "no nudge
door yet"). Built and tested in the lane, **never run live** — nothing of it is in the tree, so the
feature has nudged nobody yet; slice 5 ends with the first live verification: open a sourced run,
go idle mid-list, watch the nudge arrive and the count give up at its cap.

This RFC adds **no design** to the nudge — it commits to LANDING the pair, in that order, as the
execution half of proofs: the mechanism that keeps a claims walk going is the same one that keeps
any sourced run going. What was missing was the reason to land it; proofs are the reason.

## 4 · Slices, in landing order

1. **The container claim renders.** `Claim.js` container form, folded; children through the
   registry; leaf claims untouched. Checkable alone: wrap one claim in RFC-073, press its `:::cmd`,
   see the result in the fold. The lifecycle leaf (§2) rides this slice — same file family, same
   build.
2. **The retrofit gesture.** Right-click a leaf claim → *add a proof*. After 1 because it writes the
   form 1 renders.
3. **RFC-073 gets its proofs.** The proving ground: walk 073's marked claims and leave proofs on the
   load-bearing ones — the greps written down, the registry reads as `:::cmd`s, the watcher
   composite. This is the retrofit gesture exercised for real, and it is what makes 073's marks
   re-checkable instead of believed.
4. **The chapter and the skill learn the sequence** — and the **rfc-execution skill** is written.
   A skill teaching proofs before the fold renders is a skill teaching a verb that does nothing.
5. **The nudge pair lands — at the BACK of the list** (his call): autobot `1e89ca0`, then the
   settings cog. Nothing above depends on it; it waits until the proof work is in.

## 5 · What this does NOT add

- **No proof runner, no scheduler.** Proofs run when somebody presses them. A daemon re-running
  proofs is a different design with different costs; a failing proof is surfaced by a press, not a
  poll.
- **No new execution blocks.** The proof vocabulary is the result blocks that exist; a proof shape
  we lack is a SystemLynx door to build, not a markdown feature.
- **No mark automation.** A proof passing never writes `state=met`. Two signatures stay two.
- **No proof requirement.** `::claims` does not count proofs, and an unproofed claim is not a lesser
  claim — the mark is the contract, the proof is the courtesy that makes the contract cheap to
  audit.

## 6 · The piece most worth rejecting

§1.1's same-name container. The alternative — a separate `:::proof{for=cN}` block referencing the
claim — keeps every claim a leaf and attaches proofs by id. It is easier to bolt onto the 56 after
the fact, but it is two things that drift: a proof whose claim was reworded, a claim whose proof
moved files. A claim and its proof are one thought; the container keeps them one line apart. If the
reference form wins, §1.1, §2 and the retrofit gesture all change shape.

:::approval{ask="Approve RFC-075 — a claim carries its proof?" verdict=approved told=systemview-test}
Approving commits to:

1. §1.1 — `::claim` grows a same-name container form: folded `proof ▸`, children are ordinary
   result blocks run in place, the mark stays on the opening line, leaf claims untouched.
2. §1.2 — the sequence is verify → mark → proof; the proof is written for the human; a proof passing
   is evidence, never a mark.
3. §1.3/§5 — the mark stays mandatory, the proof stays earned; no runner, no automation, no
   requirement.
4. §2 — no grammar change, no new block names; `Claim.js` renders the container, the right-click
   retrofits a leaf.
5. §3 — the nudge pair lands as built (autobot `1e89ca0`, then the cog), selection by run source,
   unchanged — at the back of the list, after the proof slices.
6. §4 slice 3 — RFC-073's own claims are the proving ground: its load-bearing marks gain proofs.
7. §2/§4 slice 4 — the CONTEXT learns it: the how-we-work claims chapter carries the sequence and
   the approach (live system as fixture, proof-pressure grows doors, readable-first), rfc-authoring
   §7 teaches it in one line, the corpus is re-indexed — and a proof-writing subagent is permitted,
   never required, briefed with the chapter and the claim's mark, never tools alone.
8. §3 — an **rfc-execution skill** exists (his: *"each thing is going to need an execution skill"*):
   one sourced run per RFC — read it, land the slices in order, walk the claims with marks, proofs
   for the load-bearing ones, close with STATUS. rfc-authoring stops at the verdict and the check
   pass by its own words; execution had no procedure and no run, which is why work dies at slice
   boundaries — and a sourced run is what gives the nudge something real to keep alive.

The piece most worth rejecting is §1.1. If proofs attach by reference (`:::proof{for=cN}`) instead
of containment, §1.1, §2 and the retrofit all change shape.
:::

## Claims

::claims

Each one is *do this → this should happen*, grouped by where you stand when you check it.

**In the window — the claim and its fold** (slices 1, 2)

::::claim[Wrap a marked claim as `:::claim` with a `:::cmd` child → it renders as the same one-line claim row, folded, with `proof ▸`. Every leaf `::claim` in RFC-073 and RFC-074 renders exactly as it did before — no row changed.]{id=c1 note="met, spec'd in two halves after a blind review called the old note's excuse a convenience. Window.claimRow pins the container row BY NAME (statement on the opening line, proof folded under its own header, a leaf grown no affordance). The second sentence is NOT unassertable after all: Proofs.leavesInTheOtherRfcsStillParse parses RFC-073 and RFC-074 and asserts all 61 leaf claims keep their statement, their number and their leafness — the render cannot be asserted, but the regex change is what would actually break, and that can." told=systemview-test state=met by=systemview-test|you at=1793042280716}
What you saw when it first opened — this very list, c1's fold expanded in your pane, the live command inside:

::file[RFCs/proofs/rfc-075-the-fold-open-in-his-pane.png]

And the moment-proof above can rot; the re-check cannot — the render is pinned, for whoever is inside the code:
:::cmd
CI=true npx react-scripts test --watchAll=false --testPathPattern "blocks/Claim.test" 2>&1 | tail -4
:::

The living spec — the row, the fold's curtain, and the leaf that grew no affordance, each by name:
::test[SystemViewCore.Window.claimRow]{project=systemview-test}

and the second sentence, where the note used to excuse itself — no leaf claim in RFC-073 or RFC-074 lost its statement, its number or its leafness to the container form (61 leaves, parsed):
::test[SystemViewCore.Proofs.leavesInTheOtherRfcsStillParse]{project=systemview-test}
::::

:::claim[Expand the fold and press the `:::cmd` → it runs where it stands and keeps its exit and output in the fold — the live block, not a quotation.]{id=c2 state=met by=systemview-test at=1793037767715 note="met and spec'd — and the first version of this spec was two true facts with the claim sitting between them. Claim.test put a plain div in a fold; CmdBlock.test ran a block standing alone; neither asserted the COMPOSITION. blocks/claimProof.test.js now renders a real CmdBlock as a claim's proof and does the whole gesture: folded and unrun, expand, press, exit and output land INSIDE the fold, collapse keeps them, and a run still in flight survives a collapse and delivers its exit into a closed fold. That last case is the defect he found." told=systemview-test}
The "run" is your press: expand c14's *proof ▸* below and press its command — it runs in the fold, exit and output kept there, this document otherwise untouched.

The living spec — what sits in a fold is the real block: it runs what is written, keeps its exit, and never invents a result:
::test[SystemViewCore.Window.liveCmdInTheFold]{project=systemview-test}
:::

::::claim[Mark a container claim from the document → the same `state= by= at=` land on its OPENING line, and the mark fires to the document's audience exactly as a leaf claim's does.]{id=c3 told=systemview-test state=met by=systemview-test at=1793019616186 note="met and spec'd: Proofs.claimFiresOffItsOpeningLine drives the host's own parse -> fires -> setAttr chain on a CONTAINER claim — one summary ('c3 met — <statement>'), the document's members as audience, unmet announcing as not met, unchecked never firing, told= reading as silence, the mark landing on the opening line with the proof body untouched. The Window field beside it is thin by comparison (it asserts Claim forwards its own line prop), so this Proofs method is the defence, not a second one."}
The fire reads the mark off the opening line's attributes for EITHER kind — one table entry, :file[electron/markdown/blocks.cjs#L64-69]{project=autobot}, no second path for containers.

Supplement, for the code-side reader — the suite holding the container fire case. A pass means: a claim that has grown a proof body still marks and announces exactly like a bare one — the mark on its opening line, the fire to the document's audience, no second path:
:::cmd
cd ~/autobot && node tests/markdown-fires.js | tail -2
:::

The living spec — one path for both kinds, asserted through the host's own parse → fire → write chain:
::test[SystemViewCore.Proofs.claimFiresOffItsOpeningLine]{project=systemview-test}
::::

::::claim[Right-click a leaf claim → *add a proof* → the leaf is rewritten as its container form with an empty body; the statement and any existing mark survive verbatim.]{id=c4 state=met by=systemview-test at=1793017353142 note="met and spec'd for the transform: Proofs.growProof — statement and mark verbatim, the fence under an empty body, what followed still there, and a container, a non-claim and a line off the end each a no-op. NOT spec'd, and said plainly: the right-click affordance and its gating (offered on a leaf, withheld on a container) live inline in Markdown.js, which no suite can mount because react-markdown is ESM. That is a missing observable, which the doctrine calls a finding — it is on the board, not hidden here." told=systemview-test}
Try it: right-click any leaf claim in RFC-073 — 47 of them still have no proof — pick *Add a proof*, and watch the line grow its fences around an empty body, statement and mark untouched. The whole rewrite is ten lines — :file[src/atoms/Markdown/claims.js#L94-103].

Supplement — the cases pinned:
:::cmd
CI=true npx react-scripts test --watchAll=false --testPathPattern "Markdown/claims.test" 2>&1 | tail -4
:::

The living spec:
::test[SystemViewCore.Proofs.growProof]{project=systemview-test}
::::

::::claim[Open a registered document → its `::rfc`/`::arc`/`::report`/`::gap` leaf renders the kind's lifecycle with the document's current state lit, read from the registry — no longer a bare label.]{id=c5 state=met by=systemview-test at=1793017353142 note="met and spec'd in two halves: Window.lifecycleTrail pins the render law (station lit off the row, no row means no trail at all, no hub means nothing rather than an error, rejected shows draft -> rejected) and Proofs.registryLightsThisDocument asserts the LIVE row behind it — kind rfc, path matching this file, state derived by the shell's parse, station 'built' present in the kind's own list. The suite MOCKS the registry, so only the second half would notice the row going missing." told=systemview-test}
The leaf at the top of THIS document is the probe — *built* is lit. The registry state it reads:
:::cmd
node -e "const r=JSON.parse(require('fs').readFileSync(process.env.HOME+'/.autobot/documents.json'));console.log(JSON.stringify(r.find(d=>d.id==='RFC-075').state))"
:::

The living spec, in two halves — the render law (the station is lit off the row, and no row means no
trail rather than a guess), and then the LIVE row behind it: this document's own registry entry, with
the station the real `stateOf` derives from it. The suite mocks the registry, so the second half is
the only one that notices the row going missing:
::test[SystemViewCore.Window.lifecycleTrail]{project=systemview-test}
::test[SystemViewCore.Proofs.registryLightsThisDocument]{project=systemview-test}
::::

**The guards — what a proof can never do** (§1.2, §5)

::::claim[Run every proof in a document → no `state=` changes anywhere. A proof passing is evidence; the mark still takes a press or a noted `markBlock`. Two signatures stay two.]{id=c6 state=met by=systemview-test at=1793017353142 note="met and spec'd — with the first version's non-sequitur corrected by a blind review. The FIRING table governs what a block ANNOUNCES, so Proofs.resultBlocksNeverAnnounce proves no proof run reaches anybody's feed (all four result kinds absent, claim present, so the absence is a decision rather than an empty table); it does NOT prove no write. The write half is now asserted where a write would come from: CmdBlock.test's 'running a proof writes NOTHING into the document' runs a proof to its exit, pass AND fail, with a write door in scope and watches setAttr stay unused. Two signatures stay two is the third sentence, pinned by three named cases in Window.claimRow. The markBlock phrase in the statement is asserted by neither and is the one clause still carried on the note alone." told=systemview-test}
The FIRING table's own words — result blocks write nothing, so no proof run can mark anything:
:::cmd
grep -n "Result blocks" -A 1 ~/autobot/electron/markdown/blocks.cjs
:::

The living spec, both sentences — no result block in the FIRING table (so adding one breaks this),
and then *two signatures stay two*: countersigning grows `by=` and moves nothing else, stepping off
leaves the other signature standing, and a flip stashes rather than erases:
::test[SystemViewCore.Proofs.resultBlocksNeverAnnounce]{project=systemview-test}
::test[SystemViewCore.Window.claimRow]{project=systemview-test}
::::

::::claim[Grep the document machinery — every module of the host's markdown engine and the document-update path — for a proof runner, scheduler, watcher or poll → none. A proof runs only when somebody presses it.]{id=c7 state=met by=systemview-test at=1793017353142 note="met and spec'd, after the claim's own words were narrowed to what is defended. The spec scans every module in the host's document machinery plus documentUpdate.cjs for setInterval, setTimeout, fs.watch, fs.watchFile, a bare watch(, chokidar and cron — seven spellings, where the first version looked for two. The claim used to say 'the shell and the hub': run that grep where it pointed and it does NOT come back none (api/index.js and hostProject.js schedule and watch for their own reasons, CmdBlock polls a run), none of it a proof runner. A spec that redefines its claim's surface is worse than a narrower claim, so the claim is narrower now." told=systemview-test}
Zero hits in the document machinery is the answer:
:::cmd
grep -rn "setInterval\|fs.watch(" ~/autobot/electron/markdown ~/autobot/electron/apps/documentUpdate.cjs || echo "none — a proof runs when somebody presses it"
:::

The living spec:
::test[SystemViewCore.Proofs.noProofRunner]{project=systemview-test}
::::

:::claim[`::claims` counts marks, not proofs → an unproofed claim counts exactly as a proofed one.]{id=c8 state=met by=systemview-test at=1793017353142 note="met and spec'd: Proofs.countsMarksNotProofs — a proofed and an unproofed claim give identical met and total counts. A third field asserting 'no proof column' was DELETED in reconciliation: it checked for a key nobody ever used while the object right there carries specd and owed, so it asserted the opposite of what the code contains and passed anyway. The reading is narrower since the amendment, which is why c8 stands rather than being retracted." told=systemview-test}
Look at the bar at the top of this document: 15/15, every claim proofed. Now open RFC-073: its bar counts 8 proofed and 47 unproofed claims identically — there is no proof column anywhere, because the scan reads colons and marks and nothing else — :file[src/atoms/Markdown/claims.js#L22-27].

The living spec — a proofed and an unproofed claim counting identically:
::test[SystemViewCore.Proofs.countsMarksNotProofs]{project=systemview-test}
:::

**The proving ground** (slice 3)

::::claim[RFC-073's load-bearing marked claims carry proofs — the greps and registry reads from their notes written down as result blocks → press one and the check that marked it re-runs where it stands.]{id=c9 state=met by=systemview-test at=1793017353142 note="met and spec'd: Proofs.rfc073ProofsStand asserts the EIGHT load-bearing ids BY NAME (c17 c36 c40 c41 c42 c44 c45 c47) each still hold a result block in their own fold, and that no grown claim is an empty fold. Counting grown claims alone let the denominator select itself — un-grow one and the count would still agree with itself — which a blind review caught. Not asserted: that pressing one re-runs the check; that is the human's gesture." told=systemview-test}
Count the grown fences in RFC-073 — eight:
:::cmd
grep -c "^::::claim" RFCs/RFC-073-a-document-state-lives-in-the-system.md
:::

The living spec — every grown claim in RFC-073 holds a real result block, named when one does not:
::test[SystemViewCore.Proofs.rfc073ProofsStand]{project=systemview-test}
::::

**The context** (slice 4, commitments 7–8)

::::claim[`context("how do I leave a proof on a claim")` → the claims chapter answers with the sequence (verify → mark → proof written for the human) and the approach (live system as fixture; a claim that resists proving names a missing observable; readable-first).]{id=c10 state=met by=systemview-test at=1793017353142 note="met and spec'd sentence by sentence, after the note overstated itself: Proofs.chapterAnswersTheProofQuestion asserts the proof section AND the approach section by heading, the sequence said out loud (verify -> mark -> proof, written for the human), all three approach items (the live system is the fixture, a claim that RESISTS is a finding, readable-first), and that the how-we-work corpus's root covers the file — words on disk nothing indexes answer nobody. What a spec CANNOT reach: the retrieval itself. context() has no door a saved spec can call, so that half was verified live after indexing and is review facilitation, honestly labelled." told=systemview-test}
The chapter section exists where the corpus reads it; the retrieval half is any agent's `context("how do I leave a proof on a claim")` — it answered live after indexing:
:::cmd
grep -n "^## A claim can carry its proof" docs/how-we-work/rfcs.md
:::

The living spec — the chapter's sections by heading, so deleting one breaks this instead of silently emptying what `context()` can answer with:
::test[SystemViewCore.Proofs.chapterAnswersTheProofQuestion]{project=systemview-test}
::::

::::claim[rfc-authoring teaches the proof in ONE line in §7; the shapes table and the approach live in the chapter, not the skill.]{id=c11 state=met by=systemview-test at=1793017353142 note="met and spec'd — and the previous note claimed an assertion about the WRONG FILE (it cited a check on rfc-execution). Proofs.authoringPointsAtTheChapter asserts rfc-authoring itself: the proof line present, a pointer at the chapter, and no second copy of the shapes or the approach in the skill. Two corrections the review earned: the claim's 'ONE line' is really a four-line paragraph, and the shapes TABLE is in this RFC's own 1.4 rather than in the chapter — the chapter carries the shapes in prose, which is what the spec asserts." told=systemview-test}
The one line, in the skill:
:::cmd
grep -n "leave the PROOF" ~/.claude/skills/rfc-authoring/SKILL.md
:::

The living spec:
::test[SystemViewCore.Proofs.authoringPointsAtTheChapter]{project=systemview-test}
::::

::::claim[The chapter permits a proof-writing subagent — briefed with the chapter and the claim's mark and note, never tools alone. Permission, not procedure.]{id=c12 state=met by=systemview-test at=1793017353142 note="met and spec'd — and the first version was a single word that matched a HEADING: the entire permission paragraph could have been deleted with the spec still green. Proofs.chapterPermitsADelegatedProof now asserts the three things the claim says: 'Proof-writing may be delegated; verification may not', the brief (the claim, its mark, its note, this section), and 'never tools alone' — plus permitted-never-required, which is what makes it permission rather than procedure." told=systemview-test}
The permission and the brief, in the chapter:
:::cmd
grep -n "delegated" docs/how-we-work/rfcs.md
:::

The living spec:
::test[SystemViewCore.Proofs.chapterPermitsADelegatedProof]{project=systemview-test}
::::

::::claim[An rfc-execution skill exists: invoke it on an approved RFC → one sourced run (`skill:rfc-execution`) that reads the RFC, lands slices in order, walks the claims with marks, leaves proofs on the load-bearing ones, and closes with STATUS.]{id=c13 state=met by=systemview-test at=1793017353142 note="met and spec'd, both halves. Proofs.executionSkillWalksAnRfc asserts the skill opens its own sourced run and carries the procedure the claim commits to, by heading: the verdict gate, the slices in the RFC's order, the claims walk with marks, closing with STATUS — four headings the first version never checked while asserting only that the file was non-empty. And the half that was pending is real: THIS document's claims walk ran as a sourced skill:rfc-execution run, the first on disk (checked before opening it — zero existed, while this claim read met, which is the hole the doctrine is about)." told=systemview-test}
The skill on disk, its trigger naming execution and refusing authoring:
:::cmd
sed -n 1,3p ~/.claude/skills/rfc-execution/SKILL.md
:::

The living spec:
::test[SystemViewCore.Proofs.executionSkillWalksAnRfc]{project=systemview-test}
::::

**The nudge pair** (slice 5, at the back)

::::claim[An agent idle on an open sourced run is nudged back to it — the message names the source, the item left active and how far the run got; the count lives on the run record and movement resets it.]{id=c14 state=met by=systemview-test at=1793017346091 note="met and spec'd, both halves. Proofs.nudgeSelectsAndNames drives the real selector (an open run selected, the message naming the source, the item left active and 4/6, saying it is not from the human, carrying WORK TO COMPLETION; a closed run, a quiet below the floor and the knob off each selecting nothing) and then the half no spec touched before: the count lives on the run record and MOVEMENT RESETS IT, proven by nudging a run and moving its list in a scratch worklists directory — never his live store. Also verified live 2026-10-26 across four real nudges." told=systemview-test}
The real proof arrived on its own, four times over. The mechanism is :file[electron/agents/nudge.cjs#L1-30]{project=autobot} — and the re-check, for the code-side reader:
:::cmd
cd ~/autobot && node tests/nudge.js | tail -2
:::

The living spec — the selector picks the open run, and the message names the source, the active item and the progress:
::test[SystemViewCore.Proofs.nudgeSelectsAndNames]{project=systemview-test}
::::

::::claim[The nudge gives up at its cap: once a run has been nudged `giveUpAfter` times with no movement, it is never nudged again.]{id=c14b state=unmet by=systemview-test at=1793064000000 note="NOT MET, and the valuable outcome — now with a living spec of what happens INSTEAD. Proofs.nudgeNeverGivesUp asserts the law that replaced it: the first nudge is 1 of 3, the third is the FINAL NOTICE, past the cap the position WRAPS, an ordinary nudge never mentions the exit, and neither the declared word alone nor the attached report alone excuses a run. A blind review caught that all of this was arithmetic on cycleOf, which structurally cannot see a stop — so the selector is asserted too: pickNudge with a count of 9 still returns the run, which is the field that would go red if the give-up were ever put back. The knob at zero is the one real stop, and it is now written down. Kept rather than rewritten because the mark it carried was TRUE when made; a claim that went false while nobody was asking is this document's own argument for 1.5." told=systemview-test}
The old law and the new one, in the same file — the selector no longer stops on a count:
:::cmd
cd ~/autobot && grep -n "THE COUNT NEVER STOPS THE NUDGING" -A 3 electron/agents/nudge.cjs
:::

The living spec — past the cap the cycle WRAPS, and neither the word nor the report alone excuses a run:
::test[SystemViewCore.Proofs.nudgeNeverGivesUp]{project=systemview-test}
::::

::::claim[The worklist settings cog shows the nudge door instead of "no nudge door yet".]{id=c15 state=met by=systemview-test at=1793017346091 note="met and spec'd in two halves, because a registered IPC channel is not a rendered cog and the first version only had the channel. Proofs.nudgeSettingsDoor asserts the knobs' contract (defaults with no file at all, every knob defaulted, garbage falling back, a round-trip through a SCRATCH file so the spec never edits the settings his own sessions are nudged by) and the shell's door answering with nudgePicks. Window.nudgeCog wires the fourteen-case suite that renders the knobs — which was addressed by NOTHING until the review found it — including the line the claim was written against: it says plainly when there is no door rather than inventing a state." told=systemview-test}
Eyes: the cog at the right end of the band tab row — open it, the knobs are live. The door it writes through:
:::cmd
grep -n "nudge:settings" ~/autobot/electron/apps/files-host.cjs
:::

The living spec — the knobs' contract (round-tripped through a scratch file, never his own) and the shell's door:
::test[SystemViewCore.Proofs.nudgeSettingsDoor]{project=systemview-test}

and the COG itself, which a registered IPC channel is not — the fourteen-case suite that renders the knobs, and the line it draws when there really is no door:
::test[SystemViewCore.Window.nudgeCog]{project=systemview-test}
::::

**The amendment's claims** (§1.5, added 2026-10-26 — the declaration and what it derives)

::::claim[Write a claim with no `kind=` → it reads behavioural and owes a living spec. Write `kind=experiential` → it is exempt, and that is the ONLY exemption — one exemption, read from four spellings (`experiential`, `experience`, `judgment`, `judgement`); every other value, and absence, reads behavioural.]{id=c16 state=met by=systemview-test at=1793063000000 note="met and spec'd: Proofs.claimKind — absence reads behavioural, four spellings exempt, case and space tolerated, and the TYPO case pinned (kind=experential must not buy an exemption); then the consequence, that a marked behavioural claim with no spec is owed, an experiential one never is, and an unmarked one is asked for nothing yet." told=systemview-test}
The rule is one function, and the strict default is the whole point — :file[src/atoms/Markdown/claims.js#L43-L70].

Supplement — a pass means absence reads behavioural and only the written word exempts:
:::cmd
CI=true npx react-scripts test --watchAll=false --testPathPattern "Markdown/claims.test" 2>&1 | tail -4
:::

The living spec — including the typo case, because `kind=experential` must not buy an exemption:
::test[SystemViewCore.Proofs.claimKind]{project=systemview-test}
::::

::::claim[Put a `::test` or `:::run` in a claim's fold → the claim reads as carrying a spec. Put only a `:::cmd` → it does not. Put a FENCED EXAMPLE of a spec block → it does not.]{id=c17 state=met by=systemview-test at=1793063000000 note="met and spec'd: Proofs.specDetection — ::test and :::run count, a cmd and prose do not, a leaf carries none by construction, a FENCED example cannot fake one, and the body walk still finds a spec past a longer inner fence. The exclusion of :::cmd stays deliberate: a cmd running the suite and a cmd running grep are indistinguishable at parse level, and a heuristic behind a lifecycle gate is worse than an honest absence." told=systemview-test}
The walk and the deliberate exclusion of `:::cmd` — :file[src/atoms/Markdown/claims.js#L72-L108].

The living spec:
::test[SystemViewCore.Proofs.specDetection]{project=systemview-test}
::::

::::claim[Open a document's `::claims` bar → it reports `spec'd` as a fraction of the BEHAVIOURAL claims (never of the total — an experiential claim is not a shortfall) plus an `owed` count, beside met and reviewed, and the MET count is unchanged by any of it.]{id=c18 state=met by=systemview-test at=1793063000000 note="met and spec'd three ways: Proofs.barAxes pins the arithmetic on a fixture (spec'd over the BEHAVIOURAL count and never the total, met untouched, owed only where marked, behavioural and unspec'd), Window.claimRow now pins what a reader SEES — 1/2 spec'd and 1 owed drawn on a mixed document, no owed tag at all when nothing is owed, reviewed still beside them — which nothing asserted before the review asked, and Proofs.rfc075OwesNothing asserts THIS document owes nothing AND that every namespace it names resolves to a spec on disk, because hasSpec is structural and 21/21 was otherwise reachable with 21 fabricated names. The bar read 0/15 the night the amendment landed." told=systemview-test}
This bar, on this document, is the probe: it reads 15/15 met and **0/15 spec'd**, because every claim here is behavioural and none carries a spec. The document that invented proofs is its own first finding.

The living spec — the axis itself, and then THIS document's own `owed`, asserted at zero:
::test[SystemViewCore.Proofs.barAxes]{project=systemview-test}
::test[SystemViewCore.Proofs.rfc075OwesNothing]{project=systemview-test}
::::

::::claim[Mark a behavioural claim that has nothing in its fold the change loop runs → its row says `no spec`. An experiential claim says `by eye` on its kind alone, marked or not, and is never asked for a spec. Leave a behavioural claim unmarked → it is asked for nothing yet.]{id=c19 state=met by=systemview-test at=1793063000000 note="met and spec'd: Window.claimRow pins all four rows by name — 'no spec' on an undefended behavioural claim, silence when the fold carries one, 'by eye' on an experiential claim, and nothing asked of an unmarked claim — plus the clause that was half-covered until the review named it: 'by eye' rides the KIND ALONE, so an experiential claim nobody has marked still says it. Three of the five are absence checks, which is worth knowing: delete the badge feature and they would go green; the two positive ones are what catch that." told=systemview-test}
The living spec — the four rows by name: `no spec`, silence, `by eye`, and nothing asked of an unmarked claim:
::test[SystemViewCore.Window.claimRow]{project=systemview-test}
::::

::::claim[`context("proof doctrine")` → the chapter answers with the two obligations, who writes the spec, `::test`-versus-`:::run` with the change-loop consequence, and the routes for getting a live door. rfc-execution carries the deciding paragraph; neither restates the other.]{id=c20 state=met by=systemview-test at=1793063000000 note="met and spec'd: Proofs.doctrineReachesBothReaders asserts the four doctrine sections by heading, the change-loop consequence, 'living spec' said out loud, the corpus covering the file, rfc-execution carrying the deciding paragraph, the second-opinion chapter with disagreement-is-the-product — AND that neither restates the other: the skill carries the query and has no routes heading of its own. One definition, or it drifts into two, and a copy pasted into the skill reads perfectly well, which is why this is asserted rather than trusted." told=systemview-test}
Ask it yourself — the doctrine answers from the corpus, not from this document:
:::cmd
echo 'ask an agent: context("proof doctrine — living spec versus review facilitation")'
:::

The living spec:
::test[SystemViewCore.Proofs.doctrineReachesBothReaders]{project=systemview-test}
::::

**The classification was independently checked, blind.** A subagent was given the doctrine and the
twenty bare statements — never this document's own verdicts — and asked to classify from the law
alone, because the author is the party with an interest: calling a claim experiential exempts them
from writing its spec. It agreed on all twenty (**behavioural, none experiential**) and earned its
keep on the statements instead: c1 carried a stale count with no referent ("the 56 leaf claims" —
no such set exists today), c16's second sentence was literally false (`normalizeKind` honours four
spellings of the one exemption), c18 did not say its denominator is the *behavioural* count, and
c19 implied the `by eye` badge depends on a mark when it renders on the kind alone. All four are
corrected above — legitimately, because the completeness approval below has never been pressed, so
this list is still a draft and not yet a contract. It also read the "no live door" paragraph as a
trap worth naming — it is about a proof's SHAPE, never a second exemption — which is now said
outright in the chapter. **Still open, its recommendation and not yet done:** c6, c13 and c20 each
decide two things and should be split before the press.

**The walk was checked blind a second time, and it changed the specs.** A subagent was given the
twenty-one statements, their notes and the spec code — never the marks — and asked the one question
the author cannot ask themselves: *does the spec defend the STATEMENT, or something adjacent that
merely sits nearby?* It ran every method itself and came back with fourteen findings. Every one that
was real is now fixed in code rather than argued with here:

- **c12's spec was a single word that matched a HEADING** — the whole permission paragraph could
  have been deleted with the proof still green. **c13** asserted a file was non-empty while its
  claim named five steps. **c6** read a table about ANNOUNCEMENTS and concluded no write happens —
  a non-sequitur; the no-write half now runs a proof to its exit, pass and fail, and watches
  `setAttr` stay unused. **c7's** spec scanned six files for two spellings while its claim said *the
  shell and the hub*: run that grep where the claim pointed and it does not come back none, so the
  CLAIM was narrowed to what is defended. **c14b** was all arithmetic on `cycleOf`, which cannot
  see a stop — the selector itself is asserted now. **c2's** two halves never met in the middle, so
  `claimProof.test.js` was written: a real `:::cmd` in a real fold, expanded, run, collapsed
  mid-run. **c18** asserted the arithmetic and never what a reader sees. **c15's** cog had a
  fourteen-case suite that NOTHING addressed. **c9's** denominator selected itself. **c8** carried a
  field asserting the absence of a column nobody ever wrote, next to two that are there.
- **And the sharpest one, systemic:** `hasSpec` is structural — a `::test` line inside a fold — so
  `21/21 spec'd` and `owed 0` were reachable with twenty-one FABRICATED namespaces. Every namespace
  this document names is now checked to resolve to a spec on disk, and the misses would be named.
- **The loader was measured and its promise was false.** `loadEsm` said a module growing an
  unresolvable import would go red; the reviewer proved it went green with the stub recorded in an
  array the caller discarded. It throws now.

**Where this walk disagreed, and why.** Both reviews recommend SPLITTING c1, c2, c6, c13, c14, c18
and c20 — each decides two things. They are not split, and the reason is on the record rather than
in a preference: every second half named above is now *asserted by its own spec*, which removes the
thing splitting protects against (one mark covering a half nobody checked), and splitting a list
that has never been pressed would change the shape of the contract in the same motion as proving
it. The recommendation stands for his press; the holes it was aimed at are closed either way.

**What a spec still cannot reach, said plainly rather than left to be discovered:** `context()` has
no door a saved spec can call, so c10's retrieval half is review facilitation; and c4's right-click
affordance is gated inline in `Markdown.js`, which no suite can mount because its renderer is ESM —
a missing observable, which under this document's own rules is work, and it is on the board.

**A mark that went false while nobody was asking** — c14 said the nudge *"gives up at its cap"*.
That stopped being true on 2026-10-26, when the nudge cycle was rebuilt: reaching the cap is now
the cycle's FINAL NOTICE, the count wraps, and nudging continues until the run closes or is
declared abandoned with its account attached. c14 is left exactly as it was marked — the statement
was true when made, and where a claim went stale is the record — and this paragraph is its
supersession. **It is also §1.5's argument, demonstrated on this document**: c14's proof was a
note, nothing addressable ran, so the claim read `met` for hours after it became false. A spec
would have gone red in the change loop that rebuilt it.

:::approval{ask="Is this the complete list of claims for RFC-075?"}
Pressing this makes the list the contract. A behaviour missing from it is one we agreed not to
check — so the thing to read for is what is NOT here.
:::

## STATUS — built 2026-10-26

::claims

Every slice landed the day of the verdict. The two live checks that remain are his: the first
real nudge (shell restart arms it) and the window's eyes on the container fold, the lifecycle
trail and the cog (bundle swap). c11 of RFC-073 stays the named unprovable — delivery still has
no outside observable; that door is SystemLynx work this RFC only points at.

**Amended 2026-10-26 — §1.5, the declaration.** A claim now says what kind of assertion it makes,
silence reads behavioural, and the bar reports a third axis: `N/M spec'd` beside met and reviewed.
Claims c16–c20 cover it. The nudge was rebuilt the same day and c14's *"gives up at its cap"* went
false under a mark nobody was asking about — left standing, superseded in the list above, and
offered as this amendment's own best evidence.

**Amended again, 2026-10-26 — every claim now carries a living spec.** The paragraph that used to
stand here said this document *could not honestly reach `settled`*: twenty-one behavioural claims,
fourteen `:::cmd`s, **none carrying a spec**, which under its own §1.5 meant no defence the change
loop runs. That is repaired. The bar reads **21/21 spec'd, 0 owed**, and the specs are real: 24
saved SystemLynx specs on `SystemViewCore` (`Proofs.*` and `Window.*`, 170-odd asserted
evaluations), addressable as `runTests({projectCode: "systemview-test", namespace: "Proofs"})` from
any chat, by any agent, without opening this file.

**The open question §1.5 declined to decide is answered, and the answer was not a new block.**
`::test` did not have to learn to address a jest suite — a method is already a door, so the suite
became one: `Window.*` runs the real jest suites and asserts the **named cases** that pin each
claim, which is what makes a window-altitude claim addressable and loop-ridden. A count would have
gone green the day somebody deleted the case that mattered; a name cannot. The trade is stated in
that file: a fragment is a substring, so renaming a case for clarity is free and a case kept by
name with its body emptied would still pass. Only review catches that one.

**The walk that produced this was itself checked blind, twice, and the second pass rewrote the
specs** — fourteen findings, every real one fixed in code, listed above the claims list. The one
that mattered most: `owed: 0` was a syntax check until the namespaces were made to resolve.

**What is still true and uncomfortable:** c14b reads **unmet**, and its living spec defends the law
that *replaced* its statement — so `21/21 spec'd` includes one spec proving its own claim false.
That is honest at the claim and arguable at the bar, and it is a hole in the DOCTRINE rather than in
this walk: the third axis counts a refutation as a defence. Left for his ruling rather than quietly
resolved.

**What a spec cannot reach here, named rather than excused:** `context()` has no door a saved spec
can call (c10's retrieval half), and `Markdown.js` cannot be mounted because its renderer is ESM, so
c4's right-click affordance has no observable. Both are on the board as work. c11 of RFC-073 stays
the older named unprovable — delivery still has no outside observable.

**His, still:** the claims-completeness press under the list (never pressed, which is why the
statements and notes above were legitimately corrected rather than frozen), and the splits both
reviews recommend for c1, c2, c6, c13, c14, c18 and c20.
