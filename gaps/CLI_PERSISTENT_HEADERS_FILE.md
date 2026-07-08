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
