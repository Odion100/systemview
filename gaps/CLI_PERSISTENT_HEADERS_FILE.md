# CLI has no persistent, per-project headers store

The CLI can send request headers one-off via `--header "Name: Value"`, but it has no *persistent*
place to keep auth headers per project. So connecting to an **auth-gated** project — one whose
modules sit behind an authentication middleware and require a token (e.g. an `Internal-Access` JWT) —
means re-pasting `--header` on every command, and there's no home for a standing token.

## Why it matters

Remote log viewing is a core goal: run the CLI locally, `connect <url> --manifest`, pull the project,
and stream its logs. But a production project gates its RPC modules behind auth, so the CLI must
present a token to reach even the `SystemView` (logs) and `Plugin` (manifest) modules. Without a
persistent header store there's no clean "connect and go" — and the tempting alternative (teaching the
CLI to *mint* the token itself) is worse: it would couple the CLI to one project's auth scheme
(its secret, its JWT shape), when the CLI should stay a generic SystemLynx tool.

## The idea / fix direction

Give the CLI a **generic headers file** — a sibling to the cookie jar it already persists
(`systemview.cookies.json`) — that it reads on startup and attaches to every request it makes. The CLI
never learns anything project-specific: it just forwards whatever header name→value pairs the file
holds (`Internal-Access: <jwt>`, a bearer token, an API key — any scheme). Token *generation* stays
the operator's/project's one-time job; the CLI only *consumes* the file, and never touches a secret.

This also delivers the "connect and go" UX — the file is read automatically, so no `--header` on every
call.

Three things to get right:

1. **Key it by url/project, not flat.** A flat file would send the same headers to *every* remote —
   connect to two projects with different tokens and one leaks to the other. Map `url` (or
   `projectCode`) → headers.
2. **It holds a secret** — gitignore it, local-only, same handling as the cookie jar.
3. **Feed the socket handshake, not just HTTP.** The log stream (`SystemView.on("log")`) is a websocket
   handshake; if the headers only ride HTTP calls (`getManifest`, `getLog`), streaming stays unauthed
   or fails. The file's headers must reach the socket connect too.

---

## ANSWERED — 2026-10-19: two of the three requirements are already built; the third is not ours

**Requirements 1 and 2 are met, by `cli/manifestHeaders.js` (RFC-010 Phase 1).** The store exists,
and it is better than the file this gap proposed:

- **keyed by URL ORIGIN**, not flat — so two remotes with different tokens cannot bleed into each
  other (`headersFor(url)` → that origin's bucket only; the comment there spells out why it must
  stay pure per-origin, since `api/getProjects` feeds it to the browser to decide which services are
  credentialed);
- **secrets need not live in the file at all**: a value may be a literal (`"Bearer abc"`) or a
  file-pointer (`"@./token"`), dereferenced at request time. The gap asked for a gitignored secret
  file; the implementation lets the secret stay wherever the operator already keeps it;
- **read on load, attached to every HTTP request** through `cli/cookieClient.js` — no `--header` on
  every call, and `--header` still wins by name when passed;
- a captured `Set-Cookie` folds into the same store under the `Cookie` header, so "connect and go"
  covers cookie auth as well as token auth.

**Requirement 3 — the socket handshake — is NOT met, and the blocker is in SystemLynx, not here.**
The log stream is a websocket, and the client opens it with no headers and no auth payload:

```
node_modules/systemlynx/systemlynx/Client/components/SocketDispatcher.js:23
    const socket = io.connect(namespace, { path });
```

`namespace` and `path` are all it passes. socket.io-client supports `extraHeaders` (via
`transportOptions`) and an `auth` payload, and neither is reachable from a caller: `SocketDispatcher`
takes `{namespace, socketPath}` and nothing else, so there is no seam for the CLI to thread the
origin's headers through. **An auth-gated remote therefore cannot have its log stream
authenticated** — HTTP calls (`getManifest`, `getLog`) carry the token and the stream does not.

### What that leaves, and whose it is

- **SystemLynx's**: give `SocketDispatcher` an options seam — the obvious shape is for the client's
  injected http-client (or the service's connection data) to carry `headers`/`auth` through to
  `io.connect`, since the CLI already hands `createClient` a cookie-aware http client and the
  headers it needs are in the same place. One parameter, and this gap closes.
- **Ours, only once that exists**: pass `headersFor(origin)` at socket-connect time, the same way
  `cookieClient` does for HTTP.
- **A degraded path we could build without SystemLynx** — poll `getLog` on an interval instead of
  streaming, for an origin that has headers — was considered and NOT built: the trigger would have
  to be a heuristic ("this origin is credentialed" or "no entries arrived in N seconds"), because
  `connect_error` never reaches a caller through the dispatcher either, and a silent switch between
  streaming and polling is a surface lying about which one it is doing. If remote streaming is
  wanted before SystemLynx changes, that is the shape to argue about — not something to slip in.

Filed back for SystemLynx's agent. Nothing in this repo is blocked.
