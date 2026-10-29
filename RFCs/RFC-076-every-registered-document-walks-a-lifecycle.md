# RFC-076 — Every registered document walks a lifecycle, and nothing but a hand moves it

::rfc{id=RFC-076}

::members{who=systemview-test sent=systemview-test:1w73fns}

::claims

The argument is settled and it is not in this file: it is in
::file[meetings/2026-10-27-the-lifecycle-of-every-kind-we-register.md], written with him over a
night of threads. **This RFC is the implementation** — what is stored, what is derived, which
function changes, and in what order it lands. The state tables below are **verbatim from that
document**, because they are the decision and re-typing a decision is how two versions of it start.

## The problem, as what it costs now

**A document's state is derived by a function that can only see one document, and three of the four
kinds now need to see more than one.** That is the cost, and everything below follows from it.

Measured in `autobot/electron/markdown/blocks.cjs` today:

- **`deriveState` reads `approvals[0]`** — the FIRST approval block and no other. An RFC with a
  design approval and a claims-completeness approval reads its verdict off whichever happens to be
  first in the file. RFC-075 carries two. This is not a preference being changed; it is a defect.
- **An arc is done when every `::objective` carries `state=done`** — a flag an agent writes by hand.
  Nothing anywhere knows which plan serves which objective, so "the arc is finished" rests on
  somebody remembering to tick a box in the arc's own file.
- **`LIFECYCLE` holds four windows** — `arc: 30`, `rfc: 30`, `gap: 14`, `report: 7` — under a comment
  that says they are *"days a completed document stays findable in the lists before the sweep writes
  `retired`"*. **Nothing imports `LIFECYCLE`.** The sweep that comment describes does not exist, and
  under this design it must never exist: a timer that retires a document is a decision nobody made,
  attributed to nobody, with no reason attached.
- **A gap is resolved because its leaf says so.** `resolved=` is a declaration with nothing behind
  it, which makes the one state in the system that should be the hardest to claim the easiest.

The cost is not that these are missing features. It is that **the surfaces built on them tell you
things that are not true** — a drawer counting an arc as done when half of it was never designed, a
gap closed by assertion, an RFC reading approved off one block while another waits.

**And this section arbitrates.** Where a slice can be built two ways, the question is: *does it make
a surface able to say something the documents do not support?* The answer that cannot is the one to
build, even when it is the slower one. That is the rule §4 is decided by.

## 1 · What is stored, and what is derived

**Stored** — attributes on the registration leaf, written by a press or a hand:

```
::rfc{id=RFC-076 arc=ARC-004-O2 settled=2026-10-28 retired=2026-10-28 as=superseded supersededBy=RFC-081}
::arc{id=ARC-004 retired=2026-10-28 as=shelf}
::gap{id=G-12 resolved=2026-10-28 rejected=2026-10-28 why=wontfix retired=2026-10-28 as=out-of-service}
::report{id=some-id as=planning retain=14d retired=2026-10-28}
```

Two attributes are new on every kind and one is overloaded:

- **`as=`** on a retirement is the **reason**, from a CLOSED list: `cancelled`, `superseded`,
  `shelf`, `sideline`, `out of service`. Closed because conditions branch on it — an unrecognised
  reason is a state nothing can read.
- **`as=`** on a `::report` leaf is the **subtype**, from an **OPEN** vocabulary. Nothing branches on
  a subtype; it only picks which fact may end the document, so a closed list there is a vocabulary
  that can never grow by use. **The same attribute name, two opposite rules** — and that is safe
  only because a report's subtype and a report's retirement reason never occupy the same line at the
  same time. **If that is too clever, the alternative is `why=` for the reason**, and this is one of
  the two things §9 asks you to reject.
- **`supersededBy=`** carries the pointer the one reason that needs one.

**Derived** — never written anywhere, recomputed by every parse:

| flag | read from |
|---|---|
| `verdict` | **every** `::approval` block, not the first |
| `approvals` | the count still carrying no verdict |
| `built` | a `## STATUS` heading in the source |
| `objectives` | the `::objective` blocks and their `state=` |
| `plans` | **the registry, not this document** — rows whose leaf carries `arc=<this arc's objective address>` |
| `hasProof` | `:::run` / `:::cmd` / `::test` blocks in the document |

## 2 · The states, verbatim from the plan

### RFC

| state | requires | the conditional logic | what it means |
|---|---|---|---|
| `draft` | verdicts **absent** · retire **absent** | `verdicts approved = false AND retired = false`. Every other condition contains `verdicts approved`, so this one is their complement: it is true exactly when none of them can be | **you never have to undo the states above.** Draft hangs on one artifact, and every state above needs that same artifact present, so pulling the verdicts breaks all of them at once |
| `approved` | verdicts **all present** · claims **not all met** · retire **absent** | `verdicts approved = true AND claims met = false AND retired = false`. Differs from `built` in a single term — flipping `claims met` is the whole distance between them | **the one state that is expensive to get back to.** You must break built and settled while *keeping* the verdicts, so the cheap move is unavailable and you have to un-meet claims specifically |
| `built` | verdicts all present · claims **all met** · co-signatures **not all** · retire **absent** | `verdicts approved = true AND has claims = true AND claims met = true AND co-signed = false AND retired = false`. Differs from `settled` in a single term too — the whole trail from approved up is one flip per rung | backward from settled costs only your own co-signatures. **Forward** costs claims, which may not all be yours — so forward can stop short where backward cannot |
| `settled` | verdicts, claims, co-signatures **all** · retire **absent** | `verdicts approved = true AND has claims = true AND claims met = true AND co-signed = true AND retired = false`. Every term true — there is nothing left to satisfy, which is what the word means | it derives *and* cannot arrive without a human, because a human is always implicitly a reviewer |
| `retired` | retire declaration **present**, carrying a **reason** | `retired = true`. Appears in no other condition, so it is independent of all of them — which is what makes it reachable from any state. The reason qualifies it, it does not gate it: nothing branches on `as=`, so every reason lands on the same boolean | the only state referencing **no other artifact** — which is why it holds from anywhere, and why it is reached by saying so rather than by progressing. **And the reason is what it says instead of a gate** |

### ARC

| state | requires | the conditional logic | what it means |
|---|---|---|---|
| `draft` | verdicts **absent** · retire **absent** | `verdicts approved = false AND retired = false`. The same complement shape as an RFC's draft — every state above it needs the verdicts present | an arc nobody has approved is a proposal. **It does not stop you building** — it stops the record from claiming the direction was agreed |
| `approved` | verdicts **all present** · objectives **not all planned** · retire **absent** | `verdicts approved = true AND every objective planned = false AND retired = false` | the decision is made and the subplans are not all written. This is the state an arc sits in for most of its life |
| `inProgress` | approved · **every objective has a plan** · plans **not all settled** · retire absent | `verdicts approved = true AND has objectives = true AND every objective planned = true AND plans settled = false AND retired = false` | in flight: every objective has somewhere to put its work, and at least one plan is still moving. **the kind where "what you own" bites hardest** — plans usually belong to several agents |
| `settled` | approved · every objective planned · plans **all settled** · retire **absent** | `verdicts approved = true AND has objectives = true AND every objective planned = true AND plans settled = true AND retired = false`. `has objectives = true` is the **floor** — without it an empty arc satisfies everything else vacuously and takes the whole trail for free | every plan is settled, so every objective is complete, so the arc is. **Derived upward and never pressed into place**, which makes it the one state on this kind nothing can fake |
| `retired` | retire declaration **present**, carrying a **reason** | `retired = true`. Shares no term with the states before it | references no other artifact — which is why it holds from any state, including `draft`, where `cancelled` is exactly the right word |

### GAP

| state | requires | the conditional logic | what it means |
|---|---|---|---|
| `open` | resolve **absent** · reject **absent** · retire **absent** | `resolved = false AND rejected = false AND retired = false`. The complement of **both** endings now, not one | where every gap starts |
| `resolved` | resolve **present** · **a proof in the document** · retire absent | `resolved = true AND has proof = true AND retired = false`. The only state in the system whose condition reaches outside the leaf for **evidence** | **the one state a press cannot outrun.** `resolved=` on its own does not reach it — something has to be re-runnable — which makes this the least arguable state on any kind |
| `rejected` | reject **present**, carrying a **reason** · retire absent | `rejected = true AND retired = false`. Shares no term with `resolved`, which is what makes the end of this trail a **fork** rather than a line | declined on purpose. Without the reason it is indistinguishable from a gap nobody looked at, which is the exact failure a gap exists to prevent |
| `retired` | retire declaration **present**, carrying a **reason** | `retired = true`. Shares no term with the states before it | **and this is why it survives here.** A resolved gap carries a proof, so it has become a living spec — something you re-run. Retiring one says the spec stopped being worth re-running. Without the proof there was nothing to retire *from*, which is why `resolved` and `retired` used to read as near-neighbours |

### REPORT

| state | requires | the conditional logic | what it means |
|---|---|---|---|
| `filed` | the file **exists** · retire **absent** | `exists = true AND retired = false`. `exists` is the only term in the whole system that no press can write | existence is the only artifact here that a press cannot write, which is why `filed` is never pressed |
| `retired` | retire declaration **present** — a hand with a reason, **or** the subtype's own timer once `opened` is true | `retired = true`. Shares no term with `filed` | **the one kind where a clock may write the state**, and only because the clock measures your attention: while `opened = false` it never runs at all |

#### The subtype is REQUIRED, and so is the ending

A report leaf declares BOTH or it is not a valid registration (his ruling, 2026-10-29: "there
shouldn't be allowed to not be something, so that they split up properly"):

- **`as=` is required.** The vocabulary stays open — an unknown subtype is accepted — but absence
  is not a subtype. A bare `::report{id=x}` registers wearing `invalid — no subtype`, visibly, in
  the drawer and on the document; it is never lumped under the kind label. Surfaced, not refused:
  a registration that silently failed would be a document the system denies exists.
- **The ending is explicit.** Every report leaf carries `retain=<window>` or `retain=permanent` —
  never blank, and no subtype supplies a silent default. The row for a report that declares
  neither wears `invalid — no retention` the same way. Explicit was chosen over defaults on
  purpose: a default is a decision nobody can see on the document, and the whole point of the
  leaf is that the document says everything true about itself.

#### This section's claims

::::claim[Save a report whose leaf has no as= → its registry row and its document both wear 'invalid — no subtype', and the drawer shows it as invalid instead of silently filing it under the bare kind]{id=c42 state=met by=systemview-test at=1793282419000 note="Seen: autobot's state suite derives invalid='no subtype' onto the row for exactly this leaf; the jest leaf test renders 'invalid — no subtype, no retention' on the document. The drawer chip reads the same state.invalid the row carries — wired, with the row derivation tested" told=systemview-test}
:::cmd
cd /Users/odionedwards/autobot && npm run -s smoke:markdown-state | grep "declares as= and retain="
CI=true npx react-scripts test --watchAll=false --testPathPattern "blocks/Report" 2>&1 | tail -3
:::
::::

::::claim[Save a report whose leaf has as= but no retain= → the same invalid treatment, naming the missing retention]{id=c43 state=met by=systemview-test at=1793282419000 note="Seen: the state suite's same case set derives invalid='no retention' for as= without retain=, both-absences as 'no subtype, no retention', and nothing for a declared leaf — with retain=permanent riding the row as the explicit forever" told=systemview-test}
:::cmd
cd /Users/odionedwards/autobot && npm run -s smoke:markdown-state | grep "declares as= and retain="
:::
::::

::::claim[File a report with a subtype nobody has ever used → it is accepted, and the report still reads filed]{id=c14 state=met by=systemview-test at=1793191085847 note="any subtype is accepted and the report still reads filed — the vocabulary is open because nothing branches on it" told=systemview-test}
:::cmd
cd /Users/odionedwards/autobot && node -e 'const {parse}=require("./electron/markdown/parse.cjs");const {deriveState}=require("./electron/markdown/blocks.cjs");(async()=>{const src="::report{id=r-x as=nonsense}\n";const st=deriveState(await parse(src),"report",src);console.log("accepted, retired:",!!st.retired)})()' 
:::
::::

#### The subtype decides what done means

| `as=` | what it is | what makes it done | its clock |
|---|---|---|---|
| `planning` | a table to argue with — members, threads, replies. **This document** | its conclusions **left it**: it became an RFC, an arc or a spec, and it carries the pointer to what it produced | none. Retiring one with nothing pointed at is the tell that the planning went nowhere |
| `notice` | here is what happened, here is what I found | **you read it** | the natural home for the read-triggered clock |
| `audit` | a count against a tree at one moment — *"67 RFCs, five with a verdict"* | never done. It is **re-run or out of date**, so what it needs that nothing else does is the **command that regenerates it** | none; out-of-date is its state, not its ending |
| `account` | what a job, a lane or a run actually did | filed. **Never edited, only superseded** — amending a record is lying about history | none; it *is* the record |
| `brief` | context handed to another agent | **the recipient acted** — the one report whose state is genuinely per-member rather than per-document | none |
| `spec` | **what something is supposed to do, with runnable evidence** — prose plus `:::run` and `:::cmd` blocks you can press. Often spontaneous: you ask why a thing does not do X, and this is the answer you can re-run yourself | never "done". It is **current** or **drifted**, and the difference is *pressable* rather than asserted, because its proof runs | whatever `retain=` says. **Not permanent by nature** — the subtype only picks a different default |

## 3 · The press, and what each state's control does — verbatim

### RFC

| state | what moves it here — state / trigger | press it — forward / backward | UI facilitation steps, and gates |
|---|---|---|---|
| `draft` | **state** — no `verdict=` anywhere. **trigger** — none; it starts here. What *returns* it: a reviewer clearing their verdict | **▸ forward** — n/a, it is the first state. **▸ backward** — clears every `verdict=` on every approval block | **Under the bar, a step list.** *To reach draft: ☐ clear the 3 verdicts.* That is the only step — your 26 co-signatures and the claim marks **stay**, because neither defines draft. One button: *clear them*. Warning line names whose verdicts they are |
| `approved` | **state** — every approval block carries `verdict=approved`, **and the claims are not yet all met.** **trigger** — a reviewer pressing the last approval | **▸ forward** — nothing it can do alone; a verdict is a signature, with a who and a when. **▸ backward** — clears the co-signatures *and* the claim marks to land here | **Forward:** no step of its own — a pointer, *"3 blocks await a verdict"*, that jumps to the first one. **Backward: a real GATE, and it blocks.** Reaching approved needs the claims **un**-met, and claim marks are the agent's, not yours — so the panel says *"you cannot get here from built"* and names why |
| `built` | **state** — every claim met, at least one claim, **and not every reviewer has co-signed.** **trigger** — an agent marking the last claim | **▸ forward** — **facilitates:** marks met every claim that is yours, then names the ones that are not. **▸ backward** — clears the co-signatures | **Forward:** *☐ mark the 23 claims that are yours* · *3 belong to `<agent>`* — one button does your 23, then the panel says how far that got you. **Backward:** *☐ remove your 26 co-signatures* — that is the whole step to land on built |
| `settled` | **state** — every claim co-signed by every reviewer, **and no `retired=`.** **trigger** — the last reviewer co-signing; always a human hand, because a human is always implicitly a reviewer | **▸ forward** — **facilitates:** checks off all **your** reviews at once. Alone on the document, that settles it. **▸ backward** — removes `retired=` | **Forward:** *☐ check off all 26 of your reviews* — one button, plus *waiting on: `<names>`* listing the reviewers who are not you. **Backward:** *☐ remove `retired=`*. Never offers another reviewer's co-signature as a step |
| `retired` | **state** — `retired=` on the leaf; it outranks everything. **trigger** — a hand, with a reason, and that is the only trigger there is. **No timer moves state on any kind** | **▸ forward** — writes `retired=<date> as=<reason>`, plus `supersededBy=` where the reason needs a pointer. **▸ backward** — n/a, it is the last state; press it again to remove it | **Forward: the reason menu IS the gate, and it replaces the old one.** No confirm dialog — picking the reason is the confirmation, and it says more than a yes ever did. The old gate (*not offered unless settled*) is **gone**: `cancelled` only makes sense for something that was never built, so it has to be pressable from `draft`. What the reason changes is what happens **after** — `cancelled` and `superseded` are **endings** and leave the active lists; `shelf` and `sideline` are **pauses** and stay findable under their own heading, because you intend to come back; `out of service` is the settled ending. **Backward:** *☐ remove `retired=`*, no confirm; rejoining a list costs nothing |

#### This section's claims

::claim[Press forward from built on an RFC whose claims are not all yours → it marks the ones that are yours and names the ones that are not]{id=c20 state=unmet by=systemview-test at=1793191085847 note="no per-claim step list exists at the press — pressing forward from built writes settled or refuses, it never marks your claims or names the others" told=systemview-test}

::::claim[Try to press backward to approved from built → it refuses, and says that the heading cannot be unwritten]{id=c21 state=met by=systemview-test at=1793191085847 note="backward to approved from built refuses and names the STATUS heading a press cannot unwrite" told=systemview-test}
:::cmd
CI=true npx react-scripts test --watchAll=false --testPathPattern="lifecycleState|lifecycle.test"
:::
::::

### ARC

| state | what moves it here — state / trigger | press it — forward / backward | UI facilitation steps, and gates |
|---|---|---|---|
| `draft` | **state** — no `verdict=` on any approval block. **trigger** — none; it starts here. What *returns* it: a reviewer clearing their verdict | **▸ forward** — nothing it can do alone; a verdict is a signature, with a who and a when. **▸ backward** — clears every `verdict=` | **Forward:** a pointer — *"2 blocks await a verdict"* — that jumps to the first one. **Backward:** *☐ clear the 2 verdicts*, with a line naming whose they are |
| `approved` | **state** — every approval carries `verdict=approved`, **and at least one objective has no plan attached.** **trigger** — the last reviewer pressing approve | **▸ forward** — nothing; a plan is a document somebody has to write. **▸ backward** — clears the verdicts | **Forward: the step list is the unplanned objectives** — *☐ O2 and O4 have no plan attached* — each one a jump into `rfc-authoring` with the objective's address already filled in. This is where the strict half bites, and notice what it blocks: not your work, only the arc's claim to be further along than it is |
| `inProgress` | **state** — every objective has at least one plan, and at least one plan is not settled. **trigger** — the last unplanned objective getting its first plan | **▸ forward** — nothing it can do alone; a plan settles inside its own document. **▸ backward** — detaching a plan, which nobody should press as a shortcut | **Forward: no button, because none of the work is here.** *waiting on: RFC-081 (draft) · RFC-084 (built)* — the plans that are not settled, each one a link into the document where the press actually lives |
| `settled` | **state** — every attached plan is settled, so every objective is complete. **trigger** — the last plan settling, in its own document | **▸ forward** — n/a; this state is derived upward and cannot be pressed at all. **▸ backward** — removes `retired=` | **No forward press, and the panel says why:** *"an arc settles when its plans do"*, naming the last plan that closed. Same strength as an RFC's `settled` and for the same reason — there is no hand that can write it directly |
| `retired` | **state** — `retired=` on the leaf. **trigger** — a hand, with a reason. **No timer** | **▸ forward** — writes `retired=<date> as=<reason>`, plus `supersededBy=` where the reason needs a pointer. **▸ backward** — press again to remove it | **Forward: pick the reason, and it is the same list an RFC has** — `cancelled` and `superseded` are endings and leave the active lists, `shelf` and `sideline` are pauses and stay findable, `out of service` is the settled ending. Same list for the same cause: **an arc is a living spec, so it stops being one the same ways an RFC does.** Available from every state, `draft` included — `cancelled` is exactly the word for a direction nobody took. **Still open, and it is in the list at the end:** does retiring an arc retire the plans that serve it? **Backward:** *☐ remove `retired=`* |

#### This section's claims

::claim[Open an arc that has an objective nobody has planned → the panel names that objective, rather than only showing a count]{id=c19 state=unmet by=systemview-test at=1793191085847 note="the row carries planned over total and the trail wears the counts, and nothing NAMES the unplanned objective — the facilitation step list of section 3 is not built" told=systemview-test}

::claim[Press forward on an arc that is already settled → there is no button at all, and the panel says an arc settles when its plans do]{id=c22 state=unmet by=systemview-test at=1793191085847 note="the settled station is still a button on a settled arc — pressing it answers already settled, and the panel explains only through the hover title, not as the claim describes" told=systemview-test}

### GAP

| state | what moves it here — state / trigger | press it — forward / backward | UI facilitation steps, and gates |
|---|---|---|---|
| `open` | **state** — no `resolved=` and no `rejected=` on the leaf. **trigger** — none; it starts here. What *returns* it: the owner un-resolving it, or somebody undoing a rejection | **▸ forward** — n/a, first state. **▸ backward** — removes `resolved=` or `rejected=` | **Backward only, and it names the person:** *☐ remove `resolved=`* / *☐ remove `rejected=`* — each with a line saying **who closed it and when**, since reopening a gap undoes somebody else's fix or reverses somebody's decision |
| `resolved` | **state** — `resolved=` on the leaf, **a proof block in the document**, and no `retired=`. **trigger** — usually the owning project's agent writing it, not the author | **▸ forward** — writes `resolved=`, and **will not land without a proof**. **▸ backward** — removes `retired=` | **Pressing it with no proof does not refuse — it OFFERS one.** *☐ attach a proof: point at the test that closed it · drop a `:::run` that runs here · or a `:::cmd`* — then the press completes by itself. And it still names the target repo: *☐ write `resolved=` into `<project>`'s copy*, because a gap lives in the repo it was filed INTO and the presser is usually not its owner |
| `rejected` | **state** — `rejected=` on the leaf, with a reason. **trigger** — a hand; nothing derives a rejection | **▸ forward** — writes `rejected=<date> why=<reason>`. **▸ backward** — removes it, landing back on `open` | **The reason is the step, not a confirm.** *☐ say why this is declined* — a short closed list plus a line, because this is the one ending somebody will be asked about later. No gate: a gap can be declined the moment it is filed |
| `retired` | **state** — `retired=` on the leaf. **trigger** — a hand, with a reason. **No timer** | **▸ forward** — writes `retired=<date> as=<reason>`. **▸ backward** — press again to remove it | **Forward:** the same reason menu as the other kinds. **Gate:** offered from `resolved`, because that is the only state where there is a living spec to retire — from `open` or `rejected` the honest press is `cancelled`, not `retired`. **Backward:** *☐ remove `retired=`* |

### REPORT

| state | what moves it here — state / trigger | press it — forward / backward | UI facilitation steps, and gates |
|---|---|---|---|
| `filed` | **state** — the file exists **and has no `retired=`.** **trigger** — an agent filing it; no report is ever pressed into being | **▸ forward** — nothing; existence is not a fact a press can write. **▸ backward** — removes `retired=`, which is how you un-retire one | **No forward step** — existence is not pressable. **Backward:** *☐ un-retire, and clear the clock* — clearing has to be part of the same step, or the timer retires it again the next time you open it |
| `retired` | **state** — `retired=` on the leaf. **trigger** — a hand with a reason, **or** the subtype's timer, after you opened the document and did not divert it | **▸ forward** — writes `retired=<date> as=<reason>`. **▸ backward** — press again to remove it | **Forward:** one press, no confirm — a report is a view and retiring one is reversible, which is the only reason a default-after-notice is acceptable here and nowhere else. **The timer's surface is the actual feature:** the clock starts on your **first open** (an unopened report never retires — it is still owed to you, and that pile is the *"you have not read these"* list), the document itself surfaces *"this retires in 3 days"*, and **divert** is a press that clears or restarts it. Readable from the drawer too, beside the approval flag |

## 4 · The mechanism

### 4.1 · `deriveState` stops reading the first approval

`autobot/electron/markdown/blocks.cjs`:

```js
// now
const verdict = String(((approvals[0] || {}).attrs || {}).verdict || "").trim();

// after: every block, and the weakest answer wins
const verdicts = approvals.map((b) => String((b.attrs || {}).verdict || "").trim());
const rejected = verdicts.some((v) => v === "rejected");
const approved = verdicts.length > 0 && verdicts.every((v) => v === "approved");
const verdict = rejected ? "rejected" : approved ? "approved" : "";
```

**A rejection anywhere is the answer**, because one reviewer saying no is the decision; and
`approved` requires every block, which is what *"every approval block approved"* means. An RFC with
no approval block at all stays `draft` — `verdicts.length` is the floor.

> **CORRECTED 2026-10-28, at execution.** This snippet shipped as `verdicts.every(Boolean)` —
> every block carrying *something* — which accepts any non-empty string: a block reading
> `verdict=deferred`, `verdict=abstain` or a typo like `verdict=aproved` would land the document on
> **approved**, a weaker version of the very defect §4.1 exists to fix. §2's RFC table and §9's
> commitment both say *"every approval block carries `verdict=approved`"*, so the table was already
> right and the code block was a transcription of it that lost a term. Built as the strict
> comparison above; found independently by **autobot** reviewing c1/c2/c4 against the shipped code,
> and by me against §2 while building it. The two readings are identical for every verdict a press
> can produce — the control only ever writes `approved` or `rejected` — and differ only where
> somebody typed a third word, which is where the strict one is the honest answer.

#### This section's claims

::::claim[Put two approval blocks on an RFC and approve only one of them → the document still reads draft]{id=c1 reviewers=autobot state=met by=systemview-test at=1793191085847 note="deriveState folds every approval block and the weakest answer wins — pinned in both orders in smoke:markdown-state, verified RED against the old first-approval-only code, confirmed by autobot as the named reviewer. The live half holds too: after the shell restart this document's own row reads no verdict with one approval waiting, which is draft." told=autobot|systemview-test}
**What it asks:** that a document carrying two approval blocks with one answered reads as a DRAFT,
off every block rather than off whichever was typed first. **What breaks without it:** the row says
a design was approved while a reviewer is still holding the second block — which is what this
document's own row said before this landed.

:::cmd
cd ~/autobot && npm run smoke:markdown-state
:::

**And the half that makes it a tripwire rather than a demo** — put `approvals[0]` back and the first
assertion goes red. Checked that way before the fix was kept.

:::cmd
cd ~/autobot && git stash list >/dev/null; grep -n 'verdicts.every((v) => v === "approved")' electron/markdown/blocks.cjs
:::
::::

::::claim[Reject one approval block on an RFC whose others are all approved → the document reads rejected]{id=c2 reviewers=autobot state=met by=systemview-test at=1793191085847 note="a rejection anywhere is the verdict, tested behind two approvals where a short-circuit would miss it" told=autobot|systemview-test}
:::cmd
cd /Users/odionedwards/autobot && npm run -s smoke:markdown-state
:::
::::

::::claim[Approve every approval block on an RFC → only then does it read approved]{id=c3 reviewers=autobot state=met by=systemview-test at=1793191085847 note="only every block approved reads approved — one block alone also covered" told=autobot|systemview-test}
:::cmd
cd /Users/odionedwards/autobot && npm run -s smoke:markdown-state
:::
::::

::::claim[Write an RFC with no approval block at all → it reads draft, and never approved]{id=c4 reviewers=autobot state=met by=systemview-test at=1793191085847 note="no approval block reads draft — the empty-set floor, every-of-nothing never approves" told=autobot|systemview-test}
:::cmd
cd /Users/odionedwards/autobot && npm run -s smoke:markdown-state
:::
::::

### 4.2 · The reason, and what reads it

`as=` on a retirement is parsed with the rest of the leaf and lands on the row as `state.retiredAs`.
**Nothing branches on it for the STATE** — `retired = true` either way. It is read for what happens
AFTER:

| group | reasons | what the lists do |
|---|---|---|
| **ending** | `cancelled`, `superseded`, `out of service` | leave the active lists |
| **pause** | `shelf`, `sideline` | stay listed, under their own heading, with the reason showing |

`lifecycleState.js` gains `RETIRE_REASONS` and `GROUP_OF`, and the drawer's filter reads the group.
**A pause that vanished from the lists would be a deletion wearing a softer word** — the whole point
of shelving is intending to come back.

#### This section's claims

::::claim[Retire a draft RFC and give the reason cancelled → it retires, and nothing refuses it for not being finished]{id=c5 state=met by=systemview-test at=1793191085847 note="cancelled goes through from draft and writes retired= with retiredAs=cancelled — the press was never the thing to refuse" told=systemview-test}
:::cmd
CI=true npx react-scripts test --watchAll=false --testPathPattern="lifecycleState"
:::
::::

::::claim[Retire a document with a reason nobody put on the list → it does not land as an ending or as a pause, and the document says so]{id=c6 reviewers=autobot state=met by=systemview-test at=1793191085847 note="an unlisted reason groups as neither ending nor pause, the row stays listed, the drawer line says it cannot be read — and the DOCUMENT now says it too: a retired leaf with an unreadable reason renders the line visibly under the trail, read-only included, not in a hover" told=autobot|systemview-test}
:::cmd
CI=true npx react-scripts test --watchAll=false --testPathPattern="lifecycleState|rfcRows"
:::
::::

::::claim[Retire a document as superseded → it cannot be completed without naming what superseded it, and that pointer lands on the document's own first line]{id=c7 state=met by=systemview-test at=1793191085847 note="superseded with nothing named is refused by the menu and the rule; named, supersededBy lands on the leaf line" told=systemview-test}
:::cmd
CI=true npx react-scripts test --watchAll=false --testPathPattern="lifecycleState|lifecycle.test"
:::
::::

::::claim[Retire one document with an ending → it leaves the active list. Retire another with a pause → it is still in the list, showing its reason]{id=c17 state=met by=systemview-test at=1793191085847 note="retiredAs grouped ending leaves the drawer list, pause stays showing its reason — one rule in rfcRows and gapRows" told=systemview-test}
:::cmd
CI=true npx react-scripts test --watchAll=false --testPathPattern="rfcRows|gapRows"
:::
Feel it: retire the mock as *shelf* and it stays in the band's RFC tab reading retired — shelf; edit the leaf to retiredAs=cancelled and the row leaves.
::::

### 4.3 · The gate dies; the menu replaces it

`pressTo(kind, station, row, today, leaf)` today refuses a retire that is not reachable. It stops
refusing: `retired` is pressable from **every** state on every kind, and the control asks for the
reason instead. The reason list offered is filtered by where you are — `cancelled` from `draft`,
`out of service` only from a finished state — which is the gate's honest form: it narrows the
*words*, never the button.

#### This section's claims

::::claim[Press retire on a draft document → the menu opens rather than the press being refused]{id=c15 state=met by=systemview-test at=1793191085847 note="pressing retire opens the reason menu and writes nothing until a word is chosen" told=systemview-test}
:::cmd
CI=true npx react-scripts test --watchAll=false --testPathPattern="lifecycle.test"
:::
Feel it: open ::file[RFCs/proofs/mock-rfc.md], press **retired** on the trail — the menu asks why, and *never mind* backs out with nothing written.
::::

::::claim[Press retire on a draft document and read the reasons offered → cancelled is one of them and out of service is not; do the same on a settled document and it is the other way round]{id=c16 state=met by=systemview-test at=1793191085847 note="from draft the menu offers cancelled and not out of service; from settled the other way round — the words narrow, the button never goes" told=systemview-test}
:::cmd
CI=true npx react-scripts test --watchAll=false --testPathPattern="lifecycleState|lifecycle.test"
:::
1. `node RFCs/proofs/mock.js rfc draft`, press retired — cancelled offered, out of service absent.
2. `node RFCs/proofs/mock.js rfc settled`, press retired — the other way round.
::::

::::claim[Press any forward control, then read the document's own first line → it carries a date, a verdict or a reason and no state word anywhere, and the state comes back from a fresh parse with nothing stored]{id=c23 reviewers=autobot state=met by=systemview-test at=1793191085847 note="every ok press on every kind from every state writes only dates, reasons and pointers — swept against STATE_WORDS, and the leaf line re-derives from a cold parse" told=autobot|systemview-test}
:::cmd
CI=true npx react-scripts test --watchAll=false --testPathPattern="lifecycleState"
cd /Users/odionedwards/autobot && npm run -s smoke:markdown-state
:::
::::

### 4.4 · An arc derives upward, and this is the architectural change

**`deriveState(blocks, kind, source)` sees one document.** An arc's new state needs the states of
documents that are not it. So:

1. **The attachment is the objective's address.** A plan's leaf carries `arc=ARC-004-O2`, not
   `arc=ARC-004`. **This costs no new storage** — `REGISTRATION.rfc` already declares
   `relation: "arc"`, so whatever string sits in `arc=` is already kept on the row. What changes is
   what we write into it and what reads it.
2. **A second pass, after the parse.** `announceDocument` keeps deriving one document's own state.
   A new `deriveArc(arcRow, registry)` runs over the registry rows, groups plans by their objective
   address, and folds:
   - an objective is **complete** when it has at least one plan and every one of them is `settled`;
   - an objective with **no plan is incomplete** — his ruling, and it is the floor that stops an
     empty arc settling vacuously;
   - the arc is `settled` when it has at least one objective and every one is complete.
3. **Where it runs.** On an arc's own parse, and on any plan's parse that carries an `arc=` —
   because a plan settling is the event that moves the arc, and the arc's file did not change.

**`state.objectives` gains `planned`**: `{ done, total, planned }`, so a surface can say *"O3 has no
plan attached"* without a second read.

#### This section's claims

::::claim[Attach a plan to one objective of a two-objective arc by that objective's address, settle the plan in its own document, and never touch the arc → the arc reads in progress]{id=c24 reviewers=autobot state=unmet by=systemview-test at=1793191085847 note="this claim contradicts the approved section 2 table: with one objective of two planned the arc reads approved, because inProgress requires EVERY objective planned. The table was built; the claim describes a different rule — resolve at this press" told=autobot|systemview-test}
:::cmd
cd /Users/odionedwards/autobot && npm run -s smoke:registry
:::
::::

::::claim[Settle the last unsettled plan of an arc whose every objective is planned → the arc reads settled, with no edit to the arc]{id=c25 reviewers=autobot state=met by=systemview-test at=1793191085847 note="the counts are pinned end to end in smoke:registry (ARC-800: settle the last plan, complete goes 2 of 2 with the arc file untouched), and the WORD settled derives from those counts in lifecycleState, pinned in its own suite — two suites, each holding its own half" told=autobot|systemview-test}
:::cmd
cd /Users/odionedwards/autobot && npm run -s smoke:registry
:::
Feel it: walk ::file[RFCs/proofs/mock-arc.md] — *inProgress* then *settled* move only the plan files.
::::

::::claim[Give every objective of an approved arc a plan, leaving at least one plan unsettled → the arc reads in progress and not approved]{id=c26 reviewers=autobot state=met by=systemview-test at=1793191085847 note="every objective planned with one plan unsettled reads inProgress and not approved" told=autobot|systemview-test}
:::cmd
cd /Users/odionedwards/autobot && npm run -s smoke:registry
CI=true npx react-scripts test --watchAll=false --testPathPattern="lifecycleState"
:::
::::

::::claim[Attach two plans to one objective and settle only one of them → that objective is not complete, and the arc does not settle]{id=c27 reviewers=autobot state=met by=systemview-test at=1793191085847 note="a second unsettled plan on a complete objective un-completes it — every plan must settle" told=autobot|systemview-test}
:::cmd
cd /Users/odionedwards/autobot && npm run -s smoke:registry
:::
::::

::::claim[Leave one objective of an arc with no plan attached → the arc cannot reach settled, however many of the others are done]{id=c28 reviewers=autobot state=met by=systemview-test at=1793191085847 note="an unplanned objective holds the arc short of settled whatever the others do" told=autobot|systemview-test}
:::cmd
cd /Users/odionedwards/autobot && npm run -s smoke:registry
:::
::::

::::claim[Attach a plan to an arc the old way, naming only the arc and not an objective → no objective claims it, and nothing reads as planned]{id=c29 reviewers=autobot state=met by=systemview-test at=1793191085847 note="arc= naming only the arc serves no objective and is credited to none" told=autobot|systemview-test}
:::cmd
cd /Users/odionedwards/autobot && npm run -s smoke:registry
:::
::::

::::claim[Land the slice that writes the objective's address, and look at every arc in the repo → not one of them changed state]{id=c30 reviewers=autobot state=met by=systemview-test at=1793191085847 note="slice 4 landed state-free: planned was ADDED to every arc's objectives and no arc's STATE moved — ARC-001 kept done false. Pinned in smoke:registry: plan every objective of a two-objective arc and done stays exactly what the objectives' own flags said." told=autobot|systemview-test}
**What it asks:** that slice 4 landed the objective address and moved **no arc's state at all** —
the promise that lets it land without a flag day. **What breaks without it:** every arc in the repo
silently re-reads its own completion the moment the attachment ships, which is the single most
expensive way this could go wrong.

**The repo-wide check, not the fixture one** — re-derives every registered document and prints only
rows whose state actually differs:

:::cmd
cd ~/autobot && node -e 'const fs=require("fs"),path=require("path"),os=require("os");const {parse}=require("./electron/markdown/parse.cjs");const {deriveState}=require("./electron/markdown/blocks.cjs");const rows=JSON.parse(fs.readFileSync(os.homedir()+"/.autobot/documents.json","utf8"));const projs=JSON.parse(fs.readFileSync(os.homedir()+"/.autobot/projects.json","utf8"));(async()=>{let n=0;for(const r of rows){const root=projs[r.project]&&(projs[r.project].path||projs[r.project]);if(!root)continue;const f=path.join(root,r.path);if(!fs.existsSync(f))continue;const src=fs.readFileSync(f,"utf8");const next=deriveState(await parse(src),r.kind,src);const was=r.state||{};const d=["verdict","approvals","done","retired","built","settled"].filter(k=>JSON.stringify(was[k])!==JSON.stringify(next[k]));if(d.length){n++;console.log("DIFFERS",r.id,d.join(","))}}console.log(n===0?"every row matches its file — no arc moved":n+" rows differ")})()'
:::
::::

::::claim[Search the repository for a second function that decides whether an arc is finished, starting with the teaching page's own copy → there is one left]{id=c40 state=met by=systemview-test at=1793191085847 note="one definition per process, each pointed at: the completeness fold (has plans AND every plan settled, empty never complete) lives in lifecycleState as objectiveComplete — the teaching page imports it, its own copy deleted — and the host's deriveArc is the same rule on the other side of the process seam, where an import cannot reach. The grep in the proof finds exactly those two, and the seam is why two is the floor" told=systemview-test}
:::cmd
grep -rln "function deriveArc\|objectiveState" /Users/odionedwards/Systemly/systemview/src /Users/odionedwards/autobot/electron | grep -v test
:::
::::

### 4.5 · A gap needs a proof

`hasProof` is true when the document carries a `:::run`, a `:::cmd` or a `::test`. `resolved`
becomes `resolved-declared AND hasProof`, so writing `resolved=` into a gap with nothing runnable in
it **does not reach the state** — and the control says what is missing instead of refusing.

**The proof block itself is not restricted.** A gap takes whatever actually closed it: if the fix
landed in the suite, the test chip IS the evidence; if it changed something the suite cannot see, a
run block is the only thing that can answer. Any preference beyond that belongs in the skill that
writes gaps, not in an enforcement rule somebody has to bend.

`rejected=<date> why=<reason>` is the other ending, and it shares no term with `resolved`.

#### This section's claims

::::claim[Say a gap is resolved while nothing runnable sits in the document → it does not read resolved]{id=c8 state=met by=systemview-test at=1793191085847 note="resolved= with nothing runnable stays open — the row carries resolvedDeclared without done" told=systemview-test}
:::cmd
cd /Users/odionedwards/autobot && npm run -s smoke:registry
CI=true npx react-scripts test --watchAll=false --testPathPattern="lifecycleState"
:::
::::

::::claim[Add a run block to that same gap and change nothing else → it reads resolved]{id=c9 state=met by=systemview-test at=1793191085847 note="adding one proof block and nothing else completes the gap" told=systemview-test}
:::cmd
cd /Users/odionedwards/autobot && npm run -s smoke:registry
:::
::::

::::claim[Resolve one gap whose only evidence is a test, and another whose only evidence is a command → both read resolved]{id=c10 state=met by=systemview-test at=1793191085847 note="a test chip and a cmd block each count — one evidence vocabulary, PROOF_KINDS.spec" told=systemview-test}
:::cmd
cd /Users/odionedwards/autobot && node -e 'const {parse}=require("./electron/markdown/parse.cjs");const {deriveState}=require("./electron/markdown/blocks.cjs");(async()=>{for(const [name,block] of [["test-only","::test[systemview/lifecycle]"],["cmd-only",":::cmd\nyarn test\n:::"]]){const src="::gap{id=G-X resolved=2026-10-28}\n\n"+block+"\n";const st=deriveState(await parse(src),"gap",src);console.log(name,"resolved:",st.done)}})()' 
:::
::::

::::claim[Reject a gap, with a reason → it reads rejected, and it does not read resolved]{id=c11 state=met by=systemview-test at=1793191085847 note="rejected= with why= reads rejected and never resolved — the fork shares no term" told=systemview-test}
:::cmd
cd /Users/odionedwards/autobot && npm run -s smoke:registry
:::
::::

::::claim[Press resolved on a gap that has no proof → the control offers to attach one instead of refusing]{id=c18 state=met by=systemview-test at=1793191085847 note="resolved on an unproven gap answers with what is missing and an add-a-proof button that writes the skeleton" told=systemview-test}
:::cmd
CI=true npx react-scripts test --watchAll=false --testPathPattern="lifecycle.test"
:::
Feel it: delete the proof cmd in ::file[RFCs/proofs/mock-gap.md], press **resolved** — the control offers the block instead of refusing.
::::

### 4.6 · The windows: one survives, differently

`LIFECYCLE`'s four numbers were days-until-the-sweep-retires-you. **Three of them are deleted.**
Nothing may retire on a clock.

The fourth becomes something else entirely. A report may carry `retain=14d`, and:

- the clock **starts on your first open**, not at filing — an unread report never retires, because
  an unread report is still owed to you. The first open is stamped once into the hub's OWN ledger
  (`~/.autobot/documents-opened.json`, `{id: ms}`) and joined onto the registry row as `openedAt`
  at read time — its own file because the fact is about the READER, not the document: the shell
  regenerates `documents.json` on every parse, so a fact written between parses would die in the
  rewrite, and a clock that restarts on every open would measure renders instead of attention
  (first write wins);
- the document **surfaces the countdown AT THE LEAF** — the rendered `::report` block itself wears
  *"retires in 3 days"* — and the same spot carries two presses: **divert** (clears or restarts
  the clock) and **permanent** (writes `retain=permanent` into the leaf, the explicit forever);
- **no subtype supplies a default** — the leaf declares `retain=<window>` or `retain=permanent`,
  always (the required-ending rule in §2). What the subtype table's clock column now means is
  GUIDANCE for authors: a notice naturally takes a short window, an account naturally takes
  permanent — but the leaf says it, every time;
- when `openedAt + retain` elapses, the SWEEP (the re-parse half of RFC-073 §4.2 that survives)
  writes `retired=<date> retiredAs=expired` into the leaf — the one clock-written state in the
  system, and it is reversible like every report ending.

This is the one place a default-after-notice is acceptable, and only because a report is a view:
retiring one is reversible and loses nothing.

**This amends RFC-073 §2**, which committed to *"the sweep job of §4.2"* writing `retired`. That
sweep is withdrawn. The sweep's other job — re-parsing documents nobody has open — stands untouched.

#### This section's claims

::::claim[File a report with no retain= → no countdown ever starts, and its row and its leaf both read invalid, naming the missing retention]{id=c34 state=met by=systemview-test at=1793282419000 note="reworded at the second opinion: the countdown half duplicated c44 and now lives only there. Seen: autobot's state suite derives invalid='no retention' for a leaf with as= and no retain=; the jest leaf test renders the same words on the document" told=systemview-test}
:::cmd
cd /Users/odionedwards/autobot && npm run -s smoke:markdown-state | grep "declares as= and retain="
CI=true npx react-scripts test --watchAll=false --testPathPattern "blocks/(retention|Report)" 2>&1 | tail -3
:::
::::

::::claim[File a report that carries a retention and never open it → its row never says retired]{id=c35 state=met by=systemview-test at=1793282419000 note="unread never retires: the sweep skips any report with no openedAt in the ledger — an unopened report is still owed to its reader. Seen: the test files a 3d report, never opens it, sweeps past expiry, and the leaf carries no retired=" told=systemview-test}
:::cmd
cd /Users/odionedwards/autobot && node --test --test-name-pattern "unread never retires" tests/markdown-retention.cjs 2>&1 | grep -E "^# (pass|fail)"
:::
::::

::::claim[Open that report for the first time → the clock starts at that moment, and not at the moment it was filed]{id=c36 state=met by=systemview-test at=1793282419000 note="the anchors DISCRIMINATE now (the second opinion caught the first test proving nothing): filed 100 days ago + opened 5 days ago + 14d window WAITS, while filed-fresh + opened 20 days ago FIRES — only open-time anchoring produces both. Structurally, filing time is not even an input the sweep reads" told=systemview-test}
:::cmd
cd /Users/odionedwards/autobot && node --test --test-name-pattern "first open, not filing" tests/markdown-retention.cjs 2>&1 | grep -E "^# (pass|fail)"
cd /Users/odionedwards/Systemly/systemview && node --test --test-name-pattern "first open stamps once" api/documentsRegistry.test.js 2>&1 | grep -E "^# (pass|fail)"
:::
::::

::::claim[Open a report that is three days from retiring → the document itself says so, and its row in the drawer says so too]{id=c37 state=met by=systemview-test at=1793282419000 note="the leaf's render is OBSERVED in jest ('retires in 14 days' on screen, urgent under three days from retainLine's table); the drawer row is WIRED to the same retainLine and its words are the same code path, but its render is not test-observed — AgentChat cannot mount under jest. One observed surface, one shared-code surface, said plainly" told=systemview-test}
:::cmd
cd /Users/odionedwards/Systemly/systemview && CI=true npx react-scripts test --watchAll=false --testPathPattern "blocks/retention" 2>&1 | tail -3
:::
::::

::::claim[Divert a report that is counting down → the clock RESTARTS from the divert, and the next sweep does not retire it]{id=c38 state=met by=systemview-test at=1793282419000 note="reworded at the second opinion: 'clears' read as no-clock-remains, which is permanent's behaviour — divert re-measures. Seen: the hub test shows the stamp moving only under a restart, and the leaf test shows the divert press sending exactly that" told=systemview-test}
:::cmd
cd /Users/odionedwards/Systemly/systemview && node --test --test-name-pattern "divert restarts" api/documentsRegistry.test.js 2>&1 | grep -E "^# (pass|fail)"
cd /Users/odionedwards/Systemly/systemview && CI=true npx react-scripts test --watchAll=false --testPathPattern "blocks/Report" 2>&1 | tail -3
:::
::::

::::claim[Un-retire a report whose clock had already run out → the SAME press restarts the clock, so the sweep does not immediately retire it again]{id=c39 state=met by=systemview-test at=1793282419000 note="reworded at the second opinion (the press is the reset, not the re-open) and the wiring is now OBSERVED, not grepped: the jest mount presses 'filed' on a retired report and sees both facts of the one motion — setAttr clears retired= and the restart stamp fires at the hub" told=systemview-test}
:::cmd
cd /Users/odionedwards/Systemly/systemview && grep -n "restart: true" src/atoms/Markdown/blocks/lifecycle.js
cd /Users/odionedwards/Systemly/systemview && node --test --test-name-pattern "divert restarts" api/documentsRegistry.test.js 2>&1 | grep -E "^# (pass|fail)"
:::
::::

::::claim[Save a registered document from outside the window → its row is re-derived, carrying the retirement reason with it]{id=c31 reviewers=autobot state=met by=systemview-test at=1793191085847 note="the save-and-register round trip is pinned in smoke:registry — write the file, register, the row carries retired= and retiredAs= together; un-retire and both leave. No window anywhere in the path. smoke:markdown-state holds the derivation half over bare strings" told=autobot|systemview-test}
:::cmd
cd /Users/odionedwards/autobot && npm run -s smoke:markdown-state
:::
::::

::::claim[Change a registered document nobody has open → it is still re-parsed and its row still updates]{id=c32 reviewers=autobot state=met by=systemview-test at=1793191085847 note="measured live: RFC-075's row was observed stale during this session while nobody had the file open, and after the shell restart sweepDocuments re-derived it — the row now reads settled true with no retired, matching its leaf. How the stale value got there is not traceable from history and the note does not claim to know; what the claim asks — a document nobody has open is still re-parsed and its row updates — is what the sweep demonstrably did" told=autobot|systemview-test}
:::cmd
node -e 'const r=require(process.env.HOME+"/.autobot/documents.json");const x=r.find(z=>z.id==="RFC-075");console.log("row:",JSON.stringify(x.state.settled),"retired:",JSON.stringify(x.state.retired))' && grep -n "^::rfc{" /Users/odionedwards/Systemly/systemview/RFCs/RFC-075-a-claim-carries-its-proof.md
:::
::::

::::claim[Run the parse over a document old enough to have passed every window that used to exist → no retirement is written onto it, by anything]{id=c33 reviewers=autobot state=met by=systemview-test at=1793191085847 note="no window, no sweep, no parse writes retired= onto an old document — all FOUR deleted windows left no successor, asserted over a 2019 RFC and a 2019 gap in smoke:markdown-state, and age is not an input to the derivation anywhere" told=autobot|systemview-test}
:::cmd
cd /Users/odionedwards/autobot && npm run -s smoke:markdown-state
grep -n "window" /Users/odionedwards/autobot/electron/markdown/blocks.cjs | head -4
:::
::::

::::claim[Search for the four per-kind windows → all four are gone, and retention survives only as a report's own per-document retain=]{id=c41 state=met by=systemview-test at=1793282419000 note="reworded at the second opinion to match reality — the survivor is a different mechanism, not a fourth window. Seen: the grep finds zero windows; the retention suite shows the per-document clock doing everything the windows never did (open-anchored, divertable, reversible)" told=systemview-test}
:::cmd
grep -n "window" /Users/odionedwards/autobot/electron/markdown/blocks.cjs | head -4
cd /Users/odionedwards/autobot && node --test tests/markdown-retention.cjs 2>&1 | grep -E "^# (pass|fail)"
:::
::::

::::claim[Open a report carrying retain=14d → the rendered leaf itself shows the countdown, counting from the first open and not from filing]{id=c44 state=met by=systemview-test at=1793282419000 note="Seen in jest: mounting the leaf stamps the first open once, by id, and 'retires in 14 days' renders from the stamp the hub returns — filing time is not an input anywhere in the component. The not-from-filing half is the same discriminating fact c36 now pins at the sweep" told=systemview-test}
:::cmd
cd /Users/odionedwards/Systemly/systemview && CI=true npx react-scripts test --watchAll=false --testPathPattern "blocks/(Report|retention)" 2>&1 | tail -3
:::
::::

::::claim[Press permanent on a counting report → the leaf reads retain=permanent, and the next open shows no countdown]{id=c45 state=met by=systemview-test at=1793282419000 note="both halves observed (the second opinion asked for the split and each side has its test): the press half — jest sees the permanent press call setAttr(line, 'retain', 'permanent'), the document's own write channel — and the render half — a permanent leaf shows the word and no countdown" told=systemview-test}
:::cmd
cd /Users/odionedwards/Systemly/systemview && CI=true npx react-scripts test --watchAll=false --testPathPattern "blocks/(Report|retention)" 2>&1 | tail -3
:::
::::

## 5 · The empty-set floors, in one place

Every derived state needs a floor or the empty document takes the whole trail for free:

| kind | the floor | what it stops |
|---|---|---|
| rfc | `verdicts.length > 0` | zero approval blocks reading as approved |
| rfc | `claims.length > 0` | an RFC with no claims reading as built and settled |
| arc | `objectives.length > 0` | an empty arc settling |
| arc | every objective has ≥ 1 plan | an arc of unplanned objectives settling |
| gap | `hasProof` | a gap resolved by assertion |

#### This section's claims

::::claim[Delete every claim from an RFC that reads settled → it stops reading settled]{id=c12 state=met by=systemview-test at=1793191085847 note="a document carrying a settled date, a verdict, a STATUS heading and ZERO claim blocks reads neither built nor settled — the floor, pinned in smoke:markdown-state. The floor ONLY: section 2's fuller condition, claims all met and co-signed, is assigned to no slice and is not built." told=systemview-test}
**What it asks:** that an RFC with no claim blocks cannot read `built` or `settled`, however its leaf
is written. **What breaks without it:** `settled` means *"there is nothing left to satisfy"*, and
without the floor a document that never said what it would satisfy gets the top of the trail for
free. Measured before the fix: a verdict + a STATUS heading + zero claims read
`{built: true, settled: true}`.

**Read this before you believe the mark.** §6 assigns this floor to **no slice**; §9 commits to §5.
I landed it on that judgement, having first re-derived every registered document to confirm no live
row changes state. If you disagree, this is the one thing in the run to pull.

:::cmd
cd ~/autobot && npm run smoke:markdown-state 2>&1 | grep -E "c12|floor"
:::
::::

::::claim[Delete every objective from an arc that reads settled → it stops reading settled]{id=c13 state=met by=systemview-test at=1793191085847 note="an arc with no objectives reads approved and never settled — the total greater than zero floor in stateOf, asserted in lifecycleState.test (the empty-set floor case) and in arcDemo.test, where an empty fixture arc refuses to settle with the reason said out loud" told=systemview-test}
:::cmd
CI=true npx react-scripts test --watchAll=false --testPathPattern="lifecycleState"
:::
::::

## 6 · Slices, in landing order

1. **`deriveState` reads every approval.** Smallest, it is a defect, and nothing else depends on it.
2. **The reason.** `as=` parsed, grouped, stored on the row; the gate removed from `pressTo`; the
   menu in the control. Lands whole because a half-done reason is a button with no words.
3. **The gap's fork and its proof** — `rejected=`, `hasProof`, the facilitation that offers a proof.
   Before the arc, because it is one document's own parse and proves the shape.
4. **The objective address.** Write `arc=ARC-nnn-Ox` from the authoring side and read it into
   `objectives.planned`. **No state change yet** — surfaces can show *"unplanned"* while the arc
   still derives the old way, which is how this lands without a flag day.
5. **The arc derives upward.** `deriveArc` over the registry, the five states, the floors.
6. **The report's subtype and its retention clock** — in four pieces, in this order:
   6a. the REQUIRED rules derive: a report with no `as=` or no `retain=` reads `invalid — no
       subtype / no retention`, surfaced on the row and the document (autobot `deriveState`);
   6b. first-open recording: the window opening a document tells the hub, the hub writes
       `openedAt` onto the registry row (one new door on `api/documentsRegistry.js`);
   6c. the sweep writes `retired= retiredAs=expired` into the leaf when `openedAt + retain`
       elapses (autobot — the re-parse pass that already exists);
   6d. the countdown at the leaf, with the divert and permanent presses (`blocks/Report.js`), and
       the drawer spreading reports by `as=`.
   Last because it needs the subtype and retention backfilled onto existing reports — the
   backfill IS the cleanup: stale bare run-reports deleted, the rest declared.

## 7 · The surfaces this changes

- `src/atoms/Markdown/blocks/lifecycleState.js` — `TRAILS` for arc and gap, `RETIRE_REASONS`,
  `pressTo` losing the gate.
- `src/atoms/Markdown/blocks/lifecycle.js` — the reason menu, the facilitation step lists.
- `src/organisms/AgentChat/rfcRows.js` — the drawer reads `retiredAs` to split pauses from endings.
- `autobot/electron/markdown/blocks.cjs` — `deriveState`, `LIFECYCLE`, the new `deriveArc`.
- `src/organisms/HowWeWork/` — the teaching page follows the same definition; its `derive.js` is
  **deleted** in slice 5 rather than updated, because a second derivation of this rule is the defect
  this RFC exists to remove.
- `src/atoms/Markdown/blocks/Report.js` — the leaf wears the countdown and carries the divert and
  permanent presses.
- `api/documentsRegistry.js` — the `openedAt` door; the drawer read spreads reports by `as=` and
  surfaces `invalid` rows instead of lumping them.

## 8 · What this does NOT add

- **No timer that moves state.** The report's clock is the single exception and it is gated on your
  attention, not on the calendar.
- **No new block.** Everything here is attributes on leaves that already exist.
- **No restriction on proof blocks.** The condition decides what it counts; the block holds what it
  holds.
- **No deletion of anything.** Retirement takes a document out of a list. The file stays, and
  deleting it stays yours.
- **No change to how a document registers.** RFC-073 stands: the leaf is the identity, the folder
  means nothing.

## 9 · The approval

:::approval{ask="Approve RFC-076 — every registered document walks a lifecycle, and nothing but a hand moves it?" verdict=approved told=systemview-test}
Approving commits to:

- **§4.1** — `deriveState` reads every approval block; a rejection anywhere is the verdict, and
  `approved` needs them all.
- **§4.2** — retirement carries a reason from a closed list, stored as `as=` on the leaf, grouped
  into endings and pauses, and the lists read the group.
- **§4.3** — the settled-only gate is removed: `retired` is pressable from every state, and the
  reason menu narrows the words instead of the button.
- **§4.4** — an arc's state derives UPWARD from the plans attached to its objectives, read from the
  registry; the attachment is the objective's address; an objective with no plan is incomplete.
- **§4.5** — a gap is not resolved without a proof in the document, and `rejected` with a reason is
  its second ending.
- **§4.6** — three of the four `LIFECYCLE` windows are deleted and RFC-073's retiring sweep is
  withdrawn; a report may carry `retain=`, started by your first open and divertable.
- **§5** — every derived state carries a floor against the empty set.
- **§6** — the six slices land in that order, and slice 4 lands the attachment with no state change.

**The piece most worth rejecting is §2's ARC table — specifically what separates `approved` from
`inProgress`.** It is written as *every objective having a plan attached*, and **that is my
inference, not your ruling**: the planning document lists it under "not settled" in my own words.
If `inProgress` just means approved-and-in-flight, the two collapse into one state, the arc has four
and not five, and §4.4's fold loses a rung. Everything in §4.4 and slice 5 changes shape with it.

**Second-worth-rejecting: §1's double meaning for `as=`** — the same attribute as a closed reason on
one kind and an open vocabulary on another. `why=` for the reason costs one word and removes the
cleverness.
:::

:::approval{ask="Approve the 2026-10-29 amendment — a report declares its subtype AND its ending, and the countdown lives at the leaf?"}
The amendment (argued in chat, 2026-10-29, over a drawer of six unlabelled "reports") commits to:

- **§2** — `as=` is required and the ending is explicit: every report leaf carries `retain=<window>`
  or `retain=permanent`, no subtype supplies a silent default, and a leaf missing either registers
  wearing `invalid — no subtype / no retention`, surfaced instead of lumped.
- **§4.6** — the first open is recorded as `openedAt` on the registry row by the hub; the countdown
  renders AT THE LEAF with two presses beside it, divert and permanent; the sweep writes
  `retired= retiredAs=expired` when `openedAt + retain` elapses — the one clock-written state.
- **§6 slice 6a–6d** — the landing order, ending in the backfill-as-cleanup: stale bare run-reports
  deleted, every surviving report's leaf declared.

The piece most worth rejecting is the `invalid` registration in §2: if you would rather a bare
leaf simply REFUSE to register (absent from the drawer entirely), the surfaced-invalid row and its
derive change shape — surfaced was chosen because a document the system silently denies is worse
than one it visibly questions.
:::

## 10 · What §9 asked you to reject — a reviewer's ruling

> **This section is a REVIEWER'S RULING, not an amendment.** Added 2026-10-28, at execution, because
> a ruling that lives only in a chat log is a ruling nobody can find. **autobot** is the named
> reviewer on nine of the claims below and the code §4.1 changes is in its repo; it ruled on both of
> §9's questions unprompted, from the shipped code rather than from this document. Both rulings touch
> an APPROVED design, so neither is applied here: §10.3 says exactly what is still yours to say.

### 10.1 · The rung stays — `approved` and `inProgress` do not collapse

Its argument is not elegance, it is **what the threshold catches**: *"every objective has a plan
attached"* is the moment an arc is fully **dispatched**, and the failure it guards is specific —
**an arc that looks like it is moving while one objective quietly has no home.** Everything else
progresses, the arc reads healthy, and the unowned piece surfaces at the end. That is c28, and it is
a way this system really fails.

Two supporting reasons, both structural:

- **It derives; "in flight" does not.** *"Every objective planned"* is a fact the registry computes.
  *"Work is happening"* is not derivable without somebody asserting it — so a collapsed `inProgress`
  would need a **press**, and a pressed state inside a lifecycle titled *nothing but a hand moves it*
  would be the one state contradicting the title.
- **The term is already in the model.** `settled` needs every-objective-planned as a floor either
  way. Making it a rung costs no new concept; collapsing would keep the term and throw away the
  state it already implies.

### 10.2 · But §9's objection was right about something, and it is the NAME

The complaint buried in §9 is that **the word lies in the common case.** An arc with three of four
objectives planned and people actively building reads `approved` — which tells a reader *nobody has
started*. §2 itself calls this *"the state an arc sits in for most of its life"*, which is precisely
when a misleading word does the most damage.

**Collapsing is the wrong repair**, because it discards a derivable threshold to fix a vocabulary
problem. Its recommendation is to **rename the state**: `planning` says what is actually true — the
decision is made, the subplans are not all written. The trail then reads
`draft → planning → inProgress → settled`, each word meaning what it says, and §4.4's fold keeps its
rung. Its words: *"I would not ship `approved` for that condition."*

### 10.3 · And on `as=` — use `why=`

Agreed, and the reason is a rule rather than a taste: **when one field means two things, the answer
is two fields, not a better rule for reading the one.** §1's own example is the proof the worry was
right — `::report{id=some-id as=planning retain=14d retired=2026-10-28}` carries the subtype and the
retirement **on one line**, which the paragraph beneath it says never happens. Measured at execution:
that report's reason reads `planning` and groups as neither an ending nor a pause. It is pinned in
`autobot/tests/markdown-state.js` by a test that asserts the **wrong** answer on purpose, so the
evidence is a thing that runs rather than a paragraph. `why=` costs one word.

Note the design already uses `why=` for a gap's rejection reason (§4.5: `rejected=<date> why=<reason>`),
so this makes the vocabulary **more** consistent, not less.

### 10.4 · What is still yours

The structure of §10.1 is already yours — you pressed §9 with §2's ARC table as written, so the rung
is approved and this ruling agrees with it. **Two words are not, and both are one-line changes that
nothing else depends on:**

1. **`approved` → `planning`** on the arc's second state. **Slice 5 is held for this**, because
   building the trail and then renaming a state is two edits to every surface that draws it.
2. **`as=` → `why=`** for a retirement reason. **The other half of slice 6 is held for this.** The
   attribute lives in exactly one constant (`RETIRE_ATTR` in `lifecycleState.js`) specifically so
   your answer costs one line instead of a sweep.



## Claims

::claims

**The claims live beside the sections they verify** (his design, 2026-10-29): every design section
above ends in its own claims, so a future change to one section puts its contract in front of
whoever is changing it — instead of item 23 of 45 in a tail block. This recount derives over the
whole document, stored nowhere, so the bar cannot disagree with the blocks wherever they sit.

> **Reconciled after a blind second opinion** (2026-10-28). The list went out at 24 and came back
> with **ten commitments nobody would have caught being skipped** — including both of the pieces §9
> names as most worth rejecting, which is the worst place to have a hole. Five claims were also
> unbounded or missing their action. The one judgement it upheld is the classification —
> **none of these is experiential**, and the four that read like surface claims all resolve through
> modules that already have tests beside them. A second blind pass (2026-10-29) reviewed the
> retention walk's marks; what it changed is written on the claims themselves.

:::approval{ask="Is this the complete list of claims for RFC-076?"}
Pressing this makes the list the contract. A behaviour missing from it is one we agreed not to
check — so the thing to read for is what is NOT here.

**What the blind pass added, so you can judge whether it was right:** an RFC with no approval block
at all (c4 — the empty-set case the mechanism gets wrong by default, since every-of-nothing is
true); the reason list being NARROWED by where you stand rather than the button being removed (c16
— §4.3's actual commitment, and it can be built as "offer all five everywhere" with everything else
still passing); an unrecognised reason and an unknown subtype (c6, c14 — the two halves of the
closed-versus-open rule §9 asks you to reject); the approved-to-in-progress boundary itself (c26 —
the piece most worth rejecting, and nothing was checking it); several plans on one objective (c27);
the subtype choosing the default clock (c34); the document surfacing its own countdown (c37);
un-retiring clearing it (c39); both kinds of proof counting for a gap (c10); the half of RFC-073's
sweep that SURVIVES (c32); the superseded pointer (c7); and slice 4 landing with no state change
(c30).

**And one I had written off as unclaimable:** c23 — that a press writes the fact and not the state.
I said no action existed for it. There is one, and it is the rule the whole design rests on.

**What I still cannot claim:** the facilitation step lists are now covered for three behaviours
(c20, c21, c22) but not for their wording — the checkbox counts, the warning naming whose verdicts
they are. If a step list ships silently wrong in a way those three do not catch, no claim here would
find it.
:::

## STATUS — built 2026-10-29, the clock included

::claims

**Built and live** — slices 1 through 5 whole, and slice 6's deletion half: the verdict folds every
approval block; retirement carries a reason (`retiredAs=`, because both of §9's options collide with
an attribute already spent); the gap forks and `resolved` needs evidence; the objective address
lands as `arc=ARC-nnn-Ox` and a plan's parse moves both arcs of a move; the arc derives upward
through `deriveArc` with its floors, and the teaching page's second derivation is deleted; all four
`LIFECYCLE` windows are gone. Beyond the slices, landed on the same ruling: **marked is not met** —
a claim counts as met only when its proof is embedded, derived by the host and mirrored by the bar,
with `unproved` counting the marks that rest on nothing.

**Built 2026-10-29, under the amendment** — slice 6 whole (c34–c39, c41–c45): `as=` and `retain=`
are REQUIRED and a leaf missing either wears `invalid` on its row and on itself; the first open is
the hub's own ledger (`~/.autobot/documents-opened.json`), stamped by the leaf's render, joined onto
the registry row as `openedAt`; the sweep writes `retired= retiredAs=expired` into the leaf when the
declared window runs out; the countdown renders at the leaf and on the drawer row, with divert
(restart) and permanent (the explicit forever) as presses; un-retiring clears the clock in the same
press. The backfill was the cleanup: three bare run-reports deleted, the lifecycle planning meeting
retired as superseded by this RFC, every surviving report's leaf declared.

**Not built** — §3's facilitation step lists (c19, c20, c22) are assigned to no slice and are not
built. The window has not yet been WATCHED rendering the countdown — the unit specs pin the face's
words and the presses; the live look is the owner's next open of MOCK-REPORT (now `retain=14d`).

**Contradicts its own design** — c24 reads *in progress* where §2's table says a one-of-two-planned
arc is *approved*. The table is built; the claim is marked unmet; the press on the claims list below
is where that gets ruled.

**The walk, 2026-10-29:** the clock claims moved from unmet to met with their proofs embedded —
every fold's command runs clean where it stands. A SECOND blind review of these marks returned
eleven verdicts: three supported, eight gaps — and every gap was answered in the document rather
than argued with: the clock-anchor tests were rewritten to DISCRIMINATE open-time from file-time
(the originals proved nothing, the reviewer was right), c39's wiring went from grep to an observed
jest press, c34/c38/c39/c41/c42 were reworded where the statement and the note disagreed, and
every mechanism-narration note now cites what was SEEN. The earlier walk's review stands below.
A blind review of the first walk returned eight findings
— one mark flipped back (c41), three notes rewritten where the evidence did not support the story
(c6, c32, c40), four proofs re-aimed at the suites that actually hold them (c13, c25, c31, c33) —
and forced two code changes: the completeness fold now has one definition per process
(`objectiveComplete`), and a retirement reason nobody can read is said visibly in the document
instead of in an editable-only hover.
