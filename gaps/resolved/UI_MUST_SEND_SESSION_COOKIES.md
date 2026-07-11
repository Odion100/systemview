# The browser UI isn't configured to send/receive session cookies

When a project authenticates a user with a **session cookie**, the SystemView UI has to be configured
like any browser app that talks to a cross-origin API: send the cookie back on every request and accept
the `Set-Cookie` the server returns. The UI isn't doing that, so a user session never persists — each
call is a fresh, empty session and anything gated on *who the user is* fails.

## What's wrong (browser only — the CLI is fine)

1. **No credentials on the requests.** Cross-origin, a browser only stores and replays cookies when the
   request opts in — `fetch(..., { credentials: "include" })`, `xhr.withCredentials = true`, or
   `axios({ withCredentials: true })`. Without it the browser ignores the server's `Set-Cookie` and
   sends no cookie back, so the session id is lost between calls.
2. **The cookie is `Secure` + `SameSite=None`.** Such a cookie only rides **HTTPS**. Over `http://` the
   browser drops it. So the UI must reach the service over HTTPS (or the project relaxes those flags in
   dev).

The server side is already correct: CORS allows credentials (`credentials: true` with the origin
reflected, not `*`), so this is purely a UI-client configuration fix.

## Fix

- Set credentials on **every** request the UI makes to the service (`credentials: "include"` /
  `withCredentials: true`), including the websocket connect for the log stream — not just HTTP calls.
- Serve/consume over a transport where a `Secure`/`SameSite=None` cookie is valid (HTTPS).

With that, the UI carries a real per-user session: `signIn` sets the cookie, the browser replays it, and
the user's identity persists across calls — no shared/forwarded fallback needed.
