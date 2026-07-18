# Session identity is lost across services — the cookie must ride EVERY service origin

A SystemLynx project is **many services on many origins** (e.g. buAPI: `127.0.0.1:4000/4100/4900/5100`)
sharing **one** session store — a single sessions collection + one secret. The login cookie
(`connect.sid`) is **host-only** and valid on *every* service. So identity only works if a client sends
that one cookie to **all** the service origins. A signup happens on one service (Profiles); the very
next call may hit another (Media). If the cookie doesn't follow, the second service sees no user and
403s (`Unauthorized access to profile`).

**Both SystemView clients get this wrong today — the CLI and the browser UI.** (The native app gets it
right; see below.) So this is not "CLI broken, UI fine" — the UI fails too.

## The reference that works: the native app

`buApp/HttpClient.js` (React Native) does NOT rely on browser cookie rules. It stores **one** cookie in
`AsyncStorage` and attaches it to **every** request, regardless of URL:

```js
const cookie = await AsyncStorage.getItem("cookie");   // one jar, not per-origin
if (cookie) headers["Cookies"] = cookie[0];
...
const setCookie = res.headers["set-cookie"];
if (setCookie) await AsyncStorage.setItem("cookie", JSON.stringify(setCookie));
```

One cookie, replayed to all origins. That's why identity follows the user across every service. This is
the behavior both SystemView clients need.

## Bug 1 — CLI keys cookies per-origin, so they never cross services

`cli/manifestHeaders.js`: `captureCookie` stores under `store[originOf(url)].Cookie`, and `headersFor`
reads `headers[originOf(url)]`, where `originOf = new URL(url).origin` — **which includes the port**.

- Signup on `http://127.0.0.1:4100` (Profiles) → cookie stored under the `:4100` bucket.
- Next call to `http://127.0.0.1:4000` (Media) → `headersFor` looks up the `:4000` bucket → **no cookie**
  → Media has no user → 403.

The session store is shared, so the `:4100` cookie *would* resolve on `:4000` if it were sent — it just
never is. **Fix:** the login cookie is host-only, so replay a captured `Set-Cookie` to **every
same-host origin** (all ports on `127.0.0.1`), the way a browser sends a host-only cookie and the way
the native app sends its one jar — not strictly per `host:port`.

## Bug 2 — browser UI can't carry a cross-origin cookie over http

`src/systemClient.js` uses `axios({ withCredentials: true })` and relies on the **browser** to send the
cookie. That defers to browser cookie policy, which over **http** cannot do cross-origin sessions:

- A cross-origin cookie must be `SameSite=None; Secure` — and `Secure` requires **HTTPS**. Over http the
  browser refuses to store/send it.
- So over http the cookie degrades to `SameSite=Lax`, which the browser will **not** send on cross-site
  subrequests (fetch/XHR). If the UI origin and the service origins aren't same-site (different host such
  as `localhost` vs `127.0.0.1`, or genuinely cross-site), the cookie is dropped and identity is lost —
  exactly the CLI symptom, different mechanism.

`withCredentials: true` (already added — the earlier gap) is necessary but **not sufficient**; the
transport/origin layout defeats it over http.

## Fix direction

- **CLI:** replay the host-only session cookie across all same-host service origins (mirror the native
  app's single-jar behavior), instead of isolating by `host:port`.
- **UI:** over http, cross-origin sessions are a browser dead end — needs **HTTPS** (`SameSite=None;
  Secure`).
- **Robust fix that resolves both at once:** put all services behind **one origin** (a reverse proxy /
  single gateway). Then every call is same-origin, the cookie is trivially shared, the CLI's per-origin
  keying stops mattering, and the browser's cross-site rules never trigger. This is the durable answer
  for a multi-service project that authenticates with one shared session.

## buAPI side (for reference — already correct)

buAPI issues a host-only `connect.sid` valid across all its services, and (fixed) sets it over http in
dev (`secure`/`SameSite=None` are tied to actually serving https, else `secure:false`/`SameSite=Lax` so
the cookie is emitted at all). Nothing more is needed server-side; the gap is entirely in how the
clients replay the cookie across origins.
