# RFC-018: The AI Window — a living, declarative view surface (human- and agent-driven)

**Status:** Draft — vision + architecture. Planning; do not implement until approved.
**Merges:** `docs/ideas/ai-driven-doc-window.md` (folded in whole) + the "saved AI communications" idea + the CodeMirror editor we've always wanted. That idea file is now a pointer here.
**Companion:** RFC-019 (composable test actions) makes the `test` block worth showing.

## One-liner

SystemView's center window stops being a static single-markdown viewer and becomes a **living view surface for the whole system** — docs, code, files, diffs, tests, logs — one thing or many, arranged — that **both the human and an agent** can drive. Live up to the name: *SystemView* = see your system. And it's how the **agent communicates**: instead of pasting into chat, it drives *your* window to the exact thing and frames it; when it's not there, you drive it yourself.

This is the fourth pillar. Documentation = what the human wrote. Logs = what ran. Reports = what's true over time. **The AI Window = what the agent has to say, shown against the real system.**

## Two principles that make it *better*, not gimmicky

**1. Two drivers, one stage — user-first.** This is a **redesign of the center window** that stands on its own for a human, and *also* happens to be drivable by an agent. Every capability must be usable **by the user directly** (click to add a pane, pick a layout, browse a gallery, edit a file) — not only via an agent command. Ship value even if no agent is ever involved: a person can finally open several docs/files/diffs at once and actually *see their system*. The agent is a second, optional driver on the same shared state.

**2. AI drives, UI vouches — deterministic.** The UI shows **ground truth** (real files, real service map). The AI is only the **navigator** — it decides *what* to show and where to look; it **never renders/hallucinates the content**. The view description carries only *targets* (locators) + inline prose, never file bytes — the real bytes come from the plugin at render time. That split is the architecture, and it fits SystemView specifically because SystemView already holds the map (services/modules/methods, docs, tests).

## The unification: one schema, two lifetimes

Everything below is one primitive — a **declarative view: `{ layout, panes: [{ kind, target, highlight? }] }`** — that exists in two lifetimes:

- **Live stage** — the agent drives your open window *now*, in conversation ("show me all the parts"). Ephemeral, broadcast over sockets, rehydrates on reconnect.
- **Saved view** — the same description written to disk as a **communication that persists**: authored by the agent, **stored on a namespace in `.systemview/`** (per RFC-017), reopenable — "here's what we did." Your window as a document.

Live = drive it. Saved = keep it. Same blocks, same renderer.

## The blocks / pane kinds

Each pane declares a `kind` + a `target` (a locator the plugin resolves) and optional `highlight`:

- **markdown / text** — prose. The agent's words. *(existing `<Markdown>` path.)*
- **file** — point at a project file → display it (syntax-highlighted, read-only). Resolved by the plugin (`readFile`), never inlined.
- **source** — a **live method → its source span** (`getSource({ module, method })` → `file:startLine-endLine`). "Show me *this* function."
- **diff** — **before/after a change, side by side or unified.** The natural "you implemented some shit — show me the change." First-class (you asked). Target = a file (vs its git/base state) or an explicit before/after pair.
- **test** — the **worked-example** block: render a saved test as a readable story (setup → call → args → response → the assertions that pin it) **and a Run button with inline pass/fail.** The test *is* the example implementation — how the method is actually used, with real data, runnable. (See RFC-019 — named/reusable actions make these read cleanly.)
- **log** — an embedded, filtered live log view (reuses the Logs engine + RFC-011 highlight).
- **call** — a live `probe` rendered: the method, args, and its real response.
- **callout** — info / watch / bad, for the thing you must not miss.
- **checklist** — done / todo, the shape of the work.
- **link** — deep-link to a service / method / doc / another saved view.
- **topology** *(later)* — the node/edge map (ties to RFC-015).

`highlight` on any pane = emphasize a region (a line range, a match, a doc section) without losing the whole — same instinct and mechanism as **RFC-011's log highlight**.

## Layouts — presentation is a framing choice

The center holds *many* panes in switchable formats; the agent picks a sensible framing per intent, the user always overrides:

| Intent | Layout | Interaction |
|---|---|---|
| Look at one exact thing | **single** (today) | today's view |
| Skim/compare several at a glance | **two-row wrapped grid** (bounded, height-capped, scroll-in-card) | scan; click one to focus |
| Move through many one at a time | **gallery** | next/prev, focus, back & forth |
| Read a long document | **elongated single column** | read; scroll within |
| Study a few in detail | **split / larger panes** | side-by-side, expand |

Rules that keep it sane: each pane is self-contained and independently scrollable; no pane grows unbounded; the user controls layout directly (switch format, add/remove/focus/reorder/pin) and never depends on the agent to arrange.

## The editor — one component, three jobs

We need one component that does **both read-only display and real edit** — not the plain `<textarea>` in `DescriptionBox` today (which is why nobody edits in the UI). **CodeMirror 6 (`@uiw/react-codemirror`)**, one dependency:

1. **The editor we always wanted** — real code/doc editing (syntax highlight, multi-language) inline in the window, exactly like editing documentation today but for **any file**. Display vs edit = one prop.
2. **The `file`/`source`/`diff` pane renderer** (read-only CodeMirror + its merge/diff view).
3. **The line-range highlight / zoom** — native CodeMirror decorations + `scrollIntoView`.

**Why not Monaco:** it loads language services as web-worker files (usually CDN); SystemView ships a prebuilt `build/` run offline via `npm i -g`. CodeMirror bundles cleanly into the CRA build. For an offline-first global tool, decisive. Slots into the existing `EditBox` display/edit toggle in `Documentation.js` (replace the textarea).

## Architecture — grounded in the real code (mostly orchestration)

Half of this already exists; the net-new backbone is small.

**Already there (the substrate):** the CLI already drives the UI (`systemview open project ns` deep-links); the API already **pushes events to the UI** (`updateSpecList` → `this.emit("spec-list-updated:<project>")`, which `SystemNavigator` listens to); the UI already **calls plugin methods and subscribes to live streams** in the browser (`Plugin.getDoc`, `SystemView.on("log")`). Server→UI push and UI→plugin calls are not net-new.

**Net-new, per layer:**

- **Plugin — the ground-truth file/code provider** (`SystemViewModule.js`, runs inside the service so it reads that service's real source; all path-guarded to the repo root):
  - `readFile({ path })` → `{ path, content, language, lines }`
  - `listFiles({ dir?, glob? })` → tree
  - `getSource({ module, method })` → `{ path, startLine, endLine, content }` — the bridge from the service/module/method map down to **file:line** (uses `system.modules`/`system.routing` captured on ready)
  - `getDiff({ path })` → before/after (vs git base) for the `diff` block
  - `search({ query, glob? })` → hits
  - `writeFile({ path, content })` → save (the editor's write path, guarded)
- **API — the stage + saved-view store + broadcast** (`api/index.js`, reuse the `spec-list-updated` pattern):
  - stage model = `{ layout, panes: [{ id, target, highlight? }] }`
  - `getStage()` / `showTarget()` / `addPane()` / `removePane()` / `highlight()` / `assemble({ targets, layout })` — each ends with `this.emit("stage-updated", stage)`
  - `saveView(namespace, view)` / `getView(namespace)` / `listViews(projectCode)` — the persisted communications on namespaces
  - stage carries only targets, never bytes (UI vouches)
- **UI — stage renderer + code view** (generalize `src/organisms/Documentation`): on mount `getStage()` + `on("stage-updated", render)`; render `layout` + `panes[]` by `kind` (`doc`→Markdown, `file`/`source`→CodeMirror, `diff`→CodeMirror merge, `test`→test block, `log`→LogRow, `call`→result); layouts single/grid/gallery/split; highlight = scroll-to + emphasize.
- **CLI — the agent's command surface** (thin verbs → API stage/view methods, resolving targets via the fuzzy resolver we just unified):
  - live: `systemview show <ns> [--file p | --source Mod.method]`, `stage add/clear`, `highlight <target> --lines A-B|--match s`, `assemble <target...>`
  - saved: `systemview view save <namespace> <file.json>` / `view open <namespace>` / `view list`

**The loop:** you talk to me → I run `systemview assemble …` → API sets the stage + emits `stage-updated` → every open UI renders the panes, fetching **real bytes** from each service's plugin → you see the actual code/diffs/tests, framed and highlighted → you react ("why'd you write that?") → I adjust. AI drives the *what*; plugin + UI guarantee the *truth*.

## The reverse channel (UI → agent)

Clicks in the window (select a function, a log row, a line range) post a **current selection** back that the agent reads — so *"why'd you write **that**?"* already knows which "that." `SystemView.setSelection()` + agent `getSelection()`. Closes the loop both ways.

## Phases

1. **Stage backbone + `file`/`source`/`markdown` panes + CodeMirror (read-only).** The live view-control channel (stage model + `stage-updated` + client controller) and the plugin file providers. Delivers "drive the window to any file/function, framed."
2. **`diff` + `test` blocks.** Diff via CodeMirror merge; the tests-as-story block (display + run). This is "show me the change / show me what we did, runnable."
3. **Saved views on namespaces.** Persist a view-doc to `.systemview/`, list + reopen — the agent's communications as documents.
4. **The editor (edit mode)** — CodeMirror editable, `writeFile`, replacing the doc textarea and enabling edit-any-file.
5. **Layouts (grid/gallery/split), reverse-channel selection, stage presets, diff pairs, pinned/ephemeral panes + breadcrumb.**

## Open questions

- **Name** — "AI Window" vs distinguishing from RFC-015's stats "Reports." (Window? Stage? Canvas?)
- **Relationship to the nav/tests/doc three-column layout** — replace the center, or a new mode on top?
- **Multi-session** — which window an agent drives (skip for v1, single local window).
- **Where "assemble the relevant parts" intelligence lives** — the agent picks; the UI just displays.
- **Saved-view storage** — `.systemview/views/<namespace>.json` (travels per RFC-017) vs the UI-server store vs both.

---

*Origin: `docs/ideas/ai-driven-doc-window.md` (the RFC-011 log-highlight work sparked "what if the doc window were an AI-driven deterministic view onto any doc/code, showing many things at once"), merged with the "AI writes saved communications the UI renders" framing.*
