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

**`--header "Name: Value"`** adds a request header to the call. Repeatable. Overrides `manifest.headers` for the same header name.

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

**`headers`** — the single, per-origin header store the CLI attaches to every request it makes to that origin. **SystemView never sets headers itself** — the plugin writes none; you author them. Use it to reach an **auth-gated** project without re-pasting `--header` on every call (e.g. an `Origin` for a dev session, or an auth token). Each value is a literal **or** a `@file` pointer that keeps the secret out of the manifest:

```json
"headers": {
  "http://localhost:4100": {
    "Internal-Access": "@./.secrets/token",
    "Authorization": "Bearer literal-is-fine-too"
  }
}
```

Author the header once, keyed by the service's URL origin. Precedence: `--header` flag > `headers`.

**Cookies live here too** — there is no separate cookie jar. A `Set-Cookie` from any response is folded into the `Cookie` entry under that origin. Within one CLI process the captured cookie is re-sent on the next request automatically. To make it survive **across** processes (so a `probe` sign-in leaves a session the next `probe` reuses), opt in with the session policy below. Because captured cookies are written as literal values, keep the manifest gitignored (it already is by default).

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

Add the manifest to `.gitignore` — it's a local artifact that changes each time a service starts, and now also holds live session cookies.

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
