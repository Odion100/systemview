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

## Schema

You will almost always build stories through the **CLI** (next section) — it constructs this shape for
you. But here is the exact on-disk/over-the-wire schema so you know every field and nothing is a mystery.

### Story

```jsonc
{
  "id":          "divide-by-zero-narrated", // = slugify(name); ALSO the filename: .systemview/stories/<id>.json
  "projectCode": "systemview-test",
  "namespace":   "systemview-test/TestService/Math/divide", // project | project/Service | …/Module | …/method
  "name":        "Divide by zero — narrated", // free text; the chip label. Same name+namespace UPSERTS.
  "layout":      "grid",                    // "grid" (default) | "gallery" — single/column removed (legacy values render as grid)
  "panes":       [ /* Pane[], rendered top-to-bottom in this order */ ]
}
```

### Pane

```jsonc
{
  "id":     "pane_...",         // assigned by the API when the pane is added
  "kind":   "file",             // "markdown" | "source" | "test" | "diff" | "file"
  "target": { /* shape depends on kind — see table */ },
  "span":   { "w": 50, "h": 320 }, // optional (grid): w = width %, h = height px (legacy "full"/"half" still read)
  "highlight": { "lines": [40, 70] }, // optional (file/source): { "lines": [a, b] } OR { "match": "substr" }
  "replies": [ { "text": "…", "ts": 0, "author": "user" } ] // optional review thread — see "Replies" below
}
```

`target` by `kind`:

| kind | `target` shape | notes |
|---|---|---|
| `markdown` | `{ "text": "<markdown>" }` | prose / narrative |
| `source` | `{ "serviceId", "module", "method" }` | ⚠ uses `module`/`method` |
| `test` | `{ "serviceId"?, "moduleName"?, "methodName"?, "index"?, "note"? }` | which fields are present picks the level (service / module / method / one index); `note` = your markdown for the block |
| `diff` | `{ "serviceId", "path" }` | path is repo-relative |
| `file` | `{ "serviceId", "path" }` | path is repo-relative |

> ⚠ **Key-name inconsistency to know:** `source` uses `module` / `method`, while `test` uses `moduleName`
> / `methodName`. This is historical. **Use the CLI** — it builds the right keys for each kind so you
> never trip on this.

### Gotchas worth knowing

- **Prefer `file` + a line range over `source`.** A `file` pane takes an inline range —
  `--file src/modules/Users.js#L40-70` (or `#L40`) — and highlights exactly those lines. This covers
  everything `source` did and more, so **`source` is dropped from the add UI** (the `--source` CLI flag
  still works as legacy). `source` resolves a method by convention (`**/Module.js` + span), which is
  misleading when methods are attached dynamically, the real work is in middleware, or bodies are lean.
  Point at the real code with `file#L`.
- The **UI must be running** (`systemview start`) — stories are driven against the live instance.
- Panes are **live**: they hold locators, so a story never goes stale, but the target must resolve at
  render time (the file/method/test must exist on the connected service).
- A story is found in the UI under the **namespace it's filed on and any namespace above it drills into**
  — file it where the reviewer will look.

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
- `--layout` ∈ `grid` (default; flex — panes flow into rows, resizable widths/heights) · `gallery` (one at a
  time, or a big pane + a rail of the rest). `single`/`column` are gone — pass them and they render as grid.
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

### Edit a saved story in place (pane-ops)

You don't have to re-emit a whole story to change one pane. These verbs edit an existing story by name
(`--ns` disambiguates a repeated name). All are read-modify-write and broadcast live to an open UI.

```bash
systemview story-add    <project> "<name>" --file path#L88-96   # append a pane (or --at N to insert)
systemview story-rm     <project> "<name>" --at 2               # remove the pane at index 2
systemview story-move   <project> "<name>" --from 0 --to 3      # reorder a pane
systemview story-edit   <project> "<name>" --at 1 --file f#L10-20   # replace a pane; test panes accept --note
systemview story-layout <project> "<name>" --layout grid        # grid | gallery
systemview story-rename <project> "<name>" --to "<new name>"    # rename (new slug, old file removed)
systemview story-delete <project> "<name>"                      # delete the story
```

`--at` / `--from` / `--to` are 0-based pane indices (clamped; omitted `--at` on `story-add` appends).
`story-add` / `story-edit` build the pane from the same flags as `story`.

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

# 3) A change handoff: prose → the diff → the exact lines (file#L) → the tests that prove it, in order.
systemview story systemview-test "combine(): multi-object args" \
  --ns systemview-test/TestService/Math/combine \
  --text "## What changed
Added \`Math.combine({a,label},{b,label})\` — two OBJECT arguments." \
  --diff test/service/Math/index.js \
  --file test/service/Math/index.js#L40-46 \
  --test Math.combine \
  --layout grid

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

---

## Replies — the review / planning loop

A story is **two-way**. In the UI the user can leave a **reply on any pane** — a correction, a question,
a "change this here." Each reply is stored on the pane it targets:

```jsonc
"replies": [
  { "text": "positional refs won't splice — use the natural path", "ts": 1690000000000, "author": "user" }
]
```

`author` is `"user"` (left in the UI) or `"agent"` (your response). The two render distinctly (amber vs
indigo), so a pane becomes a small threaded conversation — flat, one level (you don't reply to a reply;
your response is just the next entry).

**The loop — great for iterating on a plan or a design:**

1. You build a story (a plan, an RFC walk-through, a change handoff) — prose + the exact code, interleaved.
2. The user leaves replies across the panes, then says *"I left responses — take a look."*
3. You **read** them. Each reply sits on its pane, so you know exactly which note / file / test it targets:
   ```bash
   # the replies live in the story file, under each pane
   cat .systemview/stories/<id>.json      # → panes[].replies  (author: "user")
   ```
4. You **respond** on the same pane by appending a reply with `"author": "agent"`, then keep planning.

Put the plan and the real code in a story, let the user annotate it **in place**, and converse per-point
instead of losing the thread in chat.

> A dedicated `systemview story-reply` verb (post an agent reply live, broadcast to the open UI) is
> planned. Until it lands, read the story file and append your `agent` replies to the relevant pane
> (the user sees them on the next refresh).

## Story types — declare the story's PURPOSE

Every story has a purpose, and `type` is where you declare it — BEFORE you build, because the type
should shape what you put in the panes. Current types:

- **`"report"`** (the default — an absent `type` means this): a walk-through / handoff / narration.
  You're SHOWING something: what changed, how it works, what proves it. No response is required from
  READ (`review: { "verdict": "read" }` — the sibling of approval’s marks) to track progress through it; replies are always available. Panes group by topic and flow like a document.
- **`"approval"`**: a sign-off request. You're ASKING something — the user rules on the work, piece by
  piece. Panes must be structured as decisions (below), and the UI grows review controls.

`type` is open-ended: future modes (checklist, walkthrough, incident review…) follow the same pattern.
Pick the type by asking: *what do I want the user to DO with this story?* Reading → report. Ruling →
approval.

### Approval stories — asking for sign-off

Give a story `"type": "approval"` when the point of the story is a DECISION — you're presenting work
(a plan, a change, a refactor) and you want the user to approve or reject it, piece by piece. The type
changes what the user sees AND how you should build it.

**What the user gets:** every pane grows ✓ / ✗ controls in its header. ✓ marks the card approved
(green border), ✗ rejects it (red border). Comments are independent — leave a reply on ANY pane, verdict or not. Panes
can also be left alone — unreviewed is a real state, not consent. The story toolbar shows the tally
("4/7 reviewed · 1 ✗") plus an overall **Approve story / Reject** verdict.

**How that changes your authoring:** each pane should be ONE approvable unit — one decision, not one
topic. Lead with the claim, pair it with the code/diff/test that proves it. If a card mixes three
decisions, the user can't reject just one.

**Schema** (rides the story object like everything else — `saveStory` round-trips it):

```jsonc
{
  "type": "approval",                       // the story-level mode
  "verdict": { "status": "approved", "at": 1754350000000 },   // overall — absent until the user rules
  "panes": [
    { "id": "p1", "review": { "verdict": "rejected", "at": 1754350000000 }, "replies": [ ... ] }
  ]
}
```

**The loop:**

1. Create the story with `"type": "approval"` (set it in the story JSON you write / `systemview story`
   payload). One decision per pane.
2. The user reviews: ✓ / ✗ per card (often with a reply on the rejected ones), maybe an overall verdict.
3. You read it back — `cat .systemview/stories/<id>.json` — and act on `panes[].review` +
   `panes[].replies`: revise exactly the rejected cards.
4. **When you revise a pane, DELETE its `review`** — the old verdict is about content that no longer
   exists; the card must return to unreviewed for re-review. Same for the story-level `verdict` if the
   story materially changed. Never mark a card approved yourself.

