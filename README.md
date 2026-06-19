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
1. Connects the service to the SystemView UI
2. Writes `systemview.manifest.json` to the project root — lets the CLI run tests without the SystemView server

```json
{
  "projectCode": "myProject",
  "services": [
    {
      "serviceId": "MyService",
      "system": {
        "connectionData": {
          "serviceUrl": "http://localhost:4100/my/api",
          "modules": { ... },
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

Add `systemview.manifest.json` to `.gitignore` — it regenerates each time the service starts.

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
systemview test myProject                  # run all tests for a project
systemview test myProject Users            # filter by module
systemview test myProject Users.signUp     # filter by method
systemview test myProject --json           # structured JSON output for CI/agents
systemview test myProject --verbose        # show args passed to each call
```

Starts the SystemView server headlessly if needed, runs all tests, exits with `0` (all passed) or `1` (any failure).

---

## Registering Services Without the Plugin

```bash
# Probe a live service and write its connection data to systemview.manifest.json
systemview connect MyService http://localhost:4100/my/api

# Re-probe all services already in the manifest
systemview connect
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
| `systemview [start] [port]` | Start SystemView UI (interactive, default port 3000) |
| `systemview test <projectCode> [namespace]` | Run saved tests |
| `systemview connect <serviceId> <url>` | Register a service, write manifest |
| `systemview connect` | Re-probe all services in existing manifest |
| `systemview probe <Service.Module.method> [args]` | Call a method ad-hoc |
| `systemview open [projectCode] [namespace]` | Open the UI in a browser |
| `systemview shutdown [port]` | Stop a running instance |
| `systemview help` | Print help |

**Flags:** `--json` · `--verbose` · `--manifest <path>`

Full reference: [`docs/cli.md`](docs/cli.md)
