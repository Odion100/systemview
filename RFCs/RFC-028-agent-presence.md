# RFC-028 — Agent presence: join + file, the chat front door

**Status: BUILT + LIVE-TESTED 2026-08-08 (v1 shipped in systemview@2.20.0).** Both transports were
proven in a real session the same day: file mode (hook-drained, turn-boundary delivery — his
messages landed with view context via UserPromptSubmit) and join mode (held long-poll waking an
idle agent per message; dozens of live round-trips). The experiment shaped v1: auto **"received"**
status on live handoff, cooking line = bold green mono with bouncing dots (specific status
verbatim, generic rotates), presence PUSHED over sockets (ring flips without refresh),
`chatLeave` goodbye on SIGINT (instant OFFLINE), the **peek** (a minimized bot shows its cooking
line / an unseen reply preview beside the bubble), scroll-to-latest on open, unread count badge.
The authoritative design record is the Stage report "Agent presence — join + file, the chat front
door" (verdict=approved set in it). NEXT: interactive mode docking (his call), named chats,
avatars, drop-detection for abrupt disconnects.

The UI becomes a place you talk to an agent from, with the agent visibly present. BOTH transports
get built — the experiment decides what survives; choosing one on paper would be limiting.

## Settled decisions

1. **Connecting is the AGENT'S explicit act.** SystemView never wires hook configs or
   auto-installs anything. Instructions in `agents/` + CLI verbs; the agent joins itself.
2. **Presence is visible**: per-chat floating bubble (dockable). Solid = joined live (answers
   now); outlined = file listener (hears at the next turn boundary); derived from real
   connection state so it cannot lie.
3. **The user's message is the only trigger.** Clicks/comments accumulate silently; no agent
   response per UI event.
4. **Payload = message + vantage point** (page, namespace, tab, open panes) stamped at send —
   never a UI dump; conversation history stays in the agent's own session.
5. **One chat file serves both modes** (his t-p3 refinement): `.systemview/chats/…jsonl` holds
   the conversation; join pushes appends down the held connection live, file mode drains the same
   file from an acked offset via hooks. The modes differ only in HOW the file is read.
6. **Join mode must feel like the real chat**: a live status line (the agent "cooking") +
   streamed replies. Cost accepted: the VS Code chat is occupied while joined — join is the
   escalation, file is the standing default.

## Build

- Hub: chat store (JSONL per project+chat) + `chat-updated:<pc>` broadcast (stage socket
  pattern), long-poll `chatJoin` (presence = the held connection), `chatSend/chatHistory/
  chatStatus/chatDrain/chatPresence`.
- CLI: `join` (long-poll loop printing `{message, view}` JSON), `say` (agent reply, streamable),
  `status` (cooking line), `inbox --drain` (file-mode drain + listener registration).
- UI: floating bubble + chat panel (message list, input, status line), presence states, view
  context captured on send.
- Agents doc: `agents/chat.md` — the join loop and the hook snippets (agent installs its own).

Open questions carried into the experiment (defaults for v1): one chat per project ("main"), no
avatars yet, agent replies land in the bubble and in document threads when about a document.
