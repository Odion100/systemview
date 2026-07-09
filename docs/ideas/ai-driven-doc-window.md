# Idea: The AI-driven doc window (someday / free-time)

> Not an RFC. Not scheduled. A north-star idea to come back to when we have time.
> Captured so it isn't lost.

## The one-liner

SystemView's center "documentation" window stops being a static single-markdown viewer and becomes
a **living view surface for the whole project** — docs *and* code, one thing or many, arranged — that
**both the user and an agent** can drive. Live up to the name: *SystemView* = see your system.

I talk to you about my system. Instead of pasting code into chat, you drive *my* SystemView window
to the exact thing — a doc, a file, a function, a span of lines — and frame it for me. I look at the
real thing in the real UI, and I can react: "why'd you write that? — boom, real cold." **And when
you're not there, I drive it myself** — browse, arrange, pin, compare — the same surface, my hands on it.

## Principle: two drivers, one stage — it's for the user *and* the agent

This is **not** an agent feature with a UI bolted on. It's a **redesign of the center window** that
stands on its own for a human, and *also* happens to be drivable by an agent. Every capability below
must be usable **by the user directly** — click to add a pane, pick a layout, navigate a gallery,
choose what's shown — not only via an agent command.

- The **stage** (what the window shows) is shared state with **two drivers**: the user (clicks/controls
  in the UI) and the agent (CLI/API calls). Same model, same rendering, either can mutate it.
- Ship value even if no agent is ever involved: a person can finally open several docs/files at once,
  arrange them, and actually *see their system*. The agent is a second, optional driver on top.

## Why it's not far-fetched (half of it already exists)

- **The CLI already drives the UI deterministically.** `systemview open project service/module/method`
  navigates the window to an exact location. That's the core primitive. "AI controls the UI" is just
  that command in an agent's hands.
- **The window already renders markdown from a source of truth.** It doesn't *know* it's showing
  "documentation" — it's a display surface currently pointed at docs.

So the idea = **widen what the window can point at** (arbitrary docs → code → a specific code region)
+ **let an agent be the thing pointing it**, driven by conversation.

## The key property: deterministic, AI navigates / UI vouches

The word that makes this *better* than "AI shows you code," not worse: **deterministic.**

- The UI shows **ground truth** — real files, real service topology, the map SystemView already has.
- The AI is only the **navigator** — it decides *what to show and where to look*.
- The AI never renders/hallucinates the content; the window guarantees it's real.

That split — **AI drives, UI vouches** — is the architecture. It's a natural fit for SystemView
*specifically* because SystemView already holds the map of the system (services/modules/methods, docs,
tests).

## The two extensions I'm already imagining

### 1. The center-window redesign — from one doc to many  (the core feature; user-first)

Today: nav on the left, tests in between, **one** doc in the center. Making the center hold *many*
things is **a real redesign**, and it's the heart of this whole idea — worth doing for the human alone.

**What the center becomes — multiple docs/files/code at once**, in switchable layout formats:

- **Single** — today's one-pane view. *(default; nothing lost.)*
- **Two-row wrapped grid** — panes flow left-to-right and **wrap into two rows**; each pane is a
  bounded card: elongated horizontally but **height-capped (not too tall)**, its content **scrollable
  inside the card**. The grid itself scrolls when there are more panes than fit.
- **Gallery** — a browsable set of panes you **navigate and choose** between (next/prev, pick one to
  focus/expand), for when you've assembled a lot and want to move through them.
- (later) **Split / free arrange** — side-by-side or draggable panes.

**Rules that keep it sane:**
- Each pane is **self-contained and independently scrollable**; no pane grows unbounded. The window
  stays a *view*, not an endless page.
- **The user controls the layout directly** — switch format, add/remove a pane, focus one, reorder,
  pin. (An agent can do the same via the stage, but the human never depends on the agent to arrange.)
- A pane can hold *any* target kind — a markdown doc, a source file, a highlighted function span, a
  log view — mixed freely in the same layout.

This is what "live up to the name" means: open the pieces of your system side by side and actually
**see it**, instead of clicking one doc at a time.

#### Presentation is a choice — frame for the intent

The layout isn't a static setting; it's a **framing decision made per-thing, tied to what's being
shown and why.** Same set of docs/files can be presented several ways, and the right one depends on the
intent — *how* you want me to show it, and *how* you want to interact with it. The agent picks a
sensible framing when it assembles the stage; the user can always re-frame.

| Intent — what you want to do | Presentation | Interaction |
|---|---|---|
| Skim/compare several things at a glance | **two-row wrapped grid** of bounded cards | scan; scroll a card; click one to focus |
| Move through many things one at a time | **gallery** | next/prev, click to focus, navigate back & forth |
| Read a longer document | **one-per-row, elongated** (taller/wider single column) | read; scroll within |
| Study a few things in detail | **larger view** (fewer, bigger panes) | focus, expand, side-by-side |
| Look at one exact thing | **single** | today's view |

- **The agent chooses the framing as part of the command** — `assemble`/`show` carry a `layout`, and
  I pick it to match intent ("here are all the parts" → grid; "read this design" → elongated; "step
  through these" → gallery). It's not just *what* to show, it's *how*.
- **The user always overrides** — re-frame, resize, switch grid↔gallery↔elongated, focus/expand a pane.
- So "different ways to interact" is first-class: browse-and-click-through, glance-and-compare,
  read-long, or study-in-detail — the mode carries the interaction, not just the arrangement.

### 2. "Show me all the parts" — conversation-assembled views

The real use case: I say *"you just implemented some shit — show me all the parts,"* and you
deterministically assemble the relevant set into the window — every file/function/test touched by
what we're discussing — laid out together so I can see the whole change at once and react to any piece.
Everything you're testing, everything relevant, in one framed view.

## The newest piece: zoom / emphasize a region

The window needs a **"show me *this* region and mark it up"** mode — a highlight/pan the agent can
command (show this function, emphasize these lines). Funny enough this **rhymes with the log-highlight
feature in RFC-011**: same instinct — emphasize a span without losing the whole. Might share
mechanism/vocabulary.

## Architecture — how it could actually work

The whole thing is **orchestration between the UI, the CLI, and the plugin** — and it feels seamless
because SystemView is already set up to set things up. Here's the honest current state and the small
net-new backbone.

### What already exists (the substrate)

- **The SystemView UI API (`api/`) manages/serves the UI**, and the CLI already calls API methods
  (the cookie HTTP client hits `SystemView.*`). So "agent issues a command → server acts" already works.
- **Agent → UI control today = deep-link navigation only.** `systemview open …` shells the OS `open`
  with a URL + namespace path; React Router routes there. It's **one-shot** — it reopens a URL, it
  can't mutate an *already-open* window.
- **The live channel already exists on the client — in both directions.** The UI holds
  `systemlynx-client` connections and already **calls and subscribes to** both the API and every
  service's plugin, over sockets:
  - `src/index.js` → `Client.loadService(<api>)` for `SystemViewUI.SystemView.*`.
  - `SystemNavigator.js` → `SystemView.on("spec-list-updated:<project>", …)` — **the API already pushes
    events to the UI** (see `updateSpecList` in `api/index.js`, which calls
    `this.emit("spec-list-updated:…")`).
  - `Logs.js` → `SystemView.on("log", …)` — the UI subscribes to a plugin's live log stream in the
    browser.
  - `Documentation.js` → `Client.createService(connectionData).Plugin.getDoc(…)` — the UI calls plugin
    methods directly.

  So server→UI push and UI→plugin calls are **not net-new**. The whole feature is orchestration of
  parts that already talk to each other.

### The missing backbone: a live view-control channel

Three pieces turn "deep-link navigation" into "an agent drives the live window":

1. **Command surface (AI drives)** — a few CLI verbs / API method hits the agent calls:
   `show <target>`, `add-pane`, `highlight <region>`, `assemble [...]`. Rides the existing CLI→API
   path; no new transport for *input*.
2. **Server-side view-state + broadcast (`api/`)** — new `SystemView` methods that mutate a
   **current-view model** (the source of truth for what the window is showing) and push the change out.
   Reconnects rehydrate from this model.
3. **Client-side socket + view controller (`src/`)** — the genuinely net-new client bit: the UI opens
   a WS on load, subscribes, and applies view commands to the doc window (navigate, load a doc/code
   target, multi-pane layout, highlight a region).

### Content resolution — "UI vouches"

A target like *"show this function"* → real bytes. SystemView/plugin already resolves
`serviceId/module/method`; extend that resolver to **file:line spans**. The **plugin is the
ground-truth provider** — it holds the system map and can serve file/doc/code spans. The AI only names
the target; the API/plugin supply the real content and the client renders it.

### What else you'd need

- **A command vocabulary** — the verbs above; small, explicit, deterministic.
- **A view-state schema** — e.g. `panes[] = { target, highlight? }` — so multi-pane/gallery layouts
  stay coherent and rehydrate on reconnect. (This is also what powers Extension #1's galleries.)
- **Multi-session / identity** — which window an agent is driving. Skip for v1 (single local window).

### Why it feels "free"

The only truly new surfaces are **(a)** a handful of view-control methods + a view-state model on the
server, and **(b)** the client holding a socket + a view controller. Everything else — serving the UI,
a CLI that calls API methods, a plugin that holds the map, a framework that already speaks WS — is
**already there.** The work is orchestrating parts that exist, not building new foundations.

## Concrete design — what each part does (grounded in the real code)

The four connections that already exist (so we know reuse vs net-new):

| Edge | Already there |
|---|---|
| UI → API | `SystemViewUI.SystemView.*`; UI subscribes to API `this.emit(...)` events (`spec-list-updated:<project>`) |
| API → UI | `updateSpecList` emits over socket; `SystemNavigator` listens — **push channel exists** |
| UI → plugin | `Client.createService(connectionData).Plugin.getDoc/getLog`; `Plugin.on(...)` in the browser |
| CLI → plugin | direct socket (log streaming: `SystemView.on("log")`) |
| plugin → fs | `fs`/`path` in the service's own cwd (`getDoc`, `getLog`, `getManifest`) |

Net-new is small: **file/code read methods on the plugin, a "stage" (view-state) on the API, code
rendering + a stage renderer in the UI, and a few CLI verbs.**

### Plugin — the ground-truth file/code provider  (`systemview-plugin/SystemViewModule.js`)

Runs *inside the target service*, so it can read that service's real source. Add siblings to
`getDoc`/`getLog`, all confined to the project root (path-safety guard — "any file" = any file in the
repo, not the whole disk):

- `readFile({ path })` → `{ path, content, language, lines }` — read any file in the service repo.
- `listFiles({ dir?, glob? })` → paths / tree — browse the repo.
- `getSource({ moduleName, methodName })` → `{ path, startLine, endLine, content }` — resolve a **live
  method to its source span**, using the module/routing map the plugin already captures in
  `App.on("ready")` (`system.modules`, `system.routing`). This is the bridge from SystemView's
  service/module/method map down to **file:line** — the "show me this function" resolver.
- `search({ query, glob? })` → `[{ path, line, preview }]` — grep the repo.

### API — the stage (view-state) + broadcast  (`api/index.js`, `SystemView` module)

The API module already emits socket events the UI consumes (`updateSpecList` →
`this.emit("spec-list-updated:…")`). **Reuse that exact pattern** for a *stage* = the current view.

- **Stage model** (app-level state): `{ layout: "single"|"grid"|"gallery"|"split", panes: [{ id, target, highlight? }] }`
  where `target = { kind: "doc"|"file"|"source"|"log", serviceId, ...locator }`.
- New methods — **driven by both the UI's own controls *and* the agent** (same stage, two drivers; the
  UI can mutate it locally and/or call these to sync, the agent calls these over CLI):
  - `showTarget(target)` — replace stage with one pane.
  - `addPane(target)` / `removePane(id)` — build a gallery / split.
  - `highlight({ paneId, region })` — set emphasis (line range / match / doc section) on a pane.
  - `assemble({ targets, layout })` — set several panes at once → **"show me all the parts."**
  - `getStage()` — current stage, for rehydrate on UI load / reconnect.
  - each mutator ends with `this.emit("stage-updated", stage)` — same mechanism as `spec-list-updated`.
- **AI drives / UI vouches:** the stage carries only *targets* (locators), never file bytes. The bytes
  come from the plugin at render time.

### UI — stage renderer + code view  (generalize `src/organisms/Documentation`)

- On mount: `SystemView.getStage()` then `SystemView.on("stage-updated", render)` — mirrors the existing
  `spec-list-updated` subscription and the log stream.
- Generalize the center from *single doc* → **stage renderer**: `layout` + `panes[]` → panes, each
  rendered by `target.kind`:
  - `doc` → existing `<Markdown>` path (`Plugin.getDoc`). *(unchanged)*
  - `file` / `source` → **NEW code renderer**: call that service's `Plugin.readFile`/`getSource`,
    syntax-highlight, and emphasize the `highlight` line-range ("zoom on a region").
  - `log` → existing `LogRow` / `InlineLogs`. *(unchanged)*
- **Layouts**: `single` (today) + `gallery` / `split` = the multi-pane / horizontally-elongated
  displays — this realizes Extension #1's schema.
- **Highlight/zoom** = a pane's `highlight` region → scroll-to + emphasize. Shares vocabulary and
  mechanism with **RFC-011's highlight** (emphasize a span without losing the whole).

### CLI — the agent's command surface  (`cli/`)

Thin verbs that resolve a target against connected services (like `open` uses `resolveNamespace`
today) and call the API stage methods via the cookie client:

- `systemview show <project> <ns>` — doc (today's `open`, but drives the *live* window instead of
  reopening a URL); `--file <path>` or `--source <Module.method>` for code.
- `systemview stage add <target>` / `systemview stage clear` — build a gallery.
- `systemview highlight <target> --lines A-B | --match <str>`.
- `systemview assemble <target...>` — one call, multiple panes → **"show me all the parts."**

Each is: parse args → `SystemViewUI.SystemView.showTarget/addPane/highlight/assemble(...)`. I (the
agent) run these in conversation.

### The loop, end to end

You talk to me → I run `systemview assemble …` → CLI calls API `assemble()` → API sets the stage and
emits `stage-updated` → every open UI receives it → the UI renders the panes, fetching **real bytes**
from each service's `Plugin.readFile`/`getSource` → you see the actual code/docs, framed and
highlighted → you react ("why'd you write that?") → I adjust the stage. **AI drives the *what*; the
plugin + UI guarantee the *truth*.**

## Ideas to add on top

- **Reverse channel (UI → agent):** clicks in the window (select a function, a log row, a line range)
  post a "current selection" back the agent can read — so *"why'd you write **that**?"* already knows
  which "that." A `SystemView.setSelection()` + the agent reading `getSelection()`. Closes the loop
  both ways.
- **Stage presets / recall:** save a named stage ("the auth flow") and re-`assemble` it later — named
  views of the system.
- **`diff` target kind:** before/after a change, rendered side by side — pairs perfectly with *"you
  just implemented some shit, show me all the parts."*
- **Pinned vs ephemeral panes + a breadcrumb** of what the agent has shown, so you can walk back
  through the tour.
- **It's not just for me.** Any agent (or a human via CLI) can drive the stage — SystemView becomes a
  shared, deterministic "look here" surface for a whole system.

## Building blocks — the code component (display + edit)

We need one open-source component that does **both a read-only display mode and a real edit mode** —
not the plain `<textarea>` in `DescriptionBox` today (which is why nobody ever edits in the UI).

**Recommendation: CodeMirror 6 (`@uiw/react-codemirror`).** One dependency, three payoffs:

1. **The editor we always wanted** — real code editing (syntax highlight, multi-language) to replace
   the textarea. Display vs edit is one prop (`editable`/`readOnly`).
2. **The `file`/`source` pane renderer** for the stage (read-only CodeMirror).
3. **The line-range highlight / "zoom on a region"** — native CodeMirror decorations + `scrollIntoView`
   — same mechanism RFC-011's highlight wants.

**Why not Monaco:** Monaco (VS Code's editor) is more polished but loads language services as separate
**web-worker files, usually from a CDN**. SystemView ships a **prebuilt `build/` installed globally and
run offline** — Monaco's worker/CDN model fights that and is a known CRA headache. **CodeMirror bundles
cleanly into the CRA build** as plain JS. For a `npm i -g`, offline-first tool, that's decisive.

**Why not Shiki / react-syntax-highlighter:** display-only, no edit mode — fails the "edit in the UI"
half. (Fine if we ever want *only* pretty read-only rendering, but CodeMirror covers that too.)

**Slots into existing code:** the display/edit toggle already exists — `EditBox` in
`src/organisms/Documentation/Documentation.js` swaps `mainObject` (Markdown display) ↔ `hiddenForm`
(the textarea). Adopting CodeMirror ≈ replacing that textarea (and, for code, the display) with a
CodeMirror instance inside the same `EditBox`. (For markdown docs, keep `<Markdown>` for display and
optionally use CodeMirror in markdown mode for editing.)

## Open threads (for future us)

- Layout model for multi-pane / gallery center (how many panes, how they're arranged, who decides).
- The agent → UI command vocabulary: beyond `open`, we'd want "show file X lines A–B", "add pane",
  "highlight region", "assemble these N things".
- Where the "assemble the relevant parts" intelligence lives (agent picks; UI just displays).
- Relationship to the existing nav/tests/doc three-column layout — does this replace it or ride on top.

---

*Origin: talking about the RFC-011 log-highlight work, the thought jumped to "what if the doc window
were an AI-driven, deterministic view onto any doc/code, and could show multiple things at once."*
