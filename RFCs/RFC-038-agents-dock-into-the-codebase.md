# RFC-038 — Agents dock into the codebase

**Status**: approved 2026-08-18, building.
**His words**: *"they could dock by the codebase — that's what they really go back to. And it becomes a section just like services and code, expandable."*

## Why

Docking today means *parked at the edge of the window*: a 150px pill in the header lane with no
relationship to anything. It's out of the way, and that's all it is. An agent belongs to a codebase —
so docking should mean **back where it lives**, in that project's card in the nav. A project with
three codebases open has three agents, each sitting in its own. A new agent no longer appears in a
random place.

## The shape (his answers, thread by thread)

- **No name in the row.** It's already under the project card. The row is the icon, the unread
  count, the visitor ✦ and the mode ring.
- **The icons become TABS.** 💬 📋 🔗 📺 sit where they always sit, but docked they switch one
  surface instead of opening four panels — a 280px column can't hold four boxes side by side. Being
  flipped from links to TV when you press TV is a tab bar doing its job, not a bug.
- **The real chat, mic included.** *"where in this app do I not use voice recording"* — nothing is
  reduced to a reader.
- **No resize of its own.** The side panel already resizes; a resizable thing inside a resizable
  thing is two handles arguing.
- **Opening scrolls the panel TO it.** With several projects stacked, an agent expanding below the
  fold reads as nothing happening.
- **Pull out = drag out, plus a small arrow** on the row so the gesture is findable.
- **The header pill keeps configuration and loses docking.**

## How

The bot is not rebuilt in the nav — it is **portaled** into it, so one component keeps all its state
(chat, board, TV, presence, roster) and simply renders somewhere else.

- `src/organisms/AgentChat/navDock.js` — `isNavDocked(pc)` / `setNavDocked(pc, on)` over
  `localStorage` + an `sv:navDock` event, so the nav and the bot agree without either owning the
  other. `slotId(pc)` is the contract between them.
- `CodebaseNav` renders an empty slot `<div id={slotId(pc)}>` as the first section of a docked
  project's card. It knows nothing about what lands there.
- `BotBubble` renders through `createPortal` into that slot when docked, with `--innav` on its root:
  static positioning, column-reverse (row above panel), full width, one panel at a time.
- Docking is still the double-click on the face; undocking is the arrow (or dragging the row out).

## Not in this RFC

**Auto-recording** — one press on the mic beside the name tag opens the chat *already recording*
(his ask in thread t5). Smaller, independent, and doesn't wait for this.
