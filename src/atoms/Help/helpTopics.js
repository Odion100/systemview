// The HELP REGISTRY — one place, add a topic here + drop a <Help topic="key"/> anywhere, done.
// Every topic both NARRATES (what/why) and SHOWS (an example) — never one without the other.
// Keys are stable addresses; sub-area topics use dots ("scratchpad.events") if we ever need depth.
//
// RFC-025: help topics render through the SAME markdown atom as every other document, so they USE
// the interactive vocabulary instead of describing it — namespace chips that navigate, file chips
// that open the code, runnable tests, live charts, tabs, folds. The documentation demonstrates the
// product. (Checklists here are read-only: this registry is code, not a file on disk, so there is
// nothing to save to — and the boxes say so on hover.)

const HELP_TOPICS = {
  scratchpad: {
    title: "Scratch Pad — build & run tests",
    body: `# Scratch Pad

The right panel is where a test gets BUILT: an ordered list of **sections**, each holding **steps**
that call real methods on your services. Run any step, any section, or the whole thing — then save
it as a spec that lives with your code (\`specs/tests/\`).

## The sections

- **Main** — the steps under test. The header **chip** is the \`service.module.method\` the test
  SAVES under — click it to retarget.
- **Before / After** — setup and cleanup steps, run around Main.
- **Events** — listeners asserting that something was *emitted* — :help[events].
- **+ actions** — drop in a **shared action** as a section, stored as a \`{use}\` reference — :help[actions].

Sections and steps **drag** to rearrange — the ⠿ grip. Main anchors; everything else reorders.

## Referencing earlier results

Any argument or expected value can read a previous step's response:

\`\`\`text
tv(test.before[0].results._id)      ← first Before step's result
tv(test.seedSum[1].results.total)   ← a named action's second step
"user-random(5)"                     ← unique string on every run
\`\`\`

A string mixing tv() with other text is PAYLOAD TEMPLATING — it substitutes and sends; your server
interprets it.

:::callout{type=info}
A test built here is the same artifact the CLI runs and the same one a document can embed. One
engine, three surfaces.
:::

## A real one

Here is a saved test running **in this help page** — the same component the Test Panel and story
panes render. Hit **Run**:

::test[Math.chainUse]

It targets :ns[Math.chainUse]; the source is :file[test/service/Math/index.js].`,
  },

  events: {
    title: "Events — listener steps",
    body: `# Event steps

An Events step doesn't call a method — it **listens**: \`service.module.on("event_name")\`. The test
passes when the event fires (and its payload matches your evaluations).

\`\`\`text
TestService.Math.on ( "chainUse" )     ← waits for Math to emit chainUse
\`\`\`

- A new listener **defaults to Main's namespace** — wherever Main is pointed, the event listens
  there (\`Service.Module.on\`). Retarget it with the picker like any step.
- The picker offers \`service.module.on()\` across ALL services — asserting a side-effect event on
  a service OTHER than Main's is a normal thing to do.
- Event steps are their own species: they **drag within the Events section only** (the plum grip),
  and normal steps can't drop in.

:::callout{type=warn}
An event step that never fires **fails by timeout**, not by assertion — which is what you want: a
missing emit is a real failure, not a silent pass.
:::

The emitting method in this project is :ns[Math.chainUse] — source at
:file[test/service/Math/index.js]. Build one in the Scratch Pad: :help[scratchpad].`,
  },

  actions: {
    title: "Actions — shared, reusable test sections",
    body: `# Shared actions

An **action** is a named, reusable sequence of steps — built once on this tab, dropped into any
test as a section via **+ actions**. The test stores a reference, not a copy:

\`\`\`json
{ "use": "seedSum" }
\`\`\`

Edit the action → every test using it follows. Actions save under the service they were built on
(\`specs/actions/\`), but their steps can call across namespaces like any step.

::::tabs
:::tab{label="Referencing"}
Read an action's results from later steps the usual way:

\`\`\`text
tv(test.seedSum[0].results.sum)
\`\`\`

Each action stays self-contained on its own (internal refs + \`random()\` data); references at the
seams are what make several actions work together.
:::
:::tab{label="Placement"}
An action section can sit **pre** (before Main) or **post** (after Main) — drag it. The same action
can be inserted more than once (\`seedSum\`, \`seedSum_2\`, …).
:::
:::tab{label="On disk"}
Live examples in this project: :file[test/service/specs/actions/seedSum.json] ·
:file[test/service/specs/actions/signInUser.json] · :file[test/service/specs/actions/buildGreeting.json]
:::
::::

:::details{summary="Why a reference and not a copy — click me"}
Setup logic is the thing most likely to change (a new required field, a renamed argument). If every
test copied it, one API change means editing twenty specs. A \`{use}\` reference means editing one.

This is also why a *document* that runs setup should name an action rather than inline its steps —
see :help[markdown].
:::`,
  },

  "saved-tests": {
    title: "Saved tests — the spec list",
    body: `# Saved tests

Every saved test for the current namespace, straight from the repo (\`specs/tests/\`). What you can
do from here:

- **▶ Run** one, or **Run all** — runs are SEQUENTIAL (shared sessions/cookies stay sane).
- **✎ Edit** loads the test into the builder above (collapsed, statuses reset) — you're now editing
  the saved file; the chip shows its slot (#N), the × steps off it.
- **×** deletes the spec file.

::::tabs
:::tab{label="From the UI"}
Pick a test and hit Run. Here's one embedded in this page — same thing, same engine:

::test[Math.add]
:::
:::tab{label="From the CLI"}
A test on disk is JSON — sections plus a run order. The CLI runs the same files:

\`\`\`bash
systemview test <project>              # everything
systemview test <project> Math.divide  # filter by namespace
systemview test <project> --json       # for CI / agents
\`\`\`

Same specs, same engine, UI and CLI agree.
:::
::::

:::callout{type=success}
Because it's one engine, a test embedded in a document (\`::test[Math.add]\`) isn't a copy or a
screenshot — it's the test.
:::`,
  },

  navigator: {
    title: "Navigator — services & codebases",
    body: `# Navigator

The left panel has two lenses:

- **SystemLynx** — your connected projects → services → modules → methods. Click to navigate; the
  middle panel follows (docs / logs / reports), the Scratch Pad targets it. Click a selected item
  again to **deselect** and come back to the hub.
- **Codebases** — your files. Edit-first, with a rendered **Preview** for markdown, a git **Diff**
  toggle for anything that differs from HEAD, and ⌘S to save.

Anything the tree can reach, a document can link to directly:

::::columns{split=50}
:::col
**Namespaces**

:ns[Math.add] · :ns[Math.chainUse] · :ns[GatedSibling.Auth.getSession]
:::
:::col
**Files**

:file[test/service/index.js] · :file[cli/stage.js#L43-52]
:::
::::

:::callout{type=info}
Opening a file is a real **history entry**, so the browser back button returns you where you were,
and a file view can be linked to directly.
:::

Add a connection with **＋**: paste a \`loadService\` URL for a SystemLynx service, or attach a
codebase folder.`,
  },

  markdown: {
    title: "Interactive markdown — blocks in any document",
    body: `# Interactive markdown

Every markdown surface in SystemView — this help page, the **Documentation** tab, story markdown and
\`.md\` file panes, agent notes on tests, the codebase preview — renders through one renderer. A block
written in any of them works in all of them (RFC-025).

**Everything below is live.** Source first, the real thing under it.

## Links that navigate

\`\`\`markdown
The chain test lives in :ns[Math.chainUse].
The dispatch is in :file[src/atoms/Markdown/Markdown.js#L20-46].
Open another topic with :help[scratchpad].
\`\`\`

The chain test lives in :ns[Math.chainUse]. The dispatch is in
:file[src/atoms/Markdown/Markdown.js#L20-46]. Another topic: :help[scratchpad].

\`:ns[…]\` resolves against the **live connection tree** — two segments mean "on this document's
service", three name the service, four name the project too. One that no longer exists renders
dashed and says why: :ns[Ghost.vanished]

## Callouts and folds

\`\`\`markdown
:::callout{type=warn}
Percentiles stay all-time even under a time range.
:::
\`\`\`

:::callout{type=warn}
Percentiles stay all-time even under a time range — the bounded-memory contract.
:::

:::details{summary="A fold, for the long bits — click me"}
\`:::details{summary="…"}\` wraps any markdown, including other blocks. Callout types: \`info\`,
\`warn\`, \`danger\`, \`success\`.

An unknown block shows itself instead of vanishing, so a document written against a newer version
degrades honestly: ::sparkline{of=everything}
:::

## Tabs and columns

\`\`\`markdown
::::tabs
:::tab{label="One"}…:::
:::tab{label="Two"}…:::
::::
\`\`\`

::::tabs
:::tab{label="Tabs"}
The outer container takes one **more** colon than its children — \`::::tabs\` around \`:::tab\`.
:::
:::tab{label="Columns"}
\`::::columns{split=55}\` with \`:::col\` children — a lead beside its evidence, collapsing to one
column on a narrow pane.
:::
:::tab{label="Nesting"}
Any markdown goes inside, including other blocks:

:::callout{type=success}
A callout inside a tab inside a help topic.
:::
:::
::::

## Live embeds

\`\`\`markdown
::chart{report=throughput range=1h}
::test[Math.chainUse]
\`\`\`

::chart{report=throughput range=1h height=80}

The same \`LineChart\` the Stats page draws, from the same snapshot — page and embed can't drift.
\`report\` is \`throughput\`, \`errors\` or \`latency\`; also takes \`range\`, \`service\`, \`height\`.

A saved test, runnable here:

::test[Math.chainUse]

## Runnables — steps written on the fly

\`\`\`markdown
:::run{title="Two-argument call, checked"}
- Math.combine({ "a": 2, "label": "first" }, { "b": 3, "label": "second" })
  - results.sum = 5
:::
\`\`\`

:::run{title="Two-argument call, checked"}
- Math.combine({ "a": 2, "label": "first" }, { "b": 3, "label": "second" })
  - results.sum = 5
  - results.inputs.b.value = 3
:::

A method takes as many arguments as a real function does, so the **call form** is the primary one.
\`use: <action>\` pulls a shared action in as its own section, \`tv(…)\` reaches an earlier step's
output, and \`::run[name]\` replays a **saved** action — badged differently so the two never blur.

**Assertions are a nested list** under the step, and each bullet becomes a real evaluation — the same
one a saved test stores, run by the same validators: \`- results.sum = 5\` (type inferred — number,
string, boolean), \`- results.name ~ ser_\` (is-like), \`- results.seeded = tv(test.seedSum[0].results.sum)\`
(an earlier step's output). \`expect\`, \`assert\` or a leading \`✓\` are optional and identical.

## Files and diffs — \`::file\` / \`::diff\`

\`\`\`markdown
:file[cli/stage.js#L43-52]     ← a chip that reveals it in the nav
::file[cli/stage.js#L43-52]    ← the file itself, at that range
::diff[cli/runTests.js]        ← working copy vs git HEAD
\`\`\`

Inline REFERS, block BRINGS IT IN — the same split \`run\` has. Both render through the atoms the story
panes use, so a file looks identical in a story and in a document. A \`::diff\` is read-only here.

## Logs — \`::logs\`

\`\`\`markdown
::logs[Math.chainUse]
\`\`\`

The Logs tab's own viewer, scoped by the block rather than by the nav — filters, frequency dashboard,
Monitor and Clear all included, because it is the same component.

::logs[Math]

## Approvals — \`:::approval\`

\`\`\`markdown
:::approval{id=plan ask="Approve the migration plan?"}
What's being proposed.
:::
\`\`\`

:::approval{id=help ask="Approve this example?"}
The verdict is written INTO the document (\`verdict=approved\` / \`verdict=rejected\`), which is how an
agent reads your decision back. Click the same one again to withdraw it.
:::

## Threads — reply on a block

\`\`\`markdown
:::thread{id=extraction}
Anything wrapped here carries a reply thread.
::chart{report=errors range=4h height=70}
:::
\`\`\`

:::thread{id=help-markdown-threads}
The 💬 in this block's corner is the **same** thread a story pane carries: your replies and agent
replies in distinct looks, ⌘↵ to post. Leave one here — it saves to \`.systemview/comments.<key>.json\`
in the connected project and comes back on reload.

The wrapper is the whole trick. The thread belongs to it, and it lives in the document, so it moves
with the content it's about — no heading anchors to guess at, no orphaned comments when a paragraph
is reworded, no gutter noise on paragraphs nobody wants to discuss. Replies live in a **sidecar**,
not the file, so conversation stays out of git diffs.
:::

## Carousel

\`\`\`markdown
::::carousel
:::slide{label="Throughput"}…:::
:::slide{label="Errors"}…:::
::::
\`\`\`

::::carousel
:::slide{label="Throughput"}
::chart{report=throughput range=1h height=70}
:::
:::slide{label="Errors"}
::chart{report=errors range=4h height=70}
:::
::::

Only the **active** slide is mounted, so an off-screen chart or test isn't quietly fetching.

## Checklists that edit the document

\`\`\`markdown
- [x] wire the registry
- [ ] add ::run
\`\`\`

- [x] links (\`:ns\`, \`:file\`, \`:help\`)
- [x] structure (callouts, folds, tabs, columns, carousel)
- [x] embeds (\`::chart\`, \`::test\`, \`::topology\`, \`::load\`)
- [x] \`:::run\` / \`::run[name]\`, \`::question\`, \`:::thread\`, \`:::approval\`
- [ ] \`::cmd\`, \`::mermaid\`, media embeds

Ticking a box rewrites the \`- [ ]\` on that line and saves the document — \`saveDoc\` for the
Documentation tab, \`writeFile\` for file panes. **The document is the state**; there is no second
store. The boxes above are read-only because this help page is a code constant rather than a file —
hover one and it says so. Open :file[docs/interactive-markdown.md] and the same list is live.

## Where the vocabulary lives

:file[src/atoms/Markdown/registry.js] — one map. A new block is a line there, not a renderer change.
Raw HTML stays off, so nothing renders that isn't registered.`,
  },
  chat: {
    title: "Agent chat — the bots in the corner",
    body: `# Agent chat — talk to an agent from the UI

Every connected project has a **bot** (🤖) floating on the page — always visible, wherever you are.
Drag it anywhere (release near an edge to dock; the spot is remembered). Click it to open the chat.

## The ring tells the truth

- **Solid green** — an agent is **joined live**: it answers now, even while idle elsewhere.
- **Dashed indigo** — an agent is **listening by file**: it hears you at its next turn.
- **Muted** — nobody's connected. The ring is derived from the real connection — it can't lie.

The panel header says the same in words: **LIVE / FILE / OFFLINE**.

## What your message carries

Your words **plus your vantage point at the moment you hit send** — page, namespace, tab, open
file or report. So "why would you do that?" needs no explanation: the agent knows what *that* is.
Roaming and commenting stay silent; only your **message** triggers a response.

## While the agent works

The instant a live agent takes your message the panel shows **received**, then the agent's own
cooking line (bold green, bouncing dots) — a specific status shows verbatim, generic waits rotate
through cooking words. A **minimized** bot still talks: the cooking line sticks out beside the
bubble, and an unseen reply shows as a green preview (click it to open). A green count rides the
bubble for replies you haven't read.

## How an agent connects

Connecting is the **agent's explicit act** — instructions live in \`agents/chat.md\`:

- \`systemview join <project>\` — live mode: the agent holds the line (solid ring), your send wakes
  it immediately.
- \`systemview inbox <project>\` from the agent's own hooks — file mode: messages drain from the
  chat's file (\`.systemview/chats/…jsonl\`) at the agent's next turn (dashed ring).
- \`systemview say\` / \`systemview status\` — how its replies and cooking lines get here.

One chat per project for now — named chats, docking layouts and more are on the roadmap.`,
  },
};

export default HELP_TOPICS;
