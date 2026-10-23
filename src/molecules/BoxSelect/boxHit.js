// WHAT A DRAGGED BOX GRABBED. His: *"when you use the mouse, it drags a box around whatever — and
// of course, the box intelligently tries to select what you're trying to grab, even if it's not
// perfect."*
//
// WHOLE BLOCKS, NEVER CHARACTERS, and that is what makes imprecision fine rather than a compromise.
// Clip the corner of a paragraph and you get the paragraph. He is grabbing a REGION of the
// conversation to hear, not a range of text to edit, so the unit is the thing that reads aloud as
// one piece.
//
// AND IT KEEPS THE VOICE INTELLIGENT. A native text selection hands back RENDERED text, which has
// already lost the markdown — a table is a wall of cells, a commit block is its own caption. Taking
// whole blocks means each one is still identifiable, so what gets read can still be the block's
// spoken form rather than its screen form.

/** Do two rectangles overlap at all? Touching edges do not count — a zero-area graze is a miss. */
export const overlaps = (a, b) =>
  a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;

/**
 * How much of `block` the box covers, 0..1. Used to be forgiving in one direction only: a box that
 * clips a sliver of the block above is usually reaching for the one below it.
 */
export const covered = (box, block) => {
  const h = Math.max(0, Math.min(box.bottom, block.bottom) - Math.max(box.top, block.top));
  const bh = Math.max(1, block.bottom - block.top);
  return h / bh;
};

/** A drag this small is a click, not a box. Below it, nothing is captured at all. */
export const MIN_DRAG = 6;

export const isDrag = (box) =>
  Math.abs(box.right - box.left) >= MIN_DRAG || Math.abs(box.bottom - box.top) >= MIN_DRAG;

/**
 * The blocks a box grabbed, in document order.
 *
 * `blocks` is `[{ rect, ... }]` and whatever else rides along comes back untouched, so the caller
 * keeps its element and its text without this module knowing about either.
 *
 * THE SLIVER RULE: a block the box barely touches is dropped UNLESS it is the only one, because a
 * small deliberate box inside one paragraph must still grab that paragraph. Without the exception,
 * being precise would return nothing, which is the opposite of forgiving.
 */
export const hits = (box, blocks = [], { sliver = 0.12 } = {}) => {
  if (!box || !isDrag(box)) return [];
  const touched = blocks.filter((b) => b && b.rect && overlaps(box, b.rect));
  if (touched.length <= 1) return touched;
  const solid = touched.filter((b) => covered(box, b.rect) >= sliver);
  return solid.length ? solid : touched;
};

/** The box as a rect, from two points, whichever way it was dragged. */
export const rectOf = (from, to) => ({
  left: Math.min(from.x, to.x),
  right: Math.max(from.x, to.x),
  top: Math.min(from.y, to.y),
  bottom: Math.max(from.y, to.y),
});
