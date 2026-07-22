# RFC-016 — Persist a probe-captured session across CLI invocations

## The bug

`probe` already **captures** a `Set-Cookie` from a response (`manifestHeaders.captureCookie`), but it
only lands in the module's in-memory `headers` map, which is written back solely by `save` (the
interactive `manifest save` / `connect --save`). So a non-interactive `probe` that signs in captures
the session, then **throws it away when the process exits** — the next `probe` starts with no session
and gets `User authentication failed`.

This contradicts the intended flow ("run a command, it keeps your session"): a sign-in over `probe`
should leave a session the next `probe` reuses. It didn't. The only workaround was to capture the
cookie out-of-band (curl) and hand-write the manifest.

## The fix — an opt-in `session` policy in the manifest

Persistence is a **manifest policy**, set once, not a per-call flag:

```json
"session": { "save": true }
```

- **`probe`** reads the policy after each call; when `session.save` is true and a cookie was captured,
  it writes the header store back into the manifest (guarded by a `_dirty` flag, so read-only probes
  never touch disk). Without the policy — or with no manifest at all — `probe` leaves disk alone. That
  is the safe, backwards-compatible default: existing manifests behave exactly as before.
- **`connect … --save-session`** turns the policy on. Saving is **implied**: if no manifest exists it
  bootstraps a minimal one (`{ "session": { "save": true } }`); if one exists it amends it, preserving
  `services`/`headers`. It does **not** require `--save` — `--save` (persist the connection/services)
  and `--save-session` (the persistence policy) are independent concerns, and the rest of the system
  amends the manifest afterward (`connect --save` adds services, `probe` folds in cookies).

Two orthogonal things stay separate: `--save` is imperative ("persist the connection now");
`session.save` is the ambient policy ("probe keeps the session from now on").

## Not changed

- `save` still persists everything on demand, exactly as before.
- `headersFor` still reads **pure per-origin**, so the browser-facing `getProjects` credentialed
  detection is unaffected.
- The in-memory cross-origin cookie **borrow** in `sessionCookieHeader` is untouched (see Deferred).

## Validation

Verified with the real CLI (`node cli/index.js …`), two fresh processes each — not an in-process
round-trip:

1. **Gated test service** (`:5556`, issues `session=test-session-value`): policy ON → `probe signIn`
   writes the cookie, a separate-process `probe getSession` reads it back; policy OFF → manifest stays
   `{}`, `getSession` returns `""`.
2. **Real buAPI over https** (copied buAPI manifest): `probe Profiles.Users.signIn` (as a mock user)
   persisted a real `connect.sid` under `https://127.0.0.1:4100`, and a brand-new-process
   `probe Profiles.Users.isRecognized` was recognized as that user — no curl, no interactive session.

## Deferred (own decision, not this RFC)

Cross-origin cookie **sharing** (a session captured on one service origin reaching another, e.g. buAPI
Profiles `:4100` → Basketball `:4900`) is left out on purpose. It already has a mechanism (the implicit
`sessionCookieHeader` borrow) and an open proposal (`gaps/SESSION_COOKIE_MUST_RIDE_ALL_SERVICE_ORIGINS.md`,
which argues for automatic host-only replay). Adding a `--share-session` / `scope: project` flag here
would be a third competing mechanism, so it's intentionally not built. Persistence alone covers the
single-origin case; the borrow covers multi-origin today.

## `--manifest <path>` header-source — reconciled

Originally `manifestHeaders.js` hardcoded the cwd `systemview.manifest.json` for the **header/cookie**
store, so `--manifest <path>` redirected service lookup and `persist` but *not* the read-back — a
session saved under a custom manifest silently never rode again. Fixed: `setManifestFile(path)` now
repoints the **whole** store (load + capture + persist + policy) at one path, and `probe` calls it
up front from `--manifest`. So a session persists to and re-attaches from the same manifest, default
or custom. Regression-locked by `CLI.session.json`, which drives the whole flow through an **isolated**
`--manifest` file (dogfooding this exact path).

## Known adjacent issue (flagged, out of scope)

- `probe` prefers a running UI server's service registry over the local manifest ("try UI server
  first"). A UI with a same-named localhost service can shadow a manifest pointed at a remote — needs
  its own disambiguation.
