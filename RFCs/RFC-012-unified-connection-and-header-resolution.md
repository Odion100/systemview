# RFC-012: Unified Connection Format + Header/@file Resolution for the UI

## Context

Two threads converge here, and they should be done together because they touch the same data:

1. **RFC-007 was only half-finished.**
   It unified the _service-entry shape_ (`{ projectCode, serviceId, system, specList }`) across `systemview.manifest.json` and `api/connections.json`, and declared "manifest format wins... translation layers disappear." But `headers` — added later in RFC-010 as a top-level `manifest.headers` section — were never brought into that unified format. They live only in the manifest and are consumed only by the CLI. The two `.json` stores are still two stores.

2. **Headers now need to reach the browser UI.** The UI runs tests, runs logs, and probes **from the browser** via `systemlynx-client` → `Client.createService(connectionData)` (see `src/organisms/TestPanel/components/Test.class.js`, `src/pages/Logs/Logs.js`, `Documentation.js`, `SystemNavigator.js`). Against a gated service those calls need auth headers. The browser has **no filesystem**, so it can't resolve `@file` header pointers — and a relative `@file` path only means anything in the cwd that authored it, which the UI server does not share.

The RFC-010/RFC-011-era work already landed the _foundation_ (committed at v2.3.1): the plugin **carries** operator-authored config headers into the manifest; the CLI and the **UI server** (`api/`) attach `manifest.headers` by origin through the shared `createCookieHttpClient`; a `loadService` helper does `setHeaders` on the browser side (wired at the test path only). This RFC finishes it correctly.

---

## Goals

- One connection format. `headers` become part of the connection record, not a side-channel. Kill the "manifest vs connections.json" split RFC-007 set out to remove.
- The browser can call a **gated** service — every `createService` site attaches resolved header values.
- `@file` secrets resolve correctly regardless of who reads them, **without** baking machine-specific absolute paths into the portable manifest, and **without** writing the secret value into `connections.json`.

## Non-goals

- Changing the on-the-wire manifest authoring UX (`@file` relative pointers stay the way operators write them today).
- Browser-side `@file` resolution (impossible — no filesystem; resolution stays server-side).
- Cross-machine remote gating beyond what RFC-010 already covers.

---

## The `@file` resolution rule (the load-bearing decision)

An `@file` pointer like `@./.secrets/token` is only meaningful in the cwd that authored it. Three parties may need the value: the **CLI** (its own cwd — fine today), the **plugin** (the service cwd — fine today), and **SystemView / the UI server** (cwd not guaranteed, and it receives connections by _push_, not by reading a local manifest).

Rule:

- **Relative stays in the manifest.** `systemview.manifest.json` keeps `@./relative` pointers — the manifest remains portable across machines/dirs, exactly as it works now. The CLI and plugin resolve them against their own (correct) cwd.
- **Absolute only crosses to SystemView.** At the boundary where the CLI/plugin **push a connection** to the UI server, they resolve `@./relative` → `@/abs/path` using _their_ cwd (where the path is valid). `connections.json` is already machine-local, so an absolute path there costs nothing and is portable-agnostic.
- **The secret stays in the file; the UI gets the value.** SystemView stores the **absolute `@file` reference** on the connection (never the secret value in `connections.json`). It reads the file server-side and feeds the **resolved value** to the browser via `getProjects`. The browser only ever sees values, and only in memory.

Flow: `@./token` (manifest, relative, portable) → CLI/plugin resolve to `@/Users/.../token` when pushing `connect()` → SystemView stores the abs ref in `connections.json` → `getProjects` derefs to the value → browser `setHeaders(values)`.

---

## Design

### 1. Headers become part of the connection record (finish RFC-007)

- The connect payload (`SystemView.connect(...)` from both the plugin and the CLI push) gains a `headers` field: the origin's resolved-to-absolute header map (`@file` → `@/abs`, literals as-is, captured cookies as literal values).
- `api/Connections.js` persists `headers` on each connection entry in `connections.json`. Refresh (`refreshConnections` → `Plugin.getConnection()`) must **preserve** existing `headers` — `getConnection()` does not return them, so refresh must not clobber them.
- `connections.json` entry shape becomes `{ projectCode, serviceId, system, specList, headers }` — the manifest's shape plus the resolved header ref. This is the single connection format RFC-007 wanted.

### 2. The UI server stops depending on a cwd manifest

- Replace the current `getProjects` behavior (calls `headersFor()` which reads `process.cwd()/systemview.manifest.json` and derefs against the api server's cwd — fragile) with: **read `headers` off the stored connection**, deref any `@/abs` `@file` to its value there, and include the values in the `getProjects` payload.
- The api server may still _read/write the manifest_ where it genuinely helps (e.g. a UI-driven `connect` that wants to seed a local manifest), but header **resolution for the UI** comes from the connection record, not an assumed local manifest.

### 3. Browser consumption (finish the wiring)

- The `loadService` helper (`src/utils/loadService.js`) is already in place and used at the test path. Finish wiring it at every remaining `createService` site so all browser-run traffic carries headers:
  - `src/pages/Logs/Logs.js` (log fetch, monitor subscribe, clear) — `t.headers` / `s.headers`
  - `src/organisms/TestPanel/TestPanel.js` (probe) — `serviceData.headers`
  - `src/organisms/Documentation/Documentation.js` (docs + plugin) — `serviceData.headers` / `service.headers`
  - `src/organisms/SystemNavigator/SystemNavigator.js` — `serviceData.headers`
- Each service entry already carries `.headers` (values) once §2 lands, because they come from `getProjects`.

### 4. Resolve-to-absolute helper

- Add a small resolver used at push time: given the manifest `headers[origin]` map and a base cwd, rewrite `@./rel` → `@/abs` (leave literals and already-absolute pointers alone).
- **Package boundary:** the CLI and the plugin are **separate npm packages**. The plugin cannot import from the `systemview` CLI — when a service installs `systemview-plugin`, there is no sibling `cli/`. So the resolver must exist **in both packages** (a small duplicated helper), or be extracted into a tiny shared published util both depend on. Duplication of ~10 lines is the pragmatic default; do not design it as "one file in `cli/`."
- `deref()` in `manifestHeaders.js` already resolves `@abs` correctly (it does `path.resolve(cwd, rel)`, and `path.resolve` returns an absolute path unchanged). Confirm and keep one deref **per package**.

---

## Migration / order of work

1. Resolve-to-absolute helper + confirm `deref` handles `@/abs`.
2. Plugin push: include resolved-to-absolute `headers` in `connect()`.
3. CLI push: include resolved-to-absolute `headers` on `connect`.
4. `api/`: persist `headers` on the connection; preserve on refresh; `getProjects` derefs abs `@file` → value and feeds the browser. Remove the `headersFor(cwd-manifest)` call from `getProjects`.
5. Browser: finish `loadService` wiring at the remaining `createService` sites.
6. Rebuild UI; bump version.

Keep the api server's outbound header client (RFC-010 work) — it still carries headers for the server's own probe/`getConnection`/refresh calls to gated services.

## Packaging / release

This feature spans **both** published packages — `systemview` (CLI + api + UI) and `systemview-plugin` — so both must ship for the end-to-end flow to work:

- The plugin side (push resolved-to-absolute `headers` in `connect()`, plus its own copy of the resolver) → **`systemview-plugin`** publish.
- The CLI/api/UI side (persist + deref + browser wiring + rebuild) → **`systemview`** publish.
- Each half is backward-compatible with the other's old version (old api ignores unknown `headers`; new api tolerates a plugin that sends none), so publish order doesn't matter — but the gated flow only goes live once **both are published and the consuming service (e.g. buAPI) upgrades its `systemview-plugin`**. Publishing does not push anything to consumers; they pull on upgrade.

---

## Verification

1. Gated test service (require a header, e.g. Origin) with an `@file` token in the manifest.
2. Start service → plugin pushes connection **with absolute `@file` headers**; `connections.json` shows the abs ref, **not** the secret value.
3. UI server `getProjects` returns the resolved **value** for that origin (not the `@file` ref).
4. Browser: run a test, run logs, probe, open docs against the gated service — all succeed (headers attached via `setHeaders`).
5. Move the CLI/api server to a different cwd than the service → the UI still resolves headers (proves the absolute-path fix; relative-cwd assumption is gone).
6. Manifest on disk still has the **relative** `@./` pointer (portability preserved).
7. CLI suite stays green (the intentional `Math.subtract` failure demo remains the only expected failure).

---

## Open questions

- Do we also collapse `connections.json` into literally the manifest shape end-to-end (single reader for both), or keep two files that now share one _format_? RFC-007 leaned "manifest format wins"; this RFC brings headers into that format but stops short of merging the files. Decide whether merging is in scope or a follow-up.
- Cookie capture on the UI-server side: when the api server captures a `Set-Cookie` for a gated origin, should it fold into the connection's `headers` (so the browser reuses the session) the same way the CLI folds into `manifest.headers`? Likely yes; confirm.
