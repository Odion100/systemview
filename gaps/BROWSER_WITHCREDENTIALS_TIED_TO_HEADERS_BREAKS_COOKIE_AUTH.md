# Browser ties `withCredentials` to header profiles — cookie-only services can never authenticate

> **STATUS (2026-07-17): fix implemented as RFC-013** (`RFCs/RFC-013-cookie-credentialed-services.md`)
> — `credentials: true` plugin flag, carried plugin → connect/manifest/getConnection → getProjects →
> browser marking. UI rebuilt. Pending: host restart + browser verification, then move to `resolved/`.

The browser UI decides whether to send credentials by whether a service declared **auth headers**:
`src/utils/loadService.js` calls `markCredentialed(serviceUrl)` only when the service's header profile
is non-empty, and `src/systemClient.js` sends `withCredentials: true` only to marked origins.

That rule is **exactly backwards for cookie-authenticated services**. A service that authenticates
with session cookies (the direction buAPI has now fully moved: sign up / sign in → `connect.sid`,
no token headers at all) declares **no headers** — so the browser sends every request with
`withCredentials: false`, which means:

1. The `Set-Cookie` on the signIn/signUp response is **discarded** (a CORS response can only set a
   cookie if the request itself carried `withCredentials`).
2. Even a cookie the browser somehow holds is **never sent**.

Every gated call 401s ("User authentication failed"). Verified live against buAPI over https:

- `getProjects` serves all 5 buAPI services with correct https connection data and `headers: {}` —
  so nothing is ever marked credentialed. The `[sv-cred]` diagnostic prints
  `withCredentials=false → https://127.0.0.1:...` on every call.
- The same test flow through the CLI (`cli/cookieClient.js`, which always attaches captured cookies)
  passes 8/9 (the 1 failure is an unrelated stale test) — proving the services and the cookie flow
  are fine; only the browser's credential rule blocks it.

## Why "always send credentials" is not the fix

`withCredentials: true` against a plain service with wildcard CORS (`Access-Control-Allow-Origin: *`)
is illegal — the browser blocks the response. That's why the marking exists. The problem is only the
**signal** used to mark.

## Fix direction

"Credentialed" is a property of the **service's CORS setup** (reflects origin + allows credentials),
not of whether it declares token headers. The signal should be an **explicit declaration** instead of
an inference:

- Let the service's `systemview-plugin` registration declare it — e.g. `credentials: true` in the
  plugin config — and carry that flag with the registration through the host (`getProjects`) to the
  browser, which marks the origin credentialed on load.
- Header profiles can keep implying credentialed as they do today; the flag adds the cookie-only case.

buAPI is ready on its side (CORS reflects origin + `credentials: true` on all services) and would add
the flag to its plugin configs as soon as the plugin supports it.
