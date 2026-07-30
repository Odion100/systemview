# RFC-020: Named Actions — runnable action sequences you can throw in the window

**Status:** Draft — approved in principle, do not implement until the explicit go.
**Depends on:** RFC-018 "Stories" (shipped). Fulfills the "composable/reusable actions" idea RFC-018 forward-referenced.
**Companion:** RFC-019 (nested layout).
**Supersedes:** the earlier "Live Stage + generic progress pane" draft — scrapped as too generic (see Non-goals).

## One-liner

A **named, reusable sequence of actions** — the same action list a test runs — **executed by the existing test runner**, that a human **or** the AI can **set up**, **run**, and **watch run** in a window pane. It can carry evaluations too (just not front-and-center like a test). It's **window-only for now**; the one missing piece is the pipeline to use it *inside* the test suite. Optional progress is the only extra.

## What it is — and the drift it is NOT

It **is** the named actions from a test, decoupled from the test:
- An **action** = a call into the system: `{ module, method, args }` (+ its result when run). Exactly the action shape a test already uses.
- A **named action set** = an ordered list of actions with a name, filed on a namespace — reusable, re-runnable.
- **Evaluations are allowed, just not explicit.** Because it runs through the test engine (below), an action can carry validation. But a named action set is primarily "run these," with *optional, quiet* checks — not the explicit pass/fail scoreboard a test is.
- **Runnable by a human or the AI.** "Say I want to run a season — I don't need you to do it, just set it up." Setup and run are both first-class **for the user**, not AI-only.
- **Watchable in the window** — throw it in a pane; when it runs, each action's call + result fills in so you can see it go.
- **Optional progress** — a set (or an action) may carry a progress bar. This is the ONE accepted addition. Nothing more.

It is **NOT** a generic real-time progress / activity surface. The earlier draft drifted into "any kind of activity, any progress, freeform blocks" — scrapped. This is specifically named **action (call)** sequences, runnable and viewable. If it isn't a call into the system, it doesn't belong here.

## Run it with the test runner — that's the whole point

Don't build a new execution engine. A named action set is **shaped so the existing test runner executes it** — the same machinery (`Test.class` / the harness that already runs a test's actions) runs these. Consequences:

- **It's already test-runnable.** Because it runs through the test engine, it can carry **evaluations/validations** too — the engine supports them. Allowed, but not made explicit the way a test does.
- **A test is just a named action set the pipeline picked up.** Since these are created in the test-runnable format, dropping them into the suite later is a *wiring* job, not a rebuild. "Now we have actions that can be created to run and test."
- **What we're NOT building yet: the pipeline** that uses a named action set *inside* the test suite (as a reusable block). For now they live and run **only in the window**. The runner is shared from day one; the suite integration is the deferred piece.

Build in steps. Step 1: a named action set, run via the test runner, shown in the window, optional progress, distinct look.

## The mechanism — no subscribe model; the API is the connected party

The AI is **not** a plugin and **not** a persistently-connected instance you subscribe to. The flow is a plain CLI→API call:

1. A human or the AI runs a **CLI verb** (set up a named action set, or run one).
2. That engages the **systemview API** — the party that is *already* connected to open browser windows (it serves the UI and holds its sockets).
3. To **run**, the API executes the set **through the existing test runner** (`Test.class` / the harness that already runs test actions) and, as each action returns, **broadcasts the result to open UIs over the existing `stories-updated` channel** — no new runner, no new "live channel," no AI-as-subscriber.

So "watch it run" = the API emits per-action results as it executes, over the connection it already maintains. The caller (AI or human CLI) fires-and-returns; the **API** drives the window. That's the entire "real-time" story: existing broadcast, triggered by a CLI run.

## Setup, run, view

- **Setup** (human or AI): define a named action set — `name`, namespace, ordered `actions: [{ module, method, args }]`. CLI verbs to create / add / remove / reorder actions (mirrors story pane-ops). Settable in the UI too (user-first).
- **Run**: a CLI verb — or a **Run button in the pane** — triggers the API to execute the sequence. Per-action call+result streams to the window as it goes; optional progress advances.
- **View**: a pane kind that renders the set — each action as call + result, filling in on run. **Distinct look from a test** — not a pass/fail scoreboard; evaluations, if present, read quietly. It says "here's the sequence, here's what came back."

## Persistence

- The **named action set** is durable — stored on a namespace like a story (`.systemview/`).
- **Run results** stream live to the window. Whether the *last run's* results persist with the set (so reopening shows them) is open — lean: set durable, results transient until asked otherwise.

## Open questions

1. Is a named action set its own primitive, or a **pane kind inside a story**? Lean: a pane kind (`kind: "actions"`) so it rides in stories and the window like everything else, with the set itself also addressable.
2. CLI verb surface — `action` / `actions` mirroring `story` / `stories`? Lean yes.
3. Do run results persist with the set, or live-only? (above)
4. Progress: pane-level, per-action, or both? Lean: optional, pane-level first.

## Non-goals

- A generic real-time progress / activity display for arbitrary work — **scrapped**; action sequences only.
- The **test-suite pipeline** — using a named action set as a reusable block *inside* the suite. Deferred; window-only for now. (Evaluations themselves are supported via the shared runner — it's the explicit test *presentation/pipeline* that's out of scope.)
- A new execution engine — **reuse the test runner**.
- Any subscribe model or AI-as-persistent-connection — the API is the connected party; the caller just triggers via CLI.
