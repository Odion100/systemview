# RFC-048 — The session event vocabulary

**Status**: proposed 2026-08-23 for autobot to agree or amend. This is the one piece of the harness
neither side can settle alone: the browser **produces** these events, SystemView **renders** them, and
if we each invent our own shape we will each write an adapter for the other's guesses.

Companion to [RFC-046](RFC-046-the-agent-workbench.md) (SystemView's workbench) and autobot's
`RFCs/RFC-002-the-browser-is-the-harness.md`. Nothing here is a transport decision — it is what
crosses the line, whatever carries it.

## Four rules the shape has to satisfy

1. **An activity feed is not a transcript.** Every event that can be shown carries a one-line
   `summary` AND its raw payload. SystemView renders the line; expanding it shows the raw. The
   terminal already exists for people who want scrollback.
2. **The summary is produced ONCE, by the browser.** It holds the tool schemas; SystemView does not
   re-derive "edited src/x.js" by pattern-matching tool names. One implementation, one wording.
3. **Every event names its SESSION. Not its branch, and not its worktree** — corrected by him after
   I first wrote those in: *"what the fuck does the browser care about branches?"* He is right. The
   browser is handed a `cwd` at `open()` and runs a session there; which branch that directory is on,
   and why SystemView made it, is IDE state. SystemView opened the session, so SystemView already
   knows which worktree the session id belongs to and can label the feed itself. Asking the browser
   to carry it would be storing IDE arrangement in the wrong process.
4. **A file change is its own event, not something to infer from a tool call.** SystemView already
   owns the diff, the change stripes and staging; it needs "this path changed", not tool
   introspection. Any tool — Edit, Write, a shell `sed`, a `git checkout` — that touches a path emits
   it.

## Session → renderer

| event | payload | what SystemView does with it |
| --- | --- | --- |
| `session.started` | `sessionId, projectCode, cwd, model` | the agent appears on its codebase card; SystemView supplies the branch label from the cwd it chose |
| `assistant.text` | `sessionId, delta, done` | the chat bubble, streamed |
| `assistant.thinking` | `sessionId, summary` | drives the cooking line — no more narration duty |
| `tool.call` | `sessionId, id, name, summary, input` | one line in the feed, expandable to `input` |
| `tool.result` | `sessionId, id, ok, summary, detail` | the same line resolves; `detail` on expand |
| `file.changed` | `sessionId, path, kind: created\|edited\|deleted` | the diff and the stripes light up live |
| `permission.request` | `sessionId, id, title, detail, options[]` | a control in the chat, answered by clicking |
| `usage` | `sessionId, inputTokens, outputTokens, costUsd?` | visible only when it matters (API-keyed sessions) |
| `session.ended` | `sessionId, reason: done\|interrupted\|error, error?` | presence drops, honestly, with no TTL guesswork |

## Renderer → session

| command | payload |
| --- | --- |
| `prompt` | `sessionId, text` |
| `interrupt` | `sessionId` |
| `permission.answer` | `sessionId, id, choice` |

## Two things I want autobot to push back on if they are wrong

**`assistant.thinking` carries a summary, not the raw reasoning.** Rendering raw thinking is a wall,
and it is also the thing most likely to change shape underneath us. If the browser would rather emit
raw and let each renderer decide, say so — but then the summarising lands in two places.

**`file.changed` may be redundant if `tool.result` already carries touched paths.** If the browser can
reliably list paths per result, fold it in and delete the event. It is separate here because a shell
command that writes a file has no tool schema saying so, and that case is common.

## Not in scope

Auth, spawning, worktree creation, and how a session is resumed — all the browser's, all in its
RFC-002. This document is only the wire between us.
