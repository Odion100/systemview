---
name: spec-authoring
description: Write the SPEC — the runnable thing a piece of work is checked by: a `::test` chip pointing at a saved test file, or a `:::run` block living in the document. Use it whenever work owes something somebody else can RUN rather than read: a board card declared `report=spec`, a claim needs evidence that still answers next month, a spec report is being written, proactive or self-directed work is landing, or a method has no door and needs one wrapped. Also use it when you are unsure HOW to check something — whether to extend a spec that already runs, write a new saved one, or put a run block beside the claim; and when a service has no front door, because wrapping it as `Test.<Module>.<method>` is the move, not a workaround. Do NOT use it to write the DOCUMENT that carries the spec (report-authoring), to design what gets built (rfc-authoring), to walk an approved RFC's claims (rfc-execution), or for BUStudio's rendered-pixel proof documents (proof-authoring).
---

# Writing a spec

**A spec asserts the CONTRACT, not the implementation.** It is not a unit test and is not trying to
be one: you call the thing the way a caller does, and you declare what the answer is supposed to
look like. That is the whole of it, and it is why writing one is cheaper than it feels.

Look at what an assertion actually is — three lines from a real spec in a service-based codebase:

```
results                   → object
results.Tournaments       → array
results.Tournaments[0]    → object
```

A path into the real response and the type it must be. No assertion code, no mocking framework, no
setup file. **The confidence comes from calling the live method and saying what shape it owes.**

## What you are actually calling — and why that is cheap

**SystemLynx hosts a plain JavaScript object and makes its methods callable as
`Service.Module.method`.** That one fact is the floor under everything below: a module is an object,
its methods become addresses, and a spec is a list of real calls to those addresses — which is why
there is no mocking framework here and no setup file. The mechanism, with its code, is documented:
`context("Service.module — hosting an object as a SystemLynx module")`.

Two consequences you need before §1. **If the subject is already a service, call it and stop
thinking about doors** — the method the client calls is the method you call. **And if it is not,
wrapping it is three lines rather than a project**, which is why every rung of §1's hierarchy is a
straightforward route and not a consolation.

**So do not hesitate, and do not stall on vocabulary.** The common failure is not a bad spec, it is
NO spec — an agent deciding the thing was hard to check and writing a paragraph instead. If you are
unsure whether something counts, write the runnable check anyway and say what it covers. A `:::cmd`
beside it is welcome; it is simply not the part that still answers next month.

## Executing this skill

**The worklist is how this skill starts, advances and finishes.** Not a log written afterwards: the
system reads the list to know whether the procedure was followed, and this skill is complete when
every item on it is done — nothing else marks it complete.

1. **Before step 1**, put your plan for this run on the worklist with `source: "skill:spec-authoring"` —
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

## 0 · WHETHER a spec is owed is not your question

It was decided **before the work started**, on the board card (`report=spec`), by somebody who was
not going to do the work. You read it; you do not make it. An agent asked at the END whether its own
work needed proving is the party with an interest, and it will say no.

**A DECLARATION IS AN OBLIGATION; SILENCE IS NOT A PROHIBITION.** A card reading `report=spec` means
you owe one. A card that says nothing means nobody has decided — and you may not use that absence to
EXCUSE a missing spec. Most of the good specs in this system were written by an agent that built
something and knew it needed proving, with no card anywhere; refusing to write one because none was
asked for is the NO-SPEC failure arriving by a side door. Write it. If the card is undeclared, note
that for `context-maintenance`'s board pass as well — but after the spec, not instead of it.

**And one spec per piece of WORK, not per line of it.** One check that would fail if the thing
regressed beats four that restate the implementation.

## 1 · The PURITY HIERARCHY — four routes to a door, and what each one costs

A spec resolves `Service.Module.method`, so **the subject needs a door.** Sometimes it already has
one. Sometimes you make one in three lines. Sometimes the subject is a Python process and you make
one anyway — and that is still a spec confirming a contract, not a workaround.

**What the hierarchy measures is PURITY: how much of your own code sits between the spec and the
subject.** That matters for one reason and it is not aesthetics — **purity bounds what a RED result
can MEAN.** Every rung is legitimate. Take the highest one the subject allows, and when you cannot,
say in the spec why.

**PROVE RUNG 1 BEFORE YOU LEAVE IT, and prove it by CONNECTING — never by a probe refusal.** A
subject is already a service if its process calls `.module()` on it anywhere: grep for that before
building a thing. `probe` resolves the REGISTRY, so its refusal is a fact about registration, not
about the service — and it even tells you the move ("connect it first"):
`mcp__systemview__connect(url)` registers anything live, after which probe, `runTests` and
`runProofs` all reach it. The hub itself is the canonical case — a service at
`:3000/systemview/api`, hosting `Agent`/`SystemView`/`CLI`, connectable to itself. Measured
2026-11-07: a probe refusal got read as "not a service" and a SECOND instance of an existing
service was stood up to test the first. **That is forbidden by what a spec is: standing up a copy
proves your stand-up, not the system.** The tell reads in one glance — a `Test`-side door whose
subject already lives in a named service.

**AND REGISTRATION IS THE PRECONDITION FOR EVERYTHING HERE, in general and not per-scenario:** a
SystemLynx service has to be CONNECTED to SystemView, via the systemview-plugin, under a project,
before `runTests` can reach it — saved tests are collected from each service's `Plugin` module,
which only the plugin mounts. A bare `connect(url)` buys *callable* (probe, run blocks); the plugin
(`App.use(SystemViewPlugin({ connection, projectCode, serviceId, specs }))`) buys *testable* — the
`specs` folder in that config IS the spec store a saved spec needs.

| | the route | what it is | what a RED can mean |
|---|---|---|---|
| **1** | **it is already a service** | a SystemLynx module in the system under test. There is no door to build — the method the client calls is the method you call | the subject is wrong. There is nothing of yours in the path at all |
| **2** | **pass the OBJECT in** | `.module("Name", theThing)` — hand the real object over and every method on it becomes a namespace. Zero translation, and you wrote no per-method code | the subject is wrong. You contributed one line, and it was a mount |
| **3** | **pass in SELECTED methods** | you do not want the whole surface exposed, so you pick: one line per method, call it, hand back what you saw. Still transcription — no branching, no shaping, no defaults | the subject is wrong, **or your transcription is** — one line each is how you keep that doubt small |
| **4** | **wrap something that is not an object** | a child process, another language, a CLI. A Python function, shelled to and its answer handed back. Isolation, a timeout, and whatever it genuinely takes to reach the thing | the subject is wrong, or your harness is — and you rule out the harness **first, every time** |

**Rung 3 is a real rung and not a compromise.** Passing the whole object is purer, but exposing every
method on something is a decision too — if you only mean to spec four of a module's twenty methods,
pruning to four is the honest door, and it costs you only the per-method lines you wrote.

**AND RUNG 4 IS NOT A LESSER ARTIFACT — it is the reach.** A spec is not a unit test and never was:
it confirms a CONTRACT at the highest level the system has. So a thing running in Python, a binary, a
CLI — you write a wrapper that calls it and you assert what it owes. That is the same job as rung 1,
done at longer range.

**AND THIS IS WHAT KEEPS IT PURE: THE WRAPPER MIRRORS THE SUBJECT'S OWN PUBLISHED SURFACE.** One
wrapper method per operation the thing already exposes — same names, same arguments. If the Python
side publishes six commands, your door has six methods. The surface is not yours to design; it is a
transcription of one that already exists.

Because the way purity actually breaks at this rung is not a stray branch, it is an **invented
convenience method**: you bundle three calls into one `runTheWholeThing()` because that is what your
spec needed, and now the contract under test is YOURS. Green proves your wrapper works and says
nothing about the subject.

The tell is cheap: **could somebody who uses that thing read your wrapper's method list and recognise
it?** If yes, you wrapped. If no, you designed.

**And it bounds what you may ASSERT.** From outside the door you can see what the thing owes its
callers — output shape, error behaviour, exit code — and nothing else. That is the real content of
"the highest level": the internals are not beneath you, they are INVISIBLE, and a spec reaching for
them has stopped being a spec. **What you must not do inside the wrapper is start unit testing**: it
calls and transcribes; the assertions live in the spec, where the reader can see them.

**AND A FOURTH THING A RED CAN MEAN, off the hierarchy entirely: the harness you did NOT write.**
The tell is a **DIVERGENCE between two callers of the same code** — and when you see one, **check
their VERSIONS before their logic**, then report the divergence as a fact — *this caller passes,
that one fails, same commit, these two versions* — rather than theorising from your side of it, and
let whoever owns the runner look. One measured cause is worth knowing before you start:
`context("a cached service client freezes its method map")`.

A harness is a second thing that can be broken, standing between the reader and the evidence — so
take the highest rung the subject allows, and when you cannot, say in the spec why. A mounted object
needs no defence. Just do not write a wrapper for something you could have mounted.

**Three conventions, and the argument behind them is already written — this is the short form.**
Name every wrapper `Test`, so `Test.<Module>.<method>` reads as *no door existed, so I made one* and
the pile stays countable. **A door is TRANSCRIPTION** — it may call, read, count and hand back what
it saw, and may not decide whether the answer is good, because the moment it does the judgment has
moved inside the thing being judged. **Test-side logic goes in the `Plugin` module — EXTENDED, never
declared.** Hand your functions to the systemview-plugin's `module` option, which assigns them onto
the `Plugin` module every decorated service already publishes (that is how `Plugin.createMockUsers`
exists anywhere). Declaring a second module named `Plugin` publishes BOTH while the built client
resolves only the plugin's — the method is declared, registered, and uncallable, surfacing as a
registry-mismatch refusal that reads like a stale record and is not one.
Why each one, and the shapes: `context("name every wrapper Test and keep the door dumb")`.

**In a repo that is already all services you will never write a wrapper at all.** One reference
codebase carries 227 saved cases and not a single `Test.*` serviceId, because every subject already
had a front door. The wrapper exists for code that is not a service yet, which is why the hardest
example of it is a CLI.

**AND WHEN THE SUBJECT UNDER TEST IS THE PLATFORM, THE PAYLOAD MUST BE BORING.** A spec whose job is
*the engine works* — references resolve, multi-arg renders, a throw comes back as a status — wants the
dullest method obtainable under it, because every interesting thing that method does is one more
explanation for a red result. `add({a, b}) → {sum}` is not a weak example, it is the correct one:
arithmetic cannot be the reason it failed. The corollary is a mistake worth naming, because it reads
as diligence: **do not treat the random subject as the lesson.** Such a spec is not about arithmetic,
and it is not about the domain either. It needed something, and something is all it needed.

**AND THE PLUGIN IS A LOOPHOLE IN THE TRANSCRIPTION RULE — so it gets its own rule, and this one is
not written anywhere else.** A door may not decide whether the answer is good; the Plugin is
exempted as "test-side logic", which means it can hold exactly the judgment the door is forbidden,
one inch away. Sometimes that is right: a real Plugin
function measures a payload against a 256KB cap and hands back `{ cap, under, over }` for the spec to
assert, because the alternative was committing a 256KB fixture into the repo forever. That is a
facilitator that thinks, and it was the correct trade.

So the rule is not *"logic goes in the Plugin."* It is: **if your Plugin decides anything, you must be
able to say in one sentence what a red there is ambiguous between.** For that one: *"the cap, or my
facilitator."* If you cannot write that sentence, the judgment does not belong there either.

## 2 · Probe first — the method, then the spec

**Call it and look at the answer before asserting anything about it.**

```
mcp__systemview__probe({ namespace: "<Service>.<Module>.<method>", projectCode: "<projectCode>" })
```

A spec written from what you *believe* a method returns passes against your belief and says nothing
about the code. The file shapes, the save rules and the operator tables are the agent guide's:
`context("how do I write a spec and an evaluation for a service method")`.

## 3 · Build the world with REAL calls

**NOTHING IS STUBBED — that is the claim, and it is narrower than "no mocks".** A reference codebase is full
of `Plugin.createMockUsers`, `Plugin.mockGame`, `Plugin.clearMockForums`, and §1 just told you to put
test-side logic there. "Mock" in those names means **disposable fixture data**, not a fake: the Plugin
writes real documents through real writes, no response is faked and no method is replaced. That
distinction is the entire reason green means anything, so keep it straight rather than banning a word.

`Before` signs up actual users through `Profiles.Users.signUp`, `Main` calls the one method under
test, `After` clears up. Six real calls to set up one assertion is normal and it is the point: the
spec exercises the system the way a caller does.

**Before or Plugin — two homes, and the line is whether a user could do it:**

- **`Before`** — real domain calls a user would actually make, through the front door. If a user does
  it, it belongs here even when it takes five steps, because those five steps ARE the usage
  documentation somebody reads to learn the method.
- **`Plugin`** — what a user *cannot* do, or what should not sit in a file: bulk seeding, clearing a
  collection, measuring something a fixture cannot carry.

Nothing a spec touches may be a thing you cannot depend on being up. Both of these are mounted on
the service under test and come up with it, which is what makes them safe to build a world out of.

**THE SPEC CALLS THE REAL DOOR; ISOLATION LIVES IN THE DATA, NEVER IN A COPY OF THE SERVICE.** His
rule, 2026-11-07: writes are fine when they ride a DISPOSABLE SCOPE — a fake project, a spec-only
name (the board named `spec` is a separate file from his board) — and `After` clears exactly what
`Before` made. What is never the answer is pointing the spec at a copy of the subject so the writes
feel safe: then green proves the copy.

**`After` IS REQUIRED, and the reason is that a spec without one passes exactly once.** It creates its
fixtures every run and then counts them, so its own history becomes its answer — a real case asserting
*one* forum now finds **eight**. Worse, teardown helpers are typically window-bounded (one project's clears
only reach what was `recentlyCreated()`), so once that residue ages out **nothing can reach it** and
the spec is permanently red with no cleanup that fixes it. Measured in one reference codebase: 16 of 227 cases
have no `After`, and one of them is titled `temp`.

### ONE STEP, ONE REAL CALL — this is what "pure" means in a spec

**A step is one real call to one real method through its front door, doing one thing.** That is step
purity, and it is a different claim from the door purity in §1: a door can be perfectly pure while
your steps are a mess.

A step has gone impure when it:

- **builds its own fixtures inline** — a loop, a shaped object assembled across three lines, setup
  smeared into the step that was supposed to be a call
- **asserts two unrelated things**, so a red cannot tell you which one broke
- **makes a call whose result nothing checks** — it ran, and you learned nothing
- **cannot be titled in one clause.** This is the reliable test: if the honest title needs an "and",
  the step is doing two things

**THE PLUGIN IS A STEP COMPRESSOR — that is its real job.** Not a place to put logic; a way to turn
an impure step into a pure one. Five lines of building users becomes one call,
`Plugin.createMockUsers`, and the step list stays a list of calls instead of a program. That is why
test-side logic lives there: not for tidiness, but so every step in the spec can stay a single call.

**AND HERE IS WHAT STEP PURITY BUYS, which is the whole reason to care.** When every step is one real
call, **the list of step titles reads as the procedure**:

> sign up a user → create a team → scope it to the tournament → now add the thing under test

Somebody who never opens the file learns *how you actually use this system*. That is why `Before` is
not scaffolding — it is the first half of the sentence. To add a tournament, somebody has to exist,
and the spec says so by doing it.

A step doing three things cannot have an honest title, which means **step purity is the precondition
for the section below.** Get the steps pure and the titles write themselves; leave a step doing three
things and no title you give it will be true.

**AND THE STEP SEQUENCE IS THE ONLY DOCUMENTATION THAT CANNOT DRIFT.** A page describing how to
create a tournament rots silently the first time the flow changes, and nothing announces it. A
`Before` chain that signs up a user, creates a team and scopes it is **executed on every run** — so
it is either true or it is red. That is worth more than the coverage number, and it is the strongest
reason these specs are the model: they are usage documentation that fails when it lies.

### THE TITLE IS THE SPEC

Not a courtesy — the artifact. A title states **what is proven, with the consequence attached**, so a
reader who never opens the file knows what the system guarantees:

> *"A granular edit names ONE path: content[0].caption changes and nothing else is asserted, so poll
> votes and the poll clock survive without being put back"*
> *"Play-log rows are per VIDEO — two angles of the same play count separately, two people on one
> angle sum, and each row carries a capped profile preview"*
> *"REJECTION: a file: url nested THREE levels inside a composition is caught"*

`"create a mock user"` is a label and it is the floor, not the standard. Step titles carry the same
load, because **a failure line prints the step title** — so the title decides whether a red tells
anybody anything.

**AND A TITLE THAT LIES DOES NOT MERELY FAIL TO HELP — IT MISDIRECTS A READER WHO HAS EVERY OTHER
FACT.** A real spec proves that an expired scoped team is cleared *and* deregistered from its parent
tournament, and it proves it in the steps after `Main`. Two of those steps were titled *"should clear
all mock users"* and *"clear mock tournaments"*. Both are the SUBJECT; both titles describe teardown.
Its own author read the titles, believed them, wrote the whole trailing section off as cleanup, and
diagnosed the wrong cause of a failure in a spec they had written. **Teardown-sounding titles on
load-bearing steps are the worst case**, because the convention that `After` is cleanup is exactly
what makes the lie credible.

One file per method, an array, one entry per saved test — and the `specs/` folder sits **beside the
service it belongs to**, never at the repo root. The shapes and the save rules are the agent guide's:
`context("how do I write a spec and an evaluation for a service method")`.
**`specs/actions/` is for the Before you have now written three times**, not a default: measured
across one reference repo's five services, two use it at all and one directory is empty.

## 3.5 · Prove the spec can FAIL — delete the guard, ninety seconds

**"It would fail if the work regressed" is not a judgment, it is a procedure, and without the
procedure it gets skipped.** "Run it against the old behaviour if you can reach it" is permission to
skip, because usually you cannot reach it. So do not reach for the old behaviour — **create it:**

1. Delete the guard, the branch or the line the spec exists to protect.
2. Run the spec. Watch **the specific step** go red — not the suite, that step.
3. Restore it. Run again, green.

**And the payoff is not theoretical.** Done five times in one session on real work, one guard
came out and the spec produced **no error at all** — the assertion had been passing without proving
anything was enforced. Green spec, load-bearing guard, and only the revert showed the assertion was
not watching it. Nothing short of this finds that class of hole.

**So: GREEN ON THE FIRST RUN IS A SMELL.** A spec that passes before you have ever seen it fail has
told you nothing yet. It is not finished; it is unproven.

## 4 · Which of the three shapes this work wants

Cheapest to the system first, and **say in the account which one you chose and why**.

**Choose by OWNERSHIP — §4.5 — and nothing else.** Both artifacts are one engine: a block's text
compiles into the same evaluation shape a saved spec's JSON carries, and any validator the authoring
picker offers can be named in a block directly (`✓ results.tags includes "forum"`,
`✓ results.items lengthEquals 3`). Which assertions you need does not bear on the choice.

| the work | the shape | because |
|---|---|---|
| changed what an existing method does | **edit its spec** — change the entry that is now wrong, or add one entry to that method's file under `<Service>/specs/tests/` | the file covering that method is where its new case belongs; a second file for one more assertion is the drifting-copy failure in miniature |
| added something nothing watches | **a new saved spec** | it would otherwise go unwatched, which is what pays for the suite growing |
| asserted a SEQUENCE — this, then this, and now this is true | **a `:::run` block** in the document where the question was asked | a sequence has no namespace to live at, and §4.5 is the whole reason |

## 4.5 · A method's contract is finite; a sequence's is not

That is the line between the two artifacts, and it is what decides which one you reach for.

**Both carry sequences — that is not what separates them.** The best saved specs here ARE sequences:
a spec signs up a real user in `Before` so that `Main` can assert on `Tournaments.add`. The difference
is what the sequence SERVES. In a saved spec the sequence is scaffolding in service of one namespace's
contract; in a run block the sequence IS the subject, and there is no single method it is about.

**You can enumerate a method's inputs and outputs.** The good specs here do: one `CLI.probe` file
carries thirteen cases — bad namespace format, unknown service, ambiguous namespace answered with the
choices rather than a silent guess — each with its own expected answer. That set is finite, it IS the
contract, and it belongs at the method's namespace so the change loop finds it whether or not anybody
remembered it today.

**You cannot enumerate the orders things can happen in.** So sequences are not saved exhaustively;
they are ASSEMBLED where the question gets asked. `use: <saved action>` is the tell — a run block
pulls in pieces that already carry their own contracts as steps, which makes it a composition of
tested things rather than a cheaper test of untested ones.

| what you are asserting | where it goes |
|---|---|
| this method, across its inputs and its failures | a **saved spec at its namespace** — bound to the thing it is about, so the change loop finds it by address |
| this, whatever it is — an order of calls, a mix of services, something with no single owner | a **`:::run` block where the claim is written**, because there is no namespace to file it under |
| this order broke, and here is the proof it is fixed | **both** — the run block in the gap reproduces the break; the saved spec carries the contract the fix established |

**AND LIFETIME DECIDES TOO, which the subject question alone misses: A RUN BLOCK LIVES AND DIES WITH
ITS DOCUMENT.** A `:::run` in a report retiring at `retain=30d` is a proof with an expiry date
nobody chose — the janitor takes the document and the contract goes with it. A saved spec is a file
in the repo at the method's namespace, found by the change loop forever. His catch, 2026-11-07: a
method's contract had been written as run blocks in a 30-day report, so the proof would have
quietly outlived nothing. A contract that must outlive the conversation is a saved spec, or its
document is `retain=permanent` — choosing by subject alone can pick a proof with a retirement date.

**The difference is the SUBJECT, and the question that settles it is: WHICH METHOD IS THE SUBJECT?**
Name one and the spec goes at that namespace however many steps it takes — a 14-step spec that signs
two users in and out is still about `getShelf`. **Length is not the test; ownership is.** Find
yourself naming three and it is a sequence, and it belongs in the document making the claim. That is
why gaps reach for run blocks: a gap is not about one method, it is about whatever broke.

## 5 · Run it, and report what the number covers

**YOU RUN IT. A SPEC YOU LEFT FOR SOMEBODY ELSE TO PRESS IS NOT EVIDENCE YET.** Two doors, and both
are yours:

- a saved spec — `runTests`, or `systemview test <projectCode> <Module>.<method>` from a terminal.
- **a document's specs — `runProofs({projectCode, document})`**, which collects the `:::run` blocks
  AND the `::test` chips living in an RFC, arc, plan, gap or report and runs them, results in the
  same shape `runTests` gives. Scope it with `document`, `objective`, `arc`, or none for the whole
  project; `dryRun` lists what WOULD run, and it names any spec it could not build rather than
  dropping it. A `:::cmd` is never collected — it can run anything at any level, so it asserts no
  contract; and a headless pass would execute shell nobody pressed.

Then put the result in the account **with its scope**. A green suite is evidence only about what it
covers, and the sentence that makes a report believable is the one saying what it does not: *"the
suite passed and that number says nothing about this change, because no suite renders this
component."*

Three environment facts that each cost an hour if you meet them cold:

- **FIND THE FIRST FAILING STEP BEFORE YOU BELIEVE ANY RED.** The commonest bad half-hour is a wall
  of failures about the subject that are all downstream of a `Before` that quietly failed, so the
  subject was never called. A real case prints **24 red assertion lines** — `results._id`,
  `results.status`, `results.target_role` — none of which is about the method under test, because the
  `Before` call returned undefined. A red that misdirects is worse than a red, and the only defence
  is reading upward first.
- **Every field coming back `undefined` means the method never ran** — a missing fixture, not twenty
  broken assertions. Return the precondition as a field (`{ fixturesRunning: false, why: "…" }`) and
  assert on it, so a red says which fixture and what to run.
- **Never write a step that can block forever** — there is no per-test deadline, so a method that
  hangs hangs the whole run with no failing line.

## Done when

- The card's `report=spec` is the requirement being satisfied — read, not invented
- Anything with no door got one, wrapped as `Test.<Module>.<method>`, with test-side logic in
  `Plugin` and the door itself doing only transcription
- The method was PROBED and the assertions are written against its real shape
- **Every step is ONE real call doing one thing** — anything that needed building, looping or
  clearing went into `Plugin` so the step stayed a call
- **The step titles read as the procedure** — somebody who never opens the file learns how the system
  is used from the list alone
- The shape is chosen from §4 and its reason is in the account
- **It has been SEEN to fail** — §3.5's delete-the-guard pass was run and the specific step went red.
  Green on the first run is not done, it is unproven
- **YOU ran it** — a saved spec through `runTests`, a document's blocks through
  `runProofs({projectCode, document})` — and the result is reported with what it does not cover.
  Leaving a block for the human to press is not a result
