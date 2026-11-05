# What a good test is

::report{id="What a good test is" as=planning retain=48h}

::members{who=systemview-test}

**This is a surface, not a write-up.** It is open while we argue it out, and what lands gets
written here as it lands. The threads at the bottom are where the open questions sit — nothing in
them is settled until it says so.

**Why it exists:** `spec-authoring` :file[~/.claude/skills/spec-authoring/SKILL.md] starts well and
then leaves a lot to be desired. It gets the frame right — *assert the spec, assert the contract* —
and then stops short of the thing an agent actually needs, which is **what a good test READS like**.

---

## 1 · His position, in his words — the starting point, not my summary

> The tests in buAPI are great not just because of the test coverage, but also **how it reads**. You
> see the implementation. You say, okay, okay, in order to do this, you do that. Multiple steps you
> see happening. There's barely anything that's not multiple steps — that's why the test is already
> set up for Before, After, Main and cleanup plugins. When you see in buAPI to create a tournament,
> you see that you've got to sign in, you see that you've got to add another user. **You see the
> implementation.**

> How pure each step in a test is — and that's where the plugin comes into place, to facilitate and
> make sure that each step is pure. But it's straightforward, because you're literally testing the
> methods that the client is calling.

> When it's not directly a SystemLynx API that you're testing, even if it's a local API — **wrap it
> and test it.** Use the pure Math object. Not some variation of math, the pure math object. Wrap
> it, and you can call any method and it's completely local. I just turned the Math object into a
> service. That was one of the first tests I used to do when I created the system.

---

## 2 · The three real examples — rendered, and pressable where they live

Not invented. These are in the tree right now.

### 2.1 · buAPI `Tournaments.add` — the one where you read the implementation

`Before` is not setup scaffolding. It is **the first half of the sentence**: to add a tournament,
somebody has to exist.

```json
"Before": [{
  "title": "create a mock user",
  "namespace": { "serviceId": "Profiles", "moduleName": "Users", "methodName": "signUp" },
  "args": [{ "input": { "email": "add@mockuser.com", "password": "K1234567#a",
                        "user_name": "Add", "location": "United States, Brooklyn, New York" } }]
}],
"Main": [{
  "title": "Should create a new tournament",
  "namespace": { "serviceId": "Profiles", "moduleName": "Tournaments", "methodName": "add" },
  "args": [{ "input": { "name": "Mock Add Test", "files": ["mockFile(test.png)", "mockFile(test2.png)"],
                        "destinations": ["profile_image", "banner_image"] } }]
}]
```

And the assertions are **paths and types**, not assertion code — a real response walked by address:

| namespace | expected | validation |
|---|---|---|
| `results._id` | string | |
| `results.banner_image` | string | `isLike` `^(https?:\/\/)([\w.-]+)(:\d+)?(\/[\w./%-]*)?$` |
| `results.coordinates[1]` | number | |
| `results.created_date` | date | |

:::callout
**TWO AGENTS MEASURED THIS SPEC AND GOT OPPOSITE ANSWERS. BOTH WERE RIGHT.** I ran
`node cli/index.js test buAPI "Tournaments.add" --json` → 4/4, uploads landing as real storage URLs.
buAPI ran `npx systemview test buAPI Tournaments.add` → `banner_image expected string, received
undefined`. The difference is not the resolver and not a stale memory: **the repo is 2.40.0 and the
published CLI is 2.39.0**, and 2.39.0's `createMockFile` still returns a Buffer that
`convertToReadStream()` throws on. Neither of us misremembered; we were running different code.

So this is a safe exemplar **from the repo** and a broken one from the installed CLI, and the lesson
is sharper than the one I first wrote down: **when two callers of the same code disagree, check their
versions before their logic.** The divergence was the tell and we both read it as a logic problem.
:::

::test[Profiles.Tournaments.add]{project=buAPI}

### 2.2 · `TestService.Math.chainUse` — NOT the pure case, and that correction is the doctrine

I put this up as *"the pure local wrap"* and it is neither. `test/service/Math/index.js` is a
**hand-written module** — `add`, `subtract`, `combine`, `describe`, `chainUse`, each calling
`this.log` — and `.module("Math", Math)` mounts that file, not JavaScript's global `Math`, which the
variable name shadows. Its own comments say what it is for: *"so the Stories test view can show
multi-arg rendering"*, *"so the Stories test view can prove it renders ANY argument type"*. Those
methods exist to exercise the renderer.

**The pure case is passing the object IN** — `.module("Name", theThing)` with the real thing, zero
translation — and we have no example of it in the tree, which is exactly why rung two was easy to
mistake for rung one. What the purity ladder costs is written into `spec-authoring` §1 now: the
purity of the door bounds what a red result can mean, and a harness is a second thing that can be
broken standing between the reader and the evidence.

**And this spec's real job is the second half of the lesson.** Its subject is not arithmetic, it is
the ENGINE — that references resolve across saved actions. `Before` adds 1+1, `Main` reaches back
into it by address, three different earlier steps at once. The payload is deliberately dull because
every interesting thing a method does is one more explanation for a red result. Treating the random
subject as the lesson is the mistake; it needed something, and something is all it needed.

```json
"Main": [{ "args": [{ "input": {
  "base":   "test.before[0].results.sum",
  "seeded": "test.seedSum[0].results.sum",
  "product":"test.seedSum[1].results.product" } }] }]
```

::test[TestService.Math.chainUse]

### 2.3 · `TestService.CLI` — wrapping something that is not a SystemLynx service at all

The rule already has its hardest case built: this wraps **the real CLI as a child process** so saved
specs can test it. Its own comments carry the reasons, and they are the reasons a wrapper is written
well rather than merely written:

- *"Shelling out (rather than requiring the CLI fns in-process) keeps CLI state — cwd, manifest, its
  own client — isolated from this service."* — **the wrapper must not leak the thing it wraps into
  the test runner.**
- An isolated `SESSION_MANIFEST`, so session-persistence cases never touch the manifest other cases
  depend on — **one case's world is not another case's world.**
- A `timeoutMs` that kills a hung command, *"so a test can never hang forever"* — **because the
  runner has no per-test deadline of its own.**

::test[TestService.CLI.probe]

### 2.4 · And the ad-hoc form, for contrast

Same engine, written in place rather than saved:

:::run{title="Seed, then chain"}
- Math.add { "a": 2, "b": 3 }
- Math.multiply { "a": tv(steps[0].results.sum), "b": 4 }
:::

---

## 3 · What lands here

Empty on purpose. Each row gets written when we actually settle it, with the reason, so the fold
back into `spec-authoring` is a transcription and not a reconstruction.

| what | where it goes |
|---|---|
| **The purity LADDER, and that purity bounds what a red result can mean.** Pass the object in (zero translation, a failure is the subject's) → a door that is pure transcription, one line per method (a failure is the subject's *or* your transcription's) → a harness with real logic (rule out the harness first, every time). Stay on the lowest rung the subject allows; when you climb, say why in the spec | `spec-authoring` §1 — landed |
| **When the subject under test is the PLATFORM, the payload must be boring.** `add({a,b}) → {sum}` is the correct example, not a weak one: arithmetic cannot be the reason it failed. And do not treat the random subject as the lesson — such a spec is about neither the arithmetic nor the domain | `spec-authoring` §1 — landed |
| **A method's contract is finite; a sequence's is not.** You can enumerate inputs and failures — one `CLI.probe` file carries 13 cases. You cannot enumerate orders, so sequences are assembled where the question is asked, and `use: <saved action>` is the tell: a run block composes pieces that already carry contracts | `spec-authoring` §4.5 — landed |
| **Who defends it is the choice.** A saved spec at a namespace is defended by the change loop with nobody remembering. A run block is defended by a reader pressing it. A sequence anybody will ask about twice has become a contract — save it | `spec-authoring` §4.5 — landed |
| **A gap gets BOTH.** The run block in the gap reproduces the break; the saved spec carries the contract the fix established | `spec-authoring` §4.5 — landed |
| **THE TITLE IS THE SPEC** — what is proven, with the consequence attached, so a reader who never opens the file knows what the system guarantees. A failure line prints the step title, so the title decides whether a red tells anybody anything. `"create a mock user"` is the floor, not the standard | `spec-authoring` §3 — landed |
| **A declaration is an obligation; silence is not a prohibition.** `report=spec` means you owe one. No card means nobody decided, and that absence may never EXCUSE a missing spec — most good specs here were written by an agent that built something and knew it needed proving | `spec-authoring` §0 — landed, and it was a real defect: as written, §0 would have blocked the five specs buAPI wrote today |
| **Prove the spec can FAIL, and it is a procedure not a judgment:** delete the guard, run it, watch THAT step go red, restore, re-run green. Ninety seconds, and it never needs the old behaviour because you create it. **Green on the first run is a smell** | `spec-authoring` §3.5 — landed |
| **`After` is required, because a spec without one passes exactly once** — it counts its own history (a real case asserting 1 forum finds 8), and window-bounded clears cannot reach the residue once it ages out, so the spec goes permanently red with no cleanup that fixes it | `spec-authoring` §3 — landed |
| **Nothing is STUBBED — which is narrower than "no mocks".** The Plugin writes real documents; "mock" in `createMockUsers` means disposable fixture data, not a fake. Banning the word contradicted §1's own instruction to put logic in the Plugin | `spec-authoring` §3 — landed |
| **Find the first failing step before believing any red.** A `Before` that failed produces a wall of reds about a subject that was never called — one real case prints 24 assertion lines, none about the method under test. A red that misdirects is worse than a red | `spec-authoring` §5 — landed |
| **A fourth thing a red can mean: the harness you did not write.** Same code passing in one caller and failing in another, three wrong diagnoses deep, cause a cached service client with a frozen method map. The tell is the DIVERGENCE; report it as a fact rather than theorising from your side of it | `spec-authoring` §1 — landed |
| **Which method is the SUBJECT?** Name one → it goes at that namespace however many steps it takes; length is not the test, ownership is. Name three → it is a sequence. And a run block has no address, so **one in a document nobody reopens is unowned** | `spec-authoring` §4.5 — landed, replacing "focused on anything at all", which was not a criterion |
| **Before / Plugin / Mocks, by who could do it:** Before is what a user would really do, through the front door, even five steps, because those steps ARE the usage documentation · Plugin is what a user cannot do · Mocks seeds a running system for clicking, never a suite | `spec-authoring` §3 — landed |
| **The reference facts went to the GUIDE, not the procedure** — validator frequencies, `error.message` not `results.status`, anchor the `isLike`, the substring namespace filter, `Action<N>` renumbering silently | :file[agents/tests.md] — landed |
| **WHEN TWO CALLERS OF THE SAME CODE DISAGREE, CHECK THEIR VERSIONS BEFORE THEIR LOGIC.** Two agents measured one spec and got opposite answers — repo 2.40.0 vs published 2.39.0, whose `createMockFile` still returns a Buffer `convertToReadStream()` throws on. Both measurements were correct. The divergence was the tell and we both read it as a logic problem | :file[agents/tests.md] and `spec-authoring` §1 — landed |
| **`date()` IS a macro** — `moment(<arg>).toJSON()` — and the trap is the missing ARGUMENT: bare `date()` passes an empty string, moment calls it invalid, `null` reaches the database. The inference that produced the wrong claim — *used once in 227 cases, therefore not a macro* — is a good heuristic that pointed the wrong way | :file[agents/tests.md] — landed |
| **WHEN IS A UNIT TEST THE RIGHT ARTIFACT? Ask whether anything outside the code calls it.** A caller → the spec goes at that boundary and a unit test under it is redundant. No caller → the unit test is honest and a spec is ceremony, because wrapping a pure helper buys a door that exists only for the test. The trap: never unit test something that HAS a boundary because the unit is easier to reach. Tiebreak — what risk are you managing? A unit test cannot tell you the parts agree. **AND the window is outside the question: `::test` addresses `Service.Module.method`, so nothing in `src/` has a namespace to point one at — jest there is the only artifact that reaches the boundary, not a fallback** | `spec-authoring` — t3, buAPI's criterion plus the `src/` clause |
| **A TITLE THAT LIES MISDIRECTS A READER WHO HAS EVERY OTHER FACT.** Demonstrated live, within the hour, on the agent who told me to rewrite the title section: two steps titled *"should clear all mock users"* and *"clear mock tournaments"* were the SUBJECT, not teardown — so they wrote the trailing section off as cleanup and diagnosed the wrong cause in their own spec. Teardown-sounding titles on load-bearing steps are the worst case, because the `After`-is-cleanup convention is what makes the lie credible | `spec-authoring` §3 — landed |

---

::::thread{id=t1}
**`::test` vs `:::run` — when each one is right.** His: a test is for *"asserting clearly and
explicitly the different inputs and outputs of a particular method across scenarios, positive and
negative responses"*, pointed at the namespace hierarchy — the service, module and method. The run
block is the open half: *"a run block is for scenarios where… maybe it is an existence. Maybe
there's an existing test, and even when there's a gap you update the test — you throw the updated
test in the gap in most cases."*

**SETTLED.** The axis is not scope, it is **who defends it** — and the reason is arithmetic rather
than taste: a method's contract is finite and enumerable, a sequence's is not. So contracts are
SAVED at a namespace, where the change loop finds them unasked; sequences are ASSEMBLED where the
question gets asked, and `use: <saved action>` is the mechanism that makes a run block a composition
of already-contracted pieces rather than a cheap test of untested ones. His gap case takes both: the
run block reproduces the break, the saved spec carries the contract the fix establishes. In
`spec-authoring` §4.5.
::::

::::thread{id=t2}
**Purity, and what the Plugin is actually for.** His: the plugin facilitates each step being pure.
What is not yet written down is what IMPURITY looks like in a spec — the thing an agent would write
without knowing better.

**SETTLED, and the worked example came from buAPI rather than from me.** The ladder is in
`spec-authoring` §1 with the consequence that makes it matter — purity bounds what a red can MEAN.
And the Plugin turned out to be a **loophole in the rule**: a door may not decide whether the answer
is good, the Plugin is exempted as "test-side logic", so the Plugin can hold exactly the judgment the
door is forbidden, one inch away. A real one does: it measures a payload against a 256KB cap and
hands back `{ cap, under, over }` for the spec to assert, written that way because the alternative was
committing a 256KB fixture into the repo forever. That was the right trade.

So the rule is not *"logic goes in the Plugin."* It is: **if your Plugin decides anything, you must be
able to say in one sentence what a red there is ambiguous between** — *"the cap, or my facilitator."*
A door that cannot write that sentence should not be deciding. That is a door that decided WHILE BEING
RIGHT TO, which is a better teaching example than the quiet one I was looking for.
::::

::::thread{id=t3}
**What `spec-authoring` is missing.** It gets *assert the contract* right. The gap is readability as
a REQUIREMENT rather than a nicety, and the unit-test case that still exists alongside all of this.

**THE READABILITY HALF IS SETTLED and it was the biggest hole in the skill.** The title is the
artifact — what is proven plus the consequence — and the reason it is a requirement rather than a
nicety is mechanical: a failure line prints the step title, so the title decides whether a red is
usable. The old examples (`"create a mock user"`) taught the floor while calling it the standard.
`spec-authoring` §3 now carries the strong ones.

**SETTLED, and the criterion is buAPI's.** One question decides it: **does anything outside this
code call it?**

- **Yes** → the spec goes at that boundary, and a unit test underneath is mostly redundant: you
  would be testing the inside of something whose outside you can already assert.
- **No** — a genuine internal helper with no caller — → the unit test is the honest artifact and a
  spec is ceremony. Their example: `mapNamespace("content[0].options[1].label")` →
  `["content","0","options","1","label"]`. Pure, a dozen interesting inputs, no caller outside its
  module. It could be wrapped as `Test.Namespace.map` and spec'd — rung 2, three lines, perfectly
  legal — and it would buy nothing, at the cost of a door that exists only for the test. The spec
  belongs one level up, where a caller actually arrives.

**The trap is on the other side, and it is the one to write down: do not unit test something that
HAS a boundary just because the unit is easier to reach.** That is how you get a green suite and no
evidence the system works.

**And the tiebreak when the first question is ambiguous: what risk are you managing?** A unit test
cannot tell you the parts agree. If the risk is integration — in a five-service system it nearly
always is — a thorough unit test is irrelevant no matter how good it is. Pick the artifact that can
fail for the reason you are actually afraid of.

**ONE CLAUSE TO ADD, because buAPI could not see it from a repo of services.** Their closing
observation is that this repo has no unit tests *not* by doctrine but because everything in it has a
caller. That is true of services and false of the window, and the difference is not a judgment call —
it is mechanical. **A `::test` chip addresses `Service.Module.method`; the window is not a service,
so there is no namespace to point one at.** For anything in `src/` the boundary is the rendered
surface and jest/react-testing-library is not a fallback, it is the only artifact that can reach it.
The criterion still does the work there — it says test at the surface a user meets, not at a
component's internals — but "write a spec instead" is not an option on the table, and a skill that
implies it is would send every agent working in `src/` looking for a door that does not exist.
::::
