# RFC: CLI Full Revamp — One-Shot Commands, Clean Logging, Agent Output, Manifest-Based Connections

## Context

SystemView's CLI has accumulated three compounding problems:

1. **Library bloat** — 5+ external packages (`meow`, `cli-alerts`, `cli-welcome`, `cli-meow-help`, `cli-handle-error`, `cli-handle-unhandled`) for functionality that should be a thin chalk wrapper and simple argv parsing. These constrain the output format.

2. **Interactive mode bleed** — One-shot commands (`test`, `open`, `shutdown`) drop into an interactive readline session if they had to launch the server. An agent or CI pipeline calling `systemview test` has no reliable way to get it to exit.

3. **Server dependency for tests** — `runTests.js` calls the SystemView HTTP API just to read `connections.json` (`SystemView.getServices(project_code)`). This means tests can't run without the SystemView server running, even though the server is only a middleman for data that could live locally.

**The fix has three parts:** replace the library layer with a custom chalk logger, harden the one-shot/interactive separation, and introduce `systemview.manifest.json` — a per-project connection file written by the plugin, read directly by the CLI.

The SystemView browser UI and server remain unchanged — they serve humans browsing documentation and running ad-hoc tests. The CLI becomes standalone for agents and CI.

---

## Part 1: Strip External CLI Libraries

### What goes out
Remove from `package.json` (and all imports):
- `meow` — CLI arg parsing
- `cli-alerts` — formatted log output
- `cli-welcome` — startup banner
- `cli-meow-help` — help text formatter
- `cli-handle-error` — error handler
- `cli-handle-unhandled` — unhandled rejection handler

### What replaces them

**`cli/logger.js`** (new file) — chalk-based output:
```js
const chalk = require("chalk");

const log = {
  info:    (msg) => console.log(chalk.blue("  ℹ  ") + msg),
  success: (msg) => console.log(chalk.green("  ✔  ") + msg),
  warn:    (msg) => console.log(chalk.yellow("  ⚠  ") + msg),
  error:   (msg) => console.error(chalk.red("  ✖  ") + msg),
  plain:   (msg) => console.log(msg),
};

module.exports = log;
```

**`cli/index.js`** — replace `meow` with simple `process.argv` slice:
```js
const input = process.argv.slice(2); // ["test", "myProject"] etc.
```

Replace the `cli-welcome` startup banner with a simple `chalk` one-liner in `startApp()`.

Replace `cli-handle-unhandled` with `process.on("uncaughtException", ...)` and `process.on("unhandledRejection", ...)` directly.

**Files:** `cli/logger.js` (new), `cli/index.js`, `cli/utils/log.js` (replace with re-export of logger or delete)

---

## Part 2: `--json` Flag for Agent / Machine Output

Add a global `--json` flag. When set, all human-readable output is suppressed and a single JSON object is written to stdout at the end. The output mirrors the actual test file structure (`Before`/`Main`/`Events`/`After` phases), enriched with runtime results. Only failed evaluations are included — no noise from passing ones.

```bash
systemview test buAPI --json
```

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

Structure rationale: the test is the unit. Each test identifies itself with `serviceId/moduleName/methodName` (its own namespace), then lists its `Before/Main/Events/After` phases directly. Actions within phases each carry their own namespace — they can call any service, not just the one the test belongs to. Only failed evaluations are included. No artificial grouping by service.

Output behavior: without `--json`, results print as they run (current behavior preserved). With `--json`, all output is suppressed during the run and one complete JSON object is written to stdout at the end — clean for `JSON.parse()`.

Implementation: `cli/index.js` checks `input.includes("--json")`, strips the flag, passes `{ json: true }` to `runTests()`. `runTests()` builds the results object as tests run, then at completion writes `JSON.stringify(results)` to stdout.

**Files:** `cli/index.js`, `cli/runTests.js`

---

## Part 3: One-Shot Command Fix

### `cli/launchApp.js` — add `interactive` option
```js
module.exports = async function launchApp(port, { interactive = false } = {}) {
  if (await appIsRunning(api)) {
    if (interactive) log.info("SystemView is running from another terminal");
    return;
  }
  await launchSystemView(port);
  if (interactive) {
    logConnection();
    return startLineReader(ui);
  }
};
```

### `cli/index.js` — `startTest` and `open`
- `startApp()` passes `{ interactive: true }` — unchanged behavior
- `startTest()` launches headless, awaits `runTests()`, calls `process.exit(exitCode)`
- `open()` exits cleanly after opening the browser regardless of whether it launched the server

### `cli/runTests.js` — return exit code + fix async pattern
Replace the fragile recursive promise pattern with `for...of` + async/await. Return `0` (all passed) or `1` (any failure).

**Files:** `cli/launchApp.js`, `cli/index.js`, `cli/runTests.js`

---

## Part 4: `systemview.manifest.json` — Manifest-Based Connections

### Problem
Today: plugin → fires on App "ready" → sends connectionData to SystemView server → stored in `api/connections.json` → CLI calls `SystemView.getServices()` to read it back.

The server is just a middleman for data that could live in the project directory.

### What the manifest looks like
Written to the root of the SystemLynx server project by the plugin:
```json
{
  "projectCode": "BUApp",
  "services": [
    {
      "serviceId": "ProfilesService",
      "system": {
        "connectionData": {
          "serviceUrl": "http://localhost:4100/bu/api/profiles",
          "modules": { ... },
          "routing": { ... }
        }
      },
      "specList": {
        "docs": ["ProfilesService.md"],
        "tests": ["ProfilesService.getUser.json"]
      }
    }
  ]
}
```

### Plugin changes (`systemview-plugin`)
In the "ready" handler, after calling `SystemView.connect()`, also write the manifest:
```js
const fs = require("fs");
const manifestPath = path.join(process.cwd(), "systemview.manifest.json");
fs.writeFileSync(manifestPath, JSON.stringify(getConnection(), null, 2));
```
The plugin already has `getConnection()` which returns exactly this shape.

The manifest is regenerated each time the service starts (connection data can change between runs). It's a local artifact — `.gitignore` it.

### CLI changes
`cli/runTests.js` gets a new path: if a `--manifest <path>` arg (or a `systemview.manifest.json` in the cwd) is found, read connection data from it directly instead of calling `SystemView.getServices()`.

```js
// Before:
const services = await getConnectedServices(api, project_code);

// After:
const services = await resolveServices(api, project_code);
// resolveServices: check for manifest first, fall back to API
```

**Files:** `cli/runTests.js`, `systemview-plugin/index.js`

---

## Part 5: `systemview connect` Command

The zero-plugin path for registering services. Two forms:

**Single service** — name is required so the manifest and `probe` can reference it:
```bash
systemview connect ProfilesService http://localhost:4100/bu/api/profiles
```

**From the manifest** — reconnect all services already listed in it:
```bash
systemview connect --file ./systemview.manifest.json
# or just: systemview connect  (looks for systemview.manifest.json in cwd automatically)
```

One file serves both purposes. The manifest stores service URLs alongside connection data, so `connect` can read the URLs from an existing manifest, re-probe each service, and write refreshed connection data back. No separate services config file needed.

The CLI hits the SystemLynx service URL (which exposes its connection data at the API root), reads the response, and writes/merges into the local manifest.

```js
async function connectService(name, url) {
  const service = await Client.loadService(url);
  // extract connectionData, write/merge into systemview.manifest.json under `name`
}
```

**Files:** `cli/index.js` (route), `cli/connectService.js` (new)

---

## Part 6: `systemview probe` Command — Ad-Hoc Method Invocation

A new one-shot command that calls any method on a connected service directly. Designed for agent and developer use — call a method, get the result back without writing or running a full test suite.

```bash
# Human-readable:
systemview probe ProfilesService.Users.getUser '{"userId": "123"}'

# Machine-readable:
systemview probe ProfilesService.Users.getUser '{"userId": "123"}' --json
```

Dot notation: `serviceId.Module.method` — mirrors how you'd call it in SystemLynx client code (`ProfilesService.Users.getUser(args)`).

**How it works:**
1. Parse the dotted namespace: `serviceId = "ProfilesService"`, `module = "Users"`, `method = "getUser"`
2. Read `systemview.manifest.json` to find `ProfilesService`'s `connectionData`
3. Load the service via `Client.loadService(connectionData.serviceUrl)`
4. Call `service.Users.getUser(args)`
5. Print result (human-readable or JSON)

The args parameter accepts a JSON string for objects/arrays, or a plain string for primitives.

This makes the CLI a full lightweight RPC client. The three programmatic commands form a complete workflow for agents:
- `connect <name> <url>` — register a service under a name, write manifest
- `probe <serviceId.Module.method> [args]` — call any method ad-hoc
- `test <projectCode>` — run saved test suites

`probe` + `--json` is the key agent tool: deterministic input → structured output → the agent can parse and act on results.

**Files:** `cli/index.js` (route), `cli/probe.js` (new)

---

## Plugin Role Under New Architecture

The plugin is still needed. Only a running SystemLynx server knows its own live `connectionData` (URL, modules, routing) — the CLI can't discover that without either the plugin or a known URL. The plugin's role slightly expands:

- Was: register with SystemView server on startup
- Now: register with SystemView server **and** write `systemview.manifest.json` to the project directory

The plugin still manages spec files (`specs/docs/`, `specs/tests/`). No existing functionality removed — just one new `fs.writeFileSync` call.

---

## Files to Modify

**CLI (systemview repo):**
- `cli/logger.js` — new chalk-based logger (replaces cli-alerts)
- `cli/index.js` — strip meow/cli-welcome, fix one-shot commands, add `--json` + `connect` routing
- `cli/launchApp.js` — add `{ interactive }` option
- `cli/runTests.js` — return exit code, fix async loop, manifest-first resolution, `--json` output
- `cli/connectService.js` — new, handles `systemview connect <name> <url>` and `--file` form
- `cli/probe.js` — new, handles `systemview probe <serviceId.Module.method> [args]`
- `cli/utils/log.js` — replace with re-export from logger.js (or delete)
- `package.json` — remove 5 CLI library deps

**Plugin (systemview-plugin repo):**
- `index.js` — write `systemview.manifest.json` after successful `SystemView.connect()`

**Docs:**
- `docs/cli.md` — new, full CLI reference: all commands, flags, examples, `systemview.services.json` format. Written as part of this RFC execution.

**Test fixture service (`test/service/`):**
- A minimal SystemLynx service with the systemview-plugin installed, a couple of modules and methods, and saved test specs
- Used to run automated integration tests against the CLI itself (distinct from SystemView's role as a testing suite for *other* services)
- Test scripts verify: plugin writes `systemview.manifest.json` on startup, `systemview connect` registers the service, `systemview probe` calls a method and returns correct output, `systemview test` runs saved specs and exits with the right code, `--json` output parses correctly

---

## Verification

1. `systemview start` → server + interactive REPL as before
2. `systemview test myProject` (server not running) → headless launch, tests run, process exits 0 or 1
3. `systemview test myProject` (server running) → same result
4. `systemview test myProject --json` → single JSON object to stdout, nothing else
5. `systemview connect ProfilesService http://localhost:4100/bu/api/profiles` → writes service to `systemview.manifest.json`, exits
5b. `systemview connect` (with `systemview.services.json` in cwd) → connects all listed services in one shot
6. Start a SystemLynx service with plugin → `systemview.manifest.json` appears in that project's root
7. Run `systemview test myProject` from that project's root → reads manifest, no API server needed
8. Human opens browser UI → still works as before (plugin still calls `SystemView.connect()`)
9. `systemview probe ProfilesService.Users.getUser '{"userId":"123"}'` → calls the live method, prints result
10. Same command with `--json` → clean JSON to stdout, agent-parseable
