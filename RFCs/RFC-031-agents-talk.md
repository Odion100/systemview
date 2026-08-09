# RFC-031 — Agents talk: project-to-project chat (visiting, not routing)

**Status**: APPROVED — design record = Stage report "Agents talk — project to project"
(`.systemview/report.systemview-test.Agents-talk-project-to-project.md`, verdict=approved with
his thread replies shaping every piece). Build signal given same message.
(RFC-030 stays reserved for avatar/docking per the approval text.)

## The vision (his words, distilled)

**The agent IS the project.** Not "claude working in the buAPI repo" — just *buAPI*. Rooms are
projects, identities are projects, and whoever holds a project's line is that project's voice
right now. "Talk to buAPI" addresses the project. He is ALWAYS in the chat — there is no
agent-to-agent side channel; a visiting agent is a third voice in a room he's already in.
"Sometimes I need to just connect dudes."

## The model (settled through three thread rounds)

1. **Rooms are projects. Identities are projects.** `--as <projectCode>` is the identity you
   embody; anything else (legacy `--as claude`, no `--as`) canonicalizes to the room's own
   project — you're its home agent.
2. **Visiting = joining another room as yourself.** `join <room> --as <yourPc>` with
   identity ≠ room = a visitor: you hear the room like a member, speak under your own name,
   jump out (visibly) when the errand's done.
3. **He is the router.** Introductions happen by him telling an agent "go talk to X" — the agent
   jumps in, that IS the introduction. No hub-side mention routing (that model was designed and
   then KILLED by his t3 catch: a routed visitor only hears mentions, so it never hears the
   room's own agent answering its room — routing can't carry a conversation; membership can).
   @names in text remain plain-language addressing, not machinery.
4. **The hub is the only writer** (his predictability rule). Agents only ever call
   `say`/`join`/`inbox`; nobody touches another repo's files; every chat file stays hub-local.
5. **Presence shows everything**: the room's roster lists every identity currently in; a
   visiting bot renders with a name tag; your own bot shows it's off visiting even while closed.

## Delivery rule (the entire mechanical build)

A record reaches an agent identity `me` in room `pc` iff:

```
kind !== "command" && ( from === "you"  ||  (from === "agent" && as && as !== me) )
```

- Human messages: delivered to every identity in the room (home + visitors) — unchanged for the
  home agent.
- Agent messages: delivered only when they CARRY an identity (`as`, stamped server-side), and
  never back to their speaker. **Legacy records (no `as`) deliver to no agent** — that is the
  self-loop guard: an old CLI's `say` can never wake its own author's hold, and the upgrade
  can't create echo storms in rooms still running old holds.
- Identity canonicalization (server-side, where the project registry lives): an `--as` that
  isn't a known project code, or equals the room, means "the room's own agent" → identity = pc.
  This is what makes `--as claude` holds keep working as home agents through the transition.
- Commands: never delivered to any agent, unchanged.

## Touched surfaces

- `api/Chats.js` — per-identity presence (liveSeen: room → Map(identity→ts)), identity-tagged
  waiters, `deliverable(m, me)` in join/push/drain, per-identity `leave`, presence payload gains
  `agents` (roster), `visitors`, `visiting` (rooms this project's agent is off in).
- `api/index.js` — canonicalize identities against the live project registry; stamp `as` on
  agent sends; emit `chat-presence` for BOTH rooms when a visitor joins/leaves.
- `cli/chat.js` — `say`/`inbox` pass `--as` through; join's goodbye carries its identity.
- UI `AgentChat` — name-tag bubbles for visitor messages, roster strip in the panel, "visiting
  <room>" on the closed bubble.
- `agents/chat.md` — the playbook section: identity = your project code, visiting etiquette
  (speak when spoken to or on your errand, jump out when done), plus the nav/refresh-rides-with-
  a-link rule (added same session).

## Out of scope (explicit)

- Cross-project COMMANDS (nav/act/show stay human-and-own-room; addressing gives the future
  consent hook).
- Named chats, avatars, drop-detection — separate queue items.
