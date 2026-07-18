# RFC-013 — `credentials: true`: cookie-authenticated services in the credential contract

## Problem

The credential contract (see `wiki/cli-headers.md`) marks a service CREDENTIALED — so the browser
sends `withCredentials` to it — **iff it declares a non-empty header profile**. That signal breaks
for services that authenticate with **session cookies only**: they declare no headers at all (that's
the point — sign in, `Set-Cookie`, browser jar does the rest), so they're never marked, every browser
request goes out credential-less, the signIn `Set-Cookie` is **discarded** (a CORS response can't set
a cookie unless the request carried credentials), and every gated call 401s.

Live case: buAPI removed its Internal-Access header config entirely (cookie auth over https,
`SameSite=None; Secure`, reflective CORS + Allow-Credentials on every service). `getProjects` serves
all 5 services with `headers: {}` → `[sv-cred] withCredentials=false` on every call → auth fails in
the browser while the identical flow through the CLI cookie client passes.

Full analysis: `gaps/BROWSER_WITHCREDENTIALS_TIED_TO_HEADERS_BREAKS_COOKIE_AUTH.md`.

## Design

Being credentialed is a property of the **service's CORS posture** (reflects origin + allows
credentials), not of whether it declares token headers. Header profiles remain one way to signal it;
this RFC adds the missing **explicit declaration** for the cookie-only case:

```js
require("systemview-plugin")({ ..., credentials: true })
```

The flag rides the existing registration pipeline end to end. No sniffing, no per-request guessing —
same philosophy as the header-profile rule: marked once, at load time, by declaration.

Plain services are untouched: no flag, no headers → never marked → wildcard CORS keeps working.

## Changes

1. **systemview-plugin/index.js** — accept `credentials = false` in config; include it in the
   `SystemView.connect({ system, projectCode, serviceId, specList, credentials })` push AND in the
   local manifest service entry (`{ serviceId, system, specList, credentials }`).
2. **systemview-plugin/SystemViewModule.js** — thread `credentials` into the module factory so
   `getConnection()` returns it. This keeps the flag alive through `refreshConnections`
   (api/Connections.js re-pulls `Plugin.getConnection()` — without this, a refresh silently drops it).
3. **api/index.js** —
   - `connect(...)`: store `credentials` on the service entry (update + create paths).
   - `getConnectionData(...)`: carry `credentials` through the `getManifest` and `getConnection` paths.
   - `getProjects()`: serve `credentials: !!credentials` per service.
4. **src/utils/loadService.js** — `loadServiceWithHeaders(connectionData, headers, credentials)`:
   mark the origin when the header profile is non-empty (existing rule) **or** `credentials` is true.
5. **src/organisms/SystemNavigator/SystemNavigator.js** — the up-front marking loop marks when
   headers are non-empty **or** `s.credentials`.
6. **Call sites** (TestPanel.js, Test.class.js) pass the service's `credentials` through.

## Out of scope

- Publishing (systemview + systemview-plugin) — flag rides the next release.
- The consumer side (buAPI adds `credentials: true` to its plugin configs; until the plugin
  republish, its installed copy is patched to match this source — same change, temporary bridge).
