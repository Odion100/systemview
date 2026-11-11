// THE DIVIDER'S ARITHMETIC, ON ITS OWN — his *"don't forget the resizing between the split
// paints."*
//
// It lives here and not in the component for one reason: a pointer drag is the part of this
// feature no suite in this repo can reach (jsdom has no layout, so `getBoundingClientRect` is all
// zeros and a drag has nothing to be a fraction OF). What CAN be checked is the decision the drag
// makes — where the boundary lands for a given pointer position — so that decision is a pure
// function of numbers and the component is left holding only the event plumbing.
//
// WHAT A DRAG MEANS: a divider sits BETWEEN two panes and moves only those two. The panes to its
// left and right of the pair keep the fractions they had, so dragging one divider in a three-pane
// row cannot shuffle the third pane — the hand moves one boundary, not the whole row.

// THE NARROWEST A PANE MAY BE, as a fraction of the row. Same floor the store enforces
// (tabsStore.MIN_PANE) and the same reason: at 12% a pane still has a grabbable strip on it, and a
// pane he cannot grab is a pane he cannot get back. It is repeated rather than imported because
// the two enforce it at different moments — the drag STOPS here, and the store refuses an illegal
// state however it arrived.
export const MIN_PANE = 0.12;

/**
 * Where the boundary lands, in fractions, for a pointer at `x`.
 *
 * `sizes`   — the current fractions, one per pane, summing to 1
 * `divider` — which boundary is being dragged: `0` is the one between pane 0 and pane 1
 * `x`       — the pointer's clientX
 * `left`/`width` — the ROW's own box (`getBoundingClientRect`), because a fraction is only
 *            meaningful against the thing it is a fraction of
 *
 * Returns a new sizes array, or `null` when the drag cannot mean anything (a single pane, a
 * boundary that does not exist, a row with no width yet, a pair with no room for two minimums).
 * Null is the honest answer and the caller writes nothing — snapping to some default instead would
 * be the window arguing with his hand.
 */
export function sizesAfterDrag({ sizes, divider, x, left, width, min = MIN_PANE } = {}) {
  if (!Array.isArray(sizes) || sizes.length < 2) return null;
  if (!Number.isFinite(x) || !Number.isFinite(left) || !(width > 0)) return null;
  const i = Number(divider);
  if (!Number.isInteger(i) || i < 0 || i > sizes.length - 2) return null;
  if (!sizes.every((n) => Number.isFinite(n))) return null;

  // The pair being resized, and where it starts. Everything left of the pair is untouched, so the
  // boundary is measured from the row's edge and the pair's own start is the offset.
  const start = sizes.slice(0, i).reduce((a, n) => a + n, 0);
  const pair = sizes[i] + sizes[i + 1];
  const lo = start + min;
  const hi = start + pair - min;
  // A pair with no room for two minimums: nothing legal to write, so write nothing.
  if (lo > hi) return null;

  const want = (x - left) / width;
  const at = Math.min(Math.max(want, lo), hi);
  const next = sizes.slice();
  next[i] = at - start;
  next[i + 1] = pair - next[i];
  return next;
}

/**
 * WHAT A DROP ON A STRIP MEANS — reorder, or cross the divider.
 *
 * A tab dropped on a strip is one of two different verbs depending on where the tab CAME from, and
 * getting it wrong is silent: `moveTab` on a tab that lives in another pane finds it by key, moves
 * it within ITS OWN pane, and nothing crosses — the document just shuffles somewhere he is not
 * looking. So the decision is named here and the handlers read it rather than each deciding.
 *
 * `from` — the pane index holding the dragged tab (`paneOf`, so -1 when nothing holds it)
 * `to`   — the pane whose strip took the drop
 */
export function dropPlan({ from, to, key, onKey } = {}) {
  if (!key || from === -1 || from === undefined || to === undefined) return null;
  // A tab dropped on itself is not a move. Only true within one pane — the same key cannot be in
  // two panes at once (openTab's one-document-one-side rule), so `from === to` is implied.
  if (key === onKey) return null;
  if (from === to) return { verb: "reorder", before: onKey || null };
  return { verb: "cross", to, before: onKey || null };
}

/**
 * WHAT A DROP ON A PANE'S BODY MEANS — his *"a tab should be able to be dragged out and hover and
 * then placed back in any tab. Any dark section."*
 *
 * The strips are only half of that: the dark section is the document area, and it is the bigger
 * target by far — aiming a dragged tab at a 30px strip is the fiddly way to do the thing he
 * described.
 *
 * `from`  — the pane holding the dragged tab
 * `to`    — the pane whose BODY took the drop
 * `panes` — how many panes are standing
 *
 * Two verbs and a silence:
 *   cross  — it came from the other side; carry it here.
 *   split  — it was dropped back into its own side while that is the ONLY side: that is the
 *            "dragged out" gesture, and it earns a pane of its own.
 *   null   — dropped into its own side while a split is already standing. There is nowhere for it
 *            to go that it is not already, and the honest answer is for the window to do nothing
 *            rather than to shuffle something to look busy.
 */
export function bodyDropPlan({ from, to, key, panes } = {}) {
  if (!key || from === undefined || from === -1 || to === undefined) return null;
  if (from !== to) return { verb: "cross", to };
  if (panes > 1) return null;
  return { verb: "split" };
}
