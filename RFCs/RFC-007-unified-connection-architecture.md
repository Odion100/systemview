# RFC-007: Unified Connection Architecture

## Context

Currently the CLI re-reads `systemview.manifest.json` from disk on every command (`logs`, `test`, `list`, `connect`). `connectService.js` also writes to the manifest — wrong, since the manifest belongs to the plugin. The result is brittle per-command file I/O, no shared connection state, and no clean path to connecting remote services without clobbering local files.

The fix: the CLI loads the manifest once at startup into a lightweight in-memory store. `connect` probes services and registers them in-memory only — no auto-writes to disk. `Plugin.getManifest()` enables remote projects: probe any service running the plugin, get the full project manifest back. `list` queries the UI server for the full picture. The UI surfaces all stored projects without requiring a search.

---

## Architecture

### Two tiers

**CLI "connected" tier** — services the CLI actively has handles on for the current session:
- Loaded from local `systemview.manifest.json` at startup
- Added via `connect <url>` during an interactive session
- Used by `test`, `logs` — commands that need to call into services

**UI "stored" tier** — everything the UI server knows about:
- Populated by plugin auto-notify at startup (already works)
- Updated by CLI `connect` pushing each service it connects to
- `list` queries this for the full cross-project picture

### `connect` behavior

`connect` takes a **service URL** or a **project code**:
- URL → probe the service fresh via `Client.loadService(url)` (no existing connection data)
- URL or namespace with `--force` → re-probe matching services even if connection data already exists, to pick up shape changes. Always updates the UI store with fresh data. Namespace targeting works the same as `test`/`logs`/`list` — fuzzy match against project/service/module/method.
- Project code → look up the UI server's stored connections for that project, connect to each service found there

For URL connects:
- `connect <url>` — load the service handle, store under `projectCode: "connected-services"` (no project metadata without manifest)
- `connect <url> --manifest` — load the service handle, call `Plugin.getManifest()` → get real `projectCode` and all project services
- CLI store uses upsert — no duplicates
- Every connect pushes to the UI server using the same format

### `list` behavior

Queries the UI server for all stored projects/services. Outputs a flat list of all services the UI knows about. Services the CLI currently has handles on (loaded at startup or added via `connect`) are visually indicated as connected — not in a separate tier, just noted inline. If you see a service you're not connected to, `connect <url>` to add it to your session.

---

## Changes

### 1. `cli/index.js` — One manifest read at startup

After `init()`, before any command dispatches:

```js
const MANIFEST_FILE = flags.manifest || path.join(process.cwd(), 'systemview.manifest.json');
let manifestServices = [];
if (fs.existsSync(MANIFEST_FILE)) {
  try {
    const manifest = JSON.parse(fs.readFileSync(MANIFEST_FILE, 'utf8'));
    manifestServices = (manifest.services || [manifest]).map(s => ({ projectCode: manifest.projectCode, ...s }));
    for (const { system } of manifestServices) {
      Client.createService(system.connectionData); // connection data already known, no re-probe
    }
  } catch {}
}
```

systemlynx caches service handles internally. A minimal `connectedUrls` Set tracks which service URLs the CLI has handles on (from manifest at startup + any `connect` calls during the session) — just enough for `list` to annotate connection status.

`manifestServices` and `connectedUrls` are passed to commands that need them. `list` queries the UI server for the full project registry and uses `connectedUrls` for the connection indicator.

Remove `manifest: flags.manifest` from all downstream command calls.

### 2. `cli/connectService.js` — No writes; probe and register

New flow:
1. `Client.loadService(url)` → service handle (fresh probe, no prior connection data)
2. If plugin present: call `Plugin.getManifest()` → get `projectCode` + all project services → upsert + notify UI for each
3. If plugin absent (or `getManifest()` returns null): store under `projectCode: "connected-services"` + notify UI

`connect <url>` = handle on one service. `connect <url> --manifest` = load the full project. Both start with the same probe step.

`connect` (no args) = connect to every service stored in the UI server.

Remove: `writeManifest()`, `readManifest()`, all `fs.writeFileSync` / manifest write paths.

### 3. Explicit manifest + disconnect commands (`cli/manifest.js`)

- **`manifest save`** — writes the services the CLI currently has handles on to `systemview.manifest.json` (explicit opt-in persistence)
- **`manifest clean`** — re-probes all entries, removes stale ones, rewrites the file
- **`disconnect <projectCode|namespace> [serviceId]`** — removes a project or a specific service from both the CLI session and the UI store. Supports namespace targeting. Granular — doesn't force wiping a whole project for one stale service.

Plugin still auto-writes its own entry at startup. These commands are for explicit CLI-driven management only.

### 4. `systemview-plugin/SystemViewModule.js` — Add `getManifest()`

```js
this.getManifest = () => {
  const manifestFile = path.join(process.cwd(), 'systemview.manifest.json');
  try { return JSON.parse(fs.readFileSync(manifestFile, 'utf8')); }
  catch { return null; }
};
```

`getConnection()` stays — single-service registration, used by UI and other consumers. `getManifest()` is additive — project-level, all services:
- `getConnection()` → `{ projectCode, serviceId, system, specList }` for this one service
- `getManifest()` → `{ projectCode, services: [...] }` for the whole project

### 5. `cli/logs.js`, `cli/runTests.js` — Use startup manifest services

Replace local `readManifest()` calls with the `manifestServices` array passed from `cli/index.js` at startup. Remove `readManifest` functions and manifest-only `fs`/`path` imports. Service handles come from `Client.createService(system.connectionData)` — connection data is already in the manifest, no re-probe needed.

### 6. `cli/listTests.js` — Query UI server instead of local manifest

`list` calls the UI server's `getServices()` to get all stored projects. Annotates output with which ones the CLI is currently connected to (cross-reference with `connectedUrls`). Remove local manifest fallback.

### 7. UI — Show connected projects without search + fix connect input

**`src/organisms/SystemNavigator/SystemNavigator.js`**:
- On mount, fetch all stored projects from the UI server (no search required)
- Display as a project list — expand a project to see its services and their connection status
- Delete at both levels: delete an entire project OR delete an individual service within a project (important for `connected-services` where only some entries may be stale)
- Filter/search input remains for large lists, but default view is the full list

**`api/index.js` — fix `connect()` / `getConnectionData()`**:
- If `Plugin` module present: call `Plugin.getConnection()` → real `{ projectCode, serviceId, specList }`
- If not: wrap with `projectCode: "connected-services"`, generic `serviceId`
- Upsert into `ConnectedServices` with real data

---

## Format note

**Manifest format wins.** The manifest includes `specList`, which is what enables `list` to show tests and docs. The UI's `connections.json` entries should adopt the manifest's service entry shape: `{ projectCode, serviceId, system, specList }`. Drop the root-level `modules`/`routing`/`services` duplicates from `connections.json` — verify `ConnectedServices` and UI components only read from `system.*` before removing.

The goal is net code removal. Once the format is unified, translation layers and special-case paths disappear. Look for things to delete, not add.

---

## Verification

1. Start test service → plugin writes manifest, notifies UI server
2. `node cli test` — tests run from manifest loaded at startup
3. `node cli logs` — streaming from startup-loaded connections
4. `node cli list` — queries UI server, shows all projects + which are actively connected
5. Interactive: `connect http://localhost:4001` → `list` shows new service; no manifest write
6. `connect http://remote-url --manifest` → `Plugin.getManifest()` → all project services added; UI notified
7. `connect http://raw-service` (no plugin) → stored under `connected-services`; `probe` works
8. Open UI → projects listed without typing; expand project → see services + status; delete at project or service level
