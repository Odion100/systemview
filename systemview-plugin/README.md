# systemview-plugin

Connects a [SystemLynx](https://github.com/Odion100/SystemLynx) service to [SystemView](https://github.com/Odion100/systemview) — the documentation and testing suite for SystemLynx.

---

## Installation

```bash
npm install systemview-plugin
```

---

## Setup

```js
const { App } = require("systemlynx");

App.startService({ route, port })
  .module("Users", Users)
  .module("Orders", Orders);

if (process.env.SYSTEMVIEW_HOST) {
  const SystemViewPlugin = require("systemview-plugin")({
    connection: process.env.SYSTEMVIEW_HOST,  // SystemView API URL
    specs: "./specs",                          // local path for docs and test files
    projectCode: "myProject",                 // groups services together in SystemView
    serviceId: "MyService",                   // name for this service
  });
  App.use(SystemViewPlugin);
}
```

Set `SYSTEMVIEW_HOST` to your SystemView instance, e.g.:

```bash
SYSTEMVIEW_HOST=http://localhost:3000/systemview/api node index.js
```

---

## Config options

| Option | Default | Description |
|---|---|---|
| `connection` | `http://localhost:3300/systemview/api` | SystemView API URL to register with |
| `specs` | `./specs` | Local path for docs and test files |
| `projectCode` | — | Groups services together in the UI |
| `serviceId` | — | Name for this service |
| `logs` | `./systemview.logs` | Base name for the per-service NDJSON log file — written as `systemview.<serviceId>.logs` so sibling services sharing a cwd don't collide on one shared file |
| `limit` | `100` | Default number of entries `getLog` returns |
| `trace` | `true` | Auto-tracing — see below |
| `redact` | `[]` | Paths to mask in logged `arguments`/`returnValue` — see below |
| `exclude` | `[]` | Module or `Module.method` names to skip entirely |
| `useSystemViewLogs` | `true` | Register the local log module + auto-instrumentation |
| `useSystemViewUI` | `true` | Register with the SystemView UI server |

### `trace`

Controls auto-instrumentation. Every RPC call emits a `start` trace and one terminal trace — `end` on success, `error` on failure — all sharing a single `traceId`.

- `trace: true` (default) — trace every call.
- `trace: false` — disable auto-tracing entirely.
- `trace: (req) => ({ ...ctx })` — a function returning **request-scoped context**. It runs **fresh at each entry**, and its result is merged into *every* record sharing that request's `traceId` — the `start`/`end`/`error` auto-traces **and** any manual `this.log()`/`warn()`/`error()`/`debug()` fired during the request. Use it to stamp e.g. a user id onto everything a request logged, so you can filter the whole request by who caused it. (Out-of-request logs carry no `req`, so they get nothing.)

```js
trace: (req) => ({ user_id: req.session?.user_id })
```

### `redact`

Masks sensitive values in the captured `arguments`/`returnValue` before they're written. Paths are relative to the argument **array** — `["[0].password"]` masks `password` on the first argument. Masked values become `"[REDACTED]"`.

```js
redact: ["[0].password", "[0].card.number"]
```

### `exclude`

Skip logging/tracing for whole modules or specific methods:

```js
exclude: ["HealthCheck", "Users.ping"]
```

---

## What it does on startup

1. **Registers with SystemView** — sends connection data to the SystemView server so the service appears in the UI under `projectCode > serviceId`
2. **Writes `systemview.manifest.json`** — saves connection data and spec file locations to the project root so the SystemView CLI can run tests without the SystemView server running

If multiple services in the same project use the plugin, each one merges its own entry into the manifest rather than overwriting it.

---

## `systemview.manifest.json`

Written automatically to the root of your service project on each startup:

```json
{
  "projectCode": "myProject",
  "services": [
    {
      "serviceId": "MyService",
      "system": {
        "connectionData": {
          "serviceUrl": "http://localhost:4100/my/api",
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

Add it to `.gitignore` — it's a local artifact that regenerates on each startup.

With the manifest in place, the CLI can run tests directly against your live service without needing the SystemView server:

```bash
systemview test myProject
```

---

## Specs folder

The plugin reads and writes documentation and test files from the `specs` path you configure:

```
specs/
  docs/         # markdown files, one per method
  tests/        # JSON test files, one per method
```

These files are committed to your repo. The SystemView UI saves to them via the plugin's `saveDoc` and `saveTest` methods.
