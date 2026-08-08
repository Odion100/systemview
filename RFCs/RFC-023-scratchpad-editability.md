# RFC-023: Scratchpad human-editability — drag, duplicate, references that follow

Make the scratchpad fast to edit BY HAND: rearrange without retyping, copy instead of rebuilding,
and never let a rearrange silently break the reference wiring.

## Features

1. **Step drag-and-drop** — reorder steps inside a section, and drag a step INTO another editable
   section (Before / Events / Main / After / named sections). Saved-action blocks are SEALED: their
   steps belong to the stored definition — the block moves as a unit, steps never drag in or out.
2. **Section rearrange** — every section but Main and Events drags (both anchored); other sections
   shuffle around them.
3. **Step duplication** — ⧉ on a step clones its namespace/args/evaluations (minus results) right
   below the original.
4. **Section blocks** — collapsed Before/Events/After take the saved-action block presentation
   (left color edge + small badge + title + count): uniform blocks are what make dragging legible.
   Defaults wear the indigo family; actions keep plum.

## References follow the step (no static/dynamic modes)

Every reference is STRUCTURED (`targetValues` entry with `test.<section>[i].path`), so a move
mechanically rewrites what changed — one pass over the whole test at drop time:

- **Source section, below the removed step**: indices slide UP one → remap refs into them.
- **Destination section, below the insert point**: indices slide DOWN one → remap.
- **The moved step itself**: refs pointing AT it change key + index (`test.before[3]` → `test.after[1]`).

Within-section reorder = cases 1+2 in one section; duplicate = case 2 only; section reorder = NO
rewriting (keys/indices unchanged — only run order moves).

Rewrites touch the `targetValues` entry AND the visible input text (object property strings,
embedded `tv(...)` in strings, evaluation values). Overriding by hand stays possible — refs are
visible/editable where they always were (and later: the targetValues strip under object args, with
causality warnings when a move points a ref at a step that now runs after its consumer — *Phase 2*).

Builder-only: the saved shape (sections object + run order + step arrays) already expresses every
outcome, so the file format, the CLI engine, and the plugin change NOT AT ALL.

## Phases

- **Phase 1 (built):** step drag (within + across) with the remap, step duplicate, section-block
  styling, step tool row (× · ⧉ · ⠿), AND section drag: the builder is ORDER-DRIVEN — the section
  order is state loaded from the saved test's `run` (hand-authored arrangements render truthfully),
  every section but anchored Main AND Events drags (both stay where they've always been), and the order saves back as `run`.
- **Phase 2:** targetValues strip under object args + causality warnings.
