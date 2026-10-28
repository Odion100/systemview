# RFC-076 — Every registered document walks a lifecycle, and nothing but a hand moves it

::rfc{id=RFC-076}

::members{who=systemview-test sent=systemview-test:1w73fns}

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

### ARC

| state | what moves it here — state / trigger | press it — forward / backward | UI facilitation steps, and gates |
|---|---|---|---|
| `draft` | **state** — no `verdict=` on any approval block. **trigger** — none; it starts here. What *returns* it: a reviewer clearing their verdict | **▸ forward** — nothing it can do alone; a verdict is a signature, with a who and a when. **▸ backward** — clears every `verdict=` | **Forward:** a pointer — *"2 blocks await a verdict"* — that jumps to the first one. **Backward:** *☐ clear the 2 verdicts*, with a line naming whose they are |
| `approved` | **state** — every approval carries `verdict=approved`, **and at least one objective has no plan attached.** **trigger** — the last reviewer pressing approve | **▸ forward** — nothing; a plan is a document somebody has to write. **▸ backward** — clears the verdicts | **Forward: the step list is the unplanned objectives** — *☐ O2 and O4 have no plan attached* — each one a jump into `rfc-authoring` with the objective's address already filled in. This is where the strict half bites, and notice what it blocks: not your work, only the arc's claim to be further along than it is |
| `inProgress` | **state** — every objective has at least one plan, and at least one plan is not settled. **trigger** — the last unplanned objective getting its first plan | **▸ forward** — nothing it can do alone; a plan settles inside its own document. **▸ backward** — detaching a plan, which nobody should press as a shortcut | **Forward: no button, because none of the work is here.** *waiting on: RFC-081 (draft) · RFC-084 (built)* — the plans that are not settled, each one a link into the document where the press actually lives |
| `settled` | **state** — every attached plan is settled, so every objective is complete. **trigger** — the last plan settling, in its own document | **▸ forward** — n/a; this state is derived upward and cannot be pressed at all. **▸ backward** — removes `retired=` | **No forward press, and the panel says why:** *"an arc settles when its plans do"*, naming the last plan that closed. Same strength as an RFC's `settled` and for the same reason — there is no hand that can write it directly |
| `retired` | **state** — `retired=` on the leaf. **trigger** — a hand, with a reason. **No timer** | **▸ forward** — writes `retired=<date> as=<reason>`, plus `supersededBy=` where the reason needs a pointer. **▸ backward** — press again to remove it | **Forward: pick the reason, and it is the same list an RFC has** — `cancelled` and `superseded` are endings and leave the active lists, `shelf` and `sideline` are pauses and stay findable, `out of service` is the settled ending. Same list for the same cause: **an arc is a living spec, so it stops being one the same ways an RFC does.** Available from every state, `draft` included — `cancelled` is exactly the word for a direction nobody took. **Still open, and it is in the list at the end:** does retiring an arc retire the plans that serve it? **Backward:** *☐ remove `retired=`* |

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
const verdict = rejected ? "rejected" : verdicts.length && verdicts.every(Boolean) ? "approved" : "";
```

**A rejection anywhere is the answer**, because one reviewer saying no is the decision; and
`approved` requires every block, which is what *"every approval block approved"* means. An RFC with
no approval block at all stays `draft` — `verdicts.length` is the floor.

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

### 4.3 · The gate dies; the menu replaces it

`pressTo(kind, station, row, today, leaf)` today refuses a retire that is not reachable. It stops
refusing: `retired` is pressable from **every** state on every kind, and the control asks for the
reason instead. The reason list offered is filtered by where you are — `cancelled` from `draft`,
`out of service` only from a finished state — which is the gate's honest form: it narrows the
*words*, never the button.

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

### 4.5 · A gap needs a proof

`hasProof` is true when the document carries a `:::run`, a `:::cmd` or a `::test`. `resolved`
becomes `resolved-declared AND hasProof`, so writing `resolved=` into a gap with nothing runnable in
it **does not reach the state** — and the control says what is missing instead of refusing.

**The proof block itself is not restricted.** A gap takes whatever actually closed it: if the fix
landed in the suite, the test chip IS the evidence; if it changed something the suite cannot see, a
run block is the only thing that can answer. Any preference beyond that belongs in the skill that
writes gaps, not in an enforcement rule somebody has to bend.

`rejected=<date> why=<reason>` is the other ending, and it shares no term with `resolved`.

### 4.6 · The windows: one survives, differently

`LIFECYCLE`'s four numbers were days-until-the-sweep-retires-you. **Three of them are deleted.**
Nothing may retire on a clock.

The fourth becomes something else entirely. A report may carry `retain=14d`, and:

- the clock **starts on your first open**, not at filing — an unread report never retires, because
  an unread report is still owed to you;
- the document **surfaces the warning itself** — *"this retires in 3 days"* — and **divert** is a
  press that clears or restarts it;
- the subtype picks the default: `notice` has one, `planning`, `audit`, `account`, `brief` and
  `spec` have none.

This is the one place a default-after-notice is acceptable, and only because a report is a view:
retiring one is reversible and loses nothing.

**This amends RFC-073 §2**, which committed to *"the sweep job of §4.2"* writing `retired`. That
sweep is withdrawn. The sweep's other job — re-parsing documents nobody has open — stands untouched.

## 5 · The empty-set floors, in one place

Every derived state needs a floor or the empty document takes the whole trail for free:

| kind | the floor | what it stops |
|---|---|---|
| rfc | `verdicts.length > 0` | zero approval blocks reading as approved |
| rfc | `claims.length > 0` | an RFC with no claims reading as built and settled |
| arc | `objectives.length > 0` | an empty arc settling |
| arc | every objective has ≥ 1 plan | an arc of unplanned objectives settling |
| gap | `hasProof` | a gap resolved by assertion |

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
6. **The report's subtype and its retention clock** — `as=`, `retain=`, the open-on-first-read
   trigger and the divert press. Last because it needs the subtype backfilled onto existing reports.

## 7 · The surfaces this changes

- `src/atoms/Markdown/blocks/lifecycleState.js` — `TRAILS` for arc and gap, `RETIRE_REASONS`,
  `pressTo` losing the gate.
- `src/atoms/Markdown/blocks/lifecycle.js` — the reason menu, the facilitation step lists.
- `src/organisms/AgentChat/rfcRows.js` — the drawer reads `retiredAs` to split pauses from endings.
- `autobot/electron/markdown/blocks.cjs` — `deriveState`, `LIFECYCLE`, the new `deriveArc`.
- `src/organisms/HowWeWork/` — the teaching page follows the same definition; its `derive.js` is
  **deleted** in slice 5 rather than updated, because a second derivation of this rule is the defect
  this RFC exists to remove.

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


## Claims

::claims

**Where you stand to check these** — five places, and each group is one sitting: a document you are
editing, the window with a control under your finger, two documents at once, the host with no window
open at all, and the files.

> **Reconciled after a blind second opinion** (2026-10-28). The list went out at 24 and came back
> with **ten commitments nobody would have caught being skipped** — including both of the pieces §9
> names as most worth rejecting, which is the worst place to have a hole. Five claims were also
> unbounded or missing their action. What that pass changed is marked below; the one judgement it
> upheld is the classification — **none of these is experiential**, and the four that read like
> surface claims all resolve through modules that already have tests beside them.

### In a document, watching its own state

::claim[Put two approval blocks on an RFC and approve only one of them → the document still reads draft]{id=c1 reviewers=autobot}
::claim[Reject one approval block on an RFC whose others are all approved → the document reads rejected]{id=c2 reviewers=autobot}
::claim[Approve every approval block on an RFC → only then does it read approved]{id=c3 reviewers=autobot}
::claim[Write an RFC with no approval block at all → it reads draft, and never approved]{id=c4 reviewers=autobot}
::claim[Retire a draft RFC and give the reason cancelled → it retires, and nothing refuses it for not being finished]{id=c5}
::claim[Retire a document with a reason nobody put on the list → it does not land as an ending or as a pause, and the document says so]{id=c6 reviewers=autobot}
::claim[Retire a document as superseded → it cannot be completed without naming what superseded it, and that pointer lands on the document's own first line]{id=c7}
::claim[Say a gap is resolved while nothing runnable sits in the document → it does not read resolved]{id=c8}
::claim[Add a run block to that same gap and change nothing else → it reads resolved]{id=c9}
::claim[Resolve one gap whose only evidence is a test, and another whose only evidence is a command → both read resolved]{id=c10}
::claim[Reject a gap, with a reason → it reads rejected, and it does not read resolved]{id=c11}
::claim[Delete every claim from an RFC that reads settled → it stops reading settled]{id=c12}
::claim[Delete every objective from an arc that reads settled → it stops reading settled]{id=c13}
::claim[File a report with a subtype nobody has ever used → it is accepted, and the report still reads filed]{id=c14}

### In the window, with a control under your finger

::claim[Press retire on a draft document → the menu opens rather than the press being refused]{id=c15}
::claim[Press retire on a draft document and read the reasons offered → cancelled is one of them and out of service is not; do the same on a settled document and it is the other way round]{id=c16}
::claim[Retire one document with an ending → it leaves the active list. Retire another with a pause → it is still in the list, showing its reason]{id=c17}
::claim[Press resolved on a gap that has no proof → the control offers to attach one instead of refusing]{id=c18}
::claim[Open an arc that has an objective nobody has planned → the panel names that objective, rather than only showing a count]{id=c19}
::claim[Press forward from built on an RFC whose claims are not all yours → it marks the ones that are yours and names the ones that are not]{id=c20}
::claim[Try to press backward to approved from built → it refuses, and says that the heading cannot be unwritten]{id=c21}
::claim[Press forward on an arc that is already settled → there is no button at all, and the panel says an arc settles when its plans do]{id=c22}
::claim[Press any forward control, then read the document's own first line → it carries a date, a verdict or a reason and no state word anywhere, and the state comes back from a fresh parse with nothing stored]{id=c23 reviewers=autobot}

### Two documents at once — the upward derivation

::claim[Attach a plan to one objective of a two-objective arc by that objective's address, settle the plan in its own document, and never touch the arc → the arc reads in progress]{id=c24 reviewers=autobot}
::claim[Settle the last unsettled plan of an arc whose every objective is planned → the arc reads settled, with no edit to the arc]{id=c25 reviewers=autobot}
::claim[Give every objective of an approved arc a plan, leaving at least one plan unsettled → the arc reads in progress and not approved]{id=c26 reviewers=autobot}
::claim[Attach two plans to one objective and settle only one of them → that objective is not complete, and the arc does not settle]{id=c27 reviewers=autobot}
::claim[Leave one objective of an arc with no plan attached → the arc cannot reach settled, however many of the others are done]{id=c28 reviewers=autobot}
::claim[Attach a plan to an arc the old way, naming only the arc and not an objective → no objective claims it, and nothing reads as planned]{id=c29 reviewers=autobot}
::claim[Land the slice that writes the objective's address, and look at every arc in the repo → not one of them changed state]{id=c30 reviewers=autobot}

### On the host, with no window open

::claim[Save a registered document from outside the window → its row is re-derived, carrying the retirement reason with it]{id=c31 reviewers=autobot}
::claim[Change a registered document nobody has open → it is still re-parsed and its row still updates]{id=c32 reviewers=autobot}
::claim[Run the parse over a document old enough to have passed every window that used to exist → no retirement is written onto it, by anything]{id=c33 reviewers=autobot}
::claim[File a report as an audit with no retention and open it → no countdown starts. File one as a notice and open it → one does]{id=c34}
::claim[File a report that carries a retention and never open it → its row never says retired]{id=c35}
::claim[Open that report for the first time → the clock starts at that moment, and not at the moment it was filed]{id=c36}
::claim[Open a report that is three days from retiring → the document itself says so, and its row in the drawer says so too]{id=c37}
::claim[Divert a report that is counting down → the clock clears, and the next parse does not retire it]{id=c38}
::claim[Un-retire a report whose clock had already run out, then open it again → it does not immediately retire a second time]{id=c39}

### In the files

::claim[Search the repository for a second function that decides whether an arc is finished, starting with the teaching page's own copy → there is one left]{id=c40}
::claim[Search for the four per-kind windows → three are gone, and the one left is a report's own retention]{id=c41}

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
