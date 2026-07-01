# RFC-005: Observability Dashboard + UI Improvements

## Summary

Two tracks running together:

1. **Logs page → Observability dashboard** — the `/logs` page grows a summary dashboard above the table. Accumulated stats derived from log shape: error frequencies, status code distribution, call counts by module. Storage becomes pluggable (file path or custom adapter) so the system can eventually point at a database instead of a local file.

2. **UI improvements** — documentation view gets tabs (Docs / Logs), the navigator gets a project-level node, and dead code / inline style cleanup from RFC-002 phases 2–5.

---

## 1. Pluggable storage adapter

Right now the log file path is hardcoded in `api/index.js`. It needs to be configurable — and eventually replaceable with a custom function for database storage.

### Plugin config

```js
require("systemview-plugin")({
  connection: "...",
  projectCode: "buAPI",
  serviceId: "Profiles",
  // default: writes to ./systemview.logs (NDJSON)
  storage: "./systemview.logs",
  // OR custom adapter:
  storage: {
    save: async (entry) => db.collection("logs").insertOne(entry),
    get:  async ({ projectCode, serviceId, level, limit }) => db.collection("logs").find({...}).toArray(),
    clear: async () => db.collection("logs").deleteMany({}),
  },
})
```

The plugin passes `storage` through to SystemView on connect (alongside `system`, `projectCode`, `serviceId`, `specList`).

### Server side (`api/index.js`)

`saveLog`, `getLogs`, `clearLogs` stay as-is for the default NDJSON path. But `SystemView.connect` receives the storage config and stores it per-connection. When a `saveLog` call comes in from the plugin, if the connection has a custom adapter, route through it instead of the file.

For the initial implementation, custom adapter support only needs `save` — `get` and `clear` can follow. The file-based path stays the default and is unchanged.

---

## 2. Dashboard layout (Logs page)

The `/logs` page gets a dashboard section above the log table. Stats are derived client-side from the fetched entries — no new server methods needed for now.

```
┌──────────────────────────────────────────────────────────┐
│  [ all projects ▾ ]  [ all services ▾ ]  [ all levels ▾ ] [ Clear ]
├──────────────────────────────────────────────────────────┤
│  DASHBOARD                                               │
│                                                          │
│  ┌─────────────────┐  ┌─────────────────┐               │
│  │  Error messages │  │  Status codes   │               │
│  │  ─────────────  │  │  ─────────────  │               │
│  │  "Not found" 12 │  │  404  ×12       │               │
│  │  "Auth failed"5 │  │  500  ×5        │               │
│  │  ...            │  │  ...            │               │
│  └─────────────────┘  └─────────────────┘               │
│                                                          │
│  ┌─────────────────────────────────────┐                 │
│  │  Call counts by method (trace)      │                 │
│  │  Users.getUser    ×42               │                 │
│  │  Users.signIn     ×18               │                 │
│  │  ...                                │                 │
│  └─────────────────────────────────────┘                 │
├──────────────────────────────────────────────────────────┤
│  LOG TABLE (same as current, expandable rows)            │
└──────────────────────────────────────────────────────────┘
```

### Dashboard panels

Two kinds of panels: **auto panels** (always derived from known log shape) and **field analyzers** (agnostic, user-driven).

#### Auto panels

Derived from the known top-level log shape. Always present, filter-aware.

**Error rate by module** (level = error): group by `moduleMethod`, count errors per module/method, sort descending. Shows at a glance which module is throwing the most. Only shown when error-level entries exist.

**Call counts** (level = trace): group by `moduleMethod`, count, sort descending. Top 10 most-called methods.

These auto panels know the log shape — they require no user configuration.

#### Field analyzer (agnostic)

The log entry shape is not fully known at build time — `data.*` fields vary by service and error type. The field analyzer lets the user pick any field from the actual entries and see value frequencies.

**How it works:**

1. Walk all entries in the current filtered set and collect every reachable key path: top-level (`message`, `level`, `moduleMethod`) and one level into `data` (`data.status`, `data.error.code`, `data.args.userId`, etc.).
2. Present those key paths in a dropdown — **"Analyze field..."**
3. User picks one. The panel renders a frequency table: each unique value → count, sorted descending.

```
  [ Analyze field: data.status ▾ ]

  404    ×18
  500    ×7
  401    ×3
```

Multiple analyzers can be pinned side by side — click **+ Add** to open another. Each is independent (different field, same filter scope). Pinned analyzers persist in component state for the session.

This is fully agnostic — no domain knowledge required. A service that throws `data.error.code` strings gets the same treatment as one throwing `data.status` numbers. The dashboard reads the shape from the actual data.

All panels (auto + analyzer) respond to the active project/service/level filters.

---

## 3. Navigator — project-level node

Currently the left nav jumps straight to services. The project should be a selectable node at the top of its list — clicking it loads the project-level view.

```
  buAPI                    ← project node (selectable)
    └── ProfilesService    ← service nodes (existing)
    └── OrdersService
```

Route: `/:projectCode` (already exists) — just needs the navigator to render a project node and make it clickable, so `/:projectCode` is actually a destination, not just a pass-through.

**Project-level view** shows:
- Documentation tab: project-level docs (stored as `specs/docs/project.md` or similar)
- Logs tab: all logs for this project (filter = projectCode)
- Tests: listed but not run from here (you navigate to a method to run)

---

## 4. Docs/Logs tabs

At every level that has a docs panel (method, module, service, project), the docs area gets two tabs:

```
  [ Documentation ] [ Logs ]
```

**Documentation** tab: existing behavior, shown by default.

**Logs** tab: shows the log table filtered to the current scope. Method level → filter by `moduleMethod`. Module level → filter by module name. Service level → filter by `serviceId`. Project level → filter by `projectCode`. No dashboard in the inline tab — just the table with the active filter. Dashboard lives on the full `/logs` page.

---

## 5. RFC-002 cleanup (phases 2–3 only, no version upgrades)

Scoped to things that don't touch React/Router versions:

- **Dead code removal**: unused imports, components that are never rendered
- **Inline styles → SCSS**: the `style={{...}}` objects in `SystemView.js` header moved to stylesheet
- **`_tokens.scss`**: already scaffolded — wire up color and spacing tokens used across components
- **FullTest naming conflict**: audit and fix (there are two components with overlapping names)

Phase 4 (TestPanel UX drag/reorder) and Phase 5 (connection status indicator) are deferred — scope them into a future RFC.

---

## 6. Test helper unification

Two copies of `test-helpers.js` exist:
- `src/organisms/TestPanel/components/test-helpers.js` — ES module syntax (import/export)
- `testing-utilities/test-helpers.js` — CommonJS (module.exports)

CRA/Babel handles CommonJS imports in the browser bundle, so the fix is:
1. Make `src/organisms/TestPanel/components/test-helpers.js` the single source of truth
2. Replace `testing-utilities/test-helpers.js` with a re-export that points to it
3. Update any imports that reference `testing-utilities/test-helpers.js` to point to the canonical file

No build config changes needed.

---

## Files changed

| File | Change |
|------|--------|
| `systemview-plugin/index.js` | Accept `storage` in config, pass through to `connect` |
| `api/index.js` | `saveLog` routes through custom adapter if present; `connect` stores adapter per-service |
| `src/pages/Logs/Logs.js` | Add dashboard panels above table |
| `src/pages/Logs/styles.scss` | Dashboard panel styles |
| `src/organisms/SystemNavigator/SystemNavigator.js` | Add project-level node |
| `src/pages/SystemView/SystemView.js` | Add Docs/Logs tab switcher to docs area |
| `src/pages/SystemView/styles.scss` | Tab styles; move inline styles out |
| `src/sass/_tokens.scss` | Wire tokens |
| `testing-utilities/test-helpers.js` | Re-export from canonical source |
| `src/organisms/TestPanel/components/test-helpers.js` | Canonical source (minor cleanup if needed) |

---

## Build order

1. Storage adapter (plugin config + api/index.js) — small, self-contained
2. Dashboard panels (client-side, no new API) — medium
3. Docs/Logs tabs — medium, touches multiple components
4. Project-level nav node — medium
5. RFC-002 cleanup + test unification — can be done in parallel with 3/4

---

## Not in scope

- React 18 / Router v6 upgrade (explicitly excluded, see RFC-002 Phase 1)
- TestPanel drag-to-reorder, per-phase run buttons (RFC-002 Phase 4 — future RFC)
- Connection status indicator (RFC-002 Phase 5 — future RFC)
- Database adapters shipping with systemview (user brings their own `storage` function)
