# RFC-027 — Agnostic services: the CLI-hosted testing service

**Status: BUILT 2026-08-08** (approved same day — verdict set in the Stage report "Agnostic
services — the CLI-hosted testing service", the authoritative design record including the full
discussion). All five build-order steps landed and verified: init→test green in a scratch repo,
live re-host watcher, hostedOp module operations, SystemViewCore converted from `project://`
ghost to a real hosted service (fixture suite 58 tests / 57 green, the 1 red is the intentional
Math.subtract demo). Uncommitted, unpublished.

What SystemViewCore *depicts* — the plum project-defined service — becomes real: for codebases
with **no services**, the CLI hosts one, built from configuration, pointed at a committed folder
of module files. No SystemLynx in the target repo.

## Settled decisions (from the report's threads and questions)

1. **One command: `systemview init`.** No serve verb. It interviews with defaults (enter accepts),
   writes the config, scaffolds the folder, and the hub hosts configured projects as part of its
   own boot.
2. **The committed folder is named by the PROJECT CODE; init's default project name is
   `systemview`** — so the default folder is `systemview/` (explicit, no `.systemview/` adjacency
   confusion), and a renamed project self-labels. Discovery is by registration, never by scanning
   for a name. Layout:
   ```
   <projectCode>/            ← committed, travels with the repo
     service.json            ← { serviceId, port }
     methods/<Module>.js     ← ONE FILE PER MODULE — filename IS the module name
     specs/                  ← scaffolded saved test + docs
   ```
3. **A file per module; the CLI merges the folder.** Each file exports an object; the object IS
   the module — no attach machinery, `require` + serve. The only watcher is require-cache-busting
   so a new function/file appears without a hub restart (convenience, not mechanism).
4. **Default service name `Test`** (init asks; enter accepts). The project name stays the
   namespace root regardless.
5. **The scaffold teaches**: example method + its documentation (service and method level, in the
   interactive vocabulary) + one saved test in specs/ — first `systemview test` is green out of
   the box.
6. **Boot order**: read configs → validate/scaffold → host + register → announce the UI (his
   config-before-UI rule). The plugin's file providers are used as a LIBRARY by the hub — no
   UI-first dependency.
7. **UI**: behaves like any service; plum indicator is the only visual difference. The card shows
   WHERE the config and folders live (quiet, like the service URL). Configuration from the UI =
   rename the one service, add/delete/rename modules — file operations on the folder. Source
   (findMethodLine) works unchanged; any extra affordance is a small icon, later.
8. **Separation of concerns** (his t5 catch): hosting is its own unit the boot triggers —
   discovery (loadManifest) stays pure, both service kinds register through the same `connect()`
   door.

## Implementation map (anchors verified in the report)

- Seam: dynamic registration in `cli/index.js` L47-72 — replace the `project://` ghost path with
  real hosting; split hosting OUT of loadManifest.
- Hosting: `hostProject(projectDir, config)` in the hub — folder → `app.module(basename, require(file))`
  per methods file, + Plugin module = `systemview-plugin/fileProviders.js` pointed at the project
  root (~295 lines reused as-is; the reason this is cheap), `app.startService`, register through
  `api/index.js` `connect` (L25-45).
- UI: module add/delete/rename affordances + visible config paths on the card; rows already render
  project-defined services (`CodebaseNav`).
- Engine: zero changes.
- Cleanup: retire hand-written `project://` manifests; SystemViewCore converts to a hosted service.

## Build order

1. `systemview init` — interview, config, committed folder scaffold (method + docs + saved test).
2. `hostProject` in the hub — folder → modules, providers over the repo, cache-bust on save.
3. Registration through the shared door, plum flag; hosting split out of loadManifest.
4. UI — module operations + visible config paths.
5. Retire `project://` manifests.
