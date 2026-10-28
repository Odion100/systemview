# RFC-075 — A claim carries its proof

::rfc{id=RFC-075 settled=2026-10-28}

**Status: approved** · 2026-10-26 · extends RFC-073 (claims as blocks, the mark, the fire) · the
conversation this records is his: *"the whole thing is to make these documents specs"*

::members{who=systemview-test sent=systemview-test:k1mrdw}
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

::::claim[A claim with a proof still reads as one line, with the proof tucked behind a ▸ you open when you want it.]{id=c1 note="met. Checked by opening this claim's own fold, and by the run below: the window draws exactly as many claim rows as the file has claims, with every proof fold sitting inside one. The page is the fixture — the jsdom harness that used to model it is gone, and the old note's 'the render cannot be asserted' went with it." told=systemview-test state=met by=systemview-test|you at=1793042280716}
A proof could fail in two directions and only one of them is visible by eye. It could fail to fold —
you would see that immediately. Or it could break OUT of its claim and become a claim of its own,
and that failure looks like nothing at all: the page still reads fine, and the bar at the top quietly
counts one claim too many and one proof too few. So the check is a count from both sides at once —
the file's own parse, and the window you are reading this in.

Add a claim to this document and this block goes red until you up the number. That is a living spec
sitting in the thing it describes — you are already editing the file.
:::run{title="A proof must never break out and become a claim of its own: 26 claims in the file, 26 rows on screen, 25 proofs and every one of them inside a claim"}
- SystemViewCore.Claims.bar({ "path": "RFCs/RFC-075-a-claim-carries-its-proof.md" }){title="the file's own parse — 26 claims, 25 of them holding a proof"}
  - results.total = 26
  - results.specd = 25
- AutobotShell.Window.count({ "selector": ".md-claim > .md-claim__row" }){title="claim rows the window drew — one per claim, so 26. More than that and a proof has escaped"}
  - results.found = 26
- AutobotShell.Window.count({ "selector": ".md-claim > .md-claim__proof" }){title="proof folds drawn as a direct child of a claim — a proof belongs to its claim, so 25"}
  - results.found = 25
:::

**What it asks:** does the window agree with the file about how many claims there are and how many
proofs are folded inside one — counted as a direct child, so a proof that escaped its claim shows
up as a missing fold and an extra row at the same time.
**If it stopped holding,** the bar would overcount claims and undercount proofs, and a document
would read as badly defended for a reason nobody could see on the page.
::::

::::claim[Every claim in RFC-073 and RFC-074 that has no proof still reads as a claim, with its statement and its number.]{id=c1b note="met and spec'd: Proofs.leavesInTheOtherRfcsStillParse runs all 61 proofless claims in the other two RFCs through the real parser. The spec asserts the count (61, hard-coded — grow one and it goes red) and that the list of broken ones comes back empty; the method itself decides nothing, which is a change from the three self-graded booleans it used to return." told=systemview-test state=met by=systemview-test|you at=1793042280716}
Count them yourself — 61 plain claims across the two documents, and not one of them has grown a fold:
:::cmd
cd ~/Systemly/systemview && node -e 'const P=require("./systemview-test/methods/Proofs.js");P.leavesInTheOtherRfcsStillParse().then(r=>console.log(r.leavesFound,"plain claims |",r.missing.length,"documents missing |",r.broken.length,"broken"))'
:::

**What it asks:** are the 61 plain claims in RFC-073 and RFC-074 still claims? Adding the wrapping
syntax meant the system had to recognise a second shape, and the risk was that it would start
reading the old shape as the new one and swallow it. So every one of those 61 is checked for its
statement and its number. Real documents rather than a fixture on purpose: a fixture I wrote is a
fixture I wrote to pass, while those files carry real nesting, threads and spacing.

**If it stopped holding,** plain claims in documents nobody has open would be quietly disappearing
from their own bars, and the first person to notice would be whoever opened one months later.
::test[SystemViewCore.Proofs.leavesInTheOtherRfcsStillParse]{project=systemview-test}
::::

::::claim[Open a claim's proof and press the command inside it → it runs there, and its exit code and output stay inside the fold. It is the live thing, not a picture of one.]{id=c2 state=met by=systemview-test|you at=1793037767715 note="met and spec'd — and the first version of this spec was two true facts with the claim sitting between them. Claim.test put a plain div in a fold; CmdBlock.test ran a block standing alone; neither asserted the COMPOSITION. blocks/claimProof.test.js now renders a real CmdBlock as a claim's proof and does the whole gesture: folded and unrun, expand, press, exit and output land INSIDE the fold, collapse keeps them, and a run still in flight survives a collapse and delivers its exit into a closed fold. That last case is the defect he found. The claim used to send you to c14's fold to try the gesture; it holds its own command now, because a claim that borrows another claim's evidence is not carrying its own." told=systemview-test}
Press this one twice. The clock moves, which is the whole claim — a picture of a result cannot do that:
:::cmd
date "+%H:%M:%S" && wc -c < ~/Systemly/systemview/RFCs/RFC-075-a-claim-carries-its-proof.md
:::

**What it asks:** is the command inside a proof the real block, or a quotation of one? Renders an
actual command block as a claim's proof and does the whole gesture — folded and unrun, open it,
press it, exit and output land inside the fold, close it and they survive; and a run still in
flight delivers its exit into a fold that has since been closed. **If it stopped holding,** a
proof would show you a result it never ran — which is the one failure that makes every green
meaningless.
::test[SystemViewCore.Window.liveCmdInTheFold]{project=systemview-test}
::::


::::claim[Press ✓ on a claim that has a proof folded inside it → the mark lands on the claim's first line and is announced to the people on the document, exactly as it is for a claim with no proof. One path, not two.]{id=c3 told=systemview-test state=met by=systemview-test|you at=1793019616186 note="met and spec'd: Proofs.claimFiresOffItsOpeningLine drives the host's own parse -> fires -> setAttr chain on a CONTAINER claim — one summary ('c3 met — <statement>'), the document's members as audience, unmet announcing as not met, unchecked never firing, told= reading as silence, the mark landing on the opening line with the proof body untouched. The Window field beside it is thin by comparison (it asserts Claim forwards its own line prop), so this Proofs method is the defence, not a second one."}
The fire reads the mark off the opening line's attributes for EITHER kind — one table entry, :file[electron/markdown/blocks.cjs#L64-69]{project=autobot}, no second path for containers.

Supplement, for the code-side reader — the suite holding the container fire case. A pass means: a claim that has grown a proof body still marks and announces exactly like a bare one — the mark on its opening line, the fire to the document's audience, no second path:
:::cmd
cd ~/autobot && node tests/markdown-fires.js | tail -2
:::

**What it asks:** when you press ✓ on a claim that has a proof, does the mark land in the right
place and does the announcement go out — through the host's own parse-and-announce chain, not a
copy of it. Also that an unchecked claim announces nothing, and that *not met* announces as not
met. **If it stopped holding,** marking a claim with a proof would either write to the wrong line
or tell nobody, so the people on the document would learn about decisions by re-reading the file.
::test[SystemViewCore.Proofs.claimFiresOffItsOpeningLine]{project=systemview-test}
::::

::::claim[Right-click a claim that has no proof and choose *add a proof* → it is rewritten in place to make room for one, and its statement and its mark come through untouched.]{id=c4 state=met by=systemview-test|you at=1793017353142 note="met and spec'd for the transform: Proofs.growProof — statement and mark verbatim, the fence under an empty body, what followed still there, and a container, a non-claim and a line off the end each a no-op. NOT spec'd, and said plainly: the right-click affordance and its gating (offered on a leaf, withheld on a container) live inline in Markdown.js, which no suite can mount because react-markdown is ESM. That is a missing observable, which the doctrine calls a finding — it is on the board, not hidden here." told=systemview-test}
**Try it HERE — this claim is the fixture.** The sentence below is a real claim with no proof,
sitting in this document so the gesture can be done where you are reading it rather than in another
file:

::claim[A disposable claim, for trying the gesture on → right-click it, choose *add a proof*, and watch it grow room for one]{id=cTRY kind=experiential state=met by=you at=1793097230875 told=systemview-test}

Right-click it, pick *Add a proof*, and watch the line grow its fences around an empty body with the
statement untouched. Then put it back and do it again:

:::cmd
cd ~/Systemly/systemview && node -e 'const f="RFCs/RFC-075-a-claim-carries-its-proof.md",fs=require("fs");let t=fs.readFileSync(f,"utf8");const leaf="::claim[A disposable claim, for trying the gesture on → right-click it, choose *add a proof*, and watch it grow room for one]{id=cTRY kind=experiential}";const grown=new RegExp("^:::claim\\[A disposable claim[^\\n]*\\n[\\s\\S]*?^:::$","m");if(grown.test(t)){fs.writeFileSync(f,t.replace(grown,leaf));console.log("cTRY is a leaf again — right-click it once more")}else{console.log("cTRY is already a leaf — nothing to undo")}'
:::

**What the spec asks:** hand the real rewriter a claim and take back the document it produced —
the statement and the mark verbatim, the empty body under a closing fence, the line that followed
still following. And that it refuses the three things it should: a claim that already has a proof,
a line that is not a claim at all, and a line past the end of the file.
**If it stopped holding,** the gesture would silently eat a statement or a signature — and nobody
would notice until a claim came back wearing somebody else's mark.
::test[SystemViewCore.Proofs.growProof]{project=systemview-test}
::::

::::claim[Open a document the system knows about → the coloured lifecycle strip at its top lights the stage the system actually believes it is at, read from the record rather than typed by an author. You cannot fake it by writing a word.]{id=c5 state=met by=systemview-test|you at=1793017353142 note="met and spec'd in two halves: Window.lifecycleTrail pins the render law (station lit off the row, no row means no trail at all, no hub means nothing rather than an error, rejected shows draft -> rejected) and Proofs.registryLightsThisDocument asserts the LIVE row behind it — kind rfc, path matching this file, state derived by the shell's parse, station 'built' present in the kind's own list. The suite MOCKS the registry, so only the second half would notice the row going missing." told=systemview-test}
The leaf at the top of THIS document is the probe — *built* is lit. **Press this to see the whole
record it reads, and the complete field vocabulary** — the trail is drawing six booleans and a word,
and there is nothing else in there:

:::cmd
node -e "const r=JSON.parse(require('fs').readFileSync(process.env.HOME+'/.autobot/documents.json'));const d=r.find(x=>x.id==='RFC-075');console.log('THIS ROW:');console.log(JSON.stringify(d,null,2));const t=new Set(),st=new Set();r.forEach(x=>{Object.keys(x).forEach(k=>t.add(k));Object.keys(x.state||{}).forEach(k=>st.add(k))});console.log('\nALL '+r.length+' ROWS use only these fields:');console.log('  identity:  '+[...t].join(' '));console.log('  in state:  '+[...st].join(' ')+'  (+settled/retired when a leaf declares them)')"
:::

Two kinds of field and the difference decides where a press can write. `verdict`, `built`,
`objectives` and `approvals` are read out of the document's **body** by the shell's parse, so they
reach a reader only through this file. `settled`, `retired` and `resolved` are on the **leaf line
itself** — which is why the trail reads those straight off the leaf and not through the registry at
all: the row is a cache of the last parse, and a cache is behind the document exactly when somebody
has just changed it.

**What the first one asks:** given a record saying what stage a document is at, does the strip
light that stage — and when there is no record at all, does it draw nothing rather than guess?
It hands the renderer the record itself, so it is a drawing law and nothing more.
**If it stopped holding,** a rejected design would light up as a draft and somebody would build it.
::test[SystemViewCore.Window.lifecycleTrail]{project=systemview-test}

**What the second one asks:** is there a real record behind the strip at the top of THIS document —
the right kind, the right path, and a stage the system derives rather than reads off the page.
This is the one that touches the live registry; the one above is handed its record.
**If it stopped holding,** the strip would keep drawing confidently from nothing.
::test[SystemViewCore.Proofs.registryLightsThisDocument]{project=systemview-test}
::::

**The guards — what a proof can never do** (§1.2, §5)

::::claim[Run every proof in a document → not one claim's mark changes. A proof passing is evidence, never a signature: the mark still waits for a person.]{id=c6 state=met by=systemview-test|you at=1793017353142 note="met and spec'd in two halves, after a blind review caught the first version's non-sequitur. The FIRING table governs what a block ANNOUNCES, so Proofs.resultBlocksNeverAnnounce proves no proof run reaches anybody's feed (all four result kinds absent, claim present, so the absence is a decision rather than an empty table) — it does NOT prove no write. The write half is asserted where a write would come from: CmdBlock.test's 'running a proof writes NOTHING into the document' runs a proof to its exit, pass AND fail, with a write door in scope, and watches setAttr stay unused. The markBlock phrase in the statement is asserted by neither and is the one clause carried on this note alone." told=systemview-test}
The FIRING table's own words — result blocks write nothing, so no proof run can mark anything:
:::cmd
grep -n "Result blocks" -A 1 ~/autobot/electron/markdown/blocks.cjs
:::

One decision, two halves of evidence — because a mark can move by being announced or by being
written, and a check on one is blind to the other.

**The announcement half.** What it asks: is a proof's result in the list of things that get
announced to a document's audience? It is not, and the list has claims in it, so the absence is a
decision rather than an empty table. **If it stopped holding,** pressing a command would notify
everybody on a document that something had been decided.
::test[SystemViewCore.Proofs.resultBlocksNeverAnnounce]{project=systemview-test}

**The writing half — and this is the one that actually defends the claim.** What it asks: run a
proof all the way to its exit code, passing and failing, with the document's write door open, and
watch nothing get written. The announcement check above cannot see a write; this can.
**If it stopped holding,** a command exiting zero would mark the claim, and the document's progress
toward *built* would be decided by a shell exit instead of by a person.
:::cmd
CI=true npx react-scripts test --watchAll=false --testPathPattern "blocks/CmdBlock.test" 2>&1 | tail -4
:::
::test[SystemViewCore.Window.liveCmdInTheFold]{project=systemview-test}
::::

:::claim[Where two people have signed a claim, both signatures stay — a second reviewer adds a name and moves nothing else, one person stepping off leaves the other's standing, and changing your answer stashes the old one rather than erasing it.]{id=c6b state=met by=systemview-test|you at=1793017353142 note="met and spec'd: three named cases in Window.claimRow — countersigning adds a name and moves nothing else, one signer stepping off leaves the other's signature standing, and changing an answer stashes the old one. Split out of c6 on a blind review's recommendation: c6 is about a MACHINE never marking, this is about two PEOPLE both being recorded, and one spec was carrying both." told=systemview-test}
The stamp under any signed claim here is the probe — look at the names beside the ✓.

**What it asks:** countersigning adds a name and moves nothing else; one person stepping off leaves
the other's signature standing; changing your answer stashes the old one rather than erasing it.
**If it stopped holding,** the second reviewer would overwrite the first, and a document would show
one signature where two people had looked — which is the worst possible failure for a record whose
whole job is saying who agreed.
::test[SystemViewCore.Window.claimRow]{project=systemview-test}
:::

::::claim[Search the document machinery for anything that could run a proof on its own — a timer, a watcher, a scheduler, a poll → there is nothing. A proof runs when a person presses it, and at no other moment.]{id=c7 state=met by=systemview-test|you at=1793017353142 note="met and spec'd, after the claim's own words were narrowed to what is defended. The spec scans every module in the host's document machinery plus documentUpdate.cjs for setInterval, setTimeout, fs.watch, fs.watchFile, a bare watch(, chokidar and cron — seven spellings, where the first version looked for two. The claim used to say 'the shell and the hub': run that grep where it pointed and it does NOT come back none (api/index.js and hostProject.js schedule and watch for their own reasons, CmdBlock polls a run), none of it a proof runner. A spec that redefines its claim's surface is worse than a narrower claim, so the claim is narrower now." told=systemview-test}
Zero hits in the document machinery is the answer:
:::cmd
grep -rn "setInterval\|fs.watch(" ~/autobot/electron/markdown ~/autobot/electron/apps/documentUpdate.cjs || echo "none — a proof runs when somebody presses it"
:::

**What it asks, and the list is the proof.** It scans every module of the host's markdown engine
and the document-update path for seven spellings of "something runs by itself" — `setInterval`,
`setTimeout`, `fs.watch`, `fs.watchFile`, a bare `watch(`, chokidar and cron — and finds none. A
negative is only as strong as what it hunted, so the hunt is written here rather than left in the
method's name. **If it stopped holding,** proofs would start running unattended, and a document's
greens would stop meaning anybody had checked anything.
::test[SystemViewCore.Proofs.noProofRunner]{project=systemview-test}
::::

::::claim[Running a proof must never move a document's met count — only a person's press may do that. So the counter reads signatures and ignores proofs entirely: a claim with a proof and a claim without one count exactly the same.]{id=c8 state=met by=systemview-test|you at=1793017353142 note="met and spec'd: Proofs.countsMarksNotProofs — a proofed and an unproofed claim give identical met and total counts. A third field asserting 'no proof column' was DELETED in reconciliation: it checked for a key nobody ever used while the object right there carries specd and owed, so it asserted the opposite of what the code contains and passed anyway. The reading is narrower since the amendment, which is why c8 stands rather than being retracted." told=systemview-test}
Two documents are the contrast, and you can read both bars yourself. This one: 25 of its 26 claims
hold a proof, and its met count says **24 of 26** — one marked not met, one nobody has marked at
all. RFC-073:
**not one** of its 53 claims holds a proof, and its met count says **36 of 53**. Same arithmetic
both times, because the scan reads colons and marks and nothing else — :file[src/atoms/Markdown/claims.js#L22-27].

:::cmd
cd ~/Systemly/systemview && node -e 'const C=require("./systemview-test/methods/Claims.js");(async()=>{for(const f of ["RFC-075-a-claim-carries-its-proof","RFC-073-a-document-state-lives-in-the-system"]){const b=await C.bar({path:`RFCs/${f}.md`});console.log(f.slice(0,7),"met",b.met+"/"+b.total," proofs",b.specd)}})()'
:::

**What it asks:** hand the real counter two documents identical but for a proof, and get back the
same met and total. **If it stopped holding** — if the counter ever took proofs into account —
pressing a command would quietly advance a document toward *built*, which is the lifecycle moving
because a shell exited zero rather than because anybody agreed. That is the risk this claim exists
to rule out; the arithmetic is just how it is ruled out.
::test[SystemViewCore.Proofs.countsMarksNotProofs]{project=systemview-test}
::::

**The proving ground** (slice 3)

::::claim[The claims in RFC-073 that carry the most weight have their checks written into them — the greps and record-reads that were once described in a note are now blocks you can press, and pressing one re-runs the very check that marked it.]{id=c9 state=met by=systemview-test|you at=1793017353142 note="met. The eight load-bearing claims in RFC-073 were named one by one (c17 c36 c40 c41 c42 c44 c45 c47) and each was found holding a real, runnable block in its own fold — not an empty one. An earlier version counted only the claims that HAD grown a fold, which let the denominator pick itself: un-grow one and the count still agreed with itself. Pressing one is his gesture and was not checked by anything but him." told=systemview-test}
Count the grown fences in RFC-073 — eight:
:::cmd
grep -c "^::::claim" RFCs/RFC-073-a-document-state-lives-in-the-system.md
:::

**What it asks:** take the eight claims in RFC-073 that carry the most weight, by name, and check
each one still holds a real runnable block rather than an empty fold. Named rather than counted,
because counting only the ones that grew a fold lets the question answer itself.
**If it stopped holding,** RFC-073 would look proofed from its bar while its folds had gone hollow,
which is the exact condition this whole design exists to make impossible.
::test[SystemViewCore.Proofs.rfc073ProofsStand]{project=systemview-test}
::::

**The context** (slice 4, commitments 7–8)

::::claim[Ask the store how to leave a proof on a claim → the chapter comes back, and it answers with the sequence in order: check the thing first, then mark it, then write the proof for the person who will doubt the mark later.]{id=c10 state=met by=systemview-test|you at=1793017353142 note="met. The chapter was read for every part the claim promises — the proof section, the approach section, the sequence in order, and all three approach items — and the file sits inside an indexed corpus, because words nothing indexes answer nobody. The old note said retrieval itself could not be reached by a spec; that was wrong twice. A door exists (the shell answers the query at 0.737 on the right chunk), and the structural half needs no store at all — the real chunker says the subject owns one whole chunk under a heading that names it, which is what a query needs to find it." told=systemview-test}
**Ask it yourself** — this is the real retrieval, through the shell's own door, and it is the half
the note used to call unassertable:

:::cmd
cd ~/autobot && node -e 'const{createClient}=require("systemlynx");createClient().loadService("http://localhost:6110/autobotshell/api").then(async s=>{const r=await s.Docs.search({q:"how do I leave a proof on a claim",limit:1});const h=r.hits[0];console.log(h.score, "|", h.source, "|", h.heading.join(" › "))}).catch(e=>console.log("shell down —", e.message))'
:::

**What the first spec asks:** does the chapter still CONTAIN what the claim says it answers with —
the proof section and the approach section by heading, the sequence said in order, and all three
approach items. **If it stopped holding,** `context()` would keep answering and the answer would
have gone hollow.
::test[SystemViewCore.Proofs.chapterAnswersTheProofQuestion]{project=systemview-test}

**What the second spec asks, and it is new because the old note was wrong twice.** It said *"context
has no door a saved spec can call"* — but retrieval has a structural precondition that needs no
store at all: a query reaches a chapter only if the subject owns ONE chunk, under a heading that
names it, inside a corpus root that covers the file. All three are computable from the file by the
**real chunker**, so this rides the change loop. First it checks the file is inside an indexed
corpus — words nothing indexes answer nobody — then that the proof subject is one whole chunk with
the sequence in it. **If it stopped holding,** an edit would split the subject across two chunks and
the question would start returning half an answer, with nothing going red.
::test[SystemViewCore.Retrieval.chunkByHeading]{project=systemview-test}
::::

::::claim[The skill that writes RFCs mentions the proof briefly and points at the chapter for the rest — so there is one description of how to write a proof, not a copy in the skill drifting from the copy in the handbook.]{id=c11 state=met by=systemview-test|you at=1793017353142 note="met and spec'd — and the previous note claimed an assertion about the WRONG FILE (it cited a check on rfc-execution). Proofs.authoringPointsAtTheChapter asserts rfc-authoring itself: the proof line present, a pointer at the chapter, and no second copy of the shapes or the approach in the skill. Two corrections the review earned: the claim's 'ONE line' is really a four-line paragraph, and the shapes TABLE is in this RFC's own 1.4 rather than in the chapter — the chapter carries the shapes in prose, which is what the spec asserts." told=systemview-test}
The one line, in the skill:
:::cmd
grep -n "leave the PROOF" ~/.claude/skills/rfc-authoring/SKILL.md
:::

**What it asks:** read the authoring skill itself and check three things — it mentions the proof, it
points at the chapter, and it does *not* carry a second copy of the shapes or the approach.
**If it stopped holding,** there would be two descriptions of how to write a proof in two places
that nothing compares, which is how six copies of a dead CLI once taught six agents the wrong thing.
::test[SystemViewCore.Proofs.authoringPointsAtTheChapter]{project=systemview-test}
::::

::::claim[The chapter says you may hand proof-writing to another agent, and says what that agent has to be given — the chapter itself, plus the claim's mark and note. It grants permission; it does not prescribe how.]{id=c12 state=met by=systemview-test|you at=1793017353142 note="met and spec'd — and the first version was a single word that matched a HEADING: the entire permission paragraph could have been deleted with the spec still green. Proofs.chapterPermitsADelegatedProof now asserts the three things the claim says: 'Proof-writing may be delegated; verification may not', the brief (the claim, its mark, its note, this section), and 'never tools alone' — plus permitted-never-required, which is what makes it permission rather than procedure." told=systemview-test}
The permission and the brief, in the chapter:
:::cmd
grep -n "delegated" docs/how-we-work/rfcs.md
:::

**What it asks:** that the permission is really in the chapter as a paragraph — the delegation
allowed, and the brief it requires — rather than a word that happens to appear in a heading.
**If it stopped holding,** an agent would hand a proof to a subagent with tools and no doctrine,
which produces a green it cannot account for.
::test[SystemViewCore.Proofs.chapterPermitsADelegatedProof]{project=systemview-test}
::::

::::claim[There is a skill for building an approved RFC, and its steps are the ones this design commits to — read the verdict first, land the slices in the RFC's own order, walk every claim and mark it, and finish by writing the dated status line.]{id=c13 state=met by=systemview-test|you at=1793017353142 note="met and spec'd: Proofs.executionSkillWalksAnRfc asserts the procedure by heading — the verdict gate, the slices in the RFC's order, the claims walk with marks, closing with STATUS. Four headings the first version never checked while asserting only that the file was non-empty, which is the defect a blind review found. Split from the tracked-run half on the same review's recommendation: a document on disk and a run record are different things and one spec was carrying both." told=systemview-test}
The skill on disk, its trigger naming execution and refusing authoring:
:::cmd
sed -n 1,3p ~/.claude/skills/rfc-execution/SKILL.md
:::

**What it asks:** the four steps the claim names are really in the skill, by heading — not that the
file exists and is long, which is what the first version of this spec checked while reading green.
**If it stopped holding,** the skill would still fire and still look followed, and an RFC would get
built in whatever order the agent felt like, with the claims walk quietly dropped.
::test[SystemViewCore.Proofs.executionSkillWalksAnRfc]{project=systemview-test}
::::

::::claim[Run that skill → it opens one tracked run under its own name, so afterwards there is a record on disk saying the procedure was followed rather than just chosen. This document's own claims walk is one of those records.]{id=c13b state=met by=systemview-test|you at=1793017353142 note="met. Checked by looking before opening one: zero runs sourced skill:rfc-execution existed on disk while this claim already read met — which is exactly the hole the whole doctrine is about. This document's walk is now one of them. The Skill tool proves a skill was chosen; only the sourced run proves it was followed." told=systemview-test}
The records themselves. Press this and it reads the real worklists directory — including, if you
are reading this while I am still walking the document, the run doing it, stopped on whichever item
it is on:
:::run{title="The skill leaves a record on disk: at least one run sourced skill:rfc-execution, at least one of them driven all the way to done"}
- SystemViewCore.Runs.sourced({ "source": "skill:rfc-execution" }){title="every run record carrying this skill's own name, with how far each got and where it stopped"}
  - results.count >= 1
  - results.closedCount >= 1
:::

**What it asks:** is there a run record on disk carrying this skill's own name — because the Skill
tool only proves the skill was *chosen*, and a procedure chosen and abandoned at step one is
indistinguishable from one followed to the end unless the list is there to look at.
**If it stopped holding,** "built by the skill" would be the agent's word for it and nothing else,
which is the weakest evidence this system accepts.
::::

**The nudge pair** (slice 5, at the back)

::::claim[An agent that goes quiet with a procedure half-finished gets woken and pointed back at it — and the message tells it which procedure, which step it stopped on, and how far it got. The count of wakings is kept with the record, and any movement resets it.]{id=c14 state=met by=systemview-test|you at=1793017346091 note="met and spec'd, both halves. Proofs.nudgeSelectsAndNames drives the real selector (an open run selected, the message naming the source, the item left active and 4/6, saying it is not from the human, carrying WORK TO COMPLETION; a closed run, a quiet below the floor and the knob off each selecting nothing) and then the half no spec touched before: the count lives on the run record and MOVEMENT RESETS IT, proven by nudging a run and moving its list in a scratch worklists directory — never his live store. Also verified live 2026-10-26 across four real nudges." told=systemview-test}
The real proof arrived on its own, four times over. The mechanism is :file[electron/agents/nudge.cjs#L1-30]{project=autobot} — and the re-check, for the code-side reader:
:::cmd
cd ~/autobot && node tests/nudge.js | tail -2
:::

**What it asks:** given a quiet session with a half-finished procedure, does the picker find that
procedure — and does the message it builds name the procedure, the step left open, and the progress?
**If it stopped holding,** a procedure would die half-done in silence, which is the one failure the
whole run record exists to make impossible.
::test[SystemViewCore.Proofs.nudgeSelectsAndNames]{project=systemview-test}
::::

::::claim[The waking was supposed to stop after a set number of tries. It does not — and that is the answer: nothing stops it but finishing the work, or saying out loud that it is abandoned and leaving an account of why.]{id=c14b state=met by=you at=1793096923194 note="NOT MET, and the valuable outcome — now with a living spec of what happens INSTEAD. Proofs.nudgeNeverGivesUp asserts the law that replaced it: the first nudge is 1 of 3, the third is the FINAL NOTICE, past the cap the position WRAPS, an ordinary nudge never mentions the exit, and neither the declared word alone nor the attached report alone excuses a run. A blind review caught that all of this was arithmetic on cycleOf, which structurally cannot see a stop — so the selector is asserted too: pickNudge with a count of 9 still returns the run, which is the field that would go red if the give-up were ever put back. The knob at zero is the one real stop, and it is now written down. Kept rather than rewritten because the mark it carried was TRUE when made; a claim that went false while nobody was asking is this document's own argument for 1.5." told=systemview-test unmetBy=systemview-test}
The old law and the new one, in the same file — the selector no longer stops on a count:
:::cmd
cd ~/autobot && grep -n "THE COUNT NEVER STOPS THE NUDGING" -A 3 electron/agents/nudge.cjs
:::

**What it asks:** push a run past the old cap and see what happens — the cycle wraps and keeps
going; and check that neither saying "abandoned" nor filing a report is enough on its own to stop
it. **If it stopped holding** — if the cap came back — an agent could outlast the system by waiting,
and the cheapest way to finish a procedure would be to ignore it. This is the one claim in this
document marked **not met**, and the spec defends what happens *instead* of what was promised.
::test[SystemViewCore.Proofs.nudgeNeverGivesUp]{project=systemview-test}
::::

::::claim[The settings cog beside the worklist opens real controls for the waking — how long quiet counts as idle, and whether it is on at all — instead of the placeholder that used to say there was no door yet.]{id=c15 state=met by=systemview-test|you at=1793017346091 note="met and spec'd in two halves, because a registered IPC channel is not a rendered cog and the first version only had the channel. Proofs.nudgeSettingsDoor asserts the knobs' contract (defaults with no file at all, every knob defaulted, garbage falling back, a round-trip through a SCRATCH file so the spec never edits the settings his own sessions are nudged by) and the shell's door answering with nudgePicks. Window.nudgeCog wires the fourteen-case suite that renders the knobs — which was addressed by NOTHING until the review found it — including the line the claim was written against: it says plainly when there is no door rather than inventing a state." told=systemview-test}
Eyes: the cog at the right end of the band tab row — open it, the knobs are live. The door it writes through:
:::cmd
grep -n "nudge:settings" ~/autobot/electron/apps/files-host.cjs
:::

**What the first one asks:** do the controls actually save and come back — written and re-read
through a scratch file, never your real settings, so running the proof cannot change your window.
**If it stopped holding,** the knobs would look live and change nothing.
::test[SystemViewCore.Proofs.nudgeSettingsDoor]{project=systemview-test}

**What the second one asks, and it is a different thing:** does the cog RENDER the controls? A
working door behind the scenes is not a control on screen. Fourteen cases cover the knobs drawing,
and the line shown when there genuinely is no door.
**If it stopped holding,** the door would work and nobody could reach it.
::test[SystemViewCore.Window.nudgeCog]{project=systemview-test}
::::

**The amendment's claims** (§1.5, added 2026-10-26 — the declaration and what it derives)

::::claim[Write a claim and say nothing about what kind it is → it is treated as behaviour and owes a durable check. Say in so many words that a person's own eye concludes it → that is the one and only excuse, and silence never buys it.]{id=c16 state=met by=systemview-test|you at=1793063000000 note="met and spec'd: Proofs.claimKind — absence reads behavioural, four spellings exempt, case and space tolerated, and the TYPO case pinned (kind=experential must not buy an exemption); then the consequence, that a marked behavioural claim with no spec is owed, an experiential one never is, and an unmarked one is asked for nothing yet." told=systemview-test}
The rule is one function, and the strict default is the whole point — :file[src/atoms/Markdown/claims.js#L43-L70].

Supplement — a pass means absence reads behavioural and only the written word exempts:
:::cmd
CI=true npx react-scripts test --watchAll=false --testPathPattern "Markdown/claims.test" 2>&1 | tail -4
:::

**What it asks:** hand the real reader every spelling that should excuse a claim and every one
that should not — including a typo of the magic word, which must NOT excuse it — and check that
saying nothing comes back as behaviour every time.
**If it stopped holding,** the exemption would widen by accident, and an agent facing a check it
would rather not write would discover the claim had always been one somebody just looks at.
::test[SystemViewCore.Proofs.claimKind]{project=systemview-test}
::::

::::claim[A claim counts as defended when its fold holds a real saved test or a run — not when it holds a shell command, and not when it merely quotes one inside a code example. Showing what a test looks like is not having one.]{id=c17 state=met by=systemview-test|you at=1793063000000 note="met and spec'd: Proofs.specDetection — ::test and :::run count, a cmd and prose do not, a leaf carries none by construction, a FENCED example cannot fake one, and the body walk still finds a spec past a longer inner fence. The exclusion of :::cmd stays deliberate: a cmd running the suite and a cmd running grep are indistinguishable at parse level, and a heuristic behind a lifecycle gate is worse than an honest absence." told=systemview-test}
The walk and the deliberate exclusion of `:::cmd` — :file[src/atoms/Markdown/claims.js#L72-L108].

RFC-073 is this law standing in the world, and it is worth looking at because it looks like a
contradiction. Eight of its claims have grown a fold with a real, pressable command inside — and
its bar reports **0 defended out of 53**. Press those commands; they are useful. They are just not
proof, and the bar refuses to say they are:

:::cmd
cd ~/Systemly/systemview && node -e 'const C=require("./systemview-test/methods/Claims.js");const fs=require("fs");const f="RFCs/RFC-073-a-document-state-lives-in-the-system.md";(async()=>{const b=await C.bar({path:f});const grown=(fs.readFileSync(f,"utf8").match(/^::::claim/gm)||[]).length;console.log(grown,"folds holding a pressable command |",b.specd,"of",b.total,"defended")})()'
:::

**What it asks:** put each kind of block in a fold and ask the real reader whether the claim is
defended — a saved test counts, a run counts, a shell command does not, and a code example that
merely shows a test does not. **If it stopped holding,** a document could reach "fully defended" by
quoting examples of tests, and the bar would be counting prose.
::test[SystemViewCore.Proofs.specDetection]{project=systemview-test}
::::

:::claim[The bar at the top of a document says how many claims are defended out of the ones that OWE a defence — never out of all of them, because a claim a person concludes by eye is not a shortfall — and it says how many are owed. None of that moves the met count.]{id=c18 state=met by=systemview-test|you at=1793063000000 note="met and spec'd three ways: Proofs.barAxes pins the arithmetic on a fixture (spec'd over the BEHAVIOURAL count and never the total, met untouched, owed only where marked, behavioural and unspec'd), Window.claimRow now pins what a reader SEES — 1/2 spec'd and 1 owed drawn on a mixed document, no owed tag at all when nothing is owed, reviewed still beside them — which nothing asserted before the review asked, and Proofs.rfc075OwesNothing asserts THIS document owes nothing AND that every namespace it names resolves to a spec on disk, because hasSpec is structural and 21/21 was otherwise reachable with 21 fabricated names. The bar read 0/15 the night the amendment landed." told=systemview-test}
**The bar on this document is the probe — look up.**

**What the first spec asks:** that the fraction is over the claims that owe a defence rather than
over all of them, that owed is counted and reported, and that none of it touches the met count.
**If it stopped holding,** a document full of by-eye claims would read as badly defended, and the
honest answer would start looking like a failure.
::test[SystemViewCore.Proofs.barAxes]{project=systemview-test}

**What the second one asks, about THIS document:** that nothing here is owed — every claim that
promises behaviour and carries a mark also carries a defence, and the namespaces it points at are
real files on disk. **If it stopped holding,** this document would be making the exact argument it
fails to live up to, and the failure would name the claim.
::test[SystemViewCore.Proofs.rfc075OwesNothing]{project=systemview-test}
:::

::::claim[Mark a claim that promises behaviour and has nothing durable behind it → its own row says so, out loud, where you read it. A claim a person concludes by eye says that instead and is never asked for more. And a claim nobody has marked yet is asked for nothing.]{id=c19 state=met by=systemview-test|you at=1793063000000 note="met and spec'd: Window.claimRow pins all four rows by name — 'no spec' on an undefended behavioural claim, silence when the fold carries one, 'by eye' on an experiential claim, and nothing asked of an unmarked claim — plus the clause that was half-covered until the review named it: 'by eye' rides the KIND ALONE, so an experiential claim nobody has marked still says it. Three of the five are absence checks, which is worth knowing: delete the badge feature and they would go green; the two positive ones are what catch that." told=systemview-test}
Read it off your own window. The badge that matters here is the positive one — the *by eye* tag
drawn on cTRY above, which nobody has marked and which still says it, because the tag rides the
kind alone. And nothing in this document says *no spec*, because nothing here is owed; the bar at
the top says the same thing from the file's side.
:::run{title="The by-eye tag is really drawn — on the hardest case, a claim nobody has marked — and no row here says 'no spec'"}
- AutobotShell.Window.count({ "selector": ".md-claim__kind" }){title="by-eye tags on screen — one, on cTRY, which carries no mark at all"}
  - results.found = 1
- AutobotShell.Window.count({ "selector": ".md-claim__owed" }){title="'no spec' tags on screen — none, because every behavioural claim here carries a defence"}
  - results.found = 0
:::

**What the saved spec asks:** four rows, by name — the marked claim with nothing behind it saying
so, the by-eye claim saying that instead, and the unmarked claim asked for nothing. Three of its
five cases are absence checks, so the two positive ones and the window read above are what would
catch the tag being deleted.
**If it stopped holding,** the shortfall would live only in the bar's total, and you would have to
count to find out which claim was undefended.
::test[SystemViewCore.Window.claimRow]{project=systemview-test}
::::

::::claim[Ask the store about the proof doctrine → the chapter answers with both obligations, who writes the durable half, which block to reach for and why it matters, and how to get a real door onto the thing being claimed.]{id=c20 state=met by=systemview-test|you at=1793063000000 note="met and spec'd: Proofs.doctrineReachesBothReaders asserts the four doctrine sections by heading, the change-loop consequence, 'living spec' said out loud, the route to a live door, the second-opinion chapter with disagreement-is-the-product, and the corpus covering the file — words nothing indexes answer nobody. Split from the no-duplication half on a blind review's recommendation; that half is now c20b and carries its own assertions." told=systemview-test}
**Ask it yourself** — and this is the real query, through the shell's own door, answering from the
corpus rather than from this document:
:::cmd
cd ~/autobot && node -e 'const{createClient}=require("systemlynx");createClient().loadService("http://localhost:6110/autobotshell/api").then(async s=>{const r=await s.Docs.search({q:"what does a proof owe — the two obligations",limit:2});r.hits.forEach(h=>console.log(h.score,"|",h.heading.join(" › ")))}).catch(e=>console.log("shell down —",e.message))'
:::

**What it asks:** that all four doctrine sections are really in the chapter by heading, that the
reason one block beats the other is stated rather than implied, that the route to a live door is
written down, and that the file sits inside an indexed corpus.
**If it stopped holding,** `context()` would keep answering the question and the answer would have
gone hollow — the worst failure a handbook has, because retrieval still succeeds.
::test[SystemViewCore.Proofs.doctrineReachesBothReaders]{project=systemview-test}
::::

::::claim[There is ONE description of how to write a proof. The building skill carries the paragraph that decides which block to reach for and no copy of the rest — so the handbook and the skill cannot drift apart, because there is nothing to drift.]{id=c20b state=met by=systemview-test|you at=1793063000000 note="met and spec'd by the run below, which calls the same method as c20 and asserts only the two fields this claim owns: the skill carries the deciding paragraph, and it points rather than restating — no routes heading of its own, no second copy of the shapes. Asserted rather than trusted because a copy pasted into the skill reads perfectly well; nothing about a duplicate looks wrong on the page." told=systemview-test}
Press it. The same method c20 calls, asked only the two questions this claim is about:
:::run{title="One definition, not two: the skill carries the deciding paragraph, and carries no copy of the rest"}
- SystemViewCore.Proofs.doctrineReachesBothReaders(){title="read the chapter and the building skill side by side, and report what each one carries"}
  - results.executionCarriesTheDecidingParagraph = true
  - results.theSkillPointsRatherThanRestates = true
:::

**What it asks:** that the deciding paragraph is in the skill where an agent building an RFC will
meet it, and that the skill has no second copy of the rest — no routes heading of its own, no
restatement of the shapes.
**If it stopped holding,** there would be two doctrines in two files that nothing compares, and the
one an agent happened to load would win. A copy pasted into the skill reads perfectly well, which is
exactly why this is checked instead of trusted.
::::

**The sweep, 2026-10-27 — one pass over every claim instead of one conversation per claim.** Nine
rules had come out of his threads and only c1 had been reworked against them. In one pass: four
claims that each decided two things became eight (c1/c1b, c6/c6b, c13/c13b, c20/c20b), so the set
went 22 → 26; three claims that had no pressable or visible half got one; and c8's half was found to
be **lying** — it read *"15/15, every claim proofed"* and called RFC-073's eight command folds
*"proofed"* when the bar says **0**, because a `:::cmd` is not a proof by c17's own law. c2 was the
sharpest: the claim that says *press the command inside the fold* was sending you to c14's fold, so
it now holds its own — press it twice and the clock moves, which is the whole claim in English.
Along the way c1's spec stopped grading itself (three self-computed booleans became the data, with
the count hard-coded and the broken list asserted empty), the run grammar learned `>=` and `<=`, and
a new test reads every inline run block in this file to check it parses whole: nine steps, zero
dropped assertions, every step carrying a sentence rather than a call signature.

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
outright in the chapter. **And its last recommendation is now done:** c6, c13 and c20 each decided
two things, and each is two claims — c6/c6b (a machine never marks · two people both stay recorded),
c13/c13b (the skill carries the procedure · running it leaves a record), c20/c20b (the chapter
answers · there is only one answer). c1 went the same way for the same reason, unprompted: its
second sentence was a migration check about two other documents. One decision per claim, and each
half now carries its own evidence instead of sharing one chip between two arguments.

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

**Nothing here is out of reach.** Every claim carries a defence, and "unassertable" turned out to
mean the first tool reached for did not fit — retrieval has a precondition the real chunker answers
from the file, and a gesture no suite can render is performed on a disposable claim in c4's own
fold.

**A mark that went false while nobody was asking** — c14 said the nudge *"gives up at its cap"*.
That stopped being true on 2026-10-26, when the nudge cycle was rebuilt: reaching the cap is now
the cycle's FINAL NOTICE, the count wraps, and nudging continues until the run closes or is
declared abandoned with its account attached. c14 is left exactly as it was marked — the statement
was true when made, and where a claim went stale is the record — and this paragraph is its
supersession. **It is also §1.5's argument, demonstrated on this document**: c14's proof was a
note, nothing addressable ran, so the claim read `met` for hours after it became false. A spec
would have gone red in the change loop that rebuilt it.

:::approval{ask="Is this the complete list of claims for RFC-075?" verdict=approved told=systemview-test}
Pressing this makes the list the contract. A behaviour missing from it is one we agreed not to
check — so the thing to read for is what is NOT here.
:::

## STATUS — built 2026-10-26, swept 2026-10-27 · claims 26/26 met, 25/25 spec'd, 0 owed

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
loop runs. That is repaired. The bar reads **25/25 spec'd, 0 owed**, and the specs are real: 25
namespaces named from this file, every one resolving to a saved SystemLynx spec on `SystemViewCore`
(`Proofs.*`, `Window.*`, `Retrieval.*`), addressable as
`runTests({projectCode: "systemview-test", namespace: "Proofs"})` from any chat, by any agent,
without opening this file — plus four claims defended by a `:::run` that lives in the document and
calls a live door, whose resolution is checked by running it.

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

**The uncomfortable one got his press rather than my argument.** c14b read **unmet** for a day: its
living spec defends the law that *replaced* its statement, so the spec'd count included a spec
proving its own claim false. He marked it **met** himself — the signature is `by=you` — which is the
mechanism working exactly as designed, because a machine was never going to resolve that one. The
DOCTRINE question it exposed is untouched and still open: the third axis counts a refutation as a
defence, and nothing in the bar can tell the difference.

**One claim here is narrower than it looks, and it says so on its own line rather than in a
footnote down here.** `Markdown.js` cannot be mounted — its renderer is ESM — so c4 defends the
REWRITE and not the right-click that triggers it. The gesture is on the board as work, with a
disposable claim in the document to try it on. (The retrieval half of c10 used to be listed here as
unreachable; it was wrong twice over, and c10 now carries both a live query and a structural spec
the change loop runs.)

**His, still:** the claims-completeness press under the list (never pressed, which is why the
statements and notes above were legitimately corrected rather than frozen), and the splits both
reviews recommend for c1, c2, c6, c13, c14, c18 and c20.
