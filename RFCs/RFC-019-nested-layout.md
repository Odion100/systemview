# RFC-019: One-level nested stage layout (stack-next-to-single)

**Status:** Draft — approved in principle, do not implement until the explicit go.
**Depends on:** RFC-018 "Stories" (shipped). Extends the flex grid built post-2.12.0 (resizable `{w,h}` spans, drag-drop, per-row presets).
**Companion:** RFC-020 (Live Stage + Activity pane).

## One-liner

Let the stage express **a vertical stack of panes sitting as one unit next to another pane** — e.g. two panes stacked beside one tall pane — by giving the layout **exactly one level of nesting**. Not arbitrary trees. One level.

## The gap

Today `panes` is a **flat array**; each pane carries a `{ w, h }` span and the row is a wrapping flex line. That gets you side-by-side + wrap, but a *stack is not a unit* — nothing says "these two ride together, as a column, beside that one." When the row reflows or you drag, the grouping is lost because it was never expressed; it was only a coincidence of widths.

Drag-drop today inserts a pane before/after another in the flat list. There's no "drop **onto** this pane to stack with it."

## The model — one level, no deeper

Keep `panes` a **flat array** (the source of truth for pane content, ids, spans, CLI index ops — all unchanged). Add an **optional arrangement tree** of pane ids that, when present, overrides the preset layout:

```
story.grid = [
  [ "paneA" ],                    // row 1: single pane, full-ish width
  [ ["paneB", "paneC"], "paneD" ] // row 2: a STACK of B over C, sitting next to D
]
```

Rules:
- Top level = **rows**.
- A row element is **either** a pane id (string) **or** a one-level **stack** (array of pane ids). A stack renders its panes vertically as a single flex cell.
- **A stack may not contain a stack.** One level, enforced. (If a drop would nest deeper, it flattens into the same stack.)
- Width still comes from each pane's `span.w` (a cell's width = its widest member / the stack's width); height still from `span.h`. The tree adds *grouping*, not new sizing.

Back-compat: no `grid` field → today's behavior exactly (flat wrap by preset). "Reset to grid" = **drop the `grid` field**. So this is purely additive; every existing story renders unchanged.

Why a separate id-tree instead of nesting the pane objects themselves: CLI pane-index ops (`--at/--from/--to`), `setStoryPaneSpan`, add/remove, and span persistence all operate on the flat list and keep working untouched. Only *arrangement* moves into the tree.

## Interaction

- **Drag a pane onto the top/bottom half of another pane → stack** (join/extend that pane's stack). Onto the left/right half → insert beside (today's before/after). The drop indicator already distinguishes halves; add a top/bottom variant that reads as "stack here."
- **Drag the last pane out of a stack** → the stack collapses back to a single cell (never leave a one-item stack wrapper).
- **Reset to grid** button drops `grid` and returns to the flat preset.
- Per-row presets (1/2/3/4-up) still set widths; they operate on the current row structure.

## Rendering

`Stage.js` renders `grid` when present: outer flex row per top-level row, inner flex column per stack cell, pane per leaf. When absent, the current flat wrap renderer runs as-is. `PaneView` is unchanged except it no longer assumes it's a direct child of the row (a stacked pane is a child of a cell) — width/height styling stays on the pane; the cell is a thin flex container.

## Persistence / API

`grid` is a field on the story object, saved through the existing `saveStory` (one call, no new plugin method, no restart). One new thin API/CLI affordance to set/clear it:
- API: `setStoryGrid(projectCode, storyId, grid | null)` → validates one-level depth, writes, broadcasts `stories-updated`.
- CLI: fold into existing `story` pane-ops; drag-drop in the UI is the primary driver, CLI is secondary.

## Migration

None required. Absence of `grid` = legacy render. First drag-to-stack writes a `grid` derived from the current flat order (every pane a single-cell row), then applies the stack.

## Open questions

1. Field name: `grid` vs `rows` vs `arrangement`. (Leaning `grid` — it's what the reset button already says.)
2. Do stacks get their own resize handle between stacked panes (drag the seam to trade height), or is per-pane `span.h` enough? Lean: per-pane height is enough for v1.
3. Should a 1/2/3/4-up preset flatten any stacks in that row, or preserve them? Lean: preset sets widths only, preserves stacks.

## Layout is just grid (gallery is only a way to view it)

After nesting, **grid isn't a preset among many — it's *the* composition model.** A story *is* a grid of panes (with one level of stacking). That's how you put a story together, full stop.

- **Remove `column`** — grid at 1-up *is* a column.
- **Remove `single`** — a 1-pane grid covers it.
- **Keep `gallery`** — but it's **not** a different composition; it's just another **way to view** the same grid (page through panes one at a time). Grid is the thing; gallery is a lens on it.
- **`grid` is the default and the norm.** Composing a story = arranging its grid — widths, rows, stacks. **Deciding that composition is the AI's job** — how to put the panes together — not picking from a menu of layouts.

Nested stacks (above) ride inside the grid.

## Non-goals

- Arbitrary/recursive nesting. **One level, full stop.**
- Changing pane content, kinds, or the span model.
