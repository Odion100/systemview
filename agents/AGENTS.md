# SystemView — the agent guide (start here)

You are working in a codebase with **SystemView** installed. SystemView is a documentation, testing
and review surface that runs beside the code: a UI on `localhost:3000`, a CLI, and a plugin the
project's services load.

**Start here.** This file is the map: enough of every surface to work, and a pointer to the depth
when you need it. Nothing is summarised away — the detail lives beside it in this same folder:

| File | When you need it |
| --- | --- |
| [hosted-services.md](hosted-services.md) | **the repo has NO SystemLynx services** — `systemview init` makes the CLI host a real testing service from a committed folder; start-to-green instructions for agents |
| [chat.md](chat.md) | **being in the conversation** — the panel attaches to your live session and your reply IS the message; `message-agent` reaches another agent, `join`/`leave`/`kick` manage who hears a room (RFC-051) |
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
- **Probe before asserting.** Call the method and read the real response before writing an expected
  value.
- **Prefer a report over a story** for write-ups, and a `:::approval` over prose when you need a
  decision.
- **Reference, don't repeat.** `tv(…)` a value rather than restating a literal in two places.
- **Say what's unproven.** A block you couldn't run, a claim you couldn't verify — mark it.
- **The codebase surface is HUB-served** — files, git, staging, diffs, images, by project code,
  working with your services down. ☠ [RETIRED-2026-08-26] "no branch name / `Plugin.stageFiles is not a
  function` → restart your service" — plugin-serves-git is retired and a stale plugin can no longer
  cause those symptoms. A plugin version still matters for what the plugin actually DOES: your
  documentation, tests, and your room's chat module — restart your service after upgrading for
  those. (An `init`-hosted project has no process of its own; the hub refresh covers it.)

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
systemview shutdown

# The chat — being present in the UI (chat.md has the full playbook)
# THE HUMAN: you are ATTACHED — he talks to you IN this conversation and your reply IS the message
# (markdown and blocks render there). No command speaks to him; none is needed to hear him.
systemview status <project> "…"  # the cooking line, for a room you VISIT (the attached panel reads yours)
systemview thread <project> <report name|path> <thread-id> [--json]
                                 # READ one thread WITH ITS WRAPPER — the section it lives under,
                                 # the checklist rows around it, and every reply with who wrote it.
                                 # Answering a comment no longer means re-reading the report.
systemview reply <project> <report name|path> <thread-id> "…" 
                                 # ANSWER WHERE HE ASKED (RFC-039): he replies inside a report's
                                 # threads — answer in the thread, not in the chat. `systemview tv
                                 # <project>` shows the thread ids and his answers.
<any nav/act/refresh command> --say "…" --pin              # …and keep that sentence in the chat
# Agents talk (RFC-051): you ARE your project. A message reaches ANOTHER agent; a room's list
# decides who the hub delivers a conversation to. `join` is deliberate; speaking never joins.
systemview message-agent <otherProject> "…" --as <yourPc>   # a message to ANOTHER agent's room.
#   --as is REQUIRED and cannot be you — there is no sending to yourself. Does NOT subscribe you:
#   it opens a 15-min REPLY WINDOW so their answer reaches you, then closes. The receipt names the
#   audience: `delivered → X · in the room: a, b`. --file <p.md> for long messages.
systemview join <otherProject> --as <yourPc>      # ENTER the conversation — instant; the hub delivers
#   that room to yours until you leave
systemview leave <otherProject> --as <yourPc>     # out; delivery stops, the record stays
systemview kick <yourPc> <who>                    # YOUR room's list is yours to run — nobody
#   clears a third room's table; removing yourself is leave
systemview visitors <project>                   # who is on a room's list
systemview read <otherProject> [--limit n]      # read a room you're in  (--since <mark> = new only)
# What arrives:  [in <room>] …  = that project's agent    [in <room> · human] …  = ODION, in person.
# Visit with a reason, initiative welcome ("go talk to X" is a trigger, not a permission gate);
# answer in THEIR room, not yours; the conversation stays where it started; leave when the errand
# is over; being removed is him clearing his space, not a verdict on you.
# EXAMPLES DON'T TRAVEL: ::file/::diff/::image resolve against the ROOM'S root, so a block from your
# repo renders EMPTY in theirs — indistinguishable from a broken renderer. Use their paths, or pin
# yours: ::file[cli/chat.js#L290-300]{project=<yourPc>}. Verify the path before you send it.
# An --as that is not a connected project code is refused at the front door.
systemview inbox <project>       # the hook's drain: pending messages as JSON + ack
                                 # a cursor's FIRST drain starts at now — `--history` for the back-catalog
# YOUR ROOM IS A FILE IN YOUR OWN REPO: <your root>/.systemview/chats/<pc>.<chat>.jsonl — served
# by your own service (the SystemViewChat plugin module), so you can grep and compact it yourself.

# Agent control (RFC-029) — drive the open window; every command = a "→ …" receipt in the chat
systemview nav <project> <ns> | center --report <path> | --file <p#La-b> | --tab <t> | --topic <h>
systemview highlight <project> <ns> | --file <p>   # point the tree; nothing else moves
systemview refresh <project> docs|reports|nav|all  # panes re-read in place, never a page reload
systemview act <project> test <ns|title|all>       # run a saved test where the human is looking
systemview act <project> run "<block title>"       # press a :::run block's play in the open doc

# THE TV — the interactive surface beside the chat. Proposals, demos, status boards, walkthroughs
# go HERE, not into a report (his standing rule: a report is for when he asks for one).
systemview show <project> --text "## Look\n::chart{report=throughput}"   # put a show on the TV
systemview show <project> --file scratch/demo.md   # …or a file's content    --clear  # blank it
systemview tv <project> [--json]                   # READ it back — his clicks are SILENT, so this
                                                   # is where his answers, verdicts and typed
                                                   # replies live. Read it whenever he says he
                                                   # responded; nothing tells you otherwise.

# His comments ON THE CODE (RFC-034) — notes he writes on a line range in a file. They live beside
# the repo, never in the file: .systemview/code-comments/<the file's path>.json. Read them AND
# answer them ON THE LINE — the listing prints the exact reply command per unanswered note:
systemview comments <project>                 # every file that has comments, and the lines
systemview comments <project> <path>          # one file's comments, his and agents' apart
systemview comments <project> <path> --json   # the same, structured
systemview comments <project> <path> --at <n> --reply "…" --as <yourPc>
#   --as is REQUIRED (any agent can answer any comment; the CLI cannot tell who is running it,
#   so it never guesses — no --as, no write; a name that isn't a project code is refused)

# An unknown verb ERRORS now (it used to print the boot banner and look like it worked) — and a verb
# that exists here may not exist in another project's install: check `systemview --version`.
# A cursor that has never drained starts at what's still WARM (the last 15 min), not at zero and not
# at silence — so first contact catches "I said it right before you joined" without replaying a room.

# A REPORT IS A DOCUMENT (RFC-040): `show` writes .systemview/report.<project>.<slug>.md and the
# chat record only points at it. Re-pushing the same title SAVES over it; his answers live in the
# file. Read one with `systemview tv <project>`, answer with `reply`, inspect one thread with
# `thread`.

# HIS BOARD — the notes he leaves for you between sessions: reminders, things to hand you later, a
# running list of what's wrong with something he was looking at. His surface, read when he points at
# it. `.systemview/boards/board.md`, one per project, optional title at the top.
systemview board <project> [--json]           # each note prints with a stable `id`
systemview board <project> --add "…" --as <you>   # leave HIM a note (agents write here too)
# A note holds a CONVERSATION (RFC-039): replies accumulate, each stamped with who wrote it, and he
# can reply back under yours. PASS THE ID, not the position — the list reorders the moment he adds a
# note, and a position read a minute ago answers the wrong card.
systemview board <project> --reply "…" --at <id> --as <yourProject>

# YOUR OWN SKILL, generated for a project — its code, its live namespaces, these rules — written to
# .claude/skills/systemview/SKILL.md in that project's repo. Re-run it when the services change.
systemview skill <project> [--print] [--force]

# Stats — the /reports page, and the same numbers from the terminal
systemview stats <project> [--range 1h|24h|7d] [--service <id>] [--json]
systemview nav <project> stats [tab] [--range …] [--service …]   # walk him to a stats view
```

Server-side logging: `systemview.log(msg)` inside a service, then read `systemview.logs` — or the
**Logs** tab, or a `::logs` block in any document.
