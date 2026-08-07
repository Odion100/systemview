// The HELP REGISTRY — one place, add a topic here + drop a <Help topic="key"/> anywhere, done.
// Every topic both NARRATES (what/why) and SHOWS (an example) — never one without the other.
// Keys are stable addresses; sub-area topics use dots ("scratchpad.events") if we ever need depth.

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
- **Events** — listeners asserting that something was *emitted* (see the ? on the Events section).
- **+ actions** — drop in a **shared action** (built on the Actions tab) as a section; it's stored
  as a \`{use}\` reference, so editing the action updates every test that uses it.

Sections and steps **drag** to rearrange — the ⠿ grip. Main anchors; everything else reorders.

## Referencing earlier results

Any argument or expected value can read a previous step's response:

\`\`\`text
tv(test.before[0].results._id)      ← first Before step's result
tv(test.seedSum[1].results.total)   ← a named action's second step
"user-random(5)"                     ← unique string on every run
\`\`\`

A string mixing tv() with other text is PAYLOAD TEMPLATING — it substitutes and sends; your server
interprets it.`,
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
  and normal steps can't drop in.`,
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

Reference an action's results from later steps the usual way:

\`\`\`text
tv(test.seedSum[0].results.sum)
\`\`\`

Placement: an action section can sit **pre** (before Main) or **post** (after Main) — drag it.`,
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

A test on disk is JSON — sections + a run order. The CLI runs the same files:

\`\`\`bash
systemview test <project>              # everything
systemview test <project> Math.divide  # filter by namespace
\`\`\`

Same specs, same engine, UI and CLI agree.`,
  },

  stories: {
    title: "Stories — the review & conversation surface",
    body: `# Stories

A story is a named, persisted arrangement of **panes** — markdown, files, diffs, tests, sources —
that shows something: a change to review, a plan to approve, a report to read. Stories are the
medium agents and you converse through.

## Story types — the purpose, declared

- **report** (default) — read it; each pane has a single ✓ **mark-as-read** (indigo when read).
- **approval** — each pane gets **✓ / ✗** verdicts + an optional story-level APPROVE/REJECT; the
  toolbar tallies. Use it when the story is a decision.

## Replies

Every pane has a reply thread (the 💬 corner button) — your notes ride the pane; agent answers
appear with their own indigo look. Comments are independent of verdicts — reply whenever you want.

## Layouts

Grid (spans: full/½/⅓) or gallery (filmstrip). Panes edge-resize; double-click an edge to fill or
match. Diff panes are LIVE — the right side is editable, Save writes the file.`,
  },

  navigator: {
    title: "Navigator — services & codebases",
    body: `# Navigator

The left panel has two lenses:

- **SystemLynx** — your connected projects → services → modules → methods. Click to navigate; the
  middle panel follows (docs / logs / stories), the Scratch Pad targets it. Click a selected item
  again to deselect. **＋** connects a service by its \`loadService\` URL.
- **Codebases** — the project's actual file tree (served by a plugin-bearing service). Amber dots =
  git-changed files; the filter box takes substrings or \`*.ext\`; toggle pills compose (changed /
  .md / tracked). Clicking a file opens the edit-first Code pane in the middle.

The middle panel's **breadcrumb scope is independent** — click a segment (project » service.module)
to read docs/logs/stories at that level while the nav and Scratch Pad stay where they are.`,
  },
};

export default HELP_TOPICS;
