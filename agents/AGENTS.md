# SystemView — the agent guide (start here)

You are working **inside SystemView**. It is the IDE this window is — the code, its history, the
documents, the tests, the statistics and this conversation are all surfaces of it, served by its
hub (`api/`) and drawn by its window (`src/`).

**You reach it through tools, not a terminal.** SystemView runs an internal MCP server; its tools
are `mcp__systemview__*`, and calling a service method is `mcp__systemlynx__call`. There is no
identity flag anywhere — the harness knows which session is calling, so every tool stamps you
automatically. The `systemview` CLI still exists and still works; it is the surface for a **human at
a terminal and for CI**, and it is not how you work.

**Start here.** This file is the map: enough of every surface to work, and a pointer to the depth
when you need it. Nothing is summarised away — the detail lives beside it in this same folder:

| File | When you need it |
| --- | --- |
| [hosted-services.md](hosted-services.md) | **the repo has NO SystemLynx services** — `systemview init` registers a folder and the **hub** hosts a real testing service from it; start-to-green instructions |
| [chat.md](chat.md) | **being in the conversation** — the panel attaches to your live session and your reply IS the message, rendered as interactive markdown. Reaching another agent is harness messaging, not a SystemView verb |
| [markdown.md](markdown.md) | the FULL interactive-markdown vocabulary — every block, every attribute, what writes back into the document |
| [tests.md](tests.md) | building, saving and running tests; sections, references, evaluations in depth |
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
**run `systemview init`** (RFC-027) — one of the few things still done at a shell, because it asks
questions. It registers the folder; the **hub** hosts a real testing service from it —
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

## 1.5 · The project model — a project is a NAME; everything else is an attachment

A project starts as a **name** and grows what it needs. In the UI the ＋ button asks for one thing
— the name — and the project appears immediately as a *husk*: codebase, services, code, terminal
all present as places, each saying what it still wants (the codebase area says "no folder yet —
choose a folder"; nothing pretends to exist). Attachments arrive in any order, and every shape is
first-class:

| Shape | What it has | How it happens |
| --- | --- | --- |
| husk | a name only | ＋, type the name |
| codebase-only | folder → code, terminal, agent | "choose a folder" on the husk; no services area is drawn |
| services-only | live SystemLynx connection | the plugin connects, or `systemview connect` |
| both | folder + services | either order |

Rules that follow from it:

- **The name is chosen, never derived.** No folder ever names a project; renaming is in place
  (double-click the name).
- **Removal means what the thing is**: a husk is a forgotten name; a folder is forgotten from the
  list (nothing on disk is touched); a service project is deregistered.
- The CLI paths (`systemview init`, `systemview connect`) still register projects and now carry the
  folder root, so CLI-born and UI-born projects are the same kind of thing to the shell.

Commits are offered **in the conversation**, as a `::commit{message="…"}` block the human presses —
never pasted into a terminal for them, never run uninvited. The full interactive vocabulary is
section 4 and [markdown.md](markdown.md).

---

## 1.6 · The plugin — how a SystemLynx service becomes visible

Everything in section 2 assumes SystemView can *see* the service. That is one dependency and four
lines of wiring, and it is the step most often missed: **a SystemLynx service with no plugin is
invisible** — no probe, no saved tests, no rendered docs, no logs, no stats. The tests you write for
it are files nothing runs.

```js
const SystemViewPlugin = require("systemview-plugin")({
  connection: process.env.SYSTEMVIEW_HOST,  // default http://localhost:3300/systemview/api
  specs: "./Profiles/specs",                // where THIS service's tests and docs live
  projectCode: process.env.PROJECT_CODE || "buAPI",
  serviceId: "Profiles",
  module: helpers,                          // optional — a helper module exposed to tests
  useSystemViewUI: !!process.env.SYSTEMVIEW_HOST,
});
App.use(SystemViewPlugin);
```

`~/buAPI/Profiles/index.js` is the reference — five services, each wiring its own plugin and
pointing at its own specs. The options worth knowing: `credentials: true` declares a cookie-session
service (RFC-013), `redact: ["password"]` keeps secrets out of the trace, `trace: (req) => ({…})`
stamps every call, `exclude` drops a module from observation, `hosted` is for the CLI-hosted case
([hosted-services.md](hosted-services.md)).

---

## 1.7 · What a service owes — a spec folder beside it

**One service, one `specs/` folder, beside the service it belongs to** — placement is the coupling
declaration here as everywhere else in the tree:

```
Profiles/
  index.js                      ← the plugin is wired here, pointed at ./Profiles/specs
  specs/
    tests/   Events.addTeam.json   ONE FILE PER METHOD — an array, one entry per saved test
    docs/    Events.md             ONE FILE PER MODULE — <Module>.<method>.md when a method earns a page
    actions/ seedProfile.json      shared setup, referenced as { "use": "Profiles.seedProfile" }
```

**A SystemLynx service owes a spec.** This is not a coverage target. A method nobody saved a test
for cannot be run from the window and cannot be run in CI, and its documentation is a description
with nothing underneath it that would notice when it stopped being true. Write the service, write
the test, write the doc — in the same change.

**And the doc does not describe the test, it runs it.** `::test[Profiles.Events.addTeam]` inside
`specs/docs/Events.md` renders that saved test as a thing the reader presses and watches pass or
fail; `::probe` does the same for a single call. That is why docs live beside specs — the
explanation and the proof are one artifact. The block vocabulary is [markdown.md](markdown.md); the
spec format in depth is [tests.md](tests.md).

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

Run them with tools:

```js
mcp__systemview__runTests({ projectCode })                        // everything
mcp__systemview__runTests({ projectCode, namespace: "Math.divide" })  // filter
mcp__systemview__runTests({ projectCode, dryRun: true })          // list what WOULD run
mcp__systemview__runTests({ projectCode, bail: true })            // stop at the first failure
mcp__systemlynx__call(...)                                        // call a method ad hoc
```

The result comes back structured and renders as the run display in the chat — there is no `--json`
to ask for, and no output to parse. Calling one method ad hoc is `mcp__systemview__probe`; it carries
session headers itself, which is what retired the per-terminal cookie jar (not the verb).

`systemview test` still exists for **CI**, where the exit code (`0` all passed, `1` any failure) is
the contract. Sections, references, evaluations and the save format in depth: **[tests.md](tests.md)**.

---

## 3 · Documents and reports — where writing goes

Two surfaces, two different jobs. Pick deliberately:

| Surface | Lives in | Use it for |
| --- | --- | --- |
| **Documentation** tab | the repo (`specs/docs/`, `<projectCode>.md` at the root) | documenting the SYSTEM. Committed, one per namespace. |
| **Stage (reports)** tab | `.systemview/` | write-ups, plans, reviews, findings. Several per namespace. |

If you are reporting work, a **report** is right: it is a full document with every interactive
block available (embedded files, diffs, runnable tests — see [markdown.md](markdown.md)), it is
scoped to a namespace, and it does not pollute the project's docs. **Stories are retired** — if
you find `systemview story …` anywhere, do not use it; write a report.

---

## 4 · Interactive markdown — the vocabulary

**This is the important part**, and the summary below is deliberately partial — the complete
reference (every attribute, the write-back rules, thread storage, the right-click menu, nesting) is
**[markdown.md](markdown.md)**. Every markdown surface in SystemView renders through one renderer:
the Documentation tab, reports, `.md` file panes, notes on tests, help topics.
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

**`:ns` and `:file` OPEN what they point at** — one behaviour, no modifier to learn (⌘-click does
the same thing), and the tree expands and marks where you arrived. Reveal-only was retired: a
reference you had to follow up by hand is a gesture, not a link.

`:help` is the exception and works the other way — a click reveals the topic's row in the nav,
⌘-click opens it.

`:ns` resolves against the live connection tree; `:file` is hub-served by project code and works
with every service down. Either way a stale reference renders dashed and says why instead of lying.
One colon links, **two embeds the whole file inline**. A `:file`/`::file` pointed at an image
renders the image viewer.

### Embeds — live things inside prose

```markdown
::chart{report=throughput range=1h}    throughput | errors | latency, + range, service, height
::topology                             the service call graph
::load{limit=8}                        load concentration
::logs[Math.chainUse]{limit=50}        the Logs viewer, scoped by the block
::test[Math.chainUse]                  a SAVED test, runnable in place
::file[cli/stage.js#L43-52]            the file itself, in the document
::diff[cli/runTests.js]                working copy vs git HEAD (read-only here)
::commit{message="feat(nav): the lens"}  a commit message he PRESSES instead of copying
```

`::commit` shows the branch, what would go in (staged / changes / untracked, with `+` and `−` on
each), and a two-step Commit — plus Push when the branch is ahead, and a log tab carrying git's own
output. The sha is written back into the block when it runs, so the report becomes the receipt.
**You write it; only he presses it** — there is no `systemview commit` or `systemview push`, and
that absence is the design. Full rules in [markdown.md](markdown.md).

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
- **Probe before asserting.** Call the method with `mcp__systemview__probe` and read the real
  response before writing an expected value. Never assert a shape you assumed.
- **A report for write-ups**, and a `:::approval` over prose when you need a decision. Anything long
  goes on the TV or in a report — the chat scrolls, and what scrolls is gone.
- **Reference, don't repeat.** `tv(…)` a value rather than restating a literal in two places.
- **Say what's unproven.** A block you couldn't run, a claim you couldn't verify — mark it.
- **The codebase surface is HUB-served** — files, git, staging, diffs, images, by project code,
  working with your services down. ☠ [RETIRED-2026-08-26] "no branch name / `Plugin.stageFiles is not a
  function` → restart your service" — plugin-serves-git is retired and a stale plugin can no longer
  cause those symptoms. A plugin version still matters for what the plugin actually DOES: your
  documentation, tests, and your room's chat module — restart your service after upgrading for
  those. (An `init`-hosted project has no process of its own; the hub refresh covers it.)

## 5.5 · The worklist — your plan, on his screen

Some sessions carry a worklist tool — `mcp__worklist__set` (an MCP tool; if ToolSearch doesn't find
it, your session doesn't have it and none of this applies). It holds YOUR plan for the work in
front of you, and the UI draws it under your bot: closed, one line — `3/7` and the step you're on;
open, the whole list. The minimized view carries the same header on your cooking line, so the human
knows where you are without opening anything.

Mechanics, all enforced by the tool rather than remembered by you:

- **Send the whole list every time.** The only parameter is the complete list — there are no
  deltas, so a subscriber who arrives mid-session is never wrong.
- **One item active.** Extra actives are demoted, first wins. The active item's text is what the
  human reads as "what it's doing right now" — write it as the step, not the goal.
- **States:** `pending` · `active` · `done`. Done rows render struck through with a green check.

What makes it worth writing: update it AS you work — the item goes active when you start, done when
it lands. A list rewritten after the fact is a summary in a checklist costume, and the human can
tell, because he watches it move (or not) while you cook.

## 6 · The tools, in full

Fifteen tools on the `systemview` MCP server, plus the SystemLynx bridge. **Identity is the
session's** — no tool takes an "as" argument, because the harness already knows who is calling.

### Seeing and running

```js
mcp__systemview__projects({})                                  // what is connected
mcp__systemview__runTests({ projectCode, namespace, bail, dryRun })
mcp__systemview__logs({ projectCode, level, limit, namespace })
mcp__systemview__stats({ projectCode, service, range })        // range: 15m | 1h | 4h | 24h | all
mcp__systemview__probe({ namespace, args, projectCode, headers })  // call ONE method, read the answer
```

`runTests({ dryRun: true })` is how you list what exists without running it.

**`probe` and `mcp__systemlynx__call` are not the same door.** `probe` reaches anything SystemView
has **registered** — through the hub, no whitelist, no MCP required — and resolves a fuzzy namespace
(`signIn`, `Users.signIn`, `Profiles.Users.signIn`), with a `projectCode:` prefix to scope it when
one service is connected twice. `mcp__systemlynx__call` reaches a service on the **MCP tier**:
whitelisted in `~/.autobot/services.json` and publishing its own MCP routes, so it arrives with
schemas. Use `probe` to call a method; use `call` when you want the schema-backed surface.

### Writing where he reads

```js
mcp__systemview__show({ projectCode, text })            // put a document on the TV
mcp__systemview__show({ projectCode, reportPath })      // ...or an existing .md
mcp__systemview__show({ projectCode, clear: true })     // take it down
mcp__systemview__tv({ projectCode, show })              // read the TV back, including his answers
mcp__systemview__reply({ projectCode, report, threadId, text })
mcp__systemview__comments({ projectCode, path, at, replyText })
mcp__systemview__board({ projectCode, name, add, at, replyText })
```

**A report is a document** (RFC-040). `show` with `text` files it at
`.systemview/report.<project>.<slug>.md` and the chat only points at it; re-showing the same title
saves over it, and his answers — `::question` choices, `:::approval` verdicts, `:::thread` replies —
live in the file. Read them back with `tv({ show: "<title>" })`.

**`show` files a copy.** For a file that already lives somewhere permanent — an RFC, a doc, a skill
— do not `show` it: link it with a `:file[path]{project=<code>}` chip. Otherwise you create a second
copy that never updates while he reads it.

**His board** is what he leaves you between sessions: reminders, things to hand you later, what was
wrong with something he was looking at. A note holds a conversation — replies accumulate under it.
**Pass the `id`, never the position**; the list reorders the moment he adds a note.

### Driving the window

```js
mcp__systemview__nav({ projectCode, namespace | file | report | stats | agents })
mcp__systemview__highlight({ projectCode, ..., say })
mcp__systemview__act({ projectCode, ..., say })
mcp__systemview__refresh({ projectCode, scope })
mcp__systemview__connect({ ... })  /  mcp__systemview__disconnect({ ... })
```

`nav` is **kind-explicit**: exactly one of `namespace`, `file`, `report`, `stats`, `agents`. The
caller always knows what it is sending him to, so the code never guesses.

`highlight` and `act` take `say` — a sentence that rides the receipt. It is **ephemeral by design**;
anything worth keeping goes in your reply or on the TV.

### What is gone, and why

| retired | instead |
|---|---|
| `--as`, the cookie jar, `checkIdentity` | the session is the identity |
| `join` / `leave` / `kick` / `visitors` | attachment is the harness's; a browser agent *is* in its room |
| `message-agent` / `read` / `inbox` | harness session-to-session messaging; messages arrive pushed, not polled |
| `status` | the cooking line is driven by your session events |
| `story` / `stories` | write a report |
| `skill` (for agents here) | tool descriptions and these docs |
| plugin-served files and git | the hub serves them, by project code, with your services down |

### Server-side logging

`systemview.log(msg)` inside a service, then read it with `mcp__systemview__logs`, the **Logs** tab,
or a `::logs` block in any document.
