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

### 2.2 · `TestService.Math.chainUse` — the pure local wrap

The Math object turned into a service. Completely local, nothing to stand up, and it is where the
chaining mechanism is demonstrated rather than described: `Before` adds 1+1, `Main` reaches back
into it by address.

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

---

::::thread{id=t1}
**`::test` vs `:::run` — when each one is right.** His: a test is for *"asserting clearly and
explicitly the different inputs and outputs of a particular method across scenarios, positive and
negative responses"*, pointed at the namespace hierarchy — the service, module and method. The run
block is the open half: *"a run block is for scenarios where… maybe it is an existence. Maybe
there's an existing test, and even when there's a gap you update the test — you throw the updated
test in the gap in most cases."*

Open. Discussing in the chat; what lands comes back here.
::::

::::thread{id=t2}
**Purity, and what the Plugin is actually for.** His: the plugin facilitates each step being pure.
What is not yet written down is what IMPURITY looks like in a spec — the thing an agent would write
without knowing better.

Open.
::::

::::thread{id=t3}
**What `spec-authoring` is missing.** It gets *assert the contract* right. The gap is readability as
a REQUIREMENT rather than a nicety, and the unit-test case that still exists alongside all of this.

Open.
::::
