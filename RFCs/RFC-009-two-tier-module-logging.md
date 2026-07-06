# RFC-009: Two-Tier Module Logging

## Problem

The current `this.log()` has no `traceId` — there's no way to correlate a manual log entry with
the auto-trace records for the same call. When a method is invoked via RPC, the before/after hooks
emit trace records with a `traceId`. A manual `this.log()` inside that same method has no way to
carry the same ID, so the entries are disconnected in the log stream.

## Insight

The plugin wraps every method at registration time — it knows `moduleName` and `methodName` for
each method before any call arrives. So `this.log()` can be injected **per-method**, pre-bound
with full context, at wrap time. The only thing that isn't known at wrap time is `traceId` — that
only exists during an RPC call.

Two injection points, same call site:

- **At registration** — inject `log` per-method, pre-bound with `module`, `method`, `moduleMethod`,
  `projectCode`, `serviceId`. Works for local calls with no request.
- **In the before hook (RPC only)** — re-inject `log` on the clone with `traceId` added from
  `req._svTraceId`. Everything else is already bound.

Same `this.log()` call site. Local calls get everything except `traceId`. RPC calls get everything.

## Design

Both tiers use identical call signatures — `this.log(scope, data)` or `this.log({ scope, ...data })`.
The difference is only which fields the plugin can fill automatically.

| Field | Tier 1 (local call) | Tier 2 (RPC call) |
|---|---|---|
| `timestamp` | ✓ | ✓ |
| `projectCode` | ✓ | ✓ |
| `serviceId` | ✓ | ✓ |
| `module` | ✓ | ✓ |
| `method` | ✓ | ✓ |
| `moduleMethod` | ✓ | ✓ |
| `scope` | ✓ user-provided | ✓ user-provided |
| `level` | ✓ user-provided | ✓ user-provided |
| `log` | ✓ user-provided | ✓ user-provided |
| `traceId` | — | ✓ |
| `returnValue` | — auto-trace only | — auto-trace only |
| `error` | — auto-trace only | — auto-trace only |

### Tier 1 — Local call (at registration)

Injected per-method at wrap time. Pre-bound with everything known statically. One function per
level — `log`, `warn`, `error`, `debug` — so the user calls `this.log(scope, data)` not
`this.log(level, scope, data)`.

```js
const base = { projectCode, serviceId, module: moduleName, method: methodName,
  moduleMethod: `${moduleName}.${methodName}` }
const emit = (level, scope, data) =>
  sv.log({ ...base, timestamp: new Date().toISOString(), level, scope,
    ...(data ? { log: data } : {}) })

method.log   = (scope, data) => emit("log",   scope, data)
method.warn  = (scope, data) => emit("warn",  scope, data)
method.error = (scope, data) => emit("error", scope, data)
method.debug = (scope, data) => emit("debug", scope, data)
```

### Tier 2 — RPC call (in before hook)

Re-injected on the clone, adds `traceId` from the live request. Everything else is the same.

```js
const emit = (level, scope, data) =>
  sv.log({ ...base, timestamp: new Date().toISOString(), traceId: req._svTraceId,
    level, scope, ...(data ? { log: data } : {}) })

req.Module.log   = (scope, data) => emit("log",   scope, data)
req.Module.warn  = (scope, data) => emit("warn",  scope, data)
req.Module.error = (scope, data) => emit("error", scope, data)
req.Module.debug = (scope, data) => emit("debug", scope, data)
```

### Log store schema

`traceId` is the only optional field. All other fields are always present on manual log entries.
No schema migration needed.

## What changes

| File | Change |
|---|---|
| `systemview-plugin/index.js` | Inject `log` per-method at wrap time (Tier 1); re-inject with `traceId` in before hook for RPC calls (Tier 2) |
| `cli/utils/cli.js` + `cli/logs.js` | Rename `message` → `scope` in column headers and level color map |
| `src/pages/Logs/Logs.js` + `src/sass/_log-table.scss` | Rename `message` → `scope` column header |

## What doesn't change

- `this.log()` call site is identical for both tiers — user code doesn't need to know which context it's in
- Auto-tracing (before/after hooks) is unchanged
- `redact`, `exclude`, `trace` config options apply to auto-traces only; manual `this.log()` is the user's responsibility
- Manual `this.log()` calls do NOT duplicate auto-trace entries — they only fire when explicitly called

## Rename: `message` → `scope`

The first parameter to `this.log()` isn't a message — it's a label for the calling context ("which
middleware I'm in", "which function I'm in"). Renaming it to `scope` makes that intent explicit.

```js
this.log("auth.middleware", { userId })   // scope = "auth.middleware"
this.log({ scope: "signIn", userId })     // object form — same field name
```

Changes everywhere the field is named: log store schema, `makeManualRecord` param, CLI column
header, UI column header. No behavior change — purely semantic.

Error objects from SystemLynx carry their own `message` and `status` — those stay as-is on the
error shape. `scope` is only the user-provided label on manual log calls.

---

## Open question

Should `arguments` be automatically available on manual log calls the way `traceId` is? The
before hook already has `req.arguments` in scope when it re-injects `log` for RPC calls. Including
it by default risks redundancy with the auto-trace start record. Lean toward: leave it out —
user puts whatever they need in `log:`.
