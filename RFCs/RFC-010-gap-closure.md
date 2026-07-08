# RFC-010: Gap Closure — CLI Persistent Headers + Trace Enrichment Parity

## Context

Two gaps remain open after the observability layer shipped (`systemview@2.2.5` /
`systemview-plugin@2.2.2`). Both are small, independent, and each blocks a real workflow:

- `gaps/CLI_PERSISTENT_HEADERS_FILE.md` — can't cleanly view logs from an **auth-gated** remote
  project; every CLI call needs `--header` re-pasted, and there's no home for a standing token.
- `gaps/TRACE_ENRICHMENT_END_ONLY.md` — caller-supplied trace context only lands on the `end`
  entry, so **errored** requests and the request's **manual logs** carry none of it — even though
  every request entry already shares a `traceId`.

Two phases, independent — they can land in either order. Phase 2 is trivial and plugin-local; Phase 1
is a CLI-only change riding the manifest it already reads.

---

## Phase 1: Headers in the manifest (URL-indexed, value-or-file)

### Problem

A production project gates its RPC modules (including `SystemView` logs and `Plugin` manifest)
behind auth. The CLI can only present a token via one-off `--header "Name: Value"` on every call —
no persistent home. Minting tokens is the wrong fix — it would couple a generic tool to one project's
auth scheme. The CLI should **consume** a token, never generate one.

### Design

No new file and no new keying scheme — headers live in the **manifest the CLI already reads**. The
manifest is already structured by service URL, so headers ride that structure and are URL-indexed for
free:

- **Home:** a `headers` section in the manifest, indexed by service URL (per-service entry, or a
  top-level `url → { Header: value }` map). On load the CLI selects the headers whose URL matches the
  target service and attaches them.
- **Value or file-pointer:** each header value is a literal (`"Bearer abc"`) or a pointer to a file
  (`"@./token"`). The pointer keeps the **secret out of the manifest** — the token lives in its own
  gitignored file, so the manifest itself stays clean.
- **Cookies are just a header — the jar is migrated in this change.** `systemview.cookies.json` is
  retired. A captured `Set-Cookie` folds into the in-memory `headers` under that URL and re-sends like
  any other header; `save` persists it into the manifest (consistent with read-on-load,
  write-on-`save`). One store, not two.
- **Persisted via `save`.** The CLI reads the manifest on load and writes it only on explicit `save`.
  To keep resending a token to a remote you `save` the manifest (with its `headers`); otherwise you
  pass `--header` each call. `save` must **merge** — preserve the authored `headers` section when it
  writes fetched service data around it.
- **cwd wins.** Launching from a working dir that has a manifest loads that one first, so a project
  folder's manifest (and its headers) naturally overrides.
- **CLI only forwards** whatever it finds; token generation stays the operator's job.

Gated-remote order of operations: because you need the token *before* you can reach a gated remote,
you author the `headers` (or `@file`) for that URL first, then connect and `save` — which merges the
fetched services around your authored headers.

The HTTP path is nearly free: `createCookieHttpClient(extraHeaders)` already spreads `extraHeaders`
into every request ([cli/cookieClient.js:48](../cli/cookieClient.js#L48)). Phase 1 resolves the
URL-matched headers (dereferencing any `@file`) and passes them as `extraHeaders`.

### Out of scope — authed live streaming (deferred to SystemLynx)

The one-shot HTTP calls (`getManifest`, `getLog`, `probe`, `test`) all carry the headers. **Live
streaming** (`--follow` via `SystemView.on("log")`) opens a WebSocket handshake that does not flow
through the HTTP client, and `systemlynx-client` has **no resolved way to carry auth on that handshake
today**. That's an unresolved SystemLynx-side concern — **left open, not addressed here.** Phase 1
delivers authed one-shot log viewing against gated remotes; authed live streaming waits on a future
SystemLynx change.

### What changes

| File | Change |
|---|---|
| `cli/cookieClient.js` | **migrate the cookie jar** — capture `Set-Cookie` into the in-memory manifest `headers` under that URL; retire `systemview.cookies.json`; attach resolved headers as `extraHeaders` |
| `cli/manifest.js` + `cli/index.js` (manifest read) | resolve the `headers` for the target URL; dereference any `@file` pointers |
| `cli/manifest.js` `save` | **merge** — preserve the authored `headers` section (incl. captured cookies), don't clobber it with fetched services |
| `cli/{logs,probe,runTests,connectService}.js` | use the resolved headers via the updated client |
| `.gitignore` | ignore the token/secret files referenced by `@file`; drop `systemview.cookies.json` |
| `docs/cli.md` | document manifest `headers`, value-or-`@file`, `save`-to-persist, cookie-jar retirement |

### What doesn't change

- `--header` still works as a per-call override.
- No new file or store — headers ride the manifest that already exists.
- SystemView forwards headers agnostically; it never mints or interprets a token.

---

## Phase 2: Trace enrichment applies to the whole request (by traceId)

### Problem

The `trace` config accepts a function — `trace: (req) => ({ ...ctx })` — that returns **request-scoped
context** (e.g. `{ user_id: req.session?.user_id }`). Today it enriches the **`end` entry only**.
That's the bug from two angles: an errored request (`start` + `error`, no `end`) gets none of it, and
even on success the context sits on one entry while the request's *other* entries — the `start` trace
and any manual `this.log()` fired in the method — don't carry it. You can't filter "everything request
/ user X did" when only one of a request's entries has the key.

### Design

The context is keyed to the request, and a request is identified across entries by its **`traceId`**.
So it belongs on **every entry carrying that traceId** — the `start` / `end` / `error` auto-traces
**and** any manual `this.log` / `warn` / `error` / `debug` emitted during the request. Evaluate
`traceConfig(req)` **fresh at each entry** (the compute is cheap) and merge its result into that
record. Fresh-per-entry — not cached-once — so each entry reflects `req` at its own moment: a log
emitted after auth carries `user_id` even though the `start` trace, fired before auth, does not.

The only exclusion is out-of-request entries (`traceId: "internal"`, no `req`) — there's nothing to
enrich from.

### What changes

| File | Change |
|---|---|
| `systemview-plugin/index.js` | `svCtx(req)` runs `traceConfig(req)` **fresh at each emit**; threaded via `meta.ctx` and spread in `makeBaseRecord`, so it reaches the `start` / `end` / `error` auto-traces **and** `makeLogger`'s manual-log path — every record carrying the request's traceId |

Guard the `traceConfig(req)` call in try/catch so a throw can't break the hot path.

### What doesn't change

- `traceConfig` signature; `redact` / `exclude` behavior.
- **Superseded:** RFC-009's "trace config applies to auto-traces only" — enrichment is now request-wide.

---

## Open questions

1. **Phase 1 shape** — resolved in Phase 3: service-level (`services[].headers`) is primary, with an
   optional project-level `manifest.headers` default. The shipped flat origin-keyed map already
   delivers service-level attachment.
2. **Phase 2** — `traceConfig(req)` runs fresh per entry (not cached); guard it in try/catch so a
   throw can't break the hot path.

---

## Phase 3: header reconciliation + testing (partly extra-credit)

### `probeHeaders` → unified `headers` (extra credit)

`probeHeaders` is misnamed (`test` uses it too, not just `probe`) and redundant with Phase 1's
`headers`. Fold into one cascade:

- **Project level** — top-level `manifest.headers`, applies to every request. The plugin writes its
  derived `Origin` here (replacing `probeHeaders`).
- **Service level** — `services[].headers`, overrides the project level for that service. Primary,
  always-on level — headers are naturally per-service (set while calling a service).
- Precedence: `--header` > service > project.

The shipped Phase 1 (flat origin-keyed map) already delivers service-level attachment; the
project-level default is the extra-credit add — not load-bearing.

### Setting headers

Author them in the manifest — literal values, or `@file` for secrets (token stays out of the
manifest). The manifest is regenerated each run and gitignored, so this is per-environment config,
not committed. A `systemview header set <service> <name> <value|@file>` command is the obvious future
nicety; for now, hand-authored / seeded at setup.

### Header pass-through test

`Headers.echo` returns `req.headers`. A saved-test fixture seeds a manifest `headers` entry with an
`@file` token, calls `echo`, and asserts the token header arrived — proving an `@file` header reaches
the service. Same `getLog`-style pattern as the enrichment / redaction fixtures.

### CLI test harness (the phase AFTER)

Once the header test is solid: a `CLI` test-service module whose methods **shell out** to
`systemview <command>` (its own port, non-interactive, capturing stdout + exit code) lets every CLI
surface be tested and validated in the UI alongside the rest. Shelling out avoids in-process state
tangling and the reentrancy of calling the CLI from within a registered service. Start by wrapping the
header test; then `probe` / `test` / `save` / `logs` and outward.

## Sequencing

- **Phase 2** — plugin-only, low risk → fold into the next `systemview-plugin` patch.
- **Phase 1** — CLI-only (manifest `headers`) → its own release. Authed live streaming is deferred to
  a later SystemLynx change (see Phase 1 out-of-scope).
- **Phase 3** — header pass-through test first (proves `@file` → service); the unified cascade is
  extra-credit; the comprehensive CLI test harness comes after the header test is solid.
