# SystemView — the agent guide (start here)

You are working in a codebase with **SystemView** installed. SystemView is a documentation, testing
and review surface that runs beside the code: a UI on `localhost:3000`, a CLI, and a plugin the
project's services load.

**Start here.** This file is the map: enough of every surface to work, and a pointer to the depth
when you need it. Nothing is summarised away — the detail lives beside it in this same folder:

| File | When you need it |
| --- | --- |
| [hosted-services.md](hosted-services.md) | **the repo has NO SystemLynx services** — `systemview init` makes the CLI host a real testing service from a committed folder; start-to-green instructions for agents |
| [markdown.md](markdown.md) | the FULL interactive-markdown vocabulary — every block, every attribute, what writes back into the document |
| [tests.md](tests.md) | building, saving and running tests; sections, references, evaluations in depth |
| [stories.md](stories.md) | the story surface and the whole `systemview story …` CLI grammar |
| [namespaces.md](namespaces.md) | decomposing an unfamiliar project into service / module / method |

`agents/` is the top-level home for these; they used to live under `docs/agents/`.

---

## 1 · The namespace model — how everything is addressed

Everything in SystemView hangs off a **namespace**: `service / module / method`.

| Level | What it is | How to find it |
| --- | --- | --- |
| **service** | a domain or deployable boundary | one API, one app, one worker. A small project is usually ONE service. |
| **module** | a cohesive surface inside it | ≈ one file, one class/object, one router, one resource (`Users`, `Auth`). |
| **method** | one callable | one endpoint, one exported function, one command — what a test calls and a doc describes. |

On a **SystemLynx** project these are discovered from the live connection. On any other project,
**run `systemview init`** (RFC-027): the CLI hosts a real testing service from a committed folder —
one file per module, every exported function a live, testable method. That is the primary path for
a repo with no services; full start-to-green instructions:
**[hosted-services.md](hosted-services.md)**. Authoring a namespace map by hand (a `dynamic:true`
manifest) is only for systems nobody will host — methodology: **[namespaces.md](namespaces.md)**.

**Procedure for decomposing an unfamiliar project:**

1. **Find the interface first** — routes, exported modules, CLI commands. The interface's own shape
   usually *is* the decomposition.
2. **Name services by boundary, not by folder.** `src/` is not a service.
3. **Modules are cohesion, not files.** Two files serving one resource are one module.
4. **Methods are callables you could test.** If you can't imagine calling it with arguments, it isn't
   a method.
5. **Stop at three levels.** Deeper nesting belongs in the method name.

A namespace is written with as many segments as needed; the rest comes from context:

```
Math.add                                  module.method, on the document's own service
TestService.Math.add                      name the service
systemview-test.TestService.Math.add      fully qualified
```

---

## 2 · Tests — the engine everything runs on

A test is an **ordered list of named sections**. Built-ins: `before`, `main`, `events`, `after`. Any
**shared action** dropped in becomes its own named section, stored as a `{ use }` reference, so
editing the action updates every test using it.

Saved tests are JSON in the repo at `specs/tests/<Module>.<method>.json`; shared actions at
`specs/actions/<name>.json`. The UI and the CLI run the same files.

**References (`tv(…)`)** — reach an earlier step's data from anywhere in an argument or an expected
value. The root is a **section name**, and the leading `test.` is optional in documents:

```
tv(before[0].results._id)          first Before step's result
tv(seedSum[1].results.total)       a named action's second step
tv(steps[0].args[0].a)             an earlier step's ARGUMENT — `args` is a root like `results`
"user_random(6)@test.com"          random(n): unique on every run, insertable inside a string
```

`date(…)` and `mockFile(…)` are the other run-time functions.

**Evaluations** are assertions on a step: a path, a comparison, an expected value. Comparisons are
typed — `5` is a number, `"5"` a string, `true` a boolean — plus `isLike` for substring/regex.

Run everything from the terminal:

```bash
systemview test <project>                 # everything
systemview test <project> Math.divide     # filter by namespace
systemview test <project> --json          # structured, for CI or for you
systemview probe Service.Module.method '{"a":1}'   # call a method ad hoc
```

Exit code 0 = all passed, 1 = any failure. Sections, references, evaluations and the save format in
depth: **[tests.md](tests.md)**.

---

## 3 · Documents, reports and stories — where writing goes

Three surfaces, three different jobs. Pick deliberately:

| Surface | Lives in | Use it for |
| --- | --- | --- |
| **Documentation** tab | the repo (`specs/docs/`, `<projectCode>.md` at the root) | documenting the SYSTEM. Committed, one per namespace. |
| **Report** tab | `.systemview/` (git-ignored) | write-ups, plans, reviews, findings. Several per namespace, temporary. |
| **Stories** tab | `.systemview/stories/` | an ARRANGEMENT of panes — notes beside files beside diffs beside tests. |

If you are reporting work, a **report** is usually right: it is a full document with every
interactive block available, it is scoped to a namespace, and it does not pollute the project's docs.
The story surface and its complete CLI grammar: **[stories.md](stories.md)**.

---

## 4 · Interactive markdown — the vocabulary

**This is the important part**, and the summary below is deliberately partial — the complete
reference (every attribute, the write-back rules, thread storage, the right-click menu, nesting) is
**[markdown.md](markdown.md)**. Every markdown surface in SystemView renders through one renderer:
the Documentation tab, reports, story markdown panes, `.md` file panes, notes on tests, help topics.
A block written in any of them works in all of them.

The syntax is **directives**, not HTML (raw HTML is disabled):

```
:name[label]{attrs}      inline
::name[label]{attrs}     block
:::name{attrs} … :::     container (wraps content; the outer one takes one MORE colon when nesting)
```

### Links — they reveal, they don't navigate

```markdown
:ns[Math.chainUse]                    a namespace chip — points the navigator at it
:file[src/atoms/Markdown/registry.js#L20-46]   a file, at a line range
:help[markdown]                       opens a help topic
```

Clicking one **reveals** the target in the navigator without moving the reader off the document.
⌘-click navigates for real. Both resolve against the LIVE connection tree, so a stale reference
renders dashed and says why instead of lying.

### Embeds — live things inside prose

```markdown
::chart{report=throughput range=1h}    throughput | errors | latency, + range, service, height
::topology                             the service call graph
::load{limit=8}                        load concentration
::logs[Math.chainUse]{limit=50}        the Logs viewer, scoped by the block
::test[Math.chainUse]                  a SAVED test, runnable in place
::file[cli/stage.js#L43-52]            the file itself, in the document
::diff[cli/runTests.js]                working copy vs git HEAD (read-only here)
```

### Runnables — steps written on the fly

The point is assembling steps **in the document**, for a human to press Run on:

```markdown
:::run{title="Seed and chain"}
- use: seedSum
- Math.multiply({ "a": tv(seedSum[0].results.sum), "b": 4 })
  - results.product = 20
- Math.describe("combine", 2, true, [1, 2, 3])
  - results.summary = "combine x2"
:::
```

- A step is a **method call with as many arguments as the method takes** — positional, comma
  separated. `Module.method { … }` is shorthand for one object argument.
- **Assertions are a nested list** under the step. `- path = value` (typed), `- path ~ text`
  (is-like). `expect`, `assert` or `✓` in front are optional synonyms.
- `use: <action>` pulls in a shared action as its own named section.
- The block's own section is `steps`; references read `tv(steps[0]…)`.
- `::run[seedSum]` replays a **saved** action instead, badged differently.
- **Never auto-runs.** A document is not permission.

### The document is the state

Blocks that take input write back **into the markdown** — there is no second store:

```markdown
- [ ] a task list that saves when you tick it
::question[Which approach?]{options=a|b}     answer=… is written into the block
:::approval{ask="Approve the plan?"} … :::   verdict=approved|rejected is written into the block
```

**`:::approval` is how you ask for a decision.** Wrap what you're proposing, and read the verdict back
off the document later — that is the entire handshake.

### Conversation

```markdown
:::thread{id=extraction}
Anything wrapped here carries a reply thread.
:::
```

Replies are `{ text, ts, author }`; write yours with `author: "agent"` and they render distinctly.
They live in a sidecar (`.systemview/comments.<key>.json`), not in the document.

### Structure

```markdown
:::callout{type=info|warn|danger|success} … :::
:::details{summary="Click to open"} … :::
::::tabs / :::tab{label="…"}
::::columns{split=55} / :::col          ← content side by side: a lead beside its evidence
::::carousel / :::slide{label="…"}
```

`::::columns` is the one to remember for layout — a claim on the left, the thing that proves it on
the right, in one document.

### Unknown blocks

A block this version doesn't know renders as a visible chip rather than vanishing. A document written
against a newer vocabulary degrades honestly.

---

## 5 · Working rules for agents

- **Render, never depict.** If a feature exists, show it live in the document — no ASCII mock-ups of
  something the UI can draw.
- **Probe before asserting.** Call the method and read the real response before writing an expected
  value.
- **Prefer a report over a story** for write-ups, and a `:::approval` over prose when you need a
  decision.
- **Reference, don't repeat.** `tv(…)` a value rather than restating a literal in two places.
- **Say what's unproven.** A block you couldn't run, a claim you couldn't verify — mark it.

## 6 · The CLI, in full

```bash
systemview                       # start the UI on :3000
systemview start 4000            # a different port
systemview init                  # NO framework? host a testing service from a committed folder
                                 #   (enter = defaults; `< /dev/null` = non-interactive; see hosted-services.md)
systemview delete <project>      # init's opposite — hosted projects only; removes the folder (y/N, --force)
systemview open <project> [service/module/method]
systemview test <project> [filter] [--json] [--verbose]
systemview probe <Service.Module.method> '<json args>'
systemview connect [name url]    # register a service
systemview disconnect <project> [service]   # remove a connection (hosted: keeps the folder)
systemview story <…>             # drive a story
systemview shutdown
```

Server-side logging: `systemview.log(msg)` inside a service, then read `systemview.logs` — or the
**Logs** tab, or a `::logs` block in any document.
