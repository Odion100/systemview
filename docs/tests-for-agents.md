# Tests — a guide for agents

This document is written **for AI agents** working in a SystemLynx codebase with SystemView installed.
It explains what SystemView tests are and how to **read, author, and run them** — including the exact
on-disk JSON, named actions, and the reference system. The human-oriented overview is in the
[README](../README.md#building-a-test); the CLI command reference is in [cli.md](cli.md).

---

## What a test is

A test is an **ordered list of named sections**. `before / main / events / after` are just the
*default* sections — a reusable **named action** inserted into a test becomes its own section, a peer
of the built-ins. The engine loops the order; each section is an array of **steps** (method calls with
args and evaluations).

- Saved tests live in the service repo at **`specs/tests/<Module>.<method>.json`** — one file per
  method, an **array** with one entry per saved test. A test's **slot** is its index in that array
  (save-over and delete address slots; the UI computes them correctly even in aggregated
  module/service views).
- Named actions live one-per-file at **`specs/actions/<name>.json`**.
- The top-level `namespace` is what the test is *of* — it decides the file. Main steps may call any
  connected method, but **at least one Main step must match the top-level namespace**.

## Test entry schema

```json
{
  "title": "the test's own name (may differ from Main's title)",
  "namespace": { "serviceId": "TestService", "moduleName": "Math", "methodName": "chainUse" },
  "Before": [ /* steps */ ],
  "Main":   [ /* one or more steps */ ],
  "Events": [ /* steps whose methodName is "on" — event listeners, any connected service */ ],
  "After":  [ /* steps */ ],
  "sections": { "seedSum": { "use": "seedSum" } },
  "run": ["before", "events", "seedSum", "main", "after"]
}
```

- `sections` + `run` are **optional** — omit both for the classic four-section shape (default order
  `before, events, main, after`).
- A named section is either `{ "use": "<actionName>" }` (a **reference** — the stored action's steps
  splice in at load time; one definition, many tests) or an inline steps array (a private **copy**).
- The same action can appear as multiple sections under distinct instance keys (`seedSum`,
  `seedSum_2`, …) — each key must be a valid identifier because references address it
  (`test.seedSum_2[0].results`).

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
0. Also usable via `date(...)` / `mockFile(name.ext)` as whole-string functions.

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

## Named action schema — `specs/actions/<name>.json`

```json
{
  "name": "seedSum",
  "namespace": { "serviceId": "TestService", "moduleName": "Math", "methodName": "add" },
  "steps": [ /* step schema above; refs may address the action's OWN section: test.seedSum[0]... */ ]
}
```

An action's internal references use its own name as the section key — when inserted under an instance
key (`seedSum_2`), they resolve within that instance.

## Rules the UI enforces on save (respect them when writing files by hand)

- The top-level `namespace` must be a **real method on a connected service** — that's the file it saves to.
- **≥ 1 Main step** must match the top-level namespace.
- Every step needs a `title`; a step with evaluations enabled needs ≥ 1 saved evaluation.
- Overwrites address a **slot** (array index) in the test's own file — never an index from an
  aggregated list.

## Running

```bash
systemview test <projectCode>                 # everything
systemview test <projectCode> Math.chainUse   # substring namespace filter
systemview test <projectCode> --json          # structured output for agents/CI — exit 0/1
```

Hand-written spec files are picked up as-is — the UI lists them under the method (and its module/
service pages), and `systemview test` runs them. Full command flags: [cli.md](cli.md).
