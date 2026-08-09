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

## Agent control (RFC-029) — nav, highlight, refresh, act

If you can send chats, you can send commands. Each one is a record in the same chat, renders in
the thread as a `→ …` receipt line, and the open UI executes it the moment it arrives — the
human SEES the window move and sees who moved it. All of this was proven in a live driving
session; the rules below are what that session taught.

```bash
systemview nav <pc> Math.add                        # NAVIGATE (real selection): route + center + scratchpad follow
systemview nav <pc> center --report <path>          # open a report on the Stage tab
systemview nav <pc> center --file cli/index.js#L40-80   # open a file in the Code tab (tree selection follows)
systemview nav <pc> center --tab docs|reports|logs  # switch the center tab
systemview nav <pc> center --topic chat             # open a help topic over the page
systemview highlight <pc> Math.add                  # POINT, don't navigate: tree expands + marks + scrolls, nothing else moves
systemview highlight <pc> --file api/Chats.js       # same, for a file in the tree
systemview refresh <pc> docs|reports|nav|all        # panes re-read their data — never a page reload
systemview act <pc> test Math.add                   # run a saved test where the human is LOOKING (see routing below)
systemview act <pc> test "Wrong expected value (failure demo)"   # by TITLE — a method can hold several tests
systemview act <pc> test all                        # every saved test in the saved-tests area, in sequence
systemview act <pc> run "Prove it works"            # press a :::run block's play in the OPEN document, by title
```

- **Highlight and navigate are DIFFERENT commands** (his rule). Highlight points — use it for
  "look at this"; nav selects — use it for "go here". Don't conflate them.
- **Namespaces are VALIDATED against the live tree** before anything moves: fuzzy suffix
  resolution (`add` / `Math.add` / `TestService.Math.add` all work), a name that doesn't exist
  on the LIVE system is refused with a message. Corollary: a file existing in the repo does NOT
  mean the module is mounted — trust the live tree, not the filesystem.
- **act routing — the run lands where the human is looking**: a doc block showing the target
  test claims the run; otherwise it runs in the saved-tests area. `all` always means the saved
  area's whole list. A `::test` block can hold SEVERAL saved tests — target by title when the
  namespace is ambiguous (read the open doc + its spec files to see what a block holds).
- **The already-ran block** (his favorite): run in the CLI (`test <pc> --json`), write the output
  to `.systemview/runs/<name>.json` (add `ranAt`), then embed `::test[Math.add]{ran="<run-file>"}`
  — the block renders ALREADY RAN: steps colored, real responses, verdicts recomputed from the
  recorded data, a "recorded run" badge as the honest tell. Play re-runs fresh; Clear really
  clears. The record must cover every step or the block stays honestly un-run.
- **The live-edit loop**: edit a file on disk → `refresh <scope>` → it's on their screen, no
  reload. Presenting work? `nav … --report` the write-up instead of describing where it is.
- **Never move the window as a surprise.** Pull things up when asked, or when presenting work
  you were asked for. The receipt line keeps you honest; don't make them need it.
- **Commands never come back to you** — your own command records don't wake your hold or land in
  your inbox. Only the human's messages do.
- **Their view stamp + the open doc = your eyes.** The stamp names the page, tab, open report,
  namespace; the report/doc is a file you can read to know exactly which blocks are on their
  screen. Use both before acting on "this"/"that".

## Rules

- **Messages are plain text plus LINKS** (not markdown — write chat like chat). Three link forms
  render clickable: `:report[.systemview/report.<pc>.<Name>.md]{title="…"}` (a chip that opens
  that report on the Stage tab), `[text](url)`, and bare URLs. Link the thing you're talking
  about — "the report is ready" without a `:report` link is a missed click.
- **Answer where it belongs**: short answers in the chat (`say`); anything about a document also
  as a `:::reply{author=agent}` in that document's thread ([markdown.md](markdown.md)).
- **The human's message is the only trigger.** Their clicks/comments accumulate silently — never
  respond to UI activity, only to what they SAID.
- **Don't fake presence.** Join only when actually holding the line; the indicator is derived
  from your real connection and the human trusts it.
- One chat per project for now (`main`); `--chat <name>` exists for when named chats arrive.
