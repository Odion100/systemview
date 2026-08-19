# SystemView CLI Reference

## Installation

```bash
npm install -g systemview
```

---

## Commands

### `systemview start [port]`

Launches the SystemView UI and enters an interactive REPL. Default port: `3000`.

```bash
systemview start
systemview start 4000
```

Once running, the REPL accepts the same commands as the CLI (`test`, `open`, `shutdown`).

---

### `systemview test <projectCode> [namespace]`

Runs saved tests for a project. Starts the SystemView server headlessly if it isn't already running, runs all tests, then exits with code `0` (all passed) or `1` (any failure).

```bash
systemview test buAPI
systemview test buAPI Users.signUp
systemview test buAPI Users --json
```

**`namespace`** filters by `serviceId.moduleName.methodName` — any substring match works:
- `Users` — all tests in the Users module
- `Users.signUp` — only the signUp method
- `Profiles.Users` — all Users tests on the Profiles service

**`--json`** suppresses human-readable output and writes a single JSON object to stdout when complete. Designed for agent and CI use.

**`--verbose`** prints args passed to each method call alongside results. Also prints Before/After phases even when they pass.

**`--manifest <path>`** reads connection data from a specific manifest file instead of the default `./systemview.manifest.json`.

**`--header "Name: Value"`** adds a request header to every call made during the test run. Repeatable. Overrides `manifest.headers` for the same header name.

```bash
systemview test buAPI --header "X-Api-Key: secret"
systemview test buAPI --header "Origin: http://localhost:3300" --header "X-Custom: value"
```

#### `--json` output shape

```json
{
  "projectCode": "buAPI",
  "passed": 10,
  "failed": 1,
  "tests": [
    {
      "title": "Sign Up New User",
      "serviceId": "Profiles",
      "moduleName": "Users",
      "methodName": "signUp",
      "status": "failed",
      "Before": [
        {
          "title": "Delete existing test user",
          "serviceId": "Profiles",
          "moduleName": "Users",
          "methodName": "delete",
          "args": [{ "name": "argument:", "input": { "email": "test@test.com" } }],
          "status": "passed",
          "response": { "deletedCount": 1 }
        }
      ],
      "Main": [
        {
          "title": "Sign up",
          "serviceId": "Profiles",
          "moduleName": "Users",
          "methodName": "signUp",
          "args": [{ "name": "argument:", "input": { "email": "test@test.com", "password": "abc123" } }],
          "status": "failed",
          "response": { "error": "duplicate key" },
          "failedEvaluations": [
            {
              "namespace": "results._id",
              "expected_type": "string",
              "validations": [{ "name": "strEquals", "value": "truthy" }],
              "received": null
            }
          ]
        }
      ],
      "Events": [],
      "After": []
    }
  ]
}
```

Each test is the unit. Before/Main/Events/After phases are listed directly on the test. Actions inside each phase carry their own `serviceId/moduleName/methodName` because they can call any connected service. Only `failedEvaluations` is included — passing evaluations are omitted.

#### Service resolution order

1. `.systemview/` per-service manifest files in cwd (or a combined file via `--manifest <path>`) — no SystemView server needed
2. SystemView API (`http://localhost:3000/systemview/api`) — fallback if no manifest

Test file format, shared actions, and the reference system are documented in
**[agents/tests.md](agents/tests.md)** — the operational guide for reading, authoring, and
running test spec files.

---

### `systemview connect <serviceId> <url>`

Probes a live SystemLynx service, fetches its connection data via `Plugin.getConnection()`, and writes/merges it into `systemview.manifest.json` in the current directory.

```bash
systemview connect ProfilesService http://localhost:4100/bu/api/profiles
```

The service must be running. `serviceId` is used as a label; the actual service ID is read from the service itself.

### `systemview connect`

Re-probes all services from the `.systemview/` per-service manifest files. `systemview manifest clean` prunes any whose service no longer responds (it deletes that service's file).

```bash
systemview connect
systemview connect --manifest ./path/to/systemview.manifest.json
```

---

### `systemview probe <ServiceId.Module.method> [args]`

Calls a single method on a connected service. Reads connection data from `systemview.manifest.json`. The service must be running.

```bash
systemview probe ProfilesService.Users.getUser '{"userId":"123"}'
systemview probe ProfilesService.Users.getUser '{"userId":"123"}' --json
```

Dot notation mirrors how you call the service in code: `ProfilesService.Users.getUser(args)`.

**Fuzzy namespace** — you don't have to type the whole path; probe resolves the same way `test`/`logs`/`list` do (matches against every connected `Service.Module.method`). `probe getUser` resolves if it's unambiguous. If more than one method matches, probe **lists the candidates and exits 1** rather than guessing.

**`projectCode:` prefix** — when the same service is connected under more than one project code (e.g. the same project run as two deployments), scope the resolution to one: `probe buAPI-prod:Users.getUser`. Everything after the colon still resolves fuzzily, within that project only.

**args** — a JSON string. Pass an object for single-arg methods, a JSON array for multi-arg methods (spread positionally), or a plain string for primitives. Omit for methods with no arguments.

```bash
# single object arg
systemview probe TestService.Math.add '{"a":2,"b":3}'
# multiple positional args
systemview probe TestService.String.repeat '["ha", 3]'
```

**`--json`** writes a JSON object to stdout:
```json
{ "serviceId": "ProfilesService", "moduleName": "Users", "methodName": "getUser", "args": [{"userId":"123"}], "result": { ... } }
```

On error:
```json
{ "serviceId": "ProfilesService", "moduleName": "Users", "methodName": "getUser", "args": [...], "error": "message" }
```

**`--header "Name: Value"`** adds a request header to the call. Repeatable. Overrides `manifest.headers` for the same header name.

```bash
systemview probe ProfilesService.Users.get --header "Origin: http://localhost:3300"
```

---

### Stories & the live Window (`story` / `stories` / `show` / `assemble` / `stage` / `highlight` / `view` / `selection`)

The center panel of the UI has three tabs per namespace: **Documentation · Logs · Stories**. A **Story** is a living view surface — files, source, diffs, runnable tests, prose — that an agent (or you) drives. What it shows is **real** (fetched from each service's plugin at render time), never generated.

There are two ways to drive it:

- **`story` / `stories`** — create **saved, named, namespaced** stories. A project holds many; each is filed under a namespace and persists in `.systemview/stories/`, travelling with the repo. **This is the one to use for handoffs.**
- **`show` / `assemble` / `stage` / …** — drive a single **ephemeral** live Window in real time.

**→ Agents:** read [`docs/agents/stories.md`](./agents/stories.md) for when, why, and how — with worked examples.

```bash
# Saved, namespaced Stories — the persistent way
systemview story buAPI "sign-up flow" --ns buAPI/Profiles/Users/signUp \
  --text "## What changed" --diff src/modules/Users.js --file src/modules/Users.js#L40-70 --test Users.signUp
systemview story buAPI "regression: empty email" --ns buAPI/Profiles/Users/signUp \
  --test Users.signUp:2 --note "## Guards an empty email — asserts a 400 throw."
systemview stories buAPI                              # list every saved story (name · namespace · panes)
```

`--ns <path>` files the story (`project` · `project/Service` · `project/Service/Module` · `project/Service/Module/method`; defaults to the project). `--note "<md>"` attaches your markdown to a `test` pane. Re-running the same name+namespace **upserts** it.

`--test` targets any level: `--test *` (whole project) · `--test <Service>` · `--test <Module>` · `--test <Mod.method>` · `--test <Mod.method>:N` (one indexed test).

Every verb resolves its `<target>` the same way `test`/`logs` do (fuzzy, `projectCode:` prefix supported).

#### Editing a saved story in place (pane-ops)

Once a story exists you don't have to re-emit the whole thing to change one pane — surgical verbs edit it by name (`--ns` disambiguates if the name repeats across namespaces). Each is a read-modify-write through the same store and broadcasts live, so an open UI updates instantly.

```bash
systemview story-add    buAPI "sign-up flow" --file src/modules/Users.js#L88-96   # append a pane…
systemview story-add    buAPI "sign-up flow" --text "## Edge cases" --at 0        # …or insert at an index
systemview story-rm     buAPI "sign-up flow" --at 2                                # remove the pane at index 2
systemview story-move   buAPI "sign-up flow" --from 0 --to 3                       # reorder a pane
systemview story-edit   buAPI "sign-up flow" --at 1 --file src/db.js#L10-20        # replace the pane at an index
systemview story-edit   buAPI "sign-up flow" --at 1 --note "## Updated note"       # (test pane) just change its --note
systemview story-layout buAPI "sign-up flow" --layout grid                         # change the layout
systemview story-rename buAPI "sign-up flow" --to "sign-up walkthrough"            # rename (new slug, old file removed)
systemview story-delete buAPI "sign-up flow"                                       # delete the whole story
```

`--at` / `--from` / `--to` are 0-based pane indices (clamped to range; omitted `--at` on `story-add` appends). `story-add` and `story-edit` build the pane from the same flags as `story` (`--file` · `--diff` · `--test` · `--text` · `--source`), one pane per call.

```bash
# Focus one thing
systemview show buAPI --file src/modules/Users.js#L40-70   # a file, exact lines highlighted (prefer this over --source)
systemview show buAPI --file src/modules/Users.js --lines 40-70
systemview show buAPI --diff src/modules/Users.js    # before/after vs git HEAD, side by side
systemview show buAPI --test Users.signUp            # a saved test as a runnable worked example

# Fill the Window with several panes at once (grid by default)
systemview assemble buAPI --text "Here's the sign-up flow" --file src/modules/Users.js#L40-70

# Adjust
systemview stage add buAPI --file src/db.js          # append a pane
systemview stage clear buAPI                         # empty it
systemview highlight buAPI --match "await hash"      # emphasize a region of the last pane
systemview highlight buAPI --lines 12-20

# Save / reopen a Window (persists in the project's .systemview/views/, travels with the repo)
systemview view save buAPI signup-flow
systemview view list buAPI
systemview view open buAPI signup-flow

# Read what the user selected in the Window (the reverse channel)
systemview selection buAPI
```

**Pane kinds:** `markdown` (`--text`), `file` (`--file <path[#L a-b]>` — optional inline line range to highlight), `diff` (`--diff path`), `test` (`--test <target>`, any namespace level). `source` (`--source Mod.method`) is **legacy** — prefer `file` + `#L`. Repeat any flag (in `assemble` or `story`) to add multiple panes; command order is preserved so prose can interleave.

**Layouts** (`--layout`, user-switchable in the UI toolbar): `grid` (default; flex — panes flow into rows with resizable widths/heights, drag to reorder) · `gallery` (one pane at a time, or a big pane + a rail of the rest). `single`/`column` were removed — passing them renders as grid. Panes size to content up to a cap and each is independently scrollable.

**Replies:** in the UI the user can leave a **reply on any pane** (a per-pane review thread; stored as `pane.replies[]` with `author: "user"`/`"agent"`). It's how the user annotates a story in place and you plan back-and-forth per point — see **[`docs/agents/stories.md`](./agents/stories.md)** › _Replies_.

**For agents — when and why:** don't paste code into chat — build a **story**. After a slice of work, `systemview story <project> "<name>" --ns <namespace>` with the `diff`s of what changed, the `source` of the key methods, the runnable `test`s that prove it, and `--text`/`--note` narrating it. File it on the namespace it's about so the user finds it there. Use the ephemeral `show`/`assemble` only for real-time pointing; use `story` for anything worth keeping. `systemview selection <project>` tells you what the user is looking at when you resume. See **[`docs/agents/stories.md`](./agents/stories.md)**; `systemview help` lists every flag.

---

### `systemview comments <projectCode> [path] [--json]`

His **comments on the code** (RFC-034) — notes anchored to a line range in a file, written in the UI
by right-clicking the lines. They are never written into the source file: a comment about code is not
code. They live beside the repo, one sidecar per file, mirroring the tree:

```
.systemview/code-comments/<the file's path>.json
```

This command is the way to read them — a verb rather than a folder path anyone has to remember:

```bash
systemview comments buAPI                             # every file that has comments, and the lines
systemview comments buAPI Basketball/Seasons/index.js # that file's, his and agents' apart
systemview comments buAPI Basketball/Seasons/index.js --json
```

It reads through the project's own plugin, so it works from anywhere that can reach the hub. A file
with no comments prints "no comments" rather than an error, and the last comment on a file takes the
sidecar with it — a file with nothing on it never shows up as commented.

The reply shape is the same one document threads use — `{ text, ts, author }` — so a reply written by
an agent renders in the UI with the agent look, and his with his.

---

### `systemview skill <projectCode> [--print] [--force]`

Writes **that project's** SystemView skill to `.claude/skills/systemview/SKILL.md` in its own repo —
generated, not copied: the project code, its live services and their real modules, the verbs that
matter, and the rules that are not optional. A skill is picked up by an agent's harness on its own,
which is the whole difference from documentation somebody has to be told to read.

```bash
systemview skill buAPI            # write it
systemview skill buAPI --print    # look at it first, write nothing
systemview skill buAPI --force    # overwrite a hand-written one (read it first)
```

Re-run it when the services change; it rewrites its own generated file, and refuses to clobber a
hand-written one without `--force`.

---

### `systemview reply <projectCode> <thread-id> "<markdown>"`

Answers **one thread** in the report on the TV — where he actually replied. Reads the current show,
appends the reply inside that thread, writes it back; his replies are carried, never overwritten.

```bash
systemview tv buAPI                                  # read the show + his answers, and the thread ids
systemview reply buAPI t3 "agreed — building it"     # answer that thread
systemview reply buAPI t3 --file answer.md           # …from a file
systemview reply buAPI t3 "…" --show "Docking"       # answer a thread on an OLDER report
```

An unknown id lists the ids that do exist rather than failing blankly.

---

### `systemview board <projectCode> [--json]`

**His board** — the notes he keeps between sessions: reminders, things to hand an agent later, a
running list of what's wrong with whatever he's looking at. Written in the UI from 📋 in the bot's
name-tag row (cards, newest first, voice or typing, drag to reorder), stored as one markdown file per
project:

```
.systemview/boards/board.md
```

An optional `# title` sits above the cards; each card is stamped with when it landed.

```bash
systemview board buAPI
systemview board buAPI --json
```

Each note prints with a stable **id**. Pass the id to `--at`, not the position — the list reorders
the moment he adds a note, so a position read a minute ago answers a different card.

The board is HIS surface — nothing watches it and nothing writes to it but him. This verb exists so
that "go look at my board" has an answer that doesn't depend on remembering a path.

**A note holds a conversation.** Replies accumulate under the note they answer, each stamped with who
wrote it, and he can reply back under yours in the panel. `--at` takes the note's **id** (or its
position, which is only safe if nothing has been added since you read it).

```bash
systemview board buAPI --reply "did it — the resolver is namespaced now" --at 1787087865140 --as buAPI
```

---

### `systemview open [projectCode] [namespace]`

Opens the SystemView browser UI. Starts the server if needed.

```bash
systemview open
systemview open buAPI
systemview open buAPI Profiles/Users/signUp
```

---

### `systemview shutdown [port]`

Sends a remote shutdown signal to a running SystemView instance.

```bash
systemview shutdown
systemview shutdown 4000
```

---

## Storage: the `.systemview/` folder

SystemView keeps its runtime state in a `.systemview/` folder in the root of your SystemLynx service project. Add `.systemview/` to `.gitignore` — it's local, per-machine, and holds live session cookies.

What lands there: per-service manifest files (below), the `headers`/`session` store, reports and namespace docs, saved views, recorded runs — and **`chats/`**, the project's own chat rooms (see [Where a chat is stored](#where-a-chat-is-stored)).

**Per-service manifest files** — on startup each service's plugin writes **only its own** `.systemview/<serviceId>.manifest.json` (its connection data + spec list). Because no two services ever write the same file, the services in a project can all start at once with no clobbering — this is what a project's manifest is *made of*. Assembled — by the plugin's `getManifest()` (which globs the folder) or by the CLI — they read as one project manifest:

```json
{
  "projectCode": "buAPI",
  "services": [
    {
      "serviceId": "Profiles",
      "system": {
        "connectionData": {
          "serviceUrl": "http://localhost:4100/bu/api/profiles",
          "modules": [ ... ],
          "routing": { ... }
        }
      },
      "specList": {
        "docs": ["Users.md"],
        "tests": ["Users.signUp.json"]
      }
    }
  ]
}
```

**`headers`** — the per-origin header store the CLI attaches to every request it makes to that origin, kept in **`.systemview/session.json`**. You author them (a service's `headers:{}` plugin-config defaults also merge in from its per-service manifest file; captured cookies win). Use it to reach an **auth-gated** project without re-pasting `--header` on every call (e.g. an `Origin` for a dev session, or an auth token). Each value is a literal **or** a `@file` pointer that keeps the secret out of the store:

```json
"headers": {
  "http://localhost:4100": {
    "Internal-Access": "@./.secrets/token",
    "Authorization": "Bearer literal-is-fine-too"
  }
}
```

Author the header once, keyed by the service's URL origin. Precedence: `--header` flag > `headers`.

**Cookies live here too** — there is no separate cookie jar. A `Set-Cookie` from any response is folded into the `Cookie` entry under that origin, and re-sent on the next request **to that same origin**. It does **not** automatically cross to other services — cross-service is explicit via `-g` (below). To make a session survive **across** processes (so a `probe` sign-in leaves a session the next `probe` reuses), opt in with the session policy below. Because captured cookies are written as literal values into `.systemview/session.json`, the `.systemview/` folder is gitignored by default.

**`session` — cross-process persistence policy.** By default a captured cookie dies when the CLI process exits. Set `session.save` and a `probe` that captures a `Set-Cookie` (e.g. a sign-in) writes it back into the manifest for the next `probe` to reuse — no interactive session, no `--header`, no `save` dance:

```json
"session": { "save": true }
```

Turn it on once with `connect … --save-session` (saving is implied — it creates a manifest if none exists, else amends the existing one):

```bash
systemview connect https://127.0.0.1:4100/bu/api/profiles --manifest --save-session
systemview probe Profiles.Users.signIn '{"email":"you@x.com","password":"…"}'   # captures + persists connect.sid
systemview probe Profiles.Users.isRecognized                                     # separate process — reuses the session
```

Without the policy, `probe` never writes to the manifest (the safe default). `save` still persists everything on demand as before.

**`-g` / `--global` — project-wide session.** A saved session is single-origin by default (it rides only to the service it was captured on). Add `-g` to a `--save-session` sign-in to make it **project-wide**: the sign-in records that project's service origins into the session, and the cookie then rides to all of them — deterministically, scoped to the project:

```bash
systemview probe buAPI:Profiles.Users.signIn '{…}' --save-session -g   # records buAPI's origins + the cookie
systemview probe buAPI:Media.Assets.list                                # different service, SAME project — the session rides
```

```json
"session": { "save": true, "origins": ["https://…:4000", "https://…:4100"], "cookie": "connect.sid=…" }
```

A session **never** auto-crosses services otherwise. (An earlier build borrowed the first cookie in the store across origins — which could hand a request the wrong session, e.g. a `localhost` test cookie into a remote call; that borrow is gone.) `-g` scopes strictly to the recorded project origins, so a cookie can't leak into an unrelated deployment.

The `.systemview/` folder is gitignored by default — it's local, per-machine, changes each time a service starts, and holds live session cookies.

When multiple services in the same project start (e.g., buAPI's services), each plugin writes its **own** `.systemview/<serviceId>.manifest.json` — no shared file and no read-modify-write, so nothing clobbers even when they all start at once. The `headers`/`session` cookie store described above is the CLI's own `systemview.manifest.json` (a single-writer file), kept separate from those per-service registration files.

---

## Chat, the TV, and driving the window

The UI has a chat panel per project. An agent working in that project is reachable through it, and
can drive the human's open window. Full playbook for agents: `agents/chat.md`.

### Talking

```bash
systemview join <projectCode>            # THE SESSION: holds the line, re-arms itself, reconnects
                                         # with backoff, and exits NON-ZERO when the hub is gone
systemview join <projectCode> --once     # exit after one message
systemview join <other> --once --as <yourProjectCode>   # visit another project's room
systemview say <projectCode> --file <path.md>          # a message too long to quote in a shell
<any nav/act/refresh> --say "…" --pin                  # keep that sentence in the chat, not just the trip
systemview inbox <projectCode> --history               # file mode: ask for the back-catalog on purpose
                                                       # (without it, a NEW cursor starts at now)
systemview say <projectCode> "text"      # reply into the chat        (--as for a room you visit)
systemview status <projectCode> "text"   # the cooking line; empty string clears it
systemview inbox <projectCode>           # file mode: drain pending messages as JSON + ack them
```

Identity is the **project code** — an agent speaks as its project, not as a personal handle. You
must be **in** a room to speak in it: a `say`/`status` into a room you never joined is refused, as
is an `--as` that isn't a connected project. A `join` or an `inbox` drain counts as entering, and
it holds for 15 minutes.

Bubbles render light markdown — bold/italic/strike, inline code, lists, quotes, fenced blocks and
tables. Underscores are never italic, so identifiers stay literal.

### The TV — the interactive surface beside the chat

```bash
systemview show <projectCode> --text "## Look\n::chart{report=throughput}"
systemview show <projectCode> --file scratch/demo.md
systemview show <projectCode> --clear
systemview tv <projectCode> [--json]     # read the TV back, including what the human clicked
```

The human's clicks on the TV are silent — approvals, question answers and typed replies are saved
to the room's TV state rather than echoed into the chat. `systemview tv` is how an agent reads
them.

### Driving the window

```bash
systemview nav <pc> <namespace>                    # navigate: route + center + scratchpad follow
systemview nav <pc> center --report <name[#L1-20]>|--file <p#L1-20>|--tab <t>|--topic <h>
#   #L on a REPORT points at those source lines in the RENDERED document (works while reading)
systemview nav <pc> stats [tab] [--range 1h] [--service <id>]
systemview nav <pc> ... --say "…"                  # what the bot says while it walks there (any command)
systemview highlight <pc> <namespace>|--file <p>   # point at it; nothing else moves
systemview refresh <pc> docs|reports|nav|stats|all # panes re-read in place — never a page reload
systemview act <pc> test <namespace|title|all>     # run a saved test where the human is looking
systemview act <pc> run "<block title>"            # press a :::run block's play in the open doc
systemview stats <pc> [--range 1h|24h|7d] [--service <id>] [--json]
```

Namespaces are validated against the **live** tree before anything moves — a file existing in the
repo does not mean its module is mounted.

### Where a chat is stored

**In the project's own repo**, beside its reports and manifests:

```
<project root>/.systemview/chats/<projectCode>.<chat>.jsonl     # the room, plain JSONL
<project root>/.systemview/chats/<projectCode>.<chat>.ack.json  # per-listener drain cursors
```

The project's own service owns that file, through the plugin's `SystemViewChat` module — the hub
never writes there. It keeps connections, presence, delivery and the long-poll, plus an in-memory
mirror so the panel stays instant. A project whose services predate the module keeps its room in
the hub until they restart; the hub then hands over everything it buffered, deduplicated by record
id, so nothing is lost or doubled in the gap.

Because the room is a normal file in your own repo, an agent can grep it, quote it and **compact**
it — rewrite the file as a summary plus a recent tail. The hub notices a room that got shorter and
re-reads it on its next sweep.

---

## Agent workflow

```bash
# Register a service (one-time or after URL change)
systemview connect ProfilesService http://localhost:4100/bu/api/profiles

# Run all tests, get structured output
systemview test buAPI --json | jq '.tests[] | select(.status == "failed")'

# Call a method ad-hoc
systemview probe ProfilesService.Users.signIn '{"email":"test@test.com","password":"abc123"}' --json
```

Exit codes: `0` = all passed, `1` = any failure or error.
