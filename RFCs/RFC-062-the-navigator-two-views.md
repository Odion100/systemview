# RFC-062 — The navigator: two views

**Status:** approved in conversation (2026-09-24), building now — himself, not a lane.

The side panel gets two views, switched in its header:

- **List view** — what exists today: every project card stacked in one scroll.
- **Tabs view** — one tab per agent (icon + name). A tab is a project wearing its agent's face.
  Clicking a tab makes the whole side panel that agent's world: **one codebase per tab**.

**Inside a tab, the panel is sections stacked vertically — chat, then the codebase — and the
sections are resizable.** Dragging the divider reallocates the panel; the chat can take the whole
thing. The chat section is the REAL chat — the same BotBubble panel that floats today learns to
mount into a host element in the panel (a portal, one definition, two mounts), not a copy.

**The Projects/Agents pill tabs die.** The Agents tab is redundant once the tab strip *is* the
agents; the agent stuff lives as a section inside the codebase view. The "＋ name a project"
control stays in list view. Everything moves up into the space the pills and the title row leave —
the top of the panel was mostly chrome.

**The collapse control is rethought:** the full-width "‹ Navigator" title row is gone; collapse is
a small chevron in the header row. The collapsed rail and the pull-out gesture are unchanged.

## Kept state

`sv.navView` (list|tabs) · `sv.navTab.<active>` (which agent) · per-project pane split. All
localStorage, all per-browser, same as the panel width today.

## Order

1. Header rework: view toggle, compact collapse, pills removed.
2. Tab strip: agents from the dock order, icon + name, live dot.
3. Tab body: vertical resizable panes — chat host + one-project codebase card.
4. AgentChat: the panel portals into the chat host when it exists (`--embedded` skin), floats
   exactly as today when it doesn't.

## Every section is resizable

His spec, verbatim: "each section needs to be resizable." One mechanism — a slim grip under each
section (chat, services, reports, terminal; the file tree already had its own), dragging caps the
section and its content scrolls inside, double-click hands the height back. Per section, per
project, remembered. The chat's pane sizes the box itself rather than capping it, so the
conversation can be stretched to take the panel — in both views. There is no "later pass": the
card is ONE component, so this lands everywhere the card renders.
