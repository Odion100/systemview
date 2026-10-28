::report{id=lifecycle-kinds}

# The lifecycle of every kind we register, and what moves it

::::thread{id=t1 sent=systemview-test:111zlvv|systemview-logtest:1x4gi2j}
Four kinds carry a registration leaf — `::rfc`, `::arc`, `::gap`, `::report` — and each one walks a
trail of states drawn at the top of its document. This lays all four out side by side so we can
settle, per state, **what fact moves it** and **whether a press can touch it**.
:::reply{author=you ts=1793124133002 told=systemview-test}
I don't know where there is to look. Anyway, so these registry blocks. Anyway, I just hope that street blocks. That is systematic and seamless that these registry blocks. while the file open would be reading back to update the registry. which would keep like the drawer updated based on the state, but also they got to work outside of the window being open. But that's all. I was looking for the word to call it because just to say something like that.
:::
:::reply{author=systemview-test ts=1793146434248 told=systemview-test}
The word is already settled and written down: **registration leaves**. That is the name in `markdown.md` ("`::rfc` · `::arc` · `::report` · `::gap` — the registration leaves") and in `how-we-work/registration.md`. So nothing to invent — just use it.

On seamless: **the half you were worried about is the half that works.** The shell's parse (`announceDocument`) needs no window anywhere — it fires on an agent's `Edit`/`Write`/`NotebookEdit`, on the `files:write` IPC, and on an `fs.watch` of the worktree. Measured, not remembered.

The gap is the other way round. **With the file open, the window's own save does NOT register it.** A window save goes `hostFiles → hub writeFile` → plain `fs.writeFileSync`, no announce. The watcher that would otherwise catch it only speaks while an agent has tools in flight — it cannot tell whose hand moved a file, so that gate is deliberate — and it ignores `.systemview/` outright. So your edits, and a press on a station, leave the row saying whatever the last agent write saw. That is the stale row the trail had to be taught to distrust.

And the fix is already half-designed in the registry itself: every row answers **`stale`** — whether the file on disk is newer than the row's `parsed` stamp (RFC-073 §1.4, *"the lag is VISIBLE, so a list can re-parse lazily instead of trusting or polling"*). Nothing re-parses on it. Make `stale` trigger that lazy re-parse and the drawer stays honest while you type, with no polling and no window dependency.
:::
:::reply{author=you ts=1793146642441 told=systemview-test}
Basically, I'm telling you that's the job of Once this chip is in a document. Leave isn't a document for any one of these documents. when things, the state changes of... of these leaves through the life cycle. whatever, even other document updates is cached on the registry.
:::
:::reply{author=systemview-test ts=1793147586735 told=systemview-test}
That is the contract, yes — the leaf's job is that the registry is a **cache kept current**: state changes on the leaves, and other document updates, land in the row without anyone asking.

Read off disk just now, so this is the shape not a memory: 11 rows, fields `at id kind path project state`, and the row's `state` is explicitly *what the last parse saw*. That wording is the whole reason the cache has to stay current — the row never claims to be truth, so its only value is being fresh.

And the one place the contract is not met is the one you named: with the file open, the window's save does not announce. The registry already carries the instrument to fix it — `stale`, disk mtime against the row's `parsed` stamp — and nothing reads it. Re-parse on `stale` and the cache is current by the contract rather than by luck.
:::
::::


Not a design to approve. A table to argue with.


::members{who=systemview-test sent=systemview-logtest:kt8gf2|systemview-test:1anfbdv}
## The rule that makes the table possible

Every state is read off a **fact in the document**. The only difference between states is where
that fact is written — a block, a heading, the claims bar, or the leaf itself. RFC-073 says it
already: *"four answers read off one document, never four rows written anywhere."*

Which gives one rule for the whole control:

> **A press does not set a state. A press writes the fact the state reads.**

So "can I click this?" stops being a policy question and becomes a question about the fact: can a
press honestly write it? A signature — no. A heading — yes. An attribute on the leaf — yes. A
count of claims — no, but it can say what is missing.

**One note on the word, because the code uses a different one.** Here a state is a state. In the
code it is a **station** — `stateOf()` returns the one the document is in, while `row.state` is the
bag of flags it read to get there, and two values in one signature cannot both be called state. A
sentence disambiguates from context; a variable cannot. So the document says state and the control
says station, on purpose, and the trail drawn at the top of a document is a line of stations.

## RFC — five states

Your model, with what I would add in the last column.

### The conditions, and the artifact each one reads

- **`verdicts approved`** — reads the `:::approval` blocks: true when every one carries `verdict=approved`
- **`has claims`** — reads the `::claim` blocks: true when there is at least one
- **`claims met`** — reads the `::claim` marks: true when every claim is met
- **`co-signed`** — reads the `::claim` co-signatures: true when every claim is signed by every reviewer
- **the proof** — in `::claim`'s fold (`::test` / `:::run`). An artifact of a claim, and **no
  lifecycle state requires it** — it moves the bar, not the trail
- **`retired`** — reads the `::rfc` leaf: true when `retired=` is present. It carries a **reason** from a closed list — `cancelled`, `superseded`, `shelf`, `sideline`, `out of service` — and the reason is read for *behaviour after*, never for the state itself

### The states, definitively

`requires` names the terms. **The conditional logic** is how they combine — which is where the real
answers are, because written as conditions the states are mutually exclusive: exactly one holds at a
time, so there is **no precedence rule to write**, no if-chain, no "which wins".

| state | requires | the conditional logic | what it means |
|---|---|---|---|
| `draft` | verdicts **absent** · retire **absent** | `verdicts approved = false AND retired = false`. Every other condition contains `verdicts approved`, so this one is their complement: it is true exactly when none of them can be | **you never have to undo the states above.** Draft hangs on one artifact, and every state above needs that same artifact present, so pulling the verdicts breaks all of them at once |
| `approved` | verdicts **all present** · claims **not all met** · retire **absent** | `verdicts approved = true AND claims met = false AND retired = false`. Differs from `built` in a single term — flipping `claims met` is the whole distance between them | **the one state that is expensive to get back to.** You must break built and settled while *keeping* the verdicts, so the cheap move is unavailable and you have to un-meet claims specifically |
| `built` | verdicts all present · claims **all met** · co-signatures **not all** · retire **absent** | `verdicts approved = true AND has claims = true AND claims met = true AND co-signed = false AND retired = false`. Differs from `settled` in a single term too — the whole trail from approved up is one flip per rung | backward from settled costs only your own co-signatures. **Forward** costs claims, which may not all be yours — so forward can stop short where backward cannot |
| `settled` | verdicts, claims, co-signatures **all** · retire **absent** | `verdicts approved = true AND has claims = true AND claims met = true AND co-signed = true AND retired = false`. Every term true — there is nothing left to satisfy, which is what the word means | it derives *and* cannot arrive without a human, because a human is always implicitly a reviewer |
| `retired` | retire declaration **present**, carrying a **reason** | `retired = true`. Appears in no other condition, so it is independent of all of them — which is what makes it reachable from any state. The reason qualifies it, it does not gate it: nothing branches on `as=`, so every reason lands on the same boolean | the only state referencing **no other artifact** — which is why it holds from anywhere, and why it is reached by saying so rather than by progressing. **And the reason is what it says instead of a gate** |

**The cost of a move is not distance, it is whether one artifact is required by everything above
you.** That is the whole asymmetry between going back to draft and going back to approved.

### The trail, and what a press does

::::thread{id=t2 sent=systemview-test:16toh5x}
| state | what moves it here — state / trigger | press it — forward / backward | UI facilitation steps, and gates |
|---|---|---|---|
| `draft` | **state** — no `verdict=` anywhere. **trigger** — none; it starts here. What *returns* it: a reviewer clearing their verdict | **▸ forward** — n/a, it is the first state. **▸ backward** — clears every `verdict=` on every approval block | **Under the bar, a step list.** *To reach draft: ☐ clear the 3 verdicts.* That is the only step — your 26 co-signatures and the claim marks **stay**, because neither defines draft. One button: *clear them*. Warning line names whose verdicts they are |
| `approved` | **state** — every approval block carries `verdict=approved`, **and the claims are not yet all met.** **trigger** — a reviewer pressing the last approval | **▸ forward** — nothing it can do alone; a verdict is a signature, with a who and a when. **▸ backward** — clears the co-signatures *and* the claim marks to land here | **Forward:** no step of its own — a pointer, *"3 blocks await a verdict"*, that jumps to the first one. **Backward: a real GATE, and it blocks.** Reaching approved needs the claims **un**-met, and claim marks are the agent's, not yours — so the panel says *"you cannot get here from built"* and names why |
| `built` | **state** — every claim met, at least one claim, **and not every reviewer has co-signed.** **trigger** — an agent marking the last claim | **▸ forward** — **facilitates:** marks met every claim that is yours, then names the ones that are not. **▸ backward** — clears the co-signatures | **Forward:** *☐ mark the 23 claims that are yours* · *3 belong to `<agent>`* — one button does your 23, then the panel says how far that got you. **Backward:** *☐ remove your 26 co-signatures* — that is the whole step to land on built |
| `settled` | **state** — every claim co-signed by every reviewer, **and no `retired=`.** **trigger** — the last reviewer co-signing; always a human hand, because a human is always implicitly a reviewer | **▸ forward** — **facilitates:** checks off all **your** reviews at once. Alone on the document, that settles it. **▸ backward** — removes `retired=` | **Forward:** *☐ check off all 26 of your reviews* — one button, plus *waiting on: `<names>`* listing the reviewers who are not you. **Backward:** *☐ remove `retired=`*. Never offers another reviewer's co-signature as a step |
| `retired` | **state** — `retired=` on the leaf; it outranks everything. **trigger** — a hand, with a reason, and that is the only trigger there is. **No timer moves state on any kind** | **▸ forward** — writes `retired=<date> as=<reason>`, plus `supersededBy=` where the reason needs a pointer. **▸ backward** — n/a, it is the last state; press it again to remove it | **Forward: the reason menu IS the gate, and it replaces the old one.** No confirm dialog — picking the reason is the confirmation, and it says more than a yes ever did. The old gate (*not offered unless settled*) is **gone**: `cancelled` only makes sense for something that was never built, so it has to be pressable from `draft`. What the reason changes is what happens **after** — `cancelled` and `superseded` are **endings** and leave the active lists; `shelf` and `sideline` are **pauses** and stay findable under their own heading, because you intend to come back; `out of service` is the settled ending. **Backward:** *☐ remove `retired=`*, no confirm; rejoining a list costs nothing |
:::reply{author=you ts=1793145819998 told=systemview-test}
We're tired. Retired is not cancelled. (sighs) have all full state. You could go from back and forth from settled to retired. (loud thud) You know what, I got an even better solution. And you could give me your feedback. When you do, click retired. guitar to any time but when you do another option pops up and you've got to click. out of a small list of options like cancelled. or whatever.
:::
:::reply{author=systemview-test ts=1793146449984 told=systemview-test}
Feedback, and I think your solution is better than the gate I wrote.

The option list is not cosmetic — **it replaces the gate.** The reason I wrote *"not offered unless settled"* was to stop you retiring a half-built thing. But a reason does that job properly instead of crudely: `cancelled` is exactly the word for abandoning something that was never built, so the press should be available from **draft** too. Different endings, legal from different stations:

- `cancelled` — we are not doing this. Legal from draft or approved; that is its whole point.
- `superseded` — something replaced it, and it carries a pointer to what.
- `done — out of service` — the settled one, the thing you wrote the 30-day sweep for.

So the menu that pops depends on the station you are leaving, and the gate dies: **every state can retire, with a different list of reasons.** That is strictly more honest than refusing the button, because a refused button tells you nothing about why.

On the shape: `retired=<date> as=cancelled`, and `supersededBy=` when the reason is that. Same shape as a verdict — a date, a word, and a pointer where the word needs one. One constraint worth fixing now: **the reason must be a closed list, not free text.** The condition everything reads is `retired = true`; if the reason is prose, nothing can ever branch on it and it becomes decoration on a state it was supposed to qualify.

And yes — settled ↔ retired already goes both ways in the press logic; back clears `retired=` with no confirm, because rejoining a list costs nothing.

Open question for you: those three words, or a different list?
:::
:::reply{author=you ts=1793146739739 told=systemview-test}
and shelf or sideline.
:::
:::reply{author=systemview-test ts=1793147596058 told=systemview-test}
Shelf and sideline change the station, and I think for the better — because they are **not the same kind of word as the other three.**

- `cancelled` and `superseded` are **endings**. The decision was made; coming back from one is a correction.
- `shelf` / `sideline` are **pauses**. Coming back is the expected case, not a reversal.

So the reason is not just a label on one station — it decides what the document *does* afterwards. A cancelled RFC should leave the active lists. A shelved one should be **parked and findable**: still listed, under its own heading, with the reason showing, because the whole point of shelving is that you intend to pick it up.

Two consequences worth naming while we are here:

- **The 30-day sweep is wrong for a pause.** Retiring something on a timer is reasonable for a stale report; sweeping a document you deliberately sidelined last week is the system deciding you changed your mind. A pause should have no clock, or its own longer one.
- **Backward from a pause needs no confirm at all** — un-shelving is just resuming. Backward from an ending probably does, since it reverses a decision somebody made.

Which means the list is really two lists behind one press: *ended* (cancelled, superseded) and *parked* (shelf, sideline), plus the plain settled-and-done retirement. Same menu to you, different behaviour after.
:::
:::reply{author=you ts=1793147885968 told=systemview-test}
30 days sweeps and all of that stuff is what the fuck we're resolving. That shit is obsolete as far as it can. And how is it obsolete as long as it's not as long as it's going after fucking documents that are retired. and retire for the right reason. can be read. Oh, you may retire in it on a timer. Yes, obviously, that's what I'm resolving. I am completely resolving the life cycle state of each of these documents. That's the point. So yes, there's going to be no timer. There's no resolving on a timer. A timer will clean up. Documents. and remove them, maybe even delete them.
:::
:::reply{author=systemview-test ts=1793148258865 told=systemview-test}
Understood, and this is cleaner than what I said. I split the timer by reason — no timer for a pause, a timer for a stale report. You are removing it from the state machine entirely: **a timer never moves state.** State moves because somebody decided and said why. The timer's only job is **disposal** — taking already-retired documents off the lists, removing them, possibly deleting them.

That is a better separation than mine, because a timer that sets state is a decision nobody made, attributed to nobody, with no reason attached — exactly the thing the reason menu exists to stop.

And it corrects something I wrote into this document as a measurement. The section below says *"what is missing is only a clock — nothing writes `retired`, and LIFECYCLE's windows (30/30/14/7) are imported by nothing."* Under your ruling that is **not a gap**: nothing should write `retired`, and those windows were never a state clock. If they survive at all they belong to a disposal pass over documents already retired, and they would need re-deciding from scratch for that job rather than being inherited. **That heading needs to come out** — it names an absence that your design says should be absent.

So each station in the trail table loses its *"the N-day sweep is designed and not built"* line too. There is one trigger to retirement and it is a hand, with a reason.
:::
::::



**Why `built` from the claims beats `built` from a `## STATUS` heading.** A heading is prose anybody
can type and nothing checks; claims are facts with a bar over them. It also puts the claims walk in
charge of the lifecycle, which is what RFC-075 was for. The cost: the STATUS heading stops being
state and becomes documentation — and `rfc-authoring` still instructs agents to write one, so that
instruction needs to say why it is still worth writing.

**Why `settled` from the reviewers is the strongest part of this.** The spec refused to derive
settled *"from quiet — a document nobody touched because nobody cared would read as settled."* Your
rule is not quiet. It is a roll call: the people who needed to look have looked. And because a human
is always implicitly a reviewer, `settled` derives **and** cannot arrive without a human press, at
the same time. Measured on RFC-075: 26 claims, 26 met, 26 carrying your co-signature — so under this
model it is already built and already settled.

## ARC — five states, and they derive upward

### The conditions, and the artifact each one reads

- **`verdicts approved`** — reads the `:::approval` blocks: true when every one carries
  `verdict=approved`. The same condition an RFC has, because an arc runs the same approval flow
- **`has objectives`** — reads the `::objective` blocks: true when there is at least one
- **`every objective planned`** — reads the registry for documents whose leaf carries
  `arc=ARC-nnn-Ox`: true when **every** objective has at least one plan attached. An objective with
  no plan is incomplete, not merely un-planned
- **`plans settled`** — reads those plans' own state: true when every attached RFC is `settled`
- **`objectives done`** — no longer read off the objective's `state=`. **Derived:** an objective is
  done when every plan attached to it is settled, which is what makes an arc a living spec rather
  than a checklist
- **`retired`** — reads the `::arc` leaf: true when `retired=` is present, carrying the same closed
  list of reasons an RFC uses

### The states, definitively

::::thread{id=t3 sent=systemview-test:1czvtnw}
| state | requires | the conditional logic | what it means |
|---|---|---|---|
| `draft` | verdicts **absent** · retire **absent** | `verdicts approved = false AND retired = false`. The same complement shape as an RFC's draft — every state above it needs the verdicts present | an arc nobody has approved is a proposal. **It does not stop you building** — it stops the record from claiming the direction was agreed |
| `approved` | verdicts **all present** · objectives **not all planned** · retire **absent** | `verdicts approved = true AND every objective planned = false AND retired = false` | the decision is made and the subplans are not all written. This is the state an arc sits in for most of its life |
| `open` | approved · **every objective has a plan** · plans **not all settled** · retire absent | `verdicts approved = true AND has objectives = true AND every objective planned = true AND plans settled = false AND retired = false` | in flight: every objective has somewhere to put its work, and at least one plan is still moving. **the kind where "what you own" bites hardest** — plans usually belong to several agents |
| `settled` | approved · every objective planned · plans **all settled** · retire **absent** | `verdicts approved = true AND has objectives = true AND every objective planned = true AND plans settled = true AND retired = false`. `has objectives = true` is the **floor** — without it an empty arc satisfies everything else vacuously and takes the whole trail for free | every plan is settled, so every objective is complete, so the arc is. **Derived upward and never pressed into place**, which makes it the one state on this kind nothing can fake |
| `retired` | retire declaration **present**, carrying a **reason** | `retired = true`. Shares no term with the states before it | references no other artifact — which is why it holds from any state, including `draft`, where `cancelled` is exactly the right word |
:::reply{author=you ts=1793146049990 told=systemview-test}
This should probably go through the draft and the approval flow just like Just like all. RFCs. Then it goes from open, then it goes to settle. And then retire. Remember, these are living specs. So it goes from open to settled. You gotta be able to attach the RFCs, like the structure of the vision is of how we work is more definitive every day. You gotta be able to attach the RFCs that are attached to an ARC. attached them to the objectives. The objectives. And this is when process of like when you complete the objectives or when you first you [ Silence ] So [clears throat] an arc planning law, even in the steps after arc planning, you've got to send the RFC writing step. It has to say, like, if there's an arc, you've got to attach that arc to the objectives, because there has to be a process of all the subplans that come from the Orca to each objective. Now, once all those objectives all the plans and are there and all the RFCs are settled, then the objective, the winner's objective is complete.
:::
:::reply{author=systemview-test ts=1793146459581 told=systemview-test}
Saying back what this implies, because it is bigger than adding two stations.

**State flows UP.** An RFC settles → the objective it is attached to completes → the arc is done. So `objectives done` stops being something read off `state=` on the objective and becomes **derived** — an objective is complete when every RFC attached to it is settled. The arc's condition list gains a rung below the one it has: `has plans` / `plans settled`, read off the objectives' attachments rather than off the arc leaf.

That also means the arc gets the front half of the RFC trail: **draft → approved → open → settled → retired.** `open` then means approved and in flight, which is the right reading — an unapproved arc is a draft, and nothing should be executing against it.

And the attach step is the part that makes it work or not. The RFC-writing step in arc planning has to attach the arc **to the objective**, not just to the arc — `::rfc{id=… arc=ARC-004-O2}`, the objective address rather than the arc id, which is the same address an attachment already takes. Without that the arc knows its plans and no objective knows which of them are its own, so nothing can derive upward.

One thing to settle, and it is the empty-set case again: **an objective with no RFC attached — incomplete, or just un-planned?** If incomplete, an arc can never be done until every objective has at least one plan, which is probably what you want for a living spec. If un-planned is allowed to count as complete, the derivation is vacuous and an arc with five empty objectives reads done.
:::
:::reply{author=you ts=1793146932955 told=systemview-test}
You know, attached to arc leaf, I believe. I think you attached to arc document. you can read the document for the leaf, I guess, unless you see a better way than I'm not seeing because you're casually saying you attach the arc. the leaf as if is it going to work if there's two leaves in different documents. of the same thing.
:::
:::reply{author=you ts=1793147070429 told=systemview-test}
Yes, and objective with no RFC attached is incomplete. That would suggest it would affect the state of the art, right? An objective has to have at least a one hour C attached. before the arc can be moved to the right state.
:::
:::reply{author=you ts=1793147160885 told=systemview-test}
It doesn't mean that I'm not gonna... execute on you know, stuff in this. this income if the arc isn't fully defined. This is not just procedure. This is also record keeping. So it's not about being perfect. It's what I mean. You know what I'm saying? guidelines that help you. But. strict policy is it's cool too but I don't want it to restrict our movements. It's just got to understand the benefits of when you Loosing the policy a bit, at least you could be happy that we're creating a record of decisions and where it all came from for the work. But on some boundaries the policies should be strict. I don't know. I'm sorry. I'm just brainstorming.
:::
:::reply{author=systemview-test ts=1793147607804 told=systemview-test}
On the attach — you are right to push on it, and here is what actually exists rather than me waving at it.

The attachment is already **id-to-id, not document-to-document**: an RFC's own leaf carries `arc=`, as in `::rfc{id=RFC-073 arc=ARC-004}`, and the registry can filter rows by `arc`. So you never attach to a path or to a file — RFC-073 made the **id** the identity precisely so a rename or a move does not break every pointer at it. You read the arc document when you want the *why*; you point at the id when you want the link.

Your two-leaves worry is real but it is not an attachment problem, it is an **identity** one, and it already applies to every kind: if two documents both said `::arc{id=ARC-004}`, the id would resolve to whichever parsed last and nothing would say so. I checked the registry on disk — **no duplicate ids and no duplicate paths today** — but existing-and-clean is not the same as guarded. That is worth a check of its own: a second document claiming a live id should be refused or flagged, not silently absorbed.

For reaching the objective rather than the arc, the address shape already exists elsewhere in the system — `ARC-004-O2` — so `arc=ARC-004-O2` costs no new mechanism. What is genuinely missing is on the registry side: `ARC-001`'s row carries `objectives {done: 3, total: 7}` and nothing about *which* plans serve *which* objective, so today nothing can ask "is O2 planned?"

On your ruling — **an objective with no RFC attached is incomplete** — taken, and yes it affects the arc: the arc gains a rung, at least one plan per objective, before `done` is reachable at all.

And on the brainstorm: I think the distinction you are reaching for is that **the state is strict, the work is not.** An arc that cannot read `done` without a plan per objective never stops you building — it stops the record from saying the arc is finished when half of it was never designed. Strict where it would make the record lie; loose everywhere else.
:::
::::


### The trail, and what a press does

| state | what moves it here — state / trigger | press it — forward / backward | UI facilitation steps, and gates |
|---|---|---|---|
| `draft` | **state** — no `verdict=` on any approval block. **trigger** — none; it starts here. What *returns* it: a reviewer clearing their verdict | **▸ forward** — nothing it can do alone; a verdict is a signature, with a who and a when. **▸ backward** — clears every `verdict=` | **Forward:** a pointer — *"2 blocks await a verdict"* — that jumps to the first one. **Backward:** *☐ clear the 2 verdicts*, with a line naming whose they are |
| `approved` | **state** — every approval carries `verdict=approved`, **and at least one objective has no plan attached.** **trigger** — the last reviewer pressing approve | **▸ forward** — nothing; a plan is a document somebody has to write. **▸ backward** — clears the verdicts | **Forward: the step list is the unplanned objectives** — *☐ O2 and O4 have no plan attached* — each one a jump into `rfc-authoring` with the objective's address already filled in. This is where the strict half bites, and notice what it blocks: not your work, only the arc's claim to be further along than it is |
| `open` | **state** — every objective has at least one plan, and at least one plan is not settled. **trigger** — the last unplanned objective getting its first plan | **▸ forward** — nothing it can do alone; a plan settles inside its own document. **▸ backward** — detaching a plan, which nobody should press as a shortcut | **Forward: no button, because none of the work is here.** *waiting on: RFC-081 (draft) · RFC-084 (built)* — the plans that are not settled, each one a link into the document where the press actually lives |
| `settled` | **state** — every attached plan is settled, so every objective is complete. **trigger** — the last plan settling, in its own document | **▸ forward** — n/a; this state is derived upward and cannot be pressed at all. **▸ backward** — removes `retired=` | **No forward press, and the panel says why:** *"an arc settles when its plans do"*, naming the last plan that closed. Same strength as an RFC's `settled` and for the same reason — there is no hand that can write it directly |
| `retired` | **state** — `retired=` on the leaf. **trigger** — a hand, with a reason. **No timer** | **▸ forward** — writes `retired=<date> as=<reason>`. **▸ backward** — press again to remove it | **Forward:** the same reason menu an RFC has, available from every state. **Still open, and it is in the list at the end:** does retiring an arc retire the plans that serve it? **Backward:** *☐ remove `retired=`* |

**The arc is now the kind with the most derivation and the least pressing** — three of its five
states cannot be pressed at all, because the facts they read live in **other documents**. That is
what a living spec is: the arc's state is a summary of its plans, so it cannot lie about them.

**The attachment is id-to-id.** A plan points at an objective with `arc=ARC-004-O2` on its own leaf —
never at a path and never at a document, because RFC-073 made the **id** the identity precisely so a
rename or a move does not break every pointer at it. You read the arc document when you want the
*why*; you point at the id when you want the link. Two real holes sit under this: nothing refuses a
second document claiming a live id (the later parse would silently win), and the registry row carries
`objectives {done, total}` with no record of *which* plan serves *which* objective — so today nothing
can answer *"is O2 planned?"* at all.

**Strict state, loose execution.** The arc refusing to read `settled` without a plan per objective
never stops anybody building. It stops the record from saying the arc is finished when half of it was
never designed. Strict exactly where looseness would make the record lie; loose everywhere else.

## GAP — four states, and the trail forks at the end

### The conditions, and the artifact each one reads

- **`resolved`** — reads the `::gap` leaf: true when `resolved=` is present
- **`has proof`** — reads the **document** for a proof block (a `::test`, an existing test, or a
  `:::run` that runs in the document): true when there is at least one. **The first condition on this
  kind that does not read the leaf** — and the only condition anywhere that requires evidence rather
  than a declaration
- **`rejected`** — reads the leaf: true when `rejected=` is present. It carries a **reason**, which is
  the whole difference between a gap somebody declined and a gap nobody ever got to
- **`retired`** — reads the same leaf: true when `retired=` is present, with a reason

### The states, definitively

::::thread{id=t4 sent=systemview-test:15qvrgk}
| state | requires | the conditional logic | what it means |
|---|---|---|---|
| `open` | resolve **absent** · reject **absent** · retire **absent** | `resolved = false AND rejected = false AND retired = false`. The complement of **both** endings now, not one | where every gap starts |
| `resolved` | resolve **present** · **a proof in the document** · retire absent | `resolved = true AND has proof = true AND retired = false`. The only state in the system whose condition reaches outside the leaf for **evidence** | **the one state a press cannot outrun.** `resolved=` on its own does not reach it — something has to be re-runnable — which makes this the least arguable state on any kind |
| `rejected` | reject **present**, carrying a **reason** · retire absent | `rejected = true AND retired = false`. Shares no term with `resolved`, which is what makes the end of this trail a **fork** rather than a line | declined on purpose. Without the reason it is indistinguishable from a gap nobody looked at, which is the exact failure a gap exists to prevent |
| `retired` | retire declaration **present**, carrying a **reason** | `retired = true`. Shares no term with the states before it | **and this is why it survives here.** A resolved gap carries a proof, so it has become a living spec — something you re-run. Retiring one says the spec stopped being worth re-running. Without the proof there was nothing to retire *from*, which is why `resolved` and `retired` used to read as near-neighbours |
:::reply{author=you ts=1793146168234 told=systemview-test}
I think the states are open, rejected or resolved. [ Pause ]
:::
:::reply{author=systemview-test ts=1793146467879 told=systemview-test}
Taking it as written — **open, rejected, resolved**, and `retired` goes. That reads right for the reason the two kinds differ: a report goes **stale**, so it retires; a gap gets **decided**, so it ends either resolved or rejected and there is nothing left to retire afterwards. It also kills the near-neighbour problem I flagged in the table — `resolved` and `retired` were two words for one ending, and this replaces the weaker one.

So gap becomes the first kind with **two endings**, the same shape as an RFC's `rejected`: the trail is not a line, it forks at the end.

Two things it needs:

- **`rejected` carries a reason**, same as the retire menu in t2 — `rejected=<date> why=…`. Without it a gap somebody declined on purpose reads identical to one nobody ever got to, which is the exact thing a gap exists to prevent.
- **Does `rejected` go back?** Reopening a declined gap is a real move — the thing came back, or the project it was filed into changed its mind. I would say yes, backward clears `rejected=` and names who declined it and when, the same as un-resolving does.

Then the conditions are three on one leaf: `resolved`, `rejected`, and open as their complement — `resolved = false AND rejected = false`. Still the only kind whose whole state is readable from a single line.
:::
:::reply{author=you ts=1793147407847 told=systemview-test}
Yeah, okay. Rejective comes with a reason. Now to call it resolved, we probably can use a proof block as a requirement for you to get to the results day. Now proof, we just create a proof. Still. reaches credit proofs and they work with claims. But proof probably could stand alone and be required for a gap to be resolved. You can add tests, even existing tests, or one that you created. Or you can add a run block that only runs within the document. But that seems perfect for a gap resolution. Damn. In that case, it becomes a living speck, and that's when you can go from resolve to retire. That's the only reason to have retired, because it's a living speck.
:::
:::reply{author=systemview-test ts=1793147618873 told=systemview-test}
Proof as the requirement for `resolved` is the best thing in this section, and it fixes something the table could not: `resolved` was the one station reachable by pure assertion — write `resolved=` and the state changes, with nothing behind it. A proof makes it the only station in the whole system where **the press cannot outrun the evidence.**

So the gap's conditions gain one, and it is the first one on this kind that does not read the leaf: `has proof` — true when the document carries a proof block. Then `resolved = resolved-declared AND has proof`, and the facilitation step writes itself: pressing `resolved` with no proof does not refuse, it **offers to attach one** — pick an existing test, add a new one, or drop a run block that runs in the document.

And that settles why `retired` survives here after all. With a proof in it the gap stops being a ticket and becomes a living spec — something you can re-run — so `resolved → retired` is a real move: the spec stops being worth re-running. Without the proof there was nothing to retire *from*, which is exactly why `resolved` and `retired` read as near-neighbours in the table.

One thing to be clear about, because it is a change to a different block and not to the gap: **proof standing alone.** Today a proof is bound to a claim. Letting it stand on its own is the change — a proof block that belongs to the document rather than to a claim. Worth saying out loud since the claim side has rules (a mark carries who and when) that a free-standing proof would need its own version of.

`rejected` with a reason — taken, same shape as t2: `rejected=<date> why=…`, closed list or free text, your call.
:::
::::


### The trail, and what a press does

| state | what moves it here — state / trigger | press it — forward / backward | UI facilitation steps, and gates |
|---|---|---|---|
| `open` | **state** — no `resolved=` and no `rejected=` on the leaf. **trigger** — none; it starts here. What *returns* it: the owner un-resolving it, or somebody undoing a rejection | **▸ forward** — n/a, first state. **▸ backward** — removes `resolved=` or `rejected=` | **Backward only, and it names the person:** *☐ remove `resolved=`* / *☐ remove `rejected=`* — each with a line saying **who closed it and when**, since reopening a gap undoes somebody else's fix or reverses somebody's decision |
| `resolved` | **state** — `resolved=` on the leaf, **a proof block in the document**, and no `retired=`. **trigger** — usually the owning project's agent writing it, not the author | **▸ forward** — writes `resolved=`, and **will not land without a proof**. **▸ backward** — removes `retired=` | **Pressing it with no proof does not refuse — it OFFERS one.** *☐ attach a proof: pick an existing test · write a new one · drop a `:::run` that runs here* — then the press completes by itself. And it still names the target repo: *☐ write `resolved=` into `<project>`'s copy*, because a gap lives in the repo it was filed INTO and the presser is usually not its owner |
| `rejected` | **state** — `rejected=` on the leaf, with a reason. **trigger** — a hand; nothing derives a rejection | **▸ forward** — writes `rejected=<date> why=<reason>`. **▸ backward** — removes it, landing back on `open` | **The reason is the step, not a confirm.** *☐ say why this is declined* — a short closed list plus a line, because this is the one ending somebody will be asked about later. No gate: a gap can be declined the moment it is filed |
| `retired` | **state** — `retired=` on the leaf. **trigger** — a hand, with a reason. **No timer** | **▸ forward** — writes `retired=<date> as=<reason>`. **▸ backward** — press again to remove it | **Forward:** the same reason menu as the other kinds. **Gate:** offered from `resolved`, because that is the only state where there is a living spec to retire — from `open` or `rejected` the honest press is `cancelled`, not `retired`. **Backward:** *☐ remove `retired=`* |

**A gap stopped being the simplest kind the moment `resolved` needed a proof — and it became the
best one.** Every other kind's forward press is a declaration the document then has to be trusted
about. This one's is the only press in the whole system that **cannot outrun its evidence**: the
state does not move until something re-runnable is sitting in the document.

It is also the only kind with **two endings**, which means the trail is not a line — it forks, and a
surface drawing it has to show `rejected` as a real destination rather than a failure to reach
`resolved`.

One thing this leans on that does not exist yet, and it is a change to a **different** block: a
**free-standing proof**. Today a proof lives inside a `::claim`'s fold. Letting one belong to the
document instead is the new mechanism — and the claim side has rules a free-standing proof would need
its own version of, since a claim's mark carries who marked it and when.

::::thread{id=t5 sent=systemview-logtest:11ey61h|systemview-test:1json35}
## REPORT — two states, a dynamic leaf, and the only honest clock
:::reply{author=you ts=1793148156913 told=systemview-test}
So yeah, so reports are going to be dynamic and I'm just going to have a fixed stone. The leaf is going to be dynamic depending on what the report is used for. The whole point of these leaves is to be able to track the life cycle so that we can know what we need to respond to know when it were done with a document and get rid of it. So what all reports used for reports are used, this document is a report. Right now it's being used for planning. sometimes is for a notice. And was the life cycle of that? Was the life cycle of planning report document? Was this life cycle of a notice report document? Can you think of other categories?
:::
:::reply{author=systemview-test ts=1793148273163 told=systemview-test}
Yes — and the thing that makes a dynamic leaf work is that **the subtype does not change the stations, it changes what `done` means.** `filed → retired` stays the skeleton for every report; the subtype decides which fact lets you reach the end. That keeps one trail and one parse while letting a planning report and a notice behave nothing alike.

Categories I can actually point at, from reports that exist in this repo rather than invented ones:

- **planning** — this document. A table to argue with: members, threads, replies. It is done when **its conclusions left it** — became an RFC, an arc, a spec. So its ending is not "nobody looked at it in 30 days", it is *superseded by the artifact it produced*, and it should carry a pointer to that artifact. Retiring one with nothing pointed at is the tell that the planning went nowhere.
- **notice** — here is what happened, here is what I found. Done when **you have read it.** The only report whose state is about the reader, and the one the registry already half-tracks through `told=`.
- **audit / measurement** — a count against a tree at a moment: *"67 RFCs, five with a verdict."* It rots the instant it is written, so its honest state is **as-of**, and what it needs that no other kind does is **re-runnability** — it should carry the command that regenerates it. Done is never; it is either re-run or out of date.
- **account** — what a job, lane or run actually did. **Never edited, only superseded**; it is a record, so amending one is lying about history. Done the moment it is filed; its only real question is whether anybody accepted it.
- **brief** — context handed to another agent. Addressed to someone, so done means **the recipient acted**, which makes it the one report whose state is genuinely per-member rather than per-document.

Five different answers to one question, which is what makes the dynamic leaf earn itself: `::report{id=… as=planning}`, and `as=` picks which fact `retired` is allowed to read.

The one I am least sure belongs is **account** — it may not be a report at all. A run already has a record of its own, and calling it a report may be me noticing that two things land in the same folder rather than that they are the same kind.
:::
:::reply{author=you ts=1793148777793 told=systemview-test}
[ Pause ] I think that when the agent files a report, and I do think that the leave can change, but... I mean, depending. But when the agent files a report, depending, a report is one of the... There's one over your box that I see. one of the leads that actually can have a timer on it. You know what I mean? To get retired. It can retire automatically because if you give me a little notice and I am nice. You know. read the document, maybe we could be slick and it doesn't click, it doesn't start retiring until I open it, but it also could easily, we could easily pop up surface something in a document letting me know that this is gonna be retired and it's gonna go away. And that's good, meaning that I can divert it if I want, like, oh no, I need to continue to read this report. And that wouldn't even start until I open the report. So, and I can see it in the drawer as well. And on top of the drawer, you know how on top of the drawer is as approval is waiting, for example. So yeah, reports is one thing that. The agent can, based on the, what you call it, parameters. It's a retirement timer. But I'm tired.
:::
:::reply{author=you ts=1793148909120 told=systemview-test}
Over Charlie I'll go with your list of different categories we got planning breathe and notice kind of feel the same, but I Think that our vote vocabulary, you know, I'm not gonna kill it You need to let ideas exist and evolve over time So we'll see what it goes As long as we have the ones we need and we'll see our agents use it and we'll respond to that but planning is straightforward And before notice if I was an agent, I wouldn't know which one to choose honestly um account sounds make sense because you tie it to a job so it has a specific purpose that means we'll have to And we would have to update those peripherals around that, like, skills and work lists. So keep that in mind. right now is actually a planning report.
:::
:::reply{author=systemview-test ts=1793148965697 told=systemview-test}
The read-triggered timer is the part I would not have got to, and it is not a contradiction of what you said in t2 — it is the one case where a timer is honest, because **the clock measures your attention rather than wall time.** `retire=14d` that starts at filing punishes a report for being filed on a busy week. Starting at first open means an **unread report never retires**, which is right: an unread report is still owed to you. And the pile of never-opened ones stops being clutter and becomes the signal — that *is* the "you have not read these" list, which is what the top of the drawer should carry beside the approval flag.

The divert is the half that makes it not-a-decision-nobody-made: the document surfaces *"this retires in 3 days"*, and diverting is a press that clears or restarts the clock. A default-after-notice is acceptable here and nowhere else, because a report is a view — retiring one is reversible and loses nothing.

On **notice versus brief** — you are right, and prose will not fix it. An agent choosing between them needs a question with one mechanical answer, and I think the discriminator is already on the document: **is it addressed to someone who has to act?** A brief has named members and is done when they act; a notice is addressed to whoever reads it and is done when read. So the `::members` line decides it, not judgement. Worth testing against the next few rather than declaring it.

And your point about letting the vocabulary evolve has a design consequence worth writing down, because it is the **opposite** of what I argued for the retire reason: **`as=` must be open, not an enum.** A *reason* has to be a closed list because conditions branch on it — an unrecognised reason would be a state nothing can read. A *subtype* has to be open because the vocabulary is still forming — an `as=` that refuses an unknown value is a vocabulary that can never grow by use, which is exactly the growth you are asking for. Unknown subtype falls back to the plain `filed → retired` skeleton.

On **account** — tying it to a job is what rescues it, and you are right about the peripherals: a job's handover section and a skill's reporting step are where `as=account` actually gets written, so `job-authoring` and `skill-authoring` both need the line, and the run attachment is what links the account to what produced it. Noted as a dependency, not done.

And yes — this document is a planning report. Its leaf is still bare `::report{id=lifecycle-kinds}`, so `as=planning` on it would be the first real use of the thing we just designed.
:::
::::


### The conditions, and the artifact each one reads

- **`exists`** — reads the disk: true when the file is there
- **`as`** — reads the leaf's **subtype**: `planning`, `notice`, `audit`, `account`, `brief` — and
  anything else, because the vocabulary is still forming. An unknown value is **not an error**; it
  falls back to the bare two-state skeleton
- **`opened`** — true once you have opened the document. **The only condition in the system that
  reads your attention rather than the document**, and the thing that makes a timer honest here
- **`retired`** — reads the `::report` leaf: true when `retired=` is present, with a reason

### The states, definitively

| state | requires | the conditional logic | what it means |
|---|---|---|---|
| `filed` | the file **exists** · retire **absent** | `exists = true AND retired = false`. `exists` is the only term in the whole system that no press can write | existence is the only artifact here that a press cannot write, which is why `filed` is never pressed |
| `retired` | retire declaration **present** — a hand with a reason, **or** the subtype's own timer once `opened` is true | `retired = true`. Shares no term with `filed` | **the one kind where a clock may write the state**, and only because the clock measures your attention: while `opened = false` it never runs at all |

**Two states is still the whole trail, and the subtype does not add a third.** What `as=` changes is
**which fact `retired` is allowed to read** — so a planning report and a notice behave nothing alike
while sharing one parse and one control.

### The subtype decides what `done` means

| `as=` | what it is | what makes it done | its clock |
|---|---|---|---|
| `planning` | a table to argue with — members, threads, replies. **This document** | its conclusions **left it**: it became an RFC, an arc or a spec, and it carries the pointer to what it produced | none. Retiring one with nothing pointed at is the tell that the planning went nowhere |
| `notice` | here is what happened, here is what I found | **you read it** | the natural home for the read-triggered clock |
| `audit` | a count against a tree at one moment — *"67 RFCs, five with a verdict"* | never done. It is **re-run or out of date**, so what it needs that nothing else does is the **command that regenerates it** | none; out-of-date is its state, not its ending |
| `account` | what a job, a lane or a run actually did | filed. **Never edited, only superseded** — amending a record is lying about history | none; it *is* the record |
| `brief` | context handed to another agent | **the recipient acted** — the one report whose state is genuinely per-member rather than per-document | none |

**`notice` and `brief` overlap, and prose will not separate them.** An agent choosing between them
needs a question with one mechanical answer, and the document already carries it: **does it have named
members?** With members it is a brief, done when they act. Without, it is a notice, done when read.
Worth testing against the next few rather than declaring settled.

**`as=` must be OPEN where a retire reason must be CLOSED**, and the asymmetry is not an oversight.
Conditions branch on a **reason**, so an unrecognised one would be a state nothing can read. Nothing
branches on a **subtype** — it only picks which fact `retired` may read — so a closed list there would
be a vocabulary that can never grow by use, which is the opposite of letting the words settle by
being used.

### The trail, and what a press does

| state | what moves it here — state / trigger | press it — forward / backward | UI facilitation steps, and gates |
|---|---|---|---|
| `filed` | **state** — the file exists **and has no `retired=`.** **trigger** — an agent filing it; no report is ever pressed into being | **▸ forward** — nothing; existence is not a fact a press can write. **▸ backward** — removes `retired=`, which is how you un-retire one | **No forward step** — existence is not pressable. **Backward:** *☐ un-retire, and clear the clock* — clearing has to be part of the same step, or the timer retires it again the next time you open it |
| `retired` | **state** — `retired=` on the leaf. **trigger** — a hand with a reason, **or** the subtype's timer, after you opened the document and did not divert it | **▸ forward** — writes `retired=<date> as=<reason>`. **▸ backward** — press again to remove it | **Forward:** one press, no confirm — a report is a view and retiring one is reversible, which is the only reason a default-after-notice is acceptable here and nowhere else. **The timer's surface is the actual feature:** the clock starts on your **first open** (an unopened report never retires — it is still owed to you, and that pile is the *"you have not read these"* list), the document itself surfaces *"this retires in 3 days"*, and **divert** is a press that clears or restarts it. Readable from the drawer too, beside the approval flag |

**A report is never done — it is a view, it only gets old.** That is the spec's line and it is why
there are two states. Three things were open when this table was written; two of them are now
answered:

- **Subtypes — ANSWERED.** Not different trails: the same two states, one parse, and `as=` picking
  which fact `retired` may read. An open vocabulary, not an enum.
- **Retention, set from the beginning — ANSWERED.** The agent filing the report sets it as a
  parameter on the leaf, and it is **read-triggered**, not wall-clock. That turns retention from a
  policy for the kind into something the author answers once — and because the clock waits on your
  first open, a report filed on a busy week is never punished for it.
- **Automatic deletion — STILL OPEN, and it is the line I would not cross.** Retire freely; delete is
  different. A cap that *retires* is bookkeeping. A cap that *deletes* means the oldest evidence
  disappears exactly when there is the most of it, and nobody can ever know which report they lost —
  against this system's own rule that a dead record stays where it died.

## The thing all four share, and the one new mechanism

Three of the four kinds have at least one state a press cannot honestly write — a signature, a
count, an existence. For those the control should **say what is missing**, not sit dead:
*"2 claims unmet"*, *"waiting on 2 reviewers"*. That is a better answer than *"already settled"* and
it is the same message that already reads well: *"approved comes from the approval block's
verdict."*

And then the one case the table does not cover: **you saying a state the document disagrees with.**
Settled when a reviewer has not looked. Un-built when the claims say built. That needs an override
on the leaf — and the trail has to **show** that it is overridden, a state lit differently, because
this system's rule is that a surface reads state and never testifies.

So: three layers, and the trail says which one is talking.

1. **The fact** — a block, a heading, the claims bar, the objectives.
2. **The leaf's own word** — `retired=`, `resolved=`.
3. **An override**, visibly marked as one.

## MEASURED: the parse pipeline IS built — and the missing clock is not a gap

Worth separating, because I conflated these and got it wrong out loud.

**BUILT, and verified tonight.** RFC-073 slice 3 hooks the registry into every edit, and it does not
involve the window at all — `announceDocument` is called two ways from the session: the **schema
half** reads the path off every `Edit`/`Write`/`NotebookEdit` tool call, and the **watcher half** is
an `fs.watch` on the session's worktree, which exists precisely to catch *"a shell sed, a git
checkout, an MCP tool writing files"*. Proved while writing this report: a byte-identical rewrite
from Bash re-parsed the row within 8 seconds and picked up `settled: true`. So the registry follows
the document whether the window is open, closed, or never opened — which is exactly what the RFC
set out to do.

**NOT BUILT — and that absence is CORRECT, which is the correction to this section.**
`sweepDocuments()` only re-parses every registered document; it writes nothing. `LIFECYCLE`, which
holds the windows (`rfc: 30`, `arc: 30`, `gap: 14`, `report: 7`), is exported and imported by
nothing. `retired` appears in the harness only where it is READ.

I wrote that up as the one missing piece, and the heading above used to say so. It is not a gap:
**a timer never moves state.** State moves because somebody decided and said why — a timer that
retires a document is a decision nobody made, attributed to nobody, with no reason attached, which is
the exact thing the reason menu exists to prevent. So nothing *should* write `retired` on a clock, and
those four windows do not belong to a state pass at all. Two jobs survive for a clock, both strictly
**downstream of a decision already made**:

- **disposal** — taking already-retired documents off the lists, removing them, possibly deleting
  them. That is the only thing the four windows could become, and they would need re-deciding for
  that job rather than being inherited from this one.
- **the report's read-triggered timer** — the one exception, and it earns the exception by measuring
  your attention instead of wall time: while the document is unopened, the clock does not run.

So the real statement is narrower than the old heading: **state advances on a decision or an edit,
never on the passage of time** — with one kind, one clock, and a divert button on it.

**And one half-built thing in the window, which is a separate bug.** The trail reads the registry
once at mount, so when the file changes underneath it the state does not move — the `retired`
flicker that snapped back to `settled`. The registry was right; the control was not re-asking.

## What is actually decided, and what is not

**Settled by this table, if you agree with it:** a press writes the fact, not the state. Every
vacuous-set case needs a floor. `retired` is a click on every kind. A state a press cannot write
says what is missing rather than nothing.

**Settled in the threads, after the table was first written — these are folded in above:**

- **Retirement is a hand with a REASON**, from a closed list (`cancelled`, `superseded`, `shelf`,
  `sideline`, `out of service`), and the reason replaces the gate: `cancelled` has to be pressable
  from `draft`. Endings leave the lists; pauses stay findable. **No timer moves state** on any kind.
- **An arc runs the approval flow** and its state **derives upward from its plans** — an objective is
  complete when every plan attached to it is settled, and an objective with no plan is incomplete.
  Strict state, loose execution.
- **A gap needs a PROOF to be called resolved**, and it forks: `rejected` with a reason is the other
  ending. `retired` survives because a proved gap is a living spec.
- **A report's leaf is DYNAMIC** — `as=` picks what `done` means, from an **open** vocabulary — and a
  report is the one kind a clock may retire: started by your first open, surfaced in the document,
  divertable.

**Two live defects found while writing it, which are not opinions:**

- **`deriveState` reads `approvals[0]`** — so an RFC reads *approved* off its FIRST approval block
  and ignores every other one. Your "every approval block" rule is a bug fix, not a preference.
- **No floor on the empty set.** With `built` from the claims and `settled` from the co-signatures,
  an RFC with no claims takes the whole trail for free — zero claims are all met and all co-signed.
  RFC-053 has zero claims today. The arc already guards this; the RFC states do not.

**Not settled, and these are the ones to argue:**

- Does `built` move to the claims and leave the STATUS heading as documentation?
- Does `settled` move to the reviewer roll call? (I think this one is answered — it is the
  strongest state in the table.)
- Who may resolve a gap — the finder who wrote it, or the owner whose repo it is in?
- Does retiring an arc retire the plans that serve it?
- Does a **free-standing proof** — one belonging to the document rather than to a claim — need the
  same rules a claim's mark has: who wrote it, and when?
- **What separates `approved` from `open` on an arc.** I wrote it as *every objective has a plan
  attached*, derived from your rule that an unplanned objective is incomplete — but that is my
  inference, not something you said. If `open` just means approved-and-in-flight, the two collapse
  into one state.
- **What a planning report requires** — your own question, unanswered: does it need an approval of
  its own before it becomes an RFC, and what else does the `planning` subtype demand?
- **May a cap ever delete?** Retiring is bookkeeping; deleting loses the oldest evidence exactly
  when there is most of it.
- **Nothing refuses a duplicate id.** Two documents claiming one `ARC-004` and the later parse wins,
  silently. Not a lifecycle question, but the lifecycle rests on it.
