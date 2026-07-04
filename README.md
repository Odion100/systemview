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

- **Before** — setup calls that run before the main test
- **Main** — the method call being tested, with argument inputs and response validations
- **Events** — WebSocket events to listen for during the test
- **After** — teardown calls that run after the main test

Click **Run** to execute the sequence. Click **Save** to persist the test to the service's `specs/` folder.

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

## CLI Reference

| Command | Description |
|---|---|
| `systemview [start] [port]` | Start SystemView UI; attach if already running |
| `systemview test <projectCode> [namespace]` | Run saved tests |
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
