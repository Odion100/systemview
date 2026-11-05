# Tests — a guide for agents

This document is written **for AI agents** working in a SystemLynx codebase with SystemView installed.
It explains what SystemView tests are and how to **read, author, and run them** — including the exact
on-disk JSON, shared actions, and the reference system. The human-oriented overview is in the
[README](../README.md#building-a-test); the CLI command reference is in [cli.md](cli.md).

---

## What a test is

A test is an **ordered list of named sections**. `before / main / events / after` are just the
*default* sections — a reusable **shared action** (formerly "named action") inserted into a test becomes its own section, a peer
of the built-ins. The engine loops the order; each section is an array of **steps** (method calls with
args and evaluations).

- Saved tests live in the service repo at **`specs/tests/<Module>.<method>.json`** — one file per
  method, an **array** with one entry per saved test. A test's **slot** is its index in that array
  (save-over and delete address slots; the UI computes them correctly even in aggregated
  module/service views).
- Shared actions live one-per-file at **`specs/actions/<name>.json`**.
- The top-level `namespace` is what the test is *of* — it decides the file. Main steps may call any
  connected method, but **at least one Main step must match the top-level namespace**.
- **The entry's `title` and `namespace` are not optional, and losing them fails silently.** A step
  carries its own namespace — what that step *calls* — so a file copied step-first looks complete and
  parses fine. But the runner keeps only the tests whose TOP-LEVEL `namespace.serviceId` matches the
  service it asked (several services can share one specs folder, and without that filter a shared spec
  runs once per sibling). Entries with no top-level namespace are dropped, and the report reads
  `<project> has no saved tests` — blaming the project for the shape of the file.

## Writing one — PROBE THE METHOD FIRST

An evaluation is an assertion about a **real response**, so read the real one before writing any.
`probe` is the door: it calls one method on a registered service and hands back exactly what the
runner will see.

```
mcp__systemview__probe({ namespace: "Test.Proofs.claimKind", projectCode: "systemview-test" })
systemview probe <ServiceId>.<Module>.<method> --json          # the same door from a terminal
```

Then write the `savedEvaluations` from the shape in front of you — one per field you mean to hold.

**Do not hand-roll a client script to call a method.** `createClient().loadService(url)` in a
throwaway file is the slow way to get a worse answer: probe resolves the namespace the way the
runner resolves it, carries the project's headers, and tells you which URL answered — so a service
registered twice or answering on a stale port shows up as a fact instead of a mystery.

Three traps, each measured rather than guessed:

- **An array's `expected_type` is `"array"`, not `"object"`.** `"object"` fails with
  `expected "object", got "array"` — a spec that is wrong about its own shape, which reads at a
  glance like the method being wrong.
- **The runner prints only FAILING evaluations.** A field with no validations is saved and stays
  invisible, so a `why`/`reason` string that explains a red never reaches the reader. Assert it
  EMPTY (`{"name": "strEquals", "value": ""}`) and any reason becomes a failure line carrying its
  own text — `results.why → expected "", got "the hub has no chatHubDir() door"`.
- **A precondition belongs in the ANSWER, not in a throw.** A method that dies on a missing fixture
  reports every field as `undefined`, and the report then blames twenty assertions for something
  that happened before the first one ran. Return `{ fixturesRunning: false, why: "…" }` and assert
  `fixturesRunning` — a red then says which fixture and what to run.

## Test entry schema

```json
{
  "title": "the test's own name (may differ from Main's title)",
  "namespace": { "serviceId": "TestService", "moduleName": "Math", "methodName": "chainUse" },
  "Before": [ /* steps */ ],
  "Main":   [ /* one or more steps */ ],
  "Events": [ /* steps whose methodName is "on" — event listeners, any connected service */ ],
  "After":  [ /* steps */ ],
  "sections": { "seedSum": { "use": "TestService.seedSum" } },
  "run": ["before", "events", "seedSum", "main", "after"]
}
```

- `sections` + `run` are **optional** — omit both for the classic four-section shape (default order
  `before, events, main, after`).
- A named section is either `{ "use": "<Service>.<actionName>" }` (a **reference** — the stored
  action's steps splice in at load time; one definition, many tests) or an inline steps array (a
  private **copy**).
- **A REFERENCE CARRIES THE SERVICE THAT STORES IT** (changed 2026-08-18). Actions live under the
  service they were saved on (`specs/actions/<name>.json`), and the name alone never said which one —
  so every surface used to sweep every service in the project before it could show you a test.
  `{ "use": "TestService.seedSum" }` is answered by one service. A bare `{ "use": "seedSum" }` still
  resolves, but **only against the test's own service** — there is no fallback sweep, so a reference
  to another service's action must be qualified or it will not resolve.
- **The key and the `use` value are different concepts, even when they're the same word.** The KEY is
  the section's *instance name in this test* — it's what references (`test.seedSum[0].results`) and
  `run` entries address (the call site). The `use` VALUE names the stored action — which
  `specs/actions/<name>.json` to pull steps from (the definition). Inserting an action once defaults
  the key to the action's name, so the common case reads `"seedSum": { "use": "TestService.seedSum" }`
  — a defaulted key, a qualified definition.
- The same action can appear as multiple sections under distinct instance keys (`seedSum`,
  `seedSum_2`, …) — each key must be a valid identifier because references address it
  (`test.seedSum_2[0].results`). Two instances, two positions in `run`, two result sets, one definition.

## Step schema

Every entry in `Before/Main/Events/After` (and in an action's `steps`) is:

```json
{
  "title": "human description — REQUIRED to save",
  "namespace": { "serviceId": "TestService", "moduleName": "Math", "methodName": "add" },
  "args": [
    {
      "name": "argument:",
      "input": { "a": 2, "b": 3 },
      "input_type": "object",
      "data_type": "",
      "targetValues": []
    }
  ],
  "savedEvaluations": []
}
```

`args` is positional — one entry per argument the method receives. `input` holds the literal value
(object, string, number, array…); `input_type` matches it.

### References inside args — `targetValues` is REQUIRED

An arg value can reference an **earlier step's output**. Two things must both be present (the UI writes
both; if you hand-author, so must you — the runner resolves from `targetValues`, it does not re-parse):

1. the reference string at its spot in `input`, and
2. a matching entry in `targetValues`:

**AND THE `Action<N>` / `before[N]` INDEX IS POSITIONAL, which is the most error-prone thing in this
format.** `beforeTest.Action3.results._id` names the third Before step by its PLACE, so **inserting a
Before step silently renumbers every reference after it** — the spec stays valid JSON, resolves to the
wrong step, and fails somewhere that has nothing to do with what you changed. Adding a setup step
means re-reading every reference below it.

```json
{
  "name": "argument:",
  "input": { "base": "test.before[0].results.sum" },
  "input_type": "object",
  "data_type": "",
  "targetValues": [
    {
      "target_namespace": "test.before[0].results.sum",
      "source_map": ["input", "base"],
      "source_index": 0
    }
  ]
}
```

- `target_namespace` — the reference (or the whole string containing an embedded token, see below).
- `source_map` — the path to the spot inside this arg object, always starting `"input"`.
- `source_index` — character offset of the token inside the string at that spot (`0` when the value IS
  the reference).

Reference grammar (`test.<section>[i].<field>.<path…>`):

```
test.before[0].results.sum        # step 0 of Before
test.seedSum[1].results.product   # step 1 of the seedSum action section
test.main[0].error.message        # a thrown error (error ≡ results — both resolve)
beforeTest.Action1.results        # legacy positional form — still resolves
```

Embedded form — a reference **inside** a larger string is written `tv(...)`:
`"id-tv(test.before[0].results.userId)-suffix"` (the `targetValues` entry then carries that full
string as `target_namespace` with the token's `source_index`).

### `random(n)`

`random(6)` anywhere inside a string arg → 6 fresh random alphanumerics **on every run**
(`"user_random(6)@test.com"`), for unique emails/usernames in reusable actions. Register it like an
embedded reference: a `targetValues` entry whose `target_namespace` is the whole string, `source_index`
0. **`mockFile(name.ext)` and `date(...)` are the same shape, and ONE resolver serves both faces** —
`cli/runTests.js` and `api/runTests.js` each take `transformTests` and `FullTestController` from
`testing-utilities/`, and `test-helpers.js` wires `createMockFile` in for both. There is no browser
copy and no Node copy.

**BUT WHICH BINARY YOU RAN DECIDES WHETHER THAT IS TRUE FOR YOU, AND THAT IS THE REAL TRAP HERE.**
`node cli/index.js` runs the repo. `systemview` and `npx systemview` run whatever is installed
globally for the active node version — and the installed copy can be months behind. Measured
2026-11-04: the repo is **2.40.0**, npm's latest is **2.39.0**, and three global installs exist
(`2.39.0` under node 20 and 22, **`1.20.1`** under node 14), so `nvm use` silently changes which CLI
you are testing with.

In 2.39.0 `createMockFile` still returns a **Buffer** — which `convertToReadStream()` throws on, so
an upload arrives as a stripped argument — and still writes the mock **into the current directory**,
leaving untracked `test.png`-style litter in whatever repo root you ran from. Two agents measured the
same spec and got opposite answers for exactly this reason.

**So when two callers of the same code disagree, CHECK THEIR VERSIONS BEFORE THEIR LOGIC.**
`node -e 'console.log(require("systemview/package.json").version)'` and `npm view systemview version`
cost two seconds; the alternative cost a day across two sessions.

**`date(...)` TAKES AN ARGUMENT, and a bare `date()` is the trap.** It resolves as
`moment(<arg>).toJSON()`, so:

| written | resolves to |
|---|---|
| `date()` | **`null`** — an empty argument is an invalid moment, and `null` then fails to cast on a required date field |
| `date(2026-01-01)` | `"2026-01-01T05:00:00.000Z"` |

So a spec that is permanently red on a date field is almost always missing the argument rather than
meeting a macro that does not exist. Give it one.

## Evaluations — `savedEvaluations`

Assertions on a step's response. Each targets one path of the response:

```json
{
  "namespace": "results.seeded",
  "expected_type": "number",
  "validations": [{ "name": "numEquals", "value": "tv(test.seedSum[0].results.sum)" }],
  "save": true
}
```

**THE VALIDATORS YOU WILL ACTUALLY REACH FOR, by how often they are used across 227 real cases:**
`strEquals` (485) · `numEquals` (376) · `lengthEquals` (333) · `minLength` (37) · `isLike` (31) ·
`boolEquals` (30) · `dateEquals`. Those seven cover nearly everything; reach past them only when the
shape genuinely needs it.

**ERRORS ASSERT ON `error.status` AND `error.message` — never `results.status`.** A thrown failure
does not arrive as a result, so a spec asserting on `results.*` for an error case is asserting about
a response that was never produced.

**AND ANCHOR AN `isLike` REGEX.** `"^unsupported source url protocol 'file:'"` passes only on that
message; without the `^` it also passes on a longer, different, wrong one — which is an assertion
that goes green for the wrong reason, the single failure mode this whole file exists to prevent.

- `namespace` — path into the response: `results.<path>` (use `results` even for errors).
- `expected_type` — `string | number | boolean | object | array | date | null` (type-checked first).
- `save: true` — required, only saved evaluations run.
- **`value` may be a `tv(...)` reference** — assert one step's output against another's, resolved at
  run time.

Validation names by type:

| Type | Validations |
| --- | --- |
| number | `numEquals`, `max`, `min`, `isOneOf` (comma-list) |
| string | `strEquals`, `isLike` (regex, case-insensitive), `isOneOf`, `lengthEquals`, `maxLength`, `minLength` |
| boolean | `boolEquals` |
| array | `includes`, `lengthEquals`, `maxLength`, `minLength` |
| date | `dateEquals`, `maxDate`, `minDate` |

**THE ROWS ARE A GATE, NOT A MENU — a name from the wrong row does not fail, it does NOTHING.**
Every validator is a reduce that ignores names it does not match, so `includes` on a string or
`lengthEquals` on a number is an assertion that never ran, and the step goes green having asserted
nothing. That is reported now — as `unknownValidation`, naming the typo and offering the names that
do exist for that type — but the commonest version of the mistake is a name that is real for a
DIFFERENT type, which reads correct and is the one to check first when a step passes and you do not
believe it.

**EVERY NAME IN THAT TABLE CAN BE WRITTEN IN A DOCUMENT — name the validator outright.** A `:::run`
block and a saved spec are one engine: `toEvaluations` in `RunBlock.js` compiles an assertion line
into the same `{namespace, expected_type, validations, save}` shape, assigns it to the same
`savedEvaluations` field, and hands it to the same validators. Two forms, and the symbols are only a
shorthand for the common ones:

```
✓ results.total = 5                  ✓ results.tags includes "forum"
✓ results.count >= 1                 ✓ results.role isOneOf admin,owner
✓ results.name ~ ser_                ✓ results.items lengthEquals 3
```

The named form takes any validator the authoring picker offers, and the table is DERIVED from that
picker — so a validator added there reaches documents with no change here. A name nothing implements
is dropped, counted, and reported as "N assertions couldn't be read"; it never becomes a passing
assertion.

Two things to know. **The three length validators are translated, not typed**: they are legal on
strings and arrays, so `minLength 2` becomes `min 2` on `path.length` — the same claim with the
ambiguity removed, and `.length` resolves for both. **And `>` / `<` are deliberately absent**, in
both forms: faking them with `value±1` is wrong for anything non-integer.

**AND THERE IS NO PER-TEST DEADLINE.** A method that genuinely hangs hangs the whole run with no
message and no failing line — so never write a step that can block forever (an unbounded wait, a
poll with no ceiling, a door that may never answer). A spec that times out is debuggable; a run that
hangs looks like a runner that is broken.

## Shared actions — purpose, and the procedure

Shared actions exist for **efficiency across the suite**: the repeated multi-step setup blocks that
tests keep rebuilding (sign in, seed the data, enroll the user, …) get extracted ONCE and referenced
everywhere. Creating them is a procedure, not a judgment call:

1. **Survey the suite's tests** and list each one's setup sequence. Don't skip this — actions come
   from what repeats, never from imagination.
2. **Keep only the blocks that clear the bar: multi-step AND used by multiple tests.** Used once =
   just a regular Before section. One step = just write the step.
3. **Extract each surviving block** to `specs/actions/<name>.json`, with `random(n)` in its data so
   instances never collide.
4. **Refactor the tests onto them** — `{ "use": "<Service>.<name>" }` sections, comprehensively, not two at a
   time.

**Composition is the reference system.** Actions don't nest (`{use}` resolves at the test level) —
tests COMPOSE actions by stacking sections in `run` and wiring them together with namespace
references: the action sets up users, the next section reaches into its results by instance key —
`tv(test.seasonHost[0].results.userId)` (with the matching `targetValues` entry, as always). That's
what lets each action stay **self-contained on its own** (its internal refs address its own name,
randomized data via `random(n)` so instances never collide) while still **working together** in any
test that stacks it — agnostic units, wired at the seams by references.

## Shared action schema — `specs/actions/<name>.json`

```json
{
  "name": "seedSum",
  "namespace": { "serviceId": "TestService", "moduleName": "Math", "methodName": "add" },
  "steps": [ /* step schema above; refs may address the action's OWN section: test.seedSum[0]... */ ]
}
```

An action's internal references use its own name as the section key — when inserted under an instance
key (`seedSum_2`), they resolve within that instance.

**Authoring one by hand:** write `specs/actions/<name>.json` in the OWNING service's specs folder —
`name` matching the filename, `namespace` pointing at a real method (where it was authored), `steps`
using the step schema above.

**Actions resolve PROJECT-WIDE.** An action stores under one service, but every test in the project
can `{ "use": ... }` it — the UI and CLI merge all services' actions into one map. Action names are
therefore project-wide: on a collision the first-registered service's action wins, so keep names
unique across the project.

## Rules the UI enforces on save (respect them when writing files by hand)

- The top-level `namespace` must be a **real method on a connected service** — that's the file it saves to.
- **≥ 1 Main step** must match the top-level namespace.
- Every step needs a `title`, **and it must describe THAT STEP — never repeat the test's own
  title.** The step title is the label printed over the method call, in the runner's output and in
  the window, and it is the only place a reader learns what the call is for. Measured on this
  project: 27 of 33 step titles were a copy of the test's title, which satisfies "needs a title"
  and leaves the method sitting under a label that says what the header above it already said. The
  test title says what is being CLAIMED; the step title says what this call DOES — *"count a
  document with a proof and one without, and compare the totals"*, not *"counts marks, not
  proofs"*. In a multi-step spec the titles read in sequence and become the explanation, which is
  what makes a run narrate itself when pressed.
- A step with evaluations enabled needs ≥ 1 saved evaluation.
- Overwrites address a **slot** (array index) in the test's own file — never an index from an
  aggregated list.

## Running

```bash
systemview test <projectCode>                 # everything
systemview test <projectCode> Math.chainUse   # SUBSTRING filter — see the warning below
systemview test <projectCode> --json          # structured output for agents/CI — exit 0/1
```

**THE NAMESPACE FILTER IS A SUBSTRING, AND THAT MEANS "I RAN JUST THAT ONE" IS OFTEN FALSE.**
`Games.add` also runs `Games.addPlay`. Any method whose name is a prefix of a sibling drags the
sibling in and **can never be run alone** — so a count of what you exercised, and any claim about
which spec went red, has to be read off the output rather than inferred from the filter you typed.

Hand-written spec files are picked up as-is — the UI lists them under the method (and its module/
service pages), and `systemview test` runs them. Full command flags: [cli.md](cli.md).

**AND A DOCUMENT'S SPECS RUN WITHOUT THE WINDOW — `runProofs`.** `systemview test` reaches saved
specs; the `:::run` blocks and `::test` chips living inside an RFC, arc, plan, gap or report are
collected and run by `runProofs({projectCode, document})`, results in the same shape `runTests`
gives. Scope it with `document`, `objective` (`ARC-004-O2`), `arc`, or none of them for every
document in the project; `bail` stops at the first failure and `dryRun` lists what WOULD run.

Two things it does that matter when you read the output. It **names any spec it could not build**
rather than dropping it — a `::test` chip pointing at another project's namespace comes back as
"no saved test matching …", which is a finding and not a silent pass. And it **never collects a
`:::cmd`**: that is a command for a human to press, not a spec, so anything a cmd does that needs
defending has to be wrapped in a run block.

So nothing in a document needs a human to press it in order to be checked.
