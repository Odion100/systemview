# RFC-052 — The agent rail: docked never means gone

**Status: built 2026-08-29** · relayed by SystemLynx from his description, confirmed in the chat

## The problem, in his words

Minimising the navigator hid the docked agents with it, so the choice was "see the tree" or "see
who's working." *"They need to be able to be dragged out of minimize mode… if you have a handle on
it, you could drag — boom — in and out."*

## What it is

- Collapsed, the navigator is a **rail**: a strip the width of its tab (44px), the full height of
  the page. The scratchpad side gets the same strip.
- **Docked agents live in the rail** while the navigator is away — a small form drawn for the
  strip (face, ring, unread count, visitor pips; nothing else). Panels open to the right of it.
- **The strip is the grab bar** on both sides: drag it inward past a few pixels and the panel comes
  back out, already resizing under the pointer. Dragging an open panel past its edge still collapses
  it — the same gesture, both directions.
- Agents stay dockable: drag one out of the rail and it floats where you let go; drop one onto the
  rail and it docks; the ↗ still pulls it out; double-click the face still docks.
- Navigator open: docked agents stay in their codebase card exactly as before (RFC-038). The rail is
  only the collapsed state.
- Not built, on his word: dragging agents between the two sides.

## Pieces

- `navDock.js` — `railId`; the bot's slot lookup falls back to the rail when the card is gone.
- `AgentChat.js` — `inRail` (slot is the rail) vs `inNav` (slot is the card); `--rail` class;
  drag-out undocks, drop at x ≤ 48 with the rail present docks.
- `SystemView.js` — the rail slot in the collapsed nav; `startPull` on both collapsed strips turns
  into the ordinary resize once the pointer is 56px in.
- Styles — `.nav-panel--collapsed` / `.scratchpad--collapsed` full-height strips; `.agent-chat--rail`.
