# RFC-004: SystemView Logger

## Summary

Turn SystemView into an observability layer for SystemLynx services. The plugin auto-instruments every module method via `$all` before/after middleware — every call is logged automatically, no user code required. Manual `systemview.log()` stays available for custom business-level entries. Logs are stored in `systemview.logs`, readable from the CLI and browsable in a live Logs window in the UI.

---

## 1. Log entry shape

```json
{
  "timestamp": "2026-06-28T12:00:00.000Z",
  "projectCode": "buAPI",
  "serviceId": "Profiles",
  "moduleMethod": "Users.getUser",
  "level": "trace",
  "message": "Users.getUser called",
  "data": { "args": { "userId": "abc123" }, "duration": 42, "result": { "name": "Odion" } }
}
```

**Levels:**
- `"trace"` — auto-captured method call (every module method, automatically)
- `"info" | "warn" | "error" | "debug"` — manual entries via `systemview.log()`

`moduleMethod` is populated automatically for trace entries, optional for manual entries.

---

## 2. Auto-instrumentation (the core)

The plugin registers `$all` before/after middleware on App. Every module method call is captured automatically — args, result, duration — without any user code.

**`index.js` (plugin entry):**

```js
App.before("$all", (req, res, next) => {
  if (["Plugin", "SystemView"].includes(req.module_name)) return next();
  req._svStart = Date.now();
  next();
});

App.after("$all", async (req, res, next) => {
  if (["Plugin", "SystemView"].includes(req.module_name)) return next();
  try {
    await SystemView.saveLog({
      projectCode,
      serviceId,
      moduleMethod: `${req.module_name}.${req.fn}`,
      level: "trace",
      message: `${req.module_name}.${req.fn} called`,
      data: {
        args: req.body,
        result: res.locals.result,      // whatever SystemLynx puts here
        duration: Date.now() - req._svStart,
      },
    });
  } catch {}
  next();
});
```

> **Note:** Need to verify where SystemLynx places the method result in the response cycle — `res.locals.result` is the assumption; confirm from Router.js before implementing.

---

## 3. Module logging methods

Every module automatically gets `this.log`, `this.warn`, `this.error`, `this.debug` injected before each method call via `before("$all")`. No imports, no setup — works exactly like `console.log`:

```js
// Inside any module method:
this.log("user signed in", { userId });
this.warn("rate limit close", { remaining: 2 });
this.error("stripe failed", { code: err.code });
```

These send to `SystemView.saveLog` with the appropriate level. The module name is captured automatically from `req.module_name`.

---

## 4. Storage

`systemview.logs` — NDJSON, one entry per line, append-only. Already in `nodemon.json` ignore list. No database.

---

## 5. Server (`api/index.js`)

```js
const LOG_FILE = path.join(__dirname, "../systemview.logs");

function saveLog({ projectCode, serviceId, moduleMethod, level = "info", message, data }) {
  const entry = JSON.stringify({
    timestamp: new Date().toISOString(),
    projectCode,
    serviceId,
    moduleMethod,
    level,
    message,
    data,
  });
  fs.appendFileSync(LOG_FILE, entry + "\n");
  return true;
}

function getLogs({ projectCode, serviceId, level, limit = 200 } = {}) {
  if (!fs.existsSync(LOG_FILE)) return [];
  const lines = fs.readFileSync(LOG_FILE, "utf8").trim().split("\n").filter(Boolean);
  let entries = lines.map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
  if (projectCode) entries = entries.filter((e) => e.projectCode === projectCode);
  if (serviceId)   entries = entries.filter((e) => e.serviceId === serviceId);
  if (level)       entries = entries.filter((e) => e.level === level);
  return entries.slice(-limit);
}

function clearLogs() {
  fs.writeFileSync(LOG_FILE, "");
  return true;
}
```

Wire `saveLog`, `getLogs`, `clearLogs` into the `SystemView` module in `App.startService()`.

---

## 6. CLI

New command: `systemview logs [projectCode] [serviceId]`

```bash
systemview logs                          # last 50 entries, all projects
systemview logs buAPI                    # filter by project
systemview logs buAPI Profiles           # filter by project + service
systemview logs --level error            # filter by level (trace/info/warn/error/debug)
systemview logs --limit 100              # how many entries (default 50)
systemview logs --clear                  # wipe systemview.logs (confirms first)
systemview logs --json                   # raw JSON output
```

New file `cli/logs.js`. Output format (non-JSON):

```
  12:00:01  buAPI › Profiles   Users.getUser   trace   42ms
  12:00:02  buAPI › Profiles   Users.signIn    trace   91ms
  12:00:03  buAPI › Profiles   —               warn    Stripe webhook retry
```

Level colored: `trace` = dim, `info` = white, `warn` = yellow, `error` = red, `debug` = blue.
Duration shown for trace entries. Manual entries show message instead.

---

## 7. UI — Logs window

New route `/logs`. Link in page header alongside the SystemView title.

**Layout:**

```
  ← back    SystemView  [logo]                              Logs

  [ all projects ▾ ]  [ all services ▾ ]  [ all levels ▾ ]    [ Clear ]

  12:00:01   buAPI › Profiles   Users.getUser   trace    42ms
  12:00:02   buAPI › Profiles   Users.signIn    trace    91ms   ▶ { args, result }
  12:00:03   buAPI › Profiles   —               warn     Stripe webhook retry
```

- Auto-refreshes every 5s via `getLogs()` polling
- Filters derive options from the current log data (unique projects/services/levels seen)
- Expandable rows: clicking a trace row reveals `{ args, result }` inline
- Clear button with confirm dialog
- `trace` rows dimmed by default so manual entries stand out

**New files:**
- `src/pages/Logs/Logs.js`
- `src/pages/Logs/styles.scss`

**Modified files:**
- `src/App.js` — add `/logs` route
- `src/pages/SystemView/SystemView.js` — add Logs link in header

---

## 8. Files changed

| File | Change |
|------|--------|
| `api/index.js` | Add `saveLog`, `getLogs`, `clearLogs` |
| `systemview-plugin/index.js` | Register `$all` before/after middleware for auto-instrumentation |
| `systemview-plugin/SystemViewModule.js` | Expose manual `log()` function |
| `systemview-plugin/package.json` | Bump to 1.3.2 |
| `cli/logs.js` | New — logs command implementation |
| `cli/index.js` | Wire `logs` command |
| `cli/utils/cli.js` | Add logs to help text |
| `src/pages/Logs/Logs.js` | New — logs UI page |
| `src/pages/Logs/styles.scss` | New — logs page styles |
| `src/App.js` | Add `/logs` route |
| `src/pages/SystemView/SystemView.js` | Add Logs link in header |

---

## 9. Open question before implementing

Confirm where SystemLynx places the method result in the after-middleware response cycle. Check `Router.js` `handleRequest` to find what `res.locals` or `req` properties hold the resolved return value — this determines what we capture in the after hook.

---

## 10. Verification

```bash
# Start test service (plugin installed, auto-instrumentation active)
node test/service

# Run a test — should auto-log every method call
systemview test systemview-test Math.add

# View the auto-captured trace logs
systemview logs
systemview logs --level trace
systemview logs systemview-test TestService

# Manual log via probe
systemview probe TestService.Plugin.log '{"level":"info","message":"manual entry"}'

systemview logs --level info
systemview logs --json
systemview logs --clear

# UI
systemview open  # navigate to /logs
```
