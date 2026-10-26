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

### 1.5 · A failing proof on a met claim is a finding

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

::::thread{id=t2}
::claims
:::reply{author=you ts=1793043214736 told=systemview-test}
It says... 15 out of 15 met. Two out of 15 reviewed. But I had accidentally removed your mat from the first one or before previously when your me saying unmet removed your stuff and your badge is still not there. one. So, 15 of 15 met if your badge isn't even showing.
:::
:::reply{author=systemview-test ts=1793043533929 told=systemview-test}
The count never lied, but it was counting the thing you suspected: met counts MARKS, and c1 was met on YOUR signature alone — mine was the one your old unmet-press erased, back before the stash fix landed. That erasure class is dead now (a flip stashes signatures and they return with the state), and I have just restored mine on c1 beside yours: by=systemview-test|you, both badges filled. 15/15 met stands, and reviewed now reads 2/15 honestly — c1 and c3 carry both names.
:::
::::


Each one is *do this → this should happen*, grouped by where you stand when you check it.

**In the window — the claim and its fold** (slices 1, 2)

::::claim[Wrap a marked claim as `:::claim` with a `:::cmd` child → it renders as the same one-line claim row, folded, with `proof ▸`. The 56 leaf claims render exactly as before.]{id=c1 note="container claim renders as the same one-line row with proof ▸, fold holds the children, leaves untouched — Claim.test.js 13 green incl. 4 container cases; the label is lifted from the body in BOTH parsers (markdown-parse 12)" told=systemview-test state=met by=systemview-test|you at=1793042280716}
What you saw when it first opened — this very list, c1's fold expanded in your pane, the live command inside:

::file[RFCs/proofs/rfc-075-the-fold-open-in-his-pane.png]

And the moment-proof above can rot; the re-check cannot — the render is pinned, for whoever is inside the code:
:::cmd
CI=true npx react-scripts test --watchAll=false --testPathPattern "blocks/Claim.test" 2>&1 | tail -4
:::
::::

::::thread{id=t1 sent=systemview-test:17pdfej}
:::claim[Expand the fold and press the `:::cmd` → it runs where it stands and keeps its exit and output in the fold — the live block, not a quotation.]{id=c2 state=met by=systemview-test at=1793037767715 note="the fold renders children through the registry, so a :::cmd inside is the live CmdBlock, not a quotation (render test asserts the child mounts on expand); press/run/result-kept is CmdBlock's own pinned behaviour" told=systemview-test}
The "run" is your press: expand c14's *proof ▸* below and press its command — it runs in the fold, exit and output kept there, this document otherwise untouched.
:::
:::reply{author=you ts=1793042447861 told=systemview-test}
When you say the live block is... That is a live block. Is it supposed to survive? Um, the expanding and expanding the proof section because it doesn't. But I mean, I'm only asking if you're suggesting that because it doesn't, but it works just like the, Command blocks have works, you know But if and also I also wonder if we're cleaning up these sub processes
:::
:::reply{author=systemview-test ts=1793044439449 told=systemview-test}
You caught a real defect, and it is fixed: the fold used to UNMOUNT its children on collapse, so the cmd's result (and its view of a run still going) died while the process lived on. Now the fold is a curtain, not a teardown — the children stay mounted, hidden; exit, output and an in-flight run all survive collapsing and re-expanding, same as cmd blocks behave everywhere else. On the subprocess half: the process itself was never at risk — cmd runs through the terminal seam, where navigating away lets the VIEW go, never the run, and the hub reaps it when the command exits. The bad combination was the view forgetting a run that was still alive; that is the part that is gone.
:::
::::


:::::thread{id=t3 sent=systemview-test:w63di}
::::claim[Mark a container claim from the document → the same `state= by= at=` land on its OPENING line, and the mark fires to the document's audience exactly as a leaf claim's does.]{id=c3 told=systemview-test state=met by=systemview-test at=1793019616186 note="markdown-fires 17: a container claim fires 'c2 met — <statement>' off its opening line to its audience; the window press writes state= by= at= to that same line (Claim.test container-mark case)"}
The fire reads the mark off the opening line's attributes for EITHER kind — one table entry, :file[electron/markdown/blocks.cjs#L64-69]{project=autobot}, no second path for containers.

Supplement, for the code-side reader — the suite holding the container fire case. A pass means: a claim that has grown a proof body still marks and announces exactly like a bare one — the mark on its opening line, the fire to the document's audience, no second path:
:::cmd
cd ~/autobot && node tests/markdown-fires.js | tail -2
:::
::::
:::reply{author=you ts=1793046448786 told=systemview-test}
I'm not sure what this is testing. I just run command line and it passes. Okay. So...
:::
:::reply{author=systemview-test ts=1793047126070 told=systemview-test}
Fair hit — the command passed without saying what passed, which is a proof failing its reader; I've put the missing sentence above it. What c3 pins: a claim that has grown a proof body is still ONE claim — your ✓ writes `state= by= at=` onto its opening line (never into the body), and the mark announces to the document's audience off that same line. The way this could have been wrong: a second code path for container claims that writes or fires differently. The suite you ran holds the host half of that promise — "all green" includes the case where a container claim's mark fires `met — <statement>` to the audience. The half you can see without any suite: you have been pressing ✓ on claims in this document all day, most of them containers, and every press landed on the opening line and reached me as an update row. That is the claim, observed live — the command is only the re-check that survives after we stop looking.
:::
:::::


::::claim[Right-click a leaf claim → *add a proof* → the leaf is rewritten as its container form with an empty body; the statement and any existing mark survive verbatim.]{id=c4 state=met by=systemview-test at=1793017353142 note="growProof rewrites ::claim → :::claim in place — statement and mark survive verbatim, fence lands under an empty body; refuses containers/non-claims (claims.test); wired as right-click → Add a proof on leaf claims only" told=systemview-test}
Try it: right-click any leaf claim in RFC-073 — 47 of them still have no proof — pick *Add a proof*, and watch the line grow its fences around an empty body, statement and mark untouched. The whole rewrite is ten lines — :file[src/atoms/Markdown/claims.js#L94-103].

Supplement — the cases pinned:
:::cmd
CI=true npx react-scripts test --watchAll=false --testPathPattern "Markdown/claims.test" 2>&1 | tail -4
:::
::::

::::claim[Open a registered document → its `::rfc`/`::arc`/`::report`/`::gap` leaf renders the kind's lifecycle with the document's current state lit, read from the registry — no longer a bare label.]{id=c5 state=met by=systemview-test at=1793017353142 note="LifecycleTrail reads documentsRegistry and lights the current station; no row → no trail, rejected → draft›rejected (lifecycle.test 6 green); in the window it rides bundle main.f2d26ee0 — not yet eyeballed live" told=systemview-test}
The leaf at the top of THIS document is the probe — *built* is lit. The registry state it reads:
:::cmd
node -e "const r=JSON.parse(require('fs').readFileSync(process.env.HOME+'/.autobot/documents.json'));console.log(JSON.stringify(r.find(d=>d.id==='RFC-075').state))"
:::
::::

**The guards — what a proof can never do** (§1.2, §5)

::::claim[Run every proof in a document → no `state=` changes anywhere. A proof passing is evidence; the mark still takes a press or a noted `markBlock`. Two signatures stay two.]{id=c6 state=met by=systemview-test at=1793017353142 note="proof blocks are result blocks: blocks.cjs FIRING carries no cmd/run/test, and none of them writes block attributes — running every proof changes no state= anywhere; the mark still takes a press or a noted markBlock" told=systemview-test}
The FIRING table's own words — result blocks write nothing, so no proof run can mark anything:
:::cmd
grep -n "Result blocks" -A 1 ~/autobot/electron/markdown/blocks.cjs
:::
::::

::::claim[Grep the shell and the hub for a proof runner or scheduler → none. A proof runs only when somebody presses it.]{id=c7 state=met by=systemview-test at=1793017353142 note="grep electron/markdown + documentUpdate for fs.watch/setInterval → none (c47's proof); no runner, no scheduler anywhere — a proof runs on a press" told=systemview-test}
Zero hits in the document machinery is the answer:
:::cmd
grep -rn "setInterval\|fs.watch(" ~/autobot/electron/markdown ~/autobot/electron/apps/documentUpdate.cjs || echo "none — a proof runs when somebody presses it"
:::
::::

:::claim[`::claims` counts marks, not proofs → an unproofed claim counts exactly as a proofed one.]{id=c8 state=met by=systemview-test at=1793017353142 note="claimsOf reads claim lines (2+ colons) and their marks only — proof presence is invisible to the count; claims.test pins a proofed and an unproofed claim counting identically" told=systemview-test}
Look at the bar at the top of this document: 15/15, every claim proofed. Now open RFC-073: its bar counts 8 proofed and 47 unproofed claims identically — there is no proof column anywhere, because the scan reads colons and marks and nothing else — :file[src/atoms/Markdown/claims.js#L22-27].
:::

**The proving ground** (slice 3)

::::claim[RFC-073's load-bearing marked claims carry proofs — the greps and registry reads from their notes written down as result blocks → press one and the check that marked it re-runs where it stands.]{id=c9 state=met by=systemview-test at=1793017353142 note="8 proofs grown on RFC-073 (c17 c36 c40 c41 c42 c44 c45 c47) — every :::cmd run clean before being written down; 3 split told= bags repaired in the same pass" told=systemview-test}
Count the grown fences in RFC-073 — eight:
:::cmd
grep -c "^::::claim" RFCs/RFC-073-a-document-state-lives-in-the-system.md
:::
::::

**The context** (slice 4, commitments 7–8)

::::claim[`context("how do I leave a proof on a claim")` → the claims chapter answers with the sequence (verify → mark → proof written for the human) and the approach (live system as fixture; a claim that resists proving names a missing observable; readable-first).]{id=c10 state=met by=systemview-test at=1793017353142 note="how-we-work re-indexed (15 chunks, no splits); context(“how do I leave a proof on a claim”) answers with the chapter's proof section — verified live after indexing" told=systemview-test}
The chapter section exists where the corpus reads it; the retrieval half is any agent's `context("how do I leave a proof on a claim")` — it answered live after indexing:
:::cmd
grep -n "^## A claim can carry its proof" docs/how-we-work/rfcs.md
:::
::::

::::claim[rfc-authoring teaches the proof in ONE line in §7; the shapes table and the approach live in the chapter, not the skill.]{id=c11 state=met by=systemview-test at=1793017353142 note="rfc-authoring §7 gained one proof paragraph pointing at the chapter and at rfc-execution; the shapes table and approach stayed in the chapter" told=systemview-test}
The one line, in the skill:
:::cmd
grep -n "leave the PROOF" ~/.claude/skills/rfc-authoring/SKILL.md
:::
::::

::::claim[The chapter permits a proof-writing subagent — briefed with the chapter and the claim's mark and note, never tools alone. Permission, not procedure.]{id=c12 state=met by=systemview-test at=1793017353142 note="the chapter's 'A failing proof, and a delegated one' permits the subagent and fixes the brief: claim + mark + note + the approach section + the project's doors, never tools alone" told=systemview-test}
The permission and the brief, in the chapter:
:::cmd
grep -n "delegated" docs/how-we-work/rfcs.md
:::
::::

::::claim[An rfc-execution skill exists: invoke it on an approved RFC → one sourced run (`skill:rfc-execution`) that reads the RFC, lands slices in order, walks the claims with marks, leaves proofs on the load-bearing ones, and closes with STATUS.]{id=c13 state=met by=systemview-test at=1793017353142 note="created through definitions.createSkill (user level, source 'ours'), discoverable in-session with a Do-NOT clause against rfc-authoring; its execution section opens the skill:rfc-execution sourced run — first invocation still pending" told=systemview-test}
The skill on disk, its trigger naming execution and refusing authoring:
:::cmd
sed -n 1,3p ~/.claude/skills/rfc-execution/SKILL.md
:::
::::

**The nudge pair** (slice 5, at the back)

::::claim[autobot's nudge lands from `1e89ca0` → an agent idle on an open sourced run is nudged back to it; the count lives on the run and gives up at its cap; movement resets it. First live check: stop mid-list on a sourced run and watch it arrive.]{id=c14 state=met by=systemview-test at=1793017346091 note="lane 1e89ca0 hand-merged into the tree: nudge.cjs + maybeNudge in sessions.cjs (idle floor, turn push, run.nudged receipt, count on the run, give-up at cap, movement resets) — tests/nudge.js 15 green in the tree — VERIFIED LIVE 2026-10-26: fired at two real runs (skill:job-authoring ×2, skill:nudge-live-check ×2), counts stamped on the run files, give-up and cooldown observed per run, ⏰ receipt rows drawing in his feed with the woken text" told=systemview-test}
The real proof arrives on its own: the first time an agent stalls mid-list on a sourced run, the nudge lands in its chat and the run's row says *nudged ×N*. Until that moment, the mechanism is :file[electron/agents/nudge.cjs#L1-30]{project=autobot} — and the re-check, for the code-side reader:
:::cmd
cd ~/autobot && node tests/nudge.js | tail -2
:::
::::

::::claim[The worklist settings cog shows the nudge door instead of "no nudge door yet".]{id=c15 state=met by=systemview-test at=1793017346091 note="NudgeCog + nudgeSettings brought in from lane/the-worklist-settings-cog; the door (nudge:settings IPC) now exists in files-host so the cog renders the knobs, not 'no nudge door yet' — 14 tests green; live eyeball waits on the bundle swap + shell restart" told=systemview-test}
Eyes: the cog at the right end of the band tab row — open it, the knobs are live. The door it writes through:
:::cmd
grep -n "nudge:settings" ~/autobot/electron/apps/files-host.cjs
:::
::::

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
