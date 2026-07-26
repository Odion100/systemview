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
