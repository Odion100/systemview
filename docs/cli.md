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

**`--header "Name: Value"`** adds a request header to every call made during the test run. Repeatable. Overrides `manifest.probeHeaders` for the same header name.

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

1. `systemview.manifest.json` in cwd (or `--manifest` path) — no SystemView server needed
2. SystemView API (`http://localhost:3000/systemview/api`) — fallback if no manifest

---

### `systemview connect <serviceId> <url>`

Probes a live SystemLynx service, fetches its connection data via `Plugin.getConnection()`, and writes/merges it into `systemview.manifest.json` in the current directory.

```bash
systemview connect ProfilesService http://localhost:4100/bu/api/profiles
```

The service must be running. `serviceId` is used as a label; the actual service ID is read from the service itself.

### `systemview connect`

Re-probes all services already listed in `systemview.manifest.json` and refreshes their connection data.

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

**`--header "Name: Value"`** adds a request header to the call. Repeatable. Overrides `manifest.probeHeaders` for the same header name.

```bash
systemview probe ProfilesService.Users.get --header "Origin: http://localhost:3300"
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

## `systemview.manifest.json`

A per-project connection file written by the SystemView plugin on service startup, or by `systemview connect`. Lives in the root of your SystemLynx service project.

```json
{
  "projectCode": "buAPI",
  "probeHeaders": { "Origin": "http://localhost:3300" },
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

**`probeHeaders`** — written automatically by the plugin on startup. Contains the `Origin` header derived from the SystemView connection URL. The CLI merges these headers into every request made by `probe` and `test`, so authenticated services that check the `Origin` header work without any manual configuration. `--header` flags override individual entries.

Add to `.gitignore` — it's a local artifact that changes each time a service starts.

When multiple services in the same project start (e.g., buAPI's 4 services), each plugin run merges its own entry into the manifest rather than overwriting.

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
