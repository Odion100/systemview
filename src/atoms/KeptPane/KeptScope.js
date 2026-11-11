import { useRef } from "react";

// THE ADDRESS HALF OF KEEPING, WITH NO ELEMENT AT ALL.
//
// `KeptPane` does two things: it hides a pane without unmounting it, and it remembers the address
// that pane was last given. The centre can only use the second half — its panels hide on their own
// elements, because `.kept-pane` is `display: contents` and `display: contents` is layout-invisible
// but SELECTOR-visible: one level in between and the centre's direct-child height chain stops
// matching, which is what cost a scrollable dashboard on 2026-11-10.
//
// So this is that second half on its own, as a render prop, which generates NO DOM NODE — nothing
// to break a `>` chain, nothing to style, nothing to explain to the next person reading the tree.
//
// WHAT IT IS FOR. A hidden document panel used to be handed the LIVE scope, so walking the service
// tree re-fired the listing effects of every document open behind the one he was looking at —
// wasted work, bounded only by how many documents he has open, and growing as he opens more. A
// document's identity is its path; where he happens to be standing in the tree is not a fact about
// it. The panel showing follows the scope, as it should; the ones behind it hold the last scope
// they were actually shown with.
//
// The ref is read and written during render, which is normally a smell. It is correct here and the
// reason is narrow: the held value is derived from this render's own props, it is never read by
// anything outside this subtree, and an effect would write it one render too late — the children
// would already have been handed the live scope and their effects would already have fired, which
// is the entire thing this exists to prevent.
export default function KeptScope({ showing, scope, children }) {
  const held = useRef(scope);
  if (showing) held.current = scope;
  return children(held.current);
}
