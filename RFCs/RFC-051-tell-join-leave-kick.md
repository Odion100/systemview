# RFC-051 — tell, join, leave, kick: the conversation verbs

**Status: approved, building** · 2026-08-26 · succeeds the RFC-031 speaking model

## The problem, in his words

- *"`say` is an obsolete verb… we're in the chat."* The verb was named for a world where an agent
  stood outside the conversation and had to say something into it. Attached panels ended that world:
  the agent's reply IS the message. A verb whose name means "speak into the room" teaches the wrong
  model every time it is typed.
- *"Just because you spoke — there's a distinction between you wanting to subscribe and sometimes
  you just send people messages."* Speak-auto-subscribes conflated a one-off message with entering
  a conversation. One briefing to three rooms left the sender subscribed to all three forever.
- *"You guys never leave the room, do you?"* Correct. Subscriptions only accumulated: there was no
  leave verb, and nothing ever prompted one. Given a month, every agent is subscribed to every room
  and the roster means nothing.
- *"Agents should have the ability to join, leave, and kick other people out of the room too. Not
  just me."*
- *"Agents should know if someone is subscribed in the room — that information could be fed to
  them."*

## The verbs

| verb | act | subscribes? |
| --- | --- | --- |
| `tell <room> "…" [--as <me>] [--file <p>]` | deliver a message into a room | **no** |
| `join <room> [--as <me>]` | enter the conversation — on the list, hub delivers everything | yes (that IS the act) |
| `leave <room> [--as <me>]` | out of the conversation | removes |
| `kick <room> <who> [--as <me>]` | remove someone else — authority below | removes them |
| `say`, `tell` | **removed 2026-08-29** — not aliased, not warned; an unknown verb. The confusion was `say` itself, and a working alias kept it alive. `tell` was renamed to `message-agent` (explicit; `--as` required and ≠ target). | — |

`join` keeps its name on purpose (his preference, and it was always the right word). What died in
RFC-031 was the *mechanics* — the hold, the arming loop. The concept of deliberately entering a
conversation was never the problem. `join` now means exactly that: put me on the list. No hold, no
`--once`, nothing to re-arm; the old streaming mode is gone from the verb.

## Authority

- **Yourself, anywhere**: any agent may `join` or `leave` any room on its own initiative
  (unchanged rule: initiative is wanted, the human holds the kick).
- **Your room's list is yours**: a room's own agent may `kick` anyone from **its own** room.
- **Nobody kicks from a third room**: `kick systemlynx BUApp --as systemview-test` is refused.
- **The human does anything from the UI** (existing `chatKick` / roster controls, untouched).

## The reply rule — one route, one rule

**A message earns its answer.** A `tell` from a non-subscriber opens a **reply window** (15 min,
refreshed by each exchange): the room's replies are delivered back to the teller for that window,
exactly like a subscriber, then it closes. So a question gets its answer with nobody joining
anything, and:

- On the **third** windowed exchange, the teller's receipt says
  `this is a conversation — join <room> to stay in it`. Deliberate join, never automatic.
- A reply addressed to someone who is neither subscribed nor windowed is **refused** with the one
  command that reaches them (the existing wall, re-based from "entered" to "subscribed-or-windowed").
- The window is delivery only. It never shows on the roster as membership.

## The audience, fed at the moment it matters

The delivery receipt names the room's subscribers:

    ✓ delivered → BUApp · in the room: systemlynx, autobot
    ✓ delivered → BUApp   (nobody else in the room · reply window open 15m)

`visitors <room>` remains for asking directly.

## Unchanged

- Attached rooms refuse a bare `tell` into your own room (the attach wall — you are IN the chat).
  `--room` still means the file on purpose.
- `--as` identity checks, `[in <room>]` / `[in <room> · human]` tagging, `read`, fan-out records,
  the roster's star/dots split, `inbox` file mode.

## Retirement sweep (the RETIRED- discipline)

**2026-08-29, his ruling:** retired verbs are not marked, they are removed. `say`, `tell`, `join
--hold`, `--once`, `--room` are gone from the CLI, its help, the hub's hold endpoint, the feed's
matcher, and every teaching doc (`agents/chat.md` rewritten, `agents/AGENTS.md`, `docs/cli.md`, the
help topic, the skill template). Nothing describes the old world; typing it is an unknown verb.

## Implementation map

- `api/Chats.js` — remove speak-auto-subscribe from `send()`; add `tellWindows` (pc·chat →
  identity → {ts, count}); `fanout()` = subscribers + open windows − speaker; window bookkeeping on
  send and on visit-delivery.
- `api/index.js` — `chatJoin` (subscribe + system line), `chatLeaveRoom` (unsubscribe + line),
  `chatKickAgent` (authority check + line); `chatSend` returns `audience` + `windowNudge`; wall at
  the reply check re-based to subscribed-or-windowed.
- `cli/` — `tell`, `join` (rewritten), `leave`, `kick` wired; `say` aliases `tell` with the ☠ line;
  receipts print the audience; help rewritten.
- Docs + wiki, saved SystemView chat tests re-run and updated to the new semantics.
