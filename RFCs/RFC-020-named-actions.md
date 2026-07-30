# RFC-020: Named Actions — reusable, self-contained action sections run by the test engine

**Status:** Draft — approved in principle, do not implement until the explicit go.
**Depends on:** RFC-018 "Stories" (shipped).
**Replaces:** the earlier convoluted RFC-020 draft (rewritten from scratch).

This is **one piece of work**: named actions (the feature) plus the CLI-as-a-service change that enables them. Both live here.

## One-liner

A **named action** is a **named, self-contained SECTION of actions** — the same shape as a test's `Before`/`Main`/`After` array — that the **test engine runs**, that can **nest other named actions**, and that is either **permanent** (reused inside tests) or **temporary** (run ad-hoc). It's the "reuse actions in a bigger way" primitive. To make the temporary/local path work without the plugin, the **CLI becomes a service** the UI can call.

## The model — one section, self-contained, nestable

- A **named action = a name + an ordered list of steps** (one section). It doesn't *have* `Before`/`Main`/`After`; it *is* one section. Want before→act→after? Compose several named actions.
- A **step** is either:
  - a **call** — the existing action shape `{ namespace:{serviceId,moduleName,methodName}, args, savedEvaluations }`, or
  - a **reference** to another named action (the nesting): `{ use: "<name>" }`.
- **Nesting is a tree; the engine expands it recursively** into one flat run (leaf calls only), **cycle-guarded** (a `seen` set on the expansion stack catches `A → B → A`).

### Scope — reach your own stream, never *up* into the container

One principle, no contradiction: **a named action is EXPANDED into wherever it's used.** So anything you pull in with `use` isn't "outside" — it inlines and becomes a **previous step inside your own stream**. A step may reference any earlier step in its own **post-expansion scope**: its own steps *plus* everything it `use`d.

What "self-contained" forbids is reaching **up/out into the container you were expanded into** — the surrounding test's other sections (its `Before`, siblings), or a named action you did *not* `use`. You compose by pulling actions **in** (they join your stream); you never reach **out**.

Same rule from the caller's side: when a test `use`s your named action, *you* expand into the test's stream, so the test references your `save`d results as an **earlier step** — it "reached in" only by pulling you in. Direction is the whole game: references flow **backward within your own expanded stream**, never **upward** into a scope you were merely dropped into.

## Two lifetimes — permanent vs temporary (easy to tell apart)

| | Permanent | Temporary |
|---|---|---|
| **Lives in** | `specs/actions/<name>.json` (a **third sibling** to `specs/docs/` and `specs/tests/`) | `.systemview/actions/<name>.json` |
| **Created by** | authored / saved to the repo (travels with it) | the **CLI**, ad-hoc |
| **For** | **reuse inside tests** — make tests efficient, share setup | throwaway "do this for me" runs (mock steps, add a user role, seed data) |
| **Reachable via** | plugin/CLI spec loaders (like tests/docs) | the **CLI-as-a-service** (below), which owns `.systemview` |

The UI shows the distinction plainly (e.g., a "spec" badge vs a "local" badge).

**Where each can be referenced:** a **permanent** action can be reused in **tests** *and* referenced in **stories**. A **temporary** action can be used in **stories** but **not in tests** — a test lives *in* the project, a temporary action lives *outside* it (in the CLI-service's `.systemview/`), so there is no reference path from a test to it.

## Run by the test engine

Named actions run through the **existing test engine** (`testing-utilities/` — `FullTestController` / `TestController.class` / `transformTests`), not a new runner. The engine gains one pass:

1. **Expand** — walk the step tree; for each `{ use }` resolve the named action (permanent from `specs/actions/`, temp from `.systemview/actions/`), splice its steps inline, recurse, cycle-guard.
2. **Run** — the flattened section runs exactly like a `Before`/`Main`/`After` list today; within-stream `save`/`targetValues` chaining works because it's one expanded stream.
3. **Expose** — the section's `save:true` results are visible to whatever it expanded into, as earlier-step results.

## Running from the UI — imperative, not assertive

Named actions are **affirmative**: they are about **doing something now** — "run this, call that" against connected services — not about pass/fail. It is the same engine a test uses, but the intent is different. From the UI you can **run the whole action** or **run a single nested one** on its own. This is the "instead of asking the AI to run it every time, save it and press run" primitive.

## Test integration (permanent → reuse)

Because a named action is the same shape as a `Before`/`Main`/`After` array, a test **references one into any of those slots** and it **expands in place**:

```jsonc
{
  "title": "save a location",
  "Before": [ { "use": "Auth.signIn" } ],      // ← expands the named action into Before
  "Main":   [ /* the actual calls */ ],
  "After":  [ { "use": "cleanup" } ]
}
```

After expansion the test references the named action's `save`d results as earlier steps via the normal `results.*` path.

## Enhancement — references in evaluations

Today a `savedEvaluations` validation is `{ name, value }` with `value` a **literal**. Let `value` also be a **reference** to a saved result:

```jsonc
"validations": [ { "name": "equals", "value": { "$ref": "results.userId" } } ]
```

So an assertion can check against an earlier step's (or a used action's) output, not just a constant.

## The infrastructure it needs — CLI-as-a-service

The **temporary** path (`.systemview/actions/`) and running actions **from the UI** shouldn't need the plugin. Today the CLI is a one-way **client** of the API. Flip it: the **CLI launches its own SystemLynx service and registers with the API**, so the handle goes both ways — **UI → API → CLI**.

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

The CLI already runs in the project's cwd, next to `.systemview/` and the test engine, so it's the natural **local authority**. It owns:
- **`.systemview/`** — including temporary named actions (`.systemview/actions/`) and the runtime files already there,
- **running named actions via the test engine** (already CLI-side) — so the UI can trigger a run and watch results **without the plugin**,
- **local connection management**.

The plugin stays for **in-service ground truth** (a service's own source/methods/diffs); only **project-local** concerns move to the CLI.

### It shows up in the UI as its own service

The CLI-service **injects into the window like any other connected service** — it appears in the **nav bar** (styled specially, since it is not one of your project's services), with its **own namespace**. So it is a home for stories, docs, tests, and named actions that is **separate from your project but can speak to it** — and to every other connected service (exactly what the CLI already does: run this, call that against connected services). Call it **"CLI"** for now (changeable).

### Bigger goal — work even without the project running SystemLynx

Why this matters beyond named actions: today a project needs the **plugin (SystemLynx)** loaded to get SystemView capabilities. A SystemLynx service that **lives with the CLI** (running where the project lives) can provide those capabilities **without the project itself being a SystemLynx project**. Later the CLI can **create namespaces dynamically** to represent the project and carry its docs/tests/stories. That is the deep end — the basic level this RFC needs is just **stand the service up** so it shows in the window and can drive connected services.

**The one real fork — how the persistent CLI-service is launched:**
- **A) `systemview start` co-hosts it (recommended).** The process that boots the API/UI (:3000) also launches the CLI-service for its cwd. One command, one process. Scoped to that directory.
- **B) A separate per-project `systemview agent`.** Each project dir registers its own CLI-service with the central API — mirrors the plugin's per-service registration; supports multiple project dirs. More lifecycle to manage.

Lean **A** for v1; **B** as a later door.

## Files this touches

- **`testing-utilities/`** — `transformTests.js` (+ `TestController.class.js` / `FullTestController.js`): the recursive **expand** pass + cycle guard; `$ref` support in evaluation `value`; a programmatic "run this action set" entry the CLI-service calls.
- **`specs/actions/`** — new folder convention (sibling of `docs/`, `tests/`).
- **`systemview-plugin/SystemViewModule.js`** — a `getActions`/`saveAction` pair mirroring `getTests`/`getDoc` (~L55–70) for the **permanent** (specs) path.
- **`cli/`** — a new SystemLynx service module (exposing `.systemview` + run-action + connection methods); launch wired in `cli/index.js` (and `cli/launchApp.js` for the `start` path, option A). Existing client wiring (`cli/connectService.js`) stays for outbound calls. Verbs to create/list/run named actions.
- **`api/index.js`** — accept the CLI-service registration and expose a handle/passthrough to the UI (like it does for plugin-backed services).
- **UI / Stories** — call the CLI-service (through the API) for `.systemview` actions + runs; a pane that shows/runs a named action (the "throw it in the window, watch it run" idea) + the permanent/temporary badge.

## Open decisions (defaults chosen; correct in review)

1. Folder names: `specs/actions/` + `.systemview/actions/`. Reference field: `use`. Evaluation reference token: `$ref`.
2. CLI-service lifetime: option **A** (`systemview start` co-hosts).

## Non-goals

- `Before`/`Main`/`After` **inside** a named action — it's one section; compose for phases.
- Reaching **up/out** into the container — a used action inlines into your stream; nothing reaches the parent test's other sections or un-used siblings.
- A new runner — reuse the test engine.
- Replacing the plugin — it stays for in-service ground truth; only project-local concerns move to the CLI.
