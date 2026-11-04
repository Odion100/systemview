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

**PART SETTLED** — the ladder is in `spec-authoring` §1, and with it the consequence that makes it
matter: purity bounds what a red result can MEAN. What is still open is the Plugin's half. The skill
says test-side logic goes in `Plugin` and never in a door, and that a door may call, read, count and
hand back but may not decide whether the answer is good. What it does not yet carry is a worked
example of a door that quietly decided — the shape an agent writes while believing it is being
helpful.
::::

::::thread{id=t3}
**What `spec-authoring` is missing.** It gets *assert the contract* right. The gap is readability as
a REQUIREMENT rather than a nicety, and the unit-test case that still exists alongside all of this.

Open.
::::
