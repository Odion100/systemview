# RFC-014 — Test UI presentation & live run feedback

## Problem

The test panel works but reads poorly and gives almost no feedback *while a test runs*:

- **You can't see progress.** A full test runs its actions sequentially, but the UI only re-renders **once, at the end**. `FullTestController.runFullTest` awaits every `test.runTest()` and only then does `TestPanel.setFullTest(...)` push state — so you never see *which* action is executing, or that anything is happening at all. The data already exists (`Test.class` logs `[invoking]`/`[results]` and stamps `test_start`/`test_end`) — it just never reaches React state mid-run.
- **The test area is cramped and fixed-width.** The layout is a hard `col-3 / col-6 / col-3` grid (`SystemView.js`): nav, Documentation, TestPanel. The test panel gets a fixed quarter of the screen with no way to give it more room.
- **Scratch Pad and Saved Tests look rough** — dense rows, weak hierarchy, hard to scan what passed, what failed, and what each action did.
- **No sense of timing.** Nothing shows how long an action or a test took.

## Goals

Make the test experience **legible and alive**: you can watch a run happen, immediately see pass/fail and timing, give the test area the space it needs, and read a saved test at a glance.

Non-goal: changing *how tests execute* or the saved-test file format. This is presentation + state-update timing only.

## Proposed work

### 1. Resizable Documentation ↔ Test split

Replace the fixed `col-6 / col-3` (Documentation / TestPanel) with a **draggable vertical divider** so the whole test section can be widened horizontally at the expense of the docs pane (and back). The nav (`col-3`) stays put.

- Drag handle between the two panes; live-resize on drag.
- **Persist the chosen width** so it survives reloads — reuse the UI-server settings store (`api/Settings.js`, same pattern as the sticky case toggle / CLI history), or `localStorage` if we want it purely client-side.
- Sensible min/max widths so neither pane collapses.

### 2. Live progress indicators (the state-handling fix — core of this RFC)

Give every action a visible lifecycle: **idle → running → passed / failed**, updated **as it happens**, not at the end.

- Add a `status` field to each `Test.class` action (`idle | running | passed | failed`) and set it: `running` right before it invokes, `passed`/`failed` after validation.
- `FullTestController.runFullTest` (and `SavedTests.runAllTests`, which has the same recursive runner) must **push React state after each action transition**, not once at the end. Cleanest option: thread an `onProgress()` callback into the run loop that the panel wires to a `setState`; each `runTest()` calls it on `running` and on completion. Re-render per action.
- In the UI: the currently-running action gets a **running state** (spinner / pulse), completed actions turn green/red immediately, upcoming actions stay idle. So a run visibly walks down the phases.
- Applies to both the Scratch Pad single-test run and the Saved Tests run-all.

### 3. Duration bar

Per action, show **how long it took** as a bar — encoding duration in **both length and color**.

- Duration = `test_end − test_start` (already stamped in `Test.class`, in ms).
- Bar **length** scales with duration (relative to the slowest action in the run, or a fixed scale with a cap — TBD in design).
- Bar **color** = green → red gradient (fast → slow), by thresholds.
- Also surface a **total test duration** (sum) on the test header.

### 4. Scratch Pad + Saved Tests revamp

Visual/UX overhaul of both (`TestPanel.js` Scratch Pad, `SavedTests.js`):

- Clear **phase grouping** (Before / Main / Events / After) with labels and dividers.
- Per-action rows: namespace (`service.module.method`) prominent, a **status badge**, the duration bar, and a collapsible **result/error preview**.
- Per-test **summary** (e.g. `3 passed · 1 failed · 240ms`).
- Cleaner buttons (run / save / edit / delete), better spacing, readable typography — make it easy to scan at a glance.

### 5. Other indicators worth adding (open — pick from these)

- Failed-assertion detail inline (which validation failed, expected vs received) surfaced visually, not just in a blob.
- A subtle **pulse** on the action being called so "it's working" is obvious.
- Overall run state on the panel header (running / done, pass count).
- Optional: highlight the *changed* fields between expected and received.

## Technical touch points

- `src/pages/SystemView/SystemView.js` — the `row` / `col-*` layout → resizable split.
- `src/organisms/TestPanel/components/FullTestController.js` + `TestPanel.js` — per-action state updates during `runFullTest`.
- `src/organisms/SavedTests/SavedTests.js` — same progress wiring for run-all; row revamp.
- `src/organisms/TestPanel/components/Test.class.js` — add `status`; already has `test_start`/`test_end` for duration.
- `src/organisms/MultiTestSection/`, `src/molecules/TestSummary/`, `TestCaption` — the row/summary rendering.
- Styling: `src/organisms/*/styles.scss`, shared sass.

## Out of scope

- Test execution logic and the saved-test JSON format (unchanged).
- The Logs page.
- CLI output.

## Open questions

1. Duration bar scale — relative to the run's slowest action, or a fixed ms scale with a cap? Green→red thresholds?
2. Resize width persistence — UI-server settings (shared across sessions) vs `localStorage` (per-browser)?
3. How much of §5 to include in v1.
