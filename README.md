# SystemView

A documentation and testing suite for [SystemLynx](https://github.com/Odion100/SystemLynx) services. SystemView gives you a browser-based UI to browse your service's modules and methods, read and write markdown documentation, build and run tests interactively, and execute saved test suites from the CLI.

---

## Installation

```bash
npm install -g systemview
```

> Requires Node >= 18

---

## Starting SystemView

```bash
systemview              # start on port 3000 (interactive)
systemview start 4000   # custom port
```

If SystemView is already running, `systemview start` attaches your terminal to the existing instance — no second server is started. You can run as many interactive terminals as you like against the same instance.

Once running:
- **UI** → `http://localhost:3000`
- **API** → `http://localhost:3000/systemview/api`

```bash
systemview open                                  # open browser to home
systemview open myProject                        # open to project
systemview open myProject Basketball/Games/add   # open to a specific method
systemview shutdown                              # stop the running instance
```

---

## Connecting a SystemLynx Service

Install the plugin in your service project:

```bash
npm install systemview-plugin
```

Add it to your SystemLynx app:

```js
const { App } = require("systemlynx");

App.startService({ route, port })
  .module("Users", Users)
  .module("Orders", Orders);

if (process.env.SYSTEMVIEW_HOST) {
  const SystemViewPlugin = require("systemview-plugin")({
    connection: process.env.SYSTEMVIEW_HOST,  // e.g. "http://localhost:3000/systemview/api"
    specs: "./specs",                          // local path for saving docs and tests
    projectCode: "myProject",                 // groups services together in the UI
    serviceId: "MyService",                   // name for this service
  });
  App.use(SystemViewPlugin);
}
```

On startup the plugin:
1. Registers the service with the SystemView UI (source of truth for all connections)
2. Writes `systemview.manifest.json` to the project root — used by the CLI to reconnect at startup

Add `systemview.manifest.json` to `.gitignore` — it regenerates each time the service starts.

---

## Connecting Services from the CLI

```bash
# Probe a live service and register it in the UI
systemview connect http://localhost:4100/my/api

# With plugin installed — registers under the real projectCode from the manifest
systemview connect http://localhost:4100/my/api --manifest

# Reconnect all services for a stored project
systemview connect myProject

# Re-probe even if already connected (picks up shape changes)
systemview connect http://localhost:4100/my/api --force
```

```bash
# Remove a project or service from the UI store
systemview disconnect myProject
systemview disconnect myProject MyService
```

---

## Using the UI

| Panel | Description |
|---|---|
| **Navigator** (left) | Browse connected projects, services, modules, and methods |
| **Documentation** (center) | Read and write markdown docs for the selected method |
| **Test Panel** (right) | Build, run, and save tests for the selected method |

URL pattern: `http://localhost:3000/:projectCode/:serviceId/:moduleName/:methodName`

### Building a test

A test is an **ordered list of named sections**. `Before / Main / Events / After` are the default
sections — a saved **action** you insert becomes its own section, a peer of the built-ins.

- **Before / After** — setup and teardown calls around the main test
- **Main** — the method being tested. Holds **multiple steps** if you want, each free to point at any
  `service.module.method` — as long as at least one step matches the namespace the test saves under
- **Events** — listen for a `service.module.on()` event on **any** connected service
- **Actions** — reusable **shared** sections. Build and save them in the Scratch Pad's **Actions** tab,
  then insert one into a test with **+ actions** (before or after Main) — an action saved on ANY of the
  project's services is usable in ANY test in the project. The same action can be inserted more
  than once (`seedSum`, `seedSum_2`, …). Tests store a `{ "use": "<name>" }` **reference** — edit the
  action once and every test that uses it follows

**References** — any argument (and any evaluation's expected value) can reference an earlier step's
output with `tv(...)`:

```
tv(test.before[0].results.sum)       # step 0 of Before
tv(test.seedSum[1].results.product)  # step 1 of the seedSum action section
tv(test.main[0].error.message)       # a thrown error's field
```

So an **evaluation can assert one step's output against another's** — set the validation's value to a
`tv(...)` reference and it resolves at run time.

This is also **how shared actions compose**: stack action sections in a test and wire them with
references — one action signs up the users, the next section reaches into its results
(`tv(test.seasonHost[0].results.userId)`). Each action stays self-contained on its own (internal refs
+ `random()` data); references at the seams make the units work together.

**`random(n)`** — insert `random(6)` anywhere inside a string argument to get fresh random characters
on every run (`"user_random(6)@test.com"`) — unique emails/usernames for reusable actions.

**Title & namespace** — the row above the builder holds the test's own **name** (defaults to Main's
title if left blank) and the **namespace chip**: the `service.module.method` the test saves under.
Click the chip to retarget it with the method picker — including from a module- or service-level page.
Saving refuses a namespace that isn't a real connected method, and edits/deletes always hit the right
saved slot even in the aggregated module/service views.

Click **Run** to execute the sequence. Click **Save** to persist the test to the service's
`specs/tests/<Module>.<method>.json`; actions live in `specs/actions/<name>.json`.

Agents: the exact spec-file JSON (steps, `targetValues`, evaluations, actions, `{use}`/`run`) is in
[docs/agents/tests.md](docs/agents/tests.md) — the testing counterpart to
[docs/agents/stories.md](docs/agents/stories.md).

---

## Running Tests from the CLI

```bash
systemview test myProject                          # run all tests for a project
systemview test myProject Users                    # filter by module
systemview test myProject Users.signUp             # filter by method
systemview test myProject --json                   # structured JSON output for CI/agents
systemview test myProject --verbose                # show args passed to each call
systemview test myProject --bail                   # stop after first failure
systemview test myProject --dry-run                # print which tests would run
systemview test myProject --skip deleteUser        # exclude matching tests (repeatable)
systemview test myProject --phase main             # run only one phase (before/main/events/after)
systemview test myProject --index 0                # run only action at index n within each phase
systemview test myProject --header "X-Key: secret" # extra request header (repeatable)
```

Starts the SystemView server headlessly if needed, runs all tests, exits with `0` (all passed) or `1` (any failure).

---

## Streaming Logs

```bash
systemview logs                                    # stream from all connected services
systemview logs myProject                          # stream from a project
systemview logs myProject Users                    # filter by module/method namespace
systemview logs myProject --level error            # filter by level
systemview logs myProject --current                # show existing entries before streaming
systemview logs myProject --current --limit 20     # limit history shown
systemview logs myProject --filter level=error     # AND filter on any field (repeatable)
systemview logs myProject --or moduleMethod=signIn # OR filter (repeatable)
systemview logs myProject --include userId         # show extra field as column (repeatable)
systemview logs myProject --verbose                # show full entry payload
```

In interactive mode:

```
logs myProject          # start streaming
stoplogs                # stop streaming (keeps log history)
unsubscribe             # alias for stoplogs
clearlogs               # wipe log history and stop streaming
```

---

## Listing Projects and Tests

```bash
systemview list                    # list all connected projects and services
systemview list myProject          # list services and test files for a project
systemview list myProject Users    # list tests for a module/method
systemview list myProject --verbose # expand full hierarchy
```

---

## Calling Methods Ad-Hoc

```bash
# Human-readable
systemview probe MyService.Users.getUser '{"userId":"123"}'

# JSON output (agent/CI use)
systemview probe MyService.Users.getUser '{"userId":"123"}' --json

# Multiple positional args (JSON array)
systemview probe MyService.String.repeat '["ha", 3]'
```

---

## Stories

A **Story** is a saved, named, namespaced view of a piece of work — an ordered set of panes
(markdown notes, a method's source, runnable saved tests, git diffs, whole files) that answers *"what
changed, and how do I know it works?"* Stories are filed under a namespace (project / service / module /
method) and a namespace can hold many of them, like a method holds many tests. They persist in
`.systemview/stories/` and travel with the repo.

Open them in the UI under **Specs → navigate to a namespace → the Stories tab**: pick a story's chip to
view it, **Run** its tests inline, and **filter** pass/fail.

Stories are especially useful for **AI agents** handing off work (here's the diff, here's the source,
here's the runnable proof, narrated). Drive them from the CLI:

```bash
systemview story <projectCode> "<name>" --ns <namespace> --diff <path> --file <path>#L40-70 --test <target> --text "notes"
systemview stories <projectCode>          # list every saved story
```

**→ Agents: read [`docs/agents/stories.md`](docs/agents/stories.md)** for when, why, and how
(with worked examples).

---

## CLI Reference

| Command | Description |
|---|---|
| `systemview [start] [port]` | Start SystemView UI; attach if already running |
| `systemview test <projectCode> [namespace]` | Run saved tests |
| `systemview story <projectCode> "<name>" [--ns …] [panes…]` | Create/update a namespaced Story ([agent guide](docs/agents/stories.md)) |
| `systemview stories <projectCode>` | List saved Stories |
| `systemview list [projectCode] [namespace]` | List projects, services, or tests |
| `systemview logs [projectCode] [namespace]` | Stream log entries from connected services |
| `systemview connect <url\|projectCode>` | Connect a service or reconnect a project |
| `systemview connect <url> --manifest` | Connect via plugin manifest (real projectCode) |
| `systemview disconnect [projectCode] [serviceId]` | Remove from UI store |
| `systemview probe <Service.Module.method> [args]` | Call a method ad-hoc |
| `systemview open [projectCode] [namespace]` | Open the UI in a browser |
| `systemview shutdown [port]` | Stop a running instance |
| `systemview help` | Print help |

**Common flags:** `--json` · `--verbose` · `--bail` · `--dry-run` · `--manifest` · `--force` · `--header "Name: Value"` · `--skip <pattern>` · `--phase <phase>` · `--index <n>` · `--level <level>` · `--current` · `--limit <n>` · `--filter <field=value>` · `--or <field=value>` · `--include <field>`
