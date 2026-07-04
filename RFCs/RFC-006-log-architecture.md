# RFC-006: Fix Log Architecture + Plugin SystemView Module

## Summary

RFC-004 built log I/O in the wrong place. `saveLog`, `getLogs`, and `clearLogs` were implemented as direct file I/O on the SystemView UI server (`api/index.js`). The UI server has no business owning log files for the projects it monitors — it runs separately and has no access to the project directory.

The fix: the plugin owns all log I/O (write, read, clear, emit), exactly as it does for specs, docs, and tests. The UI server becomes a proxy. The CLI goes directly to service handles for streaming, `--current`, and `flush`.

---

## Architecture

**Before:**
- Plugin calls `SystemView.saveLog()` over HTTP → UI server writes to `systemview.logs` (wrong machine)
- CLI `--current` and `flush` both hit the UI API
- Socket streaming via `SystemViewLogs` module (socket-only)

**After:**
- Plugin's `SystemView` module writes `systemview.logs` locally (co-located with the project)
- Plugin's `SystemView` module emits `"log"` events — no separate `SystemViewLogs` module
- UI server `getLogs`/`clearLogs` proxy to each connected service's `SystemView.getLog()`/`clearLog()`
- CLI `--current` uses connected service handles directly; `flush` loads manifest and calls each service

---

## Changes

### `systemview-plugin/index.js`

- Remove `SystemViewLogs` module and all `SystemView.saveLog()` calls
- Add `SystemView` module: `log`, `warn`, `error`, `debug`, `trace`, `getLog`, `clearLog`
  - All log methods write to local `systemview.logs` + emit `"log"` socket event
  - `getLog({ limit })` reads and returns log entries
  - `clearLog()` wipes the log file
- `SKIP_MODULES = ["Plugin", "SystemView"]`
- `let sv` — module-scope lazy handle to the local `SystemView` module, set in `on("ready")`
- `makeLogger(moduleName, methodName, traceId)` — closes over `sv`; injected functions are arrow functions, no `this` dependency
- `before`/`after` `$all` call `sv.trace(...)` for auto-instrumentation
- `registerSystemViewModule()` / `registerPluginModule()` — named registration functions, called at bottom
- `logsOnly` config option: skip `Plugin` module registration (logs only, no doc/test sync)

### `api/index.js`

- Remove `saveLog`, `LOG_FILE`, `fs` (no longer needed)
- `getLogs` becomes async proxy: iterates `ConnectedServices`, calls `svc.SystemView.getLog({ limit })` per service, merges and filters
- `clearLogs` becomes async proxy: calls `svc.SystemView.clearLog()` on each connected service
- Service handles cached in `serviceClients` map via `getServiceHandle(serviceUrl)`

### `cli/logs.js`

- `svc.SystemViewLogs.on("log", ...)` → `svc.SystemView.on("log", ...)`
- `connected` stores `{ serviceId, svc }` (not just `serviceId`)
- `--current`: iterates `connected`, calls `svc.SystemView.getLog({ limit })` directly
- `flush`/`clearlogs`: reads manifest, connects per service, calls `svc.SystemView.clearLog()` (no UI API)

---

## Verification

1. Start local test service (`test/service/`)
2. `node cli/index.js test` — generates logs locally via plugin
3. `node cli/index.js logs --level trace` — streaming via `svc.SystemView.on("log", ...)`
4. `node cli/index.js logs --current` — reads from `svc.SystemView.getLog()`
5. `node cli/index.js flush` — calls `svc.SystemView.clearLog()` on each service
6. Open UI Logs page — proxy in `api/index.js` still serves logs

---

## Version

Both `systemview` and `systemview-plugin` bump to `2.0.1`.
