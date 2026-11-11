import React, { useCallback, useRef } from "react";
import { sizesAfterDrag } from "./paneDrag";
import { paneSizes, setPaneSizes } from "../../pages/SystemView/tabsStore";

// THE DIVIDER BETWEEN TWO PANES — his *"resize between them"*, said twice.
//
// It is a component and not a handful of handlers in the host because the pointer plumbing is the
// part with the sharp edges, and all of it is the same wherever two panes sit side by side:
//
//   POINTER CAPTURE, NOT WINDOW LISTENERS. `setPointerCapture` sends every move and the release to
//   this element even when the pointer has left it — which it will, immediately, since the thing
//   being dragged is 6px wide and the hand overshoots. Without capture the drag dies the moment
//   the pointer crosses into the document pane and the divider is left where it was abandoned.
//
//   THE ROW'S BOX IS MEASURED PER MOVE, never cached on down. The centre is resizable (the nav and
//   the chat both push on it) and a cached width is a drag that silently lands in the wrong place
//   after the window changes shape mid-gesture.
//
//   THE STORE IS THE ONLY WRITER. No local "dragging" width, so there is no second copy of the
//   layout to disagree with it and no state to reconcile on release — the store writes, every
//   subscriber re-renders, and a refresh finds the divider exactly where he left it.
//
// The arithmetic is `paneDrag.sizesAfterDrag` and is tested on its own; what is left here is
// plumbing, which is the half jsdom genuinely cannot run.
export default function PaneDivider({ tabsPc, index, rowRef, onDragStateChange }) {
  const dragging = useRef(false);

  const apply = useCallback(
    (clientX) => {
      const row = rowRef && rowRef.current;
      if (!row) return;
      const box = row.getBoundingClientRect();
      const next = sizesAfterDrag({ sizes: paneSizes(tabsPc), divider: index, x: clientX, left: box.left, width: box.width });
      // null means the drag cannot mean anything (no room, no row yet). Writing nothing is the
      // answer: the divider stays under his finger rather than snapping somewhere invented.
      if (next) setPaneSizes(tabsPc, next);
    },
    [tabsPc, index, rowRef]
  );

  return (
    <div
      className="documentation-view__split"
      // A REAL CONTROL, SO IT SAYS SO. Separator with an orientation, which is also what makes it
      // addressable from outside — a saved command or a check can find `[data-split="0"]` rather
      // than hunting for a 6px div.
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize the split"
      data-split={index}
      title="Drag to resize · double-click to even them up"
      onPointerDown={(e) => {
        // Left button only: a right-click here belongs to the context menu, and a middle-click
        // drag would otherwise start an invisible resize.
        if (e.button !== 0) return;
        dragging.current = true;
        try {
          e.currentTarget.setPointerCapture(e.pointerId);
        } catch {}
        if (onDragStateChange) onDragStateChange(true);
        e.preventDefault(); // or the pointer-down starts a text selection across both documents
      }}
      onPointerMove={(e) => {
        if (!dragging.current) return;
        apply(e.clientX);
      }}
      onPointerUp={(e) => {
        if (!dragging.current) return;
        dragging.current = false;
        try {
          e.currentTarget.releasePointerCapture(e.pointerId);
        } catch {}
        if (onDragStateChange) onDragStateChange(false);
      }}
      onPointerCancel={() => {
        dragging.current = false;
        if (onDragStateChange) onDragStateChange(false);
      }}
      // EVEN THEM UP — the one gesture that is faster than the drag, and the way back from a
      // lopsided split without aiming at a 6px target.
      onDoubleClick={() => {
        const n = paneSizes(tabsPc).length;
        if (n > 1) setPaneSizes(tabsPc, new Array(n).fill(1 / n));
      }}
    />
  );
}
