# RFC-056 — SystemView internal MCP: the agent face

**Status:** approved direction (audit report: `.systemview/report.systemview-test.CLI-internal-MCP-the-transition-audit.md`) — awaiting his separate go for implementation.

## Why

SystemView's agent face is still a CLI: agents shell out to `systemview probe/test/logs/...` from a
skill file. Everything else agents use in the harness is internal MCP (context, discovery,
worklist, the systemlynx bridge) — tool calls with a session identity behind them. The CLI face is
the last piece of the webpage era: it needs `--as` identity flags, a per-terminal cookie jar, and
polling verbs, all of which exist only because the caller wasn't in the browser. This RFC moves the
agent face to a `systemview` internal MCP server and leaves the CLI **unchanged** as the human/CI
surface.

This is the prerequisite for the docs rewrite: the documentation describes how agents use
SystemView, and that answer must be "tools", not "subprocesses", before it's written down and
embedded.

## The shape

A `systemview` internal MCP server in the harness (beside context/discovery/worklist), talking to
the hub's existing API. Not a bridge-loaded service: the CLI verbs carry client-side orchestration
(test running, filter grammar, session handling) the hub's raw methods don't expose. Identity is
the session's — no `--as` anywhere; `checkIdentity` has no MCP equivalent because the harness
already knows who's calling (same principle as `by:` stamping in the context store).

**Every tool's output is human-readable feed material.** Same contract as the existing harness
tools: we author both the tool text and the chat parser (`parseMcp`/`parseMcpResult`), test runs
render through the existing run/test display, and unparseable payloads fall through to the raw
block so pretty never loses data. (His t1 note: "use the system we already have.")

## The tools

| tool | carries over | notes |
|---|---|---|
| `call` (unified) | probe's session auth, positional multi-arg spread | **His t1 correction:** cookies/headers move INTO the systemlynx `call` itself — sessions are native in the browser; the separate jar existed only because the CLI wasn't. `probe` stops being a separate thing. Also fixes the bridge's `arguments`-param bug (noted in store). |
| `runTests` | filter grammar (`pc`, `Module`, `Module.method`), bail/phase/index/skip, verbose | Structured output replaces `--json`; renders as the existing test display. CLI `test` keeps living for CI where the exit code is the contract. |
| `listTests` | namespace filtering | Discovery of what's runnable. |
| `logs` | level/limit/filter/include/highlight, clear | `--follow` drops — a tool call returns; following is a UI job. |
| `stats` | range windowing | RFC-032's "agent's eyes on the Stats numbers", now literally a tool. |
| `show` / `tv` | report filing + TV push; reading `::question`/`:::approval`/`:::reply` answers | The human↔agent loop. |
| `reply` / `thread` | thread addressing in reports | Identity from session. |
| `board` | add/read/reply | His notes to agents and theirs back. |
| `comments` | read/reply/at | Code comments by verb. |
| `nav` / `refresh` / `act` / `highlight` | window driving (RFC-029/030) | `act` = press things in the OPEN window (run a saved test, press a `:::run` block's play) — the demo-what-works muscle. |
| `connect` / `disconnect` | service attach/detach | **His t4 correction:** this is SystemView's loadService — agents genuinely connect services mid-work (start a test service → connect → call). Moves UP into the tools, not CLI-only. Hub-boot registration (manifests, hosted projects) is untouched. |

## Retired (agent face only — the CLI keeps existing as-is)

| verb | why it dies |
|---|---|
| `join` / `leave` / `kick` | Attachment is harness-owned; a browser agent IS in its room. Ending an agent lives in the panel/profile (two-step). |
| `inbox` | Polling was the CLI's only option; attached agents receive messages pushed mid-turn. |
| `message-agent` / `read` / `visitors` | Harness session→session messaging is the one channel — **with the traceability requirement below**. |
| `status` | **His correction:** the cooking line is harness-owned for attached agents — session events already drive it. CLI-era patch for sessionless agents. |
| `skill` (internal use) | Tool descriptions + docs replace the skill for browser agents. Published-CLI fate deferred (his Q2 answer: internal MCP first). |
| `assemble` / `stage` / `view` / `selection` | Legacy AI-window verbs; `nav`/`show` cover them. Stories already hard-stopped. |

## Decisions locked (his answers on the audit)

1. **Messaging (t3):** harness messaging is the channel, and it must gain **visible landing** — when
   one agent messages another, the delivery shows in his UI (the receiving agent's feed carries the
   receipt), not just the send. Traceability is the requirement; rooms don't survive for
   visibility's sake.
2. **Published CLI (Q2):** decide later — internal MCP first. The npm CLI ships unchanged.
3. **Probe sessions (Q3):** **per agent** — real isolation. Each agent's `call` sessions (sign-in
   cookies) are held hub-side keyed by the session's agent identity; no shared DEV_SESSION
   assumption, no per-terminal jar.

## State inheritance

| state | verdict |
|---|---|
| `.systemview/manifest.*.json` | untouched — hub boot concern |
| cookie jar / `probeHeaders` | absorbed by session-capable `call`, hub-held, per-agent |
| `api/connections.json` | demoted to hub-internal; nothing agent-facing reads it |
| `api/cli-history.json` / `cli-settings.json` | CLI's own, untouched |

## Build order

1. **Session-capable `call`** in the systemlynx bridge (cookies/headers per agent identity, multi-arg
   spread, `arguments`→`input` param fix) — the verify muscle first.
2. **`runTests` / `listTests` / `logs` / `stats`** — port the CLI orchestration into the server;
   feed rendering for each (parser + tests pinned, both ends authored together).
3. **`show`/`tv`/`reply`/`board`/`comments`** — the speaking-to-him group.
4. **`nav`/`refresh`/`act`/`highlight` + `connect`/`disconnect`** — window driving and service attach.
5. **Message landing visibility** — the traceability requirement on harness messaging.
6. **Docs rewrite + embedding** (the step this RFC unblocks — separate work, after).

Each phase lands behind a relaunch; the CLI keeps working throughout, so nothing breaks while the
face moves.

## Out of scope

Updating the published CLI (optional, later, his call), retiring the `systemview` skill for
external users, any change to hub boot/registration, the docs rewrite itself.
