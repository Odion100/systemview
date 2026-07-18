# CLI Test Plan

Coverage plan for testing the SystemView CLI **through saved tests in the UI**, using the
`CLI` test-harness module that shells out to the real `systemview` binary. Organized by the CLI
surface (every command + flag from `systemview help`) so we close the holes systematically.

Change CLI code → run the relevant fixture(s) → instant pass/fail on real CLI behavior.

---

## Approach (proven)

- `test/service/CLI/index.js` runs the real CLI as a child process (`process.execPath cli/index.js …`),
  isolated from the service's own state, `exclude`d from trace noise.
- Fixtures call `CLI.*` methods and validate `exitCode` / parsed `result` / `stdout` via
  `savedEvaluations` — same pattern as every other saved test.
- **Proven:** `CLI.probe.json` → real `systemview probe … --json` → `@file` header attaches and
  reaches the service. Green.

## Harness methods

| Method | Returns | Status |
|---|---|---|
| `CLI.run({ args })` | `{ exitCode, stdout, stderr }` — generic, any command | ✅ |
| `CLI.probe({ namespace, args })` | `{ exitCode, result }` — parses `probe --json` | ✅ |
| `CLI.test({ project, namespace, flags })` | parse `test --json` | ☐ add |
| `CLI.list(...)`, `CLI.logs(...)` | parse `--json` | ☐ add |
| `runUntil` / spawn-and-kill (timeout) | for streaming/interactive commands | ☐ add |

**Testability tiers:**
- **A — clean** (one-shot, `--json`): `probe`, `test`, `list`, `logs --current --json`, `connect`, `manifest`. Assert on parsed output + exit code.
- **B — output-scrape** (no `--json`): assert on `stdout` substrings + exit code.
- **C — special** (long-running / interactive): `logs --follow`, `start`, `open`, interactive `manifest save`. Need spawn-and-kill w/ timeout, or drive via a different port; some (`open`) only assert "exits cleanly."

---

## Findings — bugs the suite has already caught

1. **`probeHeaders`/`Origin` dropped** *(Phase 1 regression, surfaced by #1 no-arg probe)* — the project
   `Origin` header stopped being sent. Was patched by making `probeHeaders` a project-default layer —
   but **`probeHeaders` has since been removed entirely** (see #5): the plugin no longer sets any
   headers; `Origin` is now authored in the `headers` section like any other header.
2. **Large `--json` truncated when piped** *(surfaced by #3 list)* — `process.exit()` cut output at
   ~8 KB for pipe stdout (agents/CI — the `--json` audience). `list --json` lost ~85% of its output.
   **Fixed:** `flushAndExit` drains stdout before exit (`cli/index.js`).
3. **`--header` lost to the manifest header of the same name** *(surfaced by the #1/#6 precedence test)* —
   in `cli/cookieClient.js` the `request` path spread `headersFor(url)` (manifest) *after* the caller's
   `setHeaders`/`--header` values, so the manifest silently won — the reverse of the documented
   precedence. (The `upload` path already had the correct order — the two were inconsistent.)
   **Fixed:** reordered to `{ ...headersFor(url), ...headers, ...extraHeaders }` so an explicit
   `--header` overrides the manifest. Regression-locked in `CLI.probe.json`.
4. **`manifest save` was dead — and `connect --save` didn't exist** *(surfaced by "is save tested?")* —
   the whole RFC-010 gated-remote workflow (`connect <url> --manifest --save` → persist the connection so
   the session cookie is reused) was unfinished. `save()` was correct but **both call sites passed
   `undefined` services** (`cli/index.js` one-shot just warned; `startLineReader` passed `undefined`), so
   it always hit the "No services in session" guard and wrote nothing. And `connect` never handled
   `--save`. **Fixed:** wired `--save` into `connect` (feeds `save()` the connected services).
   Regression-locked in `CLI.run.json` (connect+save persists headers **and** the captured cookie; a
   cold `probe` then reuses the cookie with no `--header`).
5. **`probeHeaders` swept — the plugin was setting headers it had no business setting** *(surfaced by
   "why does the plugin write headers at all?")* — the plugin auto-wrote `manifest.probeHeaders =
   { Origin }` on startup (a leftover from a buAPI dev-session hack), and the CLI applied it as a
   hidden project-level default. SystemView should *forward* headers, never *mint* them. **Fixed:**
   removed the plugin write and the CLI `defaults` path; `headers` (URL-indexed, operator-authored) is
   now the single header store. The test seed authors `Origin` itself — the honest path. *(Plugin change
   ⇒ `systemview-plugin` needs republishing before buAPI etc. see it.)*

Open (flagged, not yet fixed):
- `logs --json` prints a human banner alongside the NDJSON.
- `--manifest <path>` selects *services* from the given file, but `manifestHeaders.js` hardcodes the
  default `systemview.manifest.json` for the *header* source — so `--manifest` wouldn't redirect headers.

---

## Categories

### 1. `probe` — ad-hoc method calls  (tier A)
- [x] attaches manifest `@file` header, reaches service  *(CLI.probe.json)*
- [x] object arg → correct result
- [x] multi-arg (JSON array) spread positionally  *(String.concat ["foo","bar"] → "foobar")*
- [x] no-arg method
- [x] `--json` output shape (`serviceId/moduleName/methodName/args/result`)
- [x] `--header` overrides manifest header for same name  *(BUG #3 — regression-locked)*
- [~] cookie captured → re-sent: **in-process** round-trip covered by `Auth.getSession.json`
  (`signIn` sets Set-Cookie → `cookieClient` captures → `getSession` sees it). Across *separate* `probe`
  processes it does **not** persist (by design — needs `manifest save`; tier-C).
- [ ] `--manifest <path>` uses the given manifest — *deferred: `probe` is UI-first so this only bites
  when the UI is down; also `manifestHeaders.js` hardcodes the default manifest path, so `--manifest`
  wouldn't redirect the header source. **Flagged** (header-source reconciliation).*
- [x] unknown service / bad namespace → error + **exit 1**  *(both cases)*

### 2. `test` — saved-test runner  (tier A)
- [x] all pass → exit **0**; a failed evaluation → exit **1**  *(CLI.test.json — failure demo → exit 1, `failed:1`)*
- [x] namespace filter (`Module.method` exercised)
- [x] `--json` output shape (`projectCode` + `passed`/`failed` counts asserted)
- [~] `--dry-run` ✓, `--skip` ✓ *(skips failure demo → green)*, `--bail` ✓ *(exit 1 on failure)* — `--verbose`, `--phase`, `--index` remain
- [x] deliberate failure demo reports correctly *(the evaluation-mismatch path)*

> **The failure demo stays — it's load-bearing.** `Math.subtract`'s "expects 99" test is a failed
> *evaluation* on purpose, and it does double duty: (1) proves the evaluator flags a wrong answer, and
> (2) is the **failure that `--bail` and "exit 1 on failure" test against** — you can't test "stop on
> failure" / "exit 1 on failure" without a failure to react to. So the suite reading "39 passed,
> **1 failed**" is correct: that 1 is the machinery working.
>
> **The only real open item is reporting** — a red "1 failed" *looks* like a regression when it's an
> expected failure. A later (UI/summary) feature could mark a test **expected-to-fail** so it reads
> "39 passed · 1 expected-fail ✓". That does **not** mean removing the failure.

> **Two fixtures are CLI-only and WILL fail in the UI (by design):** `Headers.echo` (manifest `@file`
> `testtoken`) and `Auth.getSession` (cookie carry). Both rely on **CLI-only** injection —
> `cli/cookieClient.js` + `cli/manifestHeaders.js` read the manifest off disk and hand-roll a cookie
> jar. The **browser can't**: no filesystem to read an `@file` token, and cross-origin (`:3000`→`:5555`)
> `HttpOnly` cookies aren't sent without `withCredentials`+CORS. So they pass in CLI, fail in UI — not a
> bug in the payload. Open decision: mark them CLI-context / move to a CLI-only grouping, or add
> `withCredentials`+CORS to make the cookie one browser-valid (the token one can never be browser-valid).

### 3. `list` — inventory  (tier A/B)
- [x] `list <project>` ✓; **all-projects** (object keyed by projectCode, via stdout) ✓; **namespace filter** (Math tests only) ✓
- [ ] `--verbose` expands hierarchy  *(human tree output — tier-B / `run` scrape, todo)*
- [x] `--json` shape

### 4. `logs` — read / stream  (tier A + C)
- [x] `logs <project>` recent entries  *(via --current)*
- [x] `--level` ✓ *(log-level only, traces excluded)*, `--limit` ✓ *(tail N)*, `--current` ✓
- [~] `--filter field=value` ✓, `has=` ✓ — `missing=`, `--or` remain
- [ ] `--include <field>` extra column  *(human column — tier-B)*
- [x] `--json` shape  *(per-entry NDJSON fields validated)*
- [x] `clearLog` wipes the store  *(exercised in every logs-fixture `Before`)* — standalone `flush` command still todo
- [ ] `--follow` streams a new entry then stops *(tier C: spawn-and-kill)*
- [ ] `--save` / `--saved` / `--save-limit` snapshot round-trip

### 5. connection lifecycle — `connect` / `disconnect` / `manifest`  (tier A/B)  — **content-asserted via `isLike` on stdout**
- [x] `connect <url>` registers a service  *(stdout `isLike` "connected-services")*
- [x] `connect <url> --manifest` uses real projectCode  *(stdout `isLike` "Plugin manifest found: systemview-test" — **the RFC-010 remote-pull flow**)*
- [x] `disconnect <project> [serviceId]` removes from store  *(stdout `isLike` "Disconnected: connected-services")*
- [x] `manifest clean` drops stale entries, keeps live  *(stdout `isLike` "Manifest cleaned" + "TestService")*
- [x] **`connect <url> --manifest --save`** persists the connection — services + headers + captured
  cookie *(CLI.run.json — save confirmation `isLike` "cookies for 1 origin", then cold `probe` reuses it)*
- [ ] `connect <projectCode>` reconnects stored; `connect` (all); `--force`
- [ ] `manifest save` (standalone, one-shot) — still needs its own wiring/fixture *(the connect `--save`
  path is what's tested; standalone `manifest save` one-shot still just warns)*

> **The RFC-010 gated-remote workflow is now closed AND proven end-to-end:** `connect <url> --manifest --save`
> (CLI.run.json) grabs the remote plugin's manifest, connects under its real projectCode, and the
> authenticated manifest pull returns a session cookie that `--save` persists into the local manifest
> (alongside the `@file` token header). A **cold `probe` in a fresh process then reuses that cookie with
> no `--header`** — the exact "author token → connect → save → reuse session" loop the RFC set out to close.

### 6. headers / auth  (tier A) — the new surface
- [x] `@file` header reaches the service  *(shared with #1)*
- [ ] literal header value reaches the service
- [x] `--header` > manifest header precedence  *(BUG #3 — CLI.probe.json)*
- [ ] project-level vs service-level cascade  *(after the cascade is built — extra credit)*
- [~] cookie: capture → re-send covered in-process (`Auth.getSession.json`); persists-on-`save` is tier-C
- [ ] secret stays out of the manifest (save writes the `@file` pointer, not the value)

### 7. meta / lifecycle  (tier B/C)
- [x] `--version` exits 0  *(CLI.run.json — stdout assertion omitted: "2.2.5" mis-types as a `date`, the moment gotcha)*
- [x] `help` prints usage  *(stdout `isLike` "SystemView")*
- [ ] `shutdown [port]` stops an instance *(tier C: needs a throwaway instance on another port)*
- [ ] `start` / attach *(tier C: long-running; assert it binds + attaches on a spare port)*
- [ ] `open` *(tier C: assert exits cleanly; no real browser in CI)*

### 8. error handling / exit codes  (tier A/B) — cross-cutting
- [x] bad namespace format (2-part) → exit 1  *(CLI.probe.json)*
- [x] unknown service → exit 1  *(CLI.probe.json)*; unknown **method** on a real service → error + exit 1  *(CLI.run.json)*
- [ ] offline target service → handled gracefully
- [~] malformed JSON args → **handled by design**: `probe` falls back to treating the raw string as a
  single arg (no throw, exit 0) — not an error path. *(worth an explicit fixture documenting that)*

### 9. namespace resolution + case toggle  (tier A)
- [x] `toggle cs` → stdout `isLike` "case-SENSITIVE"; `toggle ci` → "case-insensitive"  *(CLI.toggle.json)*
- [x] dash form `toggle --cs` (leading dashes stripped) flips it  *(CLI.toggle.json)*
- [x] bare `toggle` flips from the baseline  *(CLI.toggle.json)*; every case resets to insensitive in `After`
- [ ] resolution behavior: `list <service>` / `test <Module.method>` with no projectCode returns the right
  set, and case-sensitive mode makes a lowercase dotted arg stop matching *(verified manually; no fixture yet)*

---

## Build order (suggested)

1. Round out **#1 probe** and **#2 test** first (tier A, highest value, exercise the core).
2. **#6 headers/auth** (mostly reuses `Headers.echo` + seed).
3. **#3 list**, **#4 logs** one-shot (`--current --json`), **#5 connect/manifest**.
4. **#8 error/exit-code** cases woven through the above.
5. **Tier C** last (streaming/interactive) — needs the spawn-and-kill helper and a spare-port instance.

## Notes / reusable pieces

- **⚠ Run the LOCAL CLI, not a published install.** `systemview` must be `npm link`ed to this repo
  (`ls -l $(which systemview)` should resolve to `Systemly/systemview`). A `npm i -g systemview@x`
  silently overwrites the link with the published package, so `systemview test` then exercises stale
  code and header/trace fixtures fail with confusing "regressions" (e.g. `Headers.echo` losing
  `testtoken`). The **CLI harness is safe** — it spawns `process.execPath cli/index.js` from repo cwd,
  always local — but `systemview test <project>` (how you run the whole suite) uses the linked binary.
  If a header/enrichment test regresses, check the link first. Fix: `npm link` in the repo.
- **Header seeding:** the test service self-seeds a manifest `headers` entry (`@file` → `.testtoken`)
  on startup; reuse for any header/auth fixture.
- **`--json` scraping:** `CLI.probe` tolerates a stray banner line before the JSON; give `test`/`logs`
  convenience wrappers the same tolerance.
- **Determinism:** clear logs / re-seed in a fixture `Before` so `getLog`-style assertions know what to expect.
