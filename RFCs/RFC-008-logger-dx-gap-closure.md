# RFC-008: Logger DX + Gap Closure

## Context

Post RFC-006/007, the plugin logger has several known gaps documented in `PLUGIN_LOG_GAPS.md` and `LOGGER_GAPS.md`, plus new DX requests from this session. This RFC closes all of them in one pass.

## Gap Verification Results

Every gap was verified against actual code in `systemview-plugin/index.js` before planning. Verdicts:

| Gap | Verdict | Notes |
|---|---|---|
| PLUGIN 1: race on req.Module logger | **REAL (narrow, dormant) — deferred** | Spread is off-by-one-step: it captures whatever `Module.log` is at apply-time, which is *after* method-level middleware. An async method middleware (e.g. `getItem await db.findById`) yields the event loop between `$all` injection and `handleRequest`'s spread. A concurrent request's `$all` overwrites `Module.log` in that window. Fix: define `Module.log` once as a stateless fn reading `this.req._svTraceId` at call time. Auto start/end traces are unaffected. Deferred — no concurrency in current test/CLI usage. |
| PLUGIN 2: error-trace race on mod._svTraceId | **NOT REAL in practice** | The stash→read is all synchronous within one call stack; Node.js single-threaded event loop prevents interleave. Structural smell but not a live bug. |
| PLUGIN 3: arguments captured 3x unredacted | **REAL** | Lines 143, 157, 51, 112 all include unredacted `arguments`. Passwords/tokens on disk. |
| PLUGIN 4: double trace per call | **NOT A PROBLEM** | Start trace captures original args (e.g. raw entityId); middleware transforms req.arguments before method runs, so end trace captures resolved state (e.g. full entity object). Both snapshots are intentional and distinct. |
| PLUGIN 5: name collision "SystemView" | **PARTIAL FIX** | Rename loadService/useService alias to "SystemViewUI" — services have no intrinsic name, so this is two lines in the plugin. Local module name stays "SystemView". Renaming the module would require touching the UI, CLI, and store — not worth it. |
| PLUGIN 6: .map(JSON.parse) index-as-reviver | **REAL** | Line 84. Harmless now, landmine on refactor. |
| PLUGIN 7: sync I/O, no rotation | **REAL** | All `appendFileSync`. Defer — complex infra change. |
| LOGGER 1: payloads unredacted | **REAL** | Same as PLUGIN 3. |
| LOGGER 2: storage doesn't scale | **REAL** | Same as PLUGIN 7. Defer. |
| LOGGER 3: double trace | **NOT A PROBLEM** | Same as PLUGIN 4 — middleware transforms req.arguments between start and end, so both snapshots carry distinct data. |
| LOGGER 4: after hook awaits saveLog | **OUTDATED** | RFC-006 moved logging in-process. No remote saveLog call exists. |
| LOGGER 5: no per-module opt-out | **REAL** | SKIP_MODULES hardcoded. No user config. |
| LOGGER 6: level taxonomy drift (log vs info) | **HELP TEXT BUG** | `this.log()` emits `"log"` — internally consistent. Only bug: help text lists `info` as valid level; `--level info` matches nothing. Fix: swap `info` → `log` in help text and LEVEL_COLOR. |
| LOGGER 7: systemlynx v2 dependency | **REAL** | Requires getModules() + module.on("error"). Separate concern. |

**In scope:** optional message, trace, redact, exclude, level fix, .map fix, service alias rename, has/missing docs, local log snapshots, logs UI live monitor.
**Deferred:** sync I/O / rotation (PLUGIN 7, LOGGER 2), systemlynx v2 dependency (LOGGER 7).

---

## Changes

### 1. Optional message — `systemview-plugin/index.js` `makeManualRecord`

Current signature: `(level, message, logData, meta)` — message always required.

New smart dispatch:
```js
function makeManualRecord(level, messageOrData, logData, meta) {
  let message, data
  if (typeof messageOrData === 'object' && messageOrData !== null) {
    const { message: msg, ...rest } = messageOrData
    message = msg || ""
    data = Object.keys(rest).length ? rest : null
  } else {
    message = messageOrData || ""
    data = logData
  }
  return { ...makeBaseRecord(meta), level, message, ...(data ? { log: data } : {}) }
}
```

Callers: `this.log({userId, action})` — message from `object.message`, rest becomes `log:`. `this.log("msg", {userId})` still works. Message stripped from nested data to avoid duplication in table.

---

### 2. Fix level help text — `cli/utils/cli.js` + `cli/logs.js`

`this.log()` emits level `"log"` — internally consistent, not a gap. The only bug is the help text listing `info` as a valid level when the actual level name is `log`.

- `cli/utils/cli.js`: change `--level <trace|info|warn|error|debug>` → `--level <trace|log|warn|error|debug>`
- `cli/logs.js` `LEVEL_COLOR`: add `log` entry (currently has `info` which matches nothing; swap it)

---

### 3. `trace` config option

Polymorphic — controls both whether tracing runs and what context it attaches:

- `trace: true` — default; auto-traces all calls
- `trace: false` — disables auto-tracing entirely (manual `this.log()` still works)
- `trace: (req) => object` — traces + merges the returned object into each trace entry

```js
// disable:
SystemViewPlugin({ trace: false })

// enrich:
SystemViewPlugin({
  trace: (req) => ({ sessionId: req.session?.id, userId: req.user?.id })
})
```

In before hook: if `config.trace === false`, skip injection and return early.
In after hook:
```js
if (config.trace === false) return
const ctx = typeof config.trace === 'function' ? config.trace(req) : {}
sv.trace("end", { arguments: req.arguments, returnValue: req.returnValue, duration, ...ctx })
```

---

### 4. `redact` config option

Add `redact: string[]` to plugin config — array of namespace path strings targeting fields to mask before logging. Uses the repo's existing `obj` utility (`testing-utilities/test-helpers.js`) which supports dot and bracket notation.

```js
SystemViewPlugin({ redact: ['password', 'user.token', 'auth[0].secret'] })
```

Before emitting a trace, clone `req.arguments` and `req.returnValue` via `obj(...).clone()`, then call `obj(clone).apply(path, "[REDACTED]")` for each path in `config.redact`. Log the clones — never mutates the actual request data.

`obj` is not currently imported in `systemview-plugin/index.js` — will need to add the require.

---

### 5. `exclude` config option

Add `exclude: string[]` to plugin config — array of module names or `"Module.method"` strings to exclude from auto-trace. Merges with hardcoded `SKIP_MODULES`.

```js
SystemViewPlugin({ exclude: ['HealthCheck', 'Users.ping'] })
```

In before hook, check before injecting logger or emitting trace.

---

### 6. Fix `.map(JSON.parse)`

In `systemview-plugin/index.js` `getLog`:
```js
// before:
.map(JSON.parse)

// after:
.map(line => JSON.parse(line))
```

One line, no behavior change, removes the landmine.

---

### 7. Rename service alias to `SystemViewUI`

In `systemview-plugin/index.js`, two lines:
```js
// before:
App.loadService("SystemView", connection)
const svc = this.useService("SystemView")

// after:
App.loadService("SystemViewUI", connection)
const svc = this.useService("SystemViewUI")
```

Local module name (`App.module("SystemView", ...)`) unchanged. Remote module access patterns unchanged.

---

### 8. Comprehensive help text audit — `cli/utils/cli.js` + `cli/logs.js`

Full audit against actual implementation. Specific gaps:

**Command renames:**
- `stoplogs` → `unsubscribe` (already aliased — make it the primary name in help text)
- `clearlogs` → `flush`

**Undocumented flags (implemented but missing from help):**
- `--follow` / `-f` — logs: keep streaming after `--current`
- `--clear` — logs: wipe log store then stream
- `--debug` / `-d` — global: verbose debug output
- `shutdown` aliases `exit`, `q`, `stop` — all work, none documented
- `--filter has=field` / `--filter missing=field` syntax — implemented, not shown

**Wrong or misleading:**
- `--level <trace|info|warn|error|debug>` → `info` should be `log` (also Change 2)
- `--manifest` — clarify it's a boolean for `connect` and a path value for `probe`
- `--limit` — clarify it only applies with `--current`

**Broken wiring (documented but not wired through):**
- `--json` for `list` — parsed but not passed to `listTests()`
- `--json` for `logs` — parsed but not accepted by `logs.js`

**Note:** `stoplogs`/`clearlogs` handled in `startLineReader.js` (interactive session) — verify before touching.

---

### 9. Local log snapshots — `--save` / `--saved`

`systemview logs buAPI --save` streams live AND appends to a local NDJSON file as entries arrive.
`systemview logs buAPI --saved` reads from that local file instead of the live service — works when remote is gone or rotated.

**Storage:** `--save` alone uses the plugin's default log file path. `--save <path>` writes to a custom location.

**Limit:** `--save-limit <n>` (default 500) — separate value flag, independent of `--limit` (display limit). Local file is a ring buffer, oldest entries drop first on each append.

**Cleanup:** delete the file yourself — it's local and visible.

**Implementation:**
- In `cli/logs.js`: `--save` value = custom path; no value = default log path. Open write stream on start, append each entry as a JSON line; `--save-limit` sets buffer size
- If `--saved` flag, skip live subscription, read local file with same limit/filter/format logic as `--current`
- Same `formatRow` / filter logic works on both — local entries are identical shape

---

### 10. Logs UI — live monitoring toggle + scroll UX

**Current state:** `src/pages/Logs/Logs.js` fetches logs on load (one-shot or polling). No real-time streaming in the UI.

**Changes:**

**Live monitor toggle** — a button/switch in the logs page header. Off = current fetch behavior. On = subscribes to `SystemView.on("log")` for each service in the current view, new entries arrive in real time. Toggling off unsubscribes. State persists for the session.

**Animated new rows** — when in monitor mode, incoming rows animate into view (fade + slight slide from bottom). CSS transition on a `data-new` attribute, removed after ~400ms so it doesn't re-trigger on re-renders.

**Scroll behavior:**
- When new entries arrive and user is already at (or near) the bottom → auto-scroll to keep the latest entry visible
- When user has scrolled up (reading older entries) → new entries append silently, no forced scroll
- **Scroll buffer** — add `padding-bottom` to the log body equal to ~50% of the table container height, so the last row can be scrolled up to the middle of the view rather than stuck at the very bottom edge

**Implementation anchors:**
- Monitor toggle wired to `SystemView.on("log")` via the UI's SystemViewService context — same subscription pattern as `cli/logs.js`
- Track scroll position in a ref: `isAtBottom = scrollTop + clientHeight >= scrollHeight - threshold`
- New entries prepend to state array (newest first) or append (newest last) — keep consistent with existing sort order
- `src/pages/Logs/Logs.js` + `src/sass/_log-table.scss` (scroll buffer padding)

---

## Files Changed

| File | Changes |
|---|---|
| `systemview-plugin/index.js` | optional message, trace (polymorphic), redact (using obj utility), exclude, service alias rename to SystemViewUI, .map fix |
| `cli/utils/cli.js` | comprehensive help text audit — all gaps, renames, broken wiring |
| `cli/logs.js` | LEVEL_COLOR log entry, --save/--saved/--save-limit, --follow, --clear wiring |
| `src/pages/Logs/Logs.js` | live monitor toggle, scroll behavior |
| `src/sass/_log-table.scss` | scroll buffer padding |

---

## Verification

1. Start test service → logs stream in interactive mode
2. `this.log({userId, action})` — message blank, data in `log:` field; `this.log({message: "x", userId})` — message "x", `log: {userId}`
3. `systemview logs --level log` — matches entries; `--level info` matches nothing (expected)
4. `trace: false` — no trace entries emitted, manual `this.log()` still works
5. `trace: (req) => ({userId})` — userId appears in trace entries
6. `redact: ['password']` — signIn call logs `[REDACTED]` for password arg
7. `exclude: ['Math.add']` — Math.add calls produce no trace
8. `systemview logs --filter has=userId` — only entries with userId field
9. `systemview logs --filter missing=error` — only entries without error field
10. `systemview unsubscribe` — stops streaming; `systemview flush` — wipes log store
11. `systemview logs buAPI --save` — creates local snapshot; `--saved` reads it back
12. Logs UI monitor toggle — new entries arrive live; scroll behavior correct
13. Bump to `systemview@1.22.0`, `systemview-plugin@1.5.0`
