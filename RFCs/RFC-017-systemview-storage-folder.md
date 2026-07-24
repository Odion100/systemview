# RFC-017: `.systemview/` storage folder — per-service manifest + relocate everything else

**Status:** IMPLEMENTED + tested (full dogfood suite green, 45/46 — the 1 is the intentional `Math.subtract` demo). Everything SystemView writes now lives under `.systemview/`; the project cwd stays clean. Awaiting approval to commit + publish.
**Packages affected:** `systemview-plugin` (writers + `getManifest`) and `systemview` (CLI + api readers). Republish together.
**No backwards compatibility.** Plugin + CLI + UI are one internal ecosystem, versioned and deployed together — there's nothing external reading these files. We move them and update every reader in lockstep. No legacy fallback.

## The bug that started this (root cause, proven)

On the deployed buAPI box, services wedge on boot under `systemview-plugin` 2.4.0. Cause: **N separate OS processes read-modify-write the ONE shared `systemview.manifest.json`** on every service's `ready` — they each read, add their own entry, write it back, so concurrent writers clobber each other and a reader can catch a torn file mid-write.

Why it hid: the dogfood harness runs the test services in **one** process, so those writes serialize ("no clobber"). Five separate deployed processes don't. 2.4.0 is what made every plugin write the file unconditionally (2.3.0 only wrote it behind a hub connection, absent on the deploy), introducing both the write and the race there.

Kept from 2.4.1: the manifest entry persists only `system: { connectionData }`, never the live `system` (live module instances + socket-backed clients whose getters can block `JSON.stringify`). Correct, but it did not remove the race — two processes still fought over one file. Per-service files do.

## Decision

Everything SystemView writes into the observed project moves under a single **`.systemview/`** folder. The **manifest** gets a real reorganization (per-service files) because that's the race fix; **everything else is relocated as-is** — same shapes, just a new path. We are not redesigning logs/stats/session, only moving them.

Layout:

```
.systemview/
  Profiles.manifest.json      ← plugin, per-service (its OWN file only — the race fix)
  Basketball.manifest.json
  …
  manifest.json               ← combined view, materialized by the CLI/UI (single writer) — holds cookies + "everything together"
  Profiles.stats.json         ← plugin, per-service (already per-service today; relocated as-is)
  Basketball.stats.json
  systemview.logs             ← plugin, shared NDJSON (relocated as-is; unchanged behavior)
  session.json                ← CLI, cookies + RFC-016 session policy (relocated as-is)
```

`serviceId` is the explicit per-file key for the manifest — never implicit. Plugin has it from config; CLI derives it on connect via `serviceIdFromRoute`, or you set it with a flag (below).

## How the manifest works now

1. **Plugin writes its own file** → `.systemview/<serviceId>.manifest.json` = `{ projectCode, serviceId, system:{connectionData}, specList, credentials }`. Its own file only — no read of siblings, no shared array. **Race gone by construction.**
2. **`getManifest()` puts the folder together AND saves it** ([SystemViewModule.js:115](../systemview-plugin/SystemViewModule.js#L115)): globs `.systemview/*.manifest.json`, composes the whole project, **writes the assembled `.systemview/manifest.json`, and returns it**. Siblings share a cwd, so one call returns the whole project — works with **no hub on the box** (the shared cwd is the aggregator). This is safe to save because it's invoked **on-demand by a single caller** (a CLI/UI request), not by the 5 plugins stampeding at boot — that boot stampede was the race, and it's gone because the plugins only write their own per-service files. "When it gets the manifest, it writes it as a manifest" — the getter materializes it.
3. **Both files exist, same shape as today.** Per-service files (`<serviceId>.manifest.json`) are the source of truth the plugins write; the combined `.systemview/manifest.json` is the assembled view (services + headers + session), byte-for-byte the shape of today's `systemview.manifest.json` so nothing downstream can tell the source changed. The CLI can also assemble+save it (same logic) — both `getManifest` and the CLI read the folder and put it together.

## Relocate everything else — DONE (as-is, no reorganization)

- **Stats** ✓ → `.systemview/systemview.stats.<serviceId>.json` (plugin `statsFile` resolves under `SV_DIR`). Already per-service; read only by the plugin's own `getStats`.
- **Logs** ✓ → `.systemview/systemview.logs` (plugin `LOG_FILE` under `SV_DIR`; `SystemViewModule.getLog` reads there). Kept as the shared NDJSON file (not split per-service — that's an optional later reorg).
- **Cookies/session** ✓ → `.systemview/session.json` (`manifestHeaders.js` default repointed; write paths `mkdir -p` the folder). RFC-016 session lifecycle still green.
- **Config** ✓ — plugin gained one `dir` option (default `.systemview`) → `SV_DIR`.

## Readers updated (systemview package) — DONE

- `loadManifest` ✓ globs `.systemview/*.manifest.json` (or a combined file via `--manifest <path>`).
- `manifest clean` ✓ re-probes each per-service file and **unlinks** stale ones (`cli/manifestStore.js` `removeServiceFile`).
- `connect --manifest` ✓ unchanged call path — `svc.Plugin.getManifest()`, now folder-backed.
- `manifest save` ✓ materializes `.systemview/manifest.json` (single writer).
- `manifestHeaders.load()` ✓ **merges** the config-header defaults from the per-service files with the session store (cookies win). `connect --save` ✓ calls `manifestHeaders.persist()` so a cookie captured during the authed `getManifest` pull lands in `session.json` for the next process.

## What this required (non-obvious)

- Config-header **defaults** moved out of the shared manifest into each per-service file's `entry.headers`. So `manifestHeaders.load()` had to start merging folder headers + `session.json` (cookies win) — otherwise `testtoken`/`Origin` stopped attaching.
- `connect --save` writes the services snapshot to `.systemview/manifest.json` but the **cookie** must go to `.systemview/session.json` (where the next probe reads it) — hence the explicit `persist()` after save. The two used to be one file.
- Test fixture updated: `test/service/gated/index.js` seeds its `testtoken` `@file` into `.systemview/session.json` (was the old cwd manifest).

## Not done (deliberately deferred)

- **CLI connect identity flags** `--project <code>` / `--service <id>` — separable enhancement, not part of this migration.
- Splitting `systemview.logs` into per-service log files.

## Rollout

1. ✓ Plugin: per-service manifest write + folder-globbing `getManifest`; stats + logs under `SV_DIR`; `dir` option.
2. ✓ systemview: folder-aware `loadManifest` / `clean` / `manifest save`; `manifestHeaders` → `session.json` + folder-defaults merge; `connect --save` persists the cookie.
3. ✓ Dogfood harness + `CLI.manifest.json` fixture; gated fixture reseeds `testtoken`.
4. **Pending approval** → then republish `systemview-plugin` + `systemview` together; `.gitignore` already has `.systemview/`.
```
