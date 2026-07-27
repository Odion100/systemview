# Stories — a guide for agents

This document is written **for AI agents** working in a SystemLynx codebase with SystemView installed.
It explains what Stories are, and **when, why, and how** to use them. If you are a human, the short
version is in the [README](../README.md#stories); this is the operational guide your agent should read.

---

## What a Story is

A **Story** is a saved, named, namespaced arrangement of **panes** that communicates a piece of work.
Think of it as the visual, runnable answer to _"what did you do, and how do I know it works?"_

- It lives on disk at `.systemview/stories/<name>.json`, so it **travels with the repo** — a teammate
  who pulls the branch sees the same story.
- It is **filed under a namespace** — a project, a service, a module, or a single method — and carries a
  **free name**. A namespace can hold **many** stories, the same way a method can hold many tests.
- The user opens it in the browser under **Specs → (navigate to that namespace) → the Stories tab**.

A story is made of **panes**, rendered top-to-bottom in the order you give them:

| Pane       | What it shows                                       | Built from              |
| ---------- | --------------------------------------------------- | ----------------------- |
| `markdown` | your prose / narrative                              | `--text "..."`          |
| `source`   | a method's real source code                         | `--source <Mod.method>` |
| `test`     | saved test(s), **runnable**, at any namespace level | `--test <target>`       |
| `diff`     | a file's changes vs git HEAD                        | `--diff <path>`         |
| `file`     | a whole project file                                | `--file <path>`         |

Panes carry **locators, not bytes** — the UI fetches the real source/diff/test from each service's own
plugin at render time. So a story is always live and truthful, never a stale copy.

---

## When and why to use a Story

Reach for a story **after you've done a slice of work** and want to hand it off or prove it out. It is
your handoff artifact: _"here's what I changed, here's the proof, here's how to verify."_ Examples:

- **You implemented an RFC or a feature.** Assemble a story with the `diff`s of what changed, the
  `source` of the key methods, and the `test`s that cover it — with `markdown` notes narrating it.
- **You wrote new tests.** Bring _just those tests_ out into a story ("These are the new tests for X")
  so the reviewer can run them inline and see them pass, without hunting through the suite.
- **You fixed a bug.** A story with the failing case (a `test` that asserts the bug is gone), the `diff`
  of the fix, and a note explaining the root cause.
- **You want to explain how something works.** Prose (`markdown`) interleaved with the real `source` and
  a runnable `test` that demonstrates it.

**Make as many as help** — one story with the docs + diffs, another that runs the tests, or one combined;
file each at whatever level fits (project, service, module, or method). And you are **not limited** to
these moments — a story is the right tool whenever showing beats telling.

---

## How to drive Stories (CLI)

> The UI must be running (`systemview start`). Stories are driven against the live instance.

### Create or update a story

```bash
systemview story <projectCode> "<name>" [--ns <namespace>] [--layout <layout>] <panes...> [--note "<md>"]
```

- Re-running with the **same name + namespace upserts** it (edits in place). A new name makes a new story.
- **Panes are added in command order**, so `--text` can sit _between_ code/diff/test panes to tell a story.
- `--ns <namespace>` files it. Format is a path: `project`, `project/Service`, `project/Service/Module`,
  or `project/Service/Module/method`. Defaults to the project (project-level) if omitted.
- `--layout` ∈ `column` (stack, default) · `grid` (flex; mix half/full-width) · `single` · `gallery`.
- `--note "<markdown>"` attaches your **own markdown to a `test` pane** — it renders _with_ the test block
  (never interrupting the test's steps). Use it to narrate a test.

### `--test` targets any namespace level

| Target                  | Grabs                                                      |
| ----------------------- | ---------------------------------------------------------- |
| `--test *`              | every test in the whole project (all services)             |
| `--test <ServiceId>`    | all tests under that service                               |
| `--test <Module>`       | all tests under that module (across services that have it) |
| `--test <Mod.method>`   | that method's tests                                        |
| `--test <Mod.method>:N` | just test index `N` of that method                         |

### List stories

```bash
systemview stories <projectCode>          # name · namespace · pane count for every saved story
```

---

## Worked examples (against the `systemview-test` project)

These are real, runnable against the bundled test services. They created the example stories you can
open in the UI right now.

```bash
# 1) A narrated failing-case, filed on the exact method, with an agent note woven into the test block.
systemview story systemview-test "Divide by zero — narrated" \
  --ns systemview-test/TestService/Math/divide \
  --test Math.divide \
  --note "## Guarding against a zero divisor
\`Math.divide\` throws \`{ message: \"Cannot divide by zero\", status: 400 }\` when \`b === 0\`.
The test **asserts the throw** — a red *threw* is the PASS here."

# 2) Every test under a module, filed on the module.
systemview story systemview-test "All Math tests" \
  --ns systemview-test/TestService/Math \
  --test Math --layout column

# 3) A change handoff: prose → the diff → the source → the tests that prove it, in order.
systemview story systemview-test "combine(): multi-object args" \
  --ns systemview-test/TestService/Math/combine \
  --text "## What changed
Added \`Math.combine({a,label},{b,label})\` — two OBJECT arguments." \
  --diff test/service/Math/index.js \
  --source Math.combine \
  --test Math.combine \
  --layout column

# See them all
systemview stories systemview-test
```

The user then opens **Specs**, navigates to (say) `Math/divide`, opens the **Stories** tab, clicks the
story's chip, and can **Run** the tests inline, **filter** pass/fail, and read your notes — all from the
locators you filed, with bytes fetched live from the service.

---

## Where things live / how the user sees it

- On disk: `.systemview/stories/<name>.json` — `{ id, projectCode, namespace, name, layout, panes }`.
- In the UI: **Specs → navigate to the namespace → Stories tab.** A namespace shows the stories filed at
  it _and_ under it (drill into a service → its modules'/methods' stories appear). Each story is a named
  chip; open one to view/run/edit its panes.
- The live stage verbs (`show` / `assemble` / `stage` / `highlight` / `view` / `selection`) still exist for
  driving a single ephemeral Window in real time; **prefer `story`** when you want a persistent, named,
  namespaced artifact — which is almost always, for handoffs.
