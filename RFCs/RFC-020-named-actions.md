# RFC-020: Named Actions — reusable action sequences, referenced by natural path, run by the test engine

**Status:** Approved — building.
**Depends on:** RFC-018 "Stories" (shipped).
**Replaces:** the earlier convoluted RFC-020 draft (rewritten from scratch after the code-map review).

This is **one piece of work**: named actions (the feature), the reference-resolution fix that makes them
work, a stage component that runs and stores their results, and the CLI-as-a-service change that hosts the
temporary ones. All of it lives here.

## One-liner

A **named action** is a **named, self-contained sequence of steps** — the same shape as a test's
`before`/`main`/`after` section — that the **test engine runs as a section of a test**, and
that is either **permanent** (saved per service, reused inside tests) or **temporary** (owned by the CLI,
run ad-hoc). It's the "reuse actions in a bigger way" primitive: instead of asking the AI to run something
every time, you **save it and press run** — and the results live in the story.

## The crux — references are a natural path, not a position (backward compatible)

This is the heart of the change, and it fell out of the code-map review. The test engine already carries
`obj()` (`obj().get/parse` in `test-helpers`), which **walks any object/array hierarchy**. The
hierarchical-reference primitive is **already there**. What's bolted on top is a *positional* translation:

**Today** — `Argument.class.js` `getTargetValue` (≈L80-87) takes `beforeTest.Action1.error` and rewrites it
to `0.0.results` before handing it to `obj(FullTest).get(...)`:

```js
// beforeTest→0, mainTest→1, Events→2, afterTest→3 ; ActionN → N-1 ; error → results
"beforeTest.Action1.error"  →  obj(FullTest).get("0.0.results")
```

Those `Action1/Action2` labels are a **UI presentation concern** — synthesized to mirror the panel's
"Section → Action N" display. They are **not** a property of the data — they're positional, so they don't
survive the test's shape changing. The forward form keys by **section name** on the reference object instead.

**The fix — resolve the target as a real path into the (expanded) results structure `obj()` already
understands.** Positional stays for **backward compatibility**; the forward form is a natural walk:

- **Legacy (kept):** `beforeTest.Action1.error` → still resolves exactly as today.
- **Forward:** start at the run and go **down the map** — by section name, then by index **or by an
  action's name**, then the field:

```
test.before[0].results            // first step of Before, its saved result
test.before.signIn.results        // the step named "signIn" (a used named action), its result
test.main[2].results.userId       // reach into a nested field of a step's result
```

Same resolver underneath; the reference is a path, not an index that shifts. Referencing an **action by
name** works because a `use`d named action contributes its name into the stream (see below), so
`test.before.signIn.results` addresses it directly instead of guessing its position.

### Example target values (before → after)

| Intent | Today (positional) | Forward (natural path) |
| --- | --- | --- |
| First Before step's result | `tv(beforeTest.Action1.error)` | `tv(test.before[0].results)` |
| A used action's result, by name | *(not possible — position-only)* | `tv(test.before.signIn.results)` |
| A field inside a Main result | `tv(mainTest.Action3.error).userId` | `tv(test.main[2].results.userId)` |

`tv(...)` is the existing target-value token; only the **path inside it** changes. Both forms run through
the one `getTargetValue`.

## The model — named actions ARE sections (an ordered list of named procedures)

**This supersedes the earlier "splice `{ use }` steps into fixed sections" model.** A test is an **ordered
list of named procedures**, not four fixed slots.

- `before`, `main`, `events`, `after` are **built-in default sections** — they stay, still special (events
  especially: listened first). A **named action is just another section**, a peer of those, **inserted
  among them**. Nothing is spliced *inside* a section.
- A **named procedure = a name + an ordered list of steps**, stored reusably in `specs/actions/<name>.json`.
  A test's section **references** one by name; it does not copy it. Procedures do **not** nest — you
  compose by listing several sections in the run-procedure (`["before","seedSum","seedTen","main","after"]`),
  each its own section, never one inside another.

**Two structures, decoupled — placement vs address:**

- **The reference object** — the test carries each section as a key:
  `{ before:[…], main:[…], events:[…], after:[…], <named>:[…] }`. References resolve by walking it with
  `obj()`: `test.seedSum[0].results` → `object.seedSum[0].results`. Keyed by name, order-agnostic — no
  `SECTION_INDEX`, no tag-gathering. The object's shape **is** the reference path.
- **The run-procedure** — an ordered list of section names the engine loops:
  `run: ["before", "seedSum", "main", "after"]`. It **always starts with `before`, ends with `after`**;
  `main` and named sections slot between. Each entry is a **key into the reference object** — loop the
  list, run `object[name]`'s steps. Events stay special (asterisk): listened first, outside the reordering.

Because the two are separate, **reordering the run never disturbs a reference** — move `seedSum` in the
list and `test.seedSum[0].results` still resolves. **Placement is the list; address is the object.** And
because every section is a peer key on one object, a section may freely reference **any earlier section**
(the old "never reach out of your own stream" restriction is dropped — it only existed for splice-in-place).

**Backward compatible:** a test with no `run` list defaults to `["before","main","after"]` (events special),
so every existing `{ Before, Main, Events, After }` test runs unchanged.

**In the code this is deletions, not additions:** the hardcoded `SECTION_INDEX`, the
`[...Before,...Events,...Main,...After]` concat, and the four-slot destructuring collapse into ONE generic
path — loop the run-list, deref the object. before/main/after go through the SAME path a named section does.

## Addressing — stored per service, so referenced by namespace

This isn't a design fork; it falls out of the storage model. Actions are **stored per service**, so you
address them by their namespace — the same way everything else in SystemView is filed:

- **Permanent** → saved under the service in `specs/actions/<name>.json` (a third sibling to `specs/docs/`
  and `specs/tests/`). Referenced by its **namespaced path**, e.g. `use: "TestService/Math/signIn"` (or a
  shorter form the resolver disambiguates), the same shape tests already use.
- **Temporary** → owned by the **CLI-as-a-service** (below) under `.systemview/actions/<name>.json`.
  Because the CLI registers itself **as a service** in the window, a temp action is addressed under the
  **CLI-service's namespace** — it points at that service, not at one of your project's services.

## Two lifetimes — permanent vs temporary

|                   | Permanent                                                                    | Temporary                                                          |
| ----------------- | ---------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| **Lives in**      | `specs/actions/<name>.json` (third sibling to `specs/docs/` & `specs/tests/`) | `.systemview/actions/<name>.json`                                  |
| **Filed under**   | the **service** it belongs to                                                | the **CLI-service** namespace                                      |
| **Created by**    | authored / saved to the repo (travels with it)                               | the **CLI**, ad-hoc                                               |
| **For**           | **reuse inside tests** — efficient tests, shared setup                        | throwaway "do this for me" runs (seed data, add a role, mock steps) |
| **Reachable via** | plugin/CLI spec loaders (like tests/docs)                                     | the **CLI-as-a-service**, which owns `.systemview`                |

**Where each can be referenced:** a **permanent** action can be reused in **tests** _and_ referenced in
**stories**. A **temporary** action can be used in **stories** but **not in tests** — a test lives _in_ the
project; a temporary action lives _outside_ it (in the CLI-service's `.systemview/`), so there's no
reference path from a test to it.

## Run by the test engine

Named actions run through the **existing test engine** (`testing-utilities/` — `FullTestController` /
`Test.class` / `transformTests`), not a new runner. The engine gains one pass:

1. **Assemble** — in `transformTests` (`initializeSavedTests`), build the test's **reference object**
   `{ before, main, events, after, <named>… }`: each built-in section from the test, each **named section**
   by pulling the referenced procedure (permanent from `specs/actions/`, temp from `.systemview/actions/`)
   by name. Also build the **run-procedure** — the ordered list of section names (default
   `["before","main","after"]`, events special).
2. **Run** — loop the run-procedure (`runFullTest`), running each section's steps in order; `save` /
   `targetValues` chaining works because every prior section's results sit on the shared reference object.
3. **Expose** — every section's `save:true` results live on the object under its name, addressable as
   `test.<section>[i].results` by any later section.

## Enhancement — references in evaluations reuse the SAME resolver

Today a `savedEvaluations` validation (`validators.js` `evaluate`, ≈L9-33) compares against a **literal**
`value`. Let `value` also be a **reference to a saved result** — but **not a new mechanism**: it resolves
through the **same** `getTargetValue` path resolver a step arg uses. Once the stored test maps references
as real paths, an evaluation can reach **any** previous value for free:

```jsonc
"validations": [ { "name": "equals", "value": "tv(test.main[0].results.userId)" } ]
```

An alias (`ref()` / `refValue`) may be added for readability at the call site, but it's the one resolver
underneath — the invented `$ref` token from the prior draft is dropped.

## The runner component — set up actions, or run them and keep the results

This is a **separate feature** from named actions (they're the reusable data; this is how you *use* them in
a story). A **stage component** that:

- **holds a named action** (permanent or temporary),
- **runs it** — *you* press run, **or** the agent runs it and drops the results in,
- **stores the results inline** in the story, so a **refresh keeps them** (persisted, like a test-story
  block keeps its run state),
- can **clear** the stored results.

It's the payoff of the whole RFC: instead of "hey, run this for me," an action + its results go straight
into the story — you run it yourself, or I run it and show you the output, right there in the window. It's
the test-as-story block's sibling, but **affirmative** (about *doing*, not pass/fail).

### Interactive vs non-interactive — the reconciliation rule

- When **you** run `systemview` interactively, that session is the service the UI is bound to.
- When the **agent** runs actions **outside** your interactive session, it does **not** broadcast — it
  **writes results to the story on disk**, and you see them on the next refresh. It should not try to push
  live updates it has no channel for.
- **Live-as-you-go** is optional and later, and it does **not** need the CLI holding a socket: an action
  hits the **API**, and the **API** owns the socket broadcast. No new socket plumbing in the CLI.

## The infrastructure it needs — CLI-as-a-service

The **temporary** path (`.systemview/actions/`) and running actions **from the UI** shouldn't need the
plugin. Today the CLI is a one-way **client** of the API. Flip it: the **CLI launches its own SystemLynx
service and registers with the API**, so the handle goes both ways — **UI → API → CLI**.

**Today (one-way):**

```
CLI ──loadService──▶ SystemView API (:3000) ──RPC──▶ each service's PLUGIN ──▶ .systemview / files
UI  ─────────────────▶ API ─────────────────────────▶ plugin
```

**Proposed (two-way):**

```
CLI launches a service ──registers──▶ API ──RPC──▶ CLI service ──▶ .systemview / test engine / connections
UI ──────────────────────────────▶ API ─────────▶ CLI service (direct handle)
```

The CLI runs in the project's cwd, next to `.systemview/` and the test engine, so it's the natural **local
authority**. It owns:

- **`.systemview/`** — temporary named actions (`.systemview/actions/`) and the runtime files already there,
- **running named actions via the test engine** (already CLI-side) — so the UI can trigger a run and watch
  results **without the plugin**,
- **local connection management**.

**It exposes the plugin providers too.** The CLI-service surfaces the same provider surface the plugin does
— `getDoc` / `getTests` / `saveTest` / `readFile` / `listFiles` / `changedFiles` / … — not just actions.
That's what makes it **standalone and project-agnostic**: point it at any repo, no SystemLynx required, and
you still get docs/tests/files/actions over one service surface. The in-service plugin stays for a running
service's own ground truth; only **project-local** concerns live on the CLI-service.

### It shows up in the UI as its own service

The CLI-service **injects into the window like any other connected service** — it appears in the **nav bar**
(styled specially, since it's not one of your project's services), with its **own namespace**. So it's a
home for stories, docs, tests, and named actions that's **separate from your project but can speak to it** —
and to every other connected service. Call it **"CLI"** for now (changeable).

### Bigger goal — work even without the project running SystemLynx

Today a project needs the **plugin (SystemLynx)** loaded to get SystemView capabilities. A SystemLynx
service that **lives with the CLI** can provide those capabilities **without the project itself being a
SystemLynx project**. Later, `systemview init <project-name>` lets you **name a project** and register it,
and the CLI-service **creates namespaces dynamically** to represent it — a reserved namespace for built-ins
(actions + the providers), plus dynamic ones for the named project (agents or config define them). That's
the deep end; this RFC needs only the basic level: **stand the service up** so it shows in the window and
can drive connected services.

**The one real fork — how the persistent CLI-service is launched:**

- **A) `systemview start` co-hosts it (recommended).** The process that boots the API/UI (:3000) also
  launches the CLI-service for its cwd. One command, one process, scoped to that directory.
- **B) A separate per-project `systemview agent`.** Each project dir registers its own CLI-service —
  mirrors the plugin's per-service registration; supports multiple project dirs. More lifecycle to manage.

Lean **A** for v1; **B** as a later door.

## Files this touches

- **`testing-utilities/`**
  - `Argument.class.js` — `getTargetValue`: keep the positional path, add the **natural-path** resolution
    (section-name + index/name + field) through the existing `obj(FullTest).get`.
  - `transformTests.js` (`initializeSavedTests`) — build the **reference object** `{ before, main, …, <named> }`
    (pull named sections by name) + the **run-procedure** list the engine loops.
  - `validators.js` (`evaluate`) — let a validation `value` be a `tv(...)` reference resolved by the same
    path resolver.
- **`specs/actions/`** — new folder convention (sibling of `docs/`, `tests/`).
- **`systemview-plugin/SystemViewModule.js`** — a `getActions`/`saveAction` pair mirroring
  `getTests`/`getDoc` (≈L55-70) for the **permanent** (specs) path.
- **`cli/`** — a new SystemLynx service module (exposing `.systemview` + run-action + the plugin providers +
  connection methods); launch wired in `cli/index.js` (and the `start` path, option A). Existing client
  wiring stays for outbound calls. Verbs to create/list/run named actions.
- **`api/index.js`** — accept the CLI-service registration and expose a handle/passthrough to the UI (as it
  does for plugin-backed services).
- **UI / Stories** — the **runner component** (holds/runs/stores/clears an action's results, persisted in
  the story); call the CLI-service (through the API) for `.systemview` actions + runs; positional
  `Action N` labels become **display-only**; permanent/temporary badge.

## Build order (incremental, test-green at each step)

1. **Reference resolver** — `getTargetValue` natural-path + backward-compat. *Dogfood test engine still
   green.* ← start here; it's the crux and unblocks everything.
2. **Sections + run-procedure** — build the reference object + run-list in `initializeSavedTests`, loop it
   in `FullTestController`; pull named sections from the permanent loader.
3. **Evaluations** — `tv(...)` reference in validation `value`.
4. **CLI-as-a-service** (option A) — stand it up, register, show in nav, run actions without the plugin.
5. **Runner component** — the stage pane that runs + stores + clears results, persisted.

## Non-goals

- `Before`/`Main`/`After` **inside** a named action — it's one sequence; compose for phases.
- A new runner — reuse the test engine.
- New socket plumbing in the CLI — live updates, if/when, go through the API.
- Replacing the plugin — it stays for in-service ground truth; only project-local concerns move to the CLI.
