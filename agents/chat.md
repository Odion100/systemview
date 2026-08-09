# The chat — being present in the UI (RFC-028)

This document is written **for AI agents**. The SystemView UI has a chat bubble (bottom-right of
the project page). The human talks to you FROM the UI; your job is to be reachable. Connecting is
**your explicit act** — SystemView never wires your hooks or config for you. Two modes; set up
one or both. Siblings: [AGENTS.md](AGENTS.md), [markdown.md](markdown.md).

## What arrives

Every message carries the human's words **plus their vantage point at the moment they sent it**:

```json
{ "id": "m_…", "ts": 1786227000000, "from": "you",
  "text": "why would you do that?",
  "view": { "path": "/specs/systemview-test?tab=reports", "projectCode": "systemview-test",
            "namespace": { "serviceId": "TestService" }, "tab": "reports",
            "openFile": "cli/index.js" } }
```

**Use the view.** "That", "this", "here" refer to what the view shows — the open report, the
selected namespace, the file on screen. Never ask "which report?" when the view already says.

## Mode 1 — JOIN (live, in the room)

Run this and STAY on it — the hold itself is the "agent is in" indicator (solid bubble):

```bash
systemview join <projectCode>          # hangs; each message prints as one JSON line
systemview join <projectCode> --once   # exits after the first message (one message per call)
```

The loop you live: hold → a message prints → work → answer → hold again. While working:

```bash
systemview status <projectCode> "running the Math tests"   # the cooking line the human watches
systemview say <projectCode> "12 green. The subtract demo is the only red."
```

- **Always set a status before anything slow** — a silent bubble reads as a dead agent. The hub
  auto-shows "received" the instant your hold takes a message; your status replaces it; your next
  `say` clears it. Specific beats generic: "running the Math tests", not "working".
- `say` repeatedly to stream a long answer in chunks.
- **Leaving**: Ctrl-C / SIGTERM sends a goodbye so the ring drops to OFFLINE immediately. Never
  fake presence — join only while you actually hold the line.
- The cost: while you hold, your terminal/turn is occupied. Join when the human asks you in
  ("join the chat", "get in the UI") or when pairing on UI work; leave when done.

### The Claude Code loop (proven live — follow this exactly)

Run the hold as a **tracked background task** with `--once`. The task completes when a message
arrives — and a background-task completion **wakes you even while idle**. That's the whole magic:
the human reaches you without touching your terminal.

1. Arm: run `systemview join <project> --once --as <you>` with your harness's background-task
   mechanism (in Claude Code: the Bash tool's `run_in_background` option — **never** a shell `&`
   inside a command; an untracked child can't wake you and its message is lost).
2. On the completion notification: read the task output — one JSON line per message,
   `{ text, view }`.
3. Immediately `systemview status <project> "<what you're doing>"`, then work, then
   `systemview say <project> "<answer>"`.
4. Re-arm. You can chain the reply and the re-arm in ONE tracked background call
   (`say … ; join --once …`) — the task then completes on the NEXT message, keeping one wake per
   message.
5. Poll-timeout re-arms happen inside the CLI silently — an idle hold costs nothing; you spend a
   turn only when the human actually speaks.

## Mode 2 — FILE (ambient, hooks)

Delivery at your turn boundaries — the human's UI messages land in your context the next time
your session turns over. Install YOUR OWN hooks (e.g. `.claude/settings.json`) that call:

```bash
systemview inbox <projectCode>     # prints pending messages as JSON + acks them (never replayed)
```

The working pattern (proven live): a small hook script that stays QUIET when there's nothing —
only injecting context when the human actually said something — wired into UserPromptSubmit
(and/or Stop):

```bash
#!/bin/bash
# .claude/hooks/sv-inbox.sh — drain quietly, speak only when there are messages
OUT=$(systemview inbox <projectCode> 2>/dev/null | grep '^\[' | tail -1)
if [ -n "$OUT" ] && [ "$OUT" != "[]" ]; then
  echo "SystemView UI chat — messages from the user (answer them now via systemview say): $OUT"
fi
exit 0
```

```json
{ "hooks": { "UserPromptSubmit": [{ "matcher": "", "hooks": [{ "type": "command",
    "command": "bash .claude/hooks/sv-inbox.sh" }] }] } }
```

Draining registers you as a listener — the bubble shows OUTLINED ("hears me next turn"), honestly
weaker than join's solid. Treat drained messages as things to answer NOW, in your reply — and in
the document's own thread when the message is about a document. The two modes run fine TOGETHER:
keep the hooks standing, join when asked in — you'll hear the UI on both channels without
double-processing (separate ack cursors).

## Rules

- **Answer where it belongs**: short answers in the chat (`say`); anything about a document also
  as a `:::reply{author=agent}` in that document's thread ([markdown.md](markdown.md)).
- **The human's message is the only trigger.** Their clicks/comments accumulate silently — never
  respond to UI activity, only to what they SAID.
- **Don't fake presence.** Join only when actually holding the line; the indicator is derived
  from your real connection and the human trusts it.
- One chat per project for now (`main`); `--chat <name>` exists for when named chats arrive.
