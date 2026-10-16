import React from "react";
import "./styles.scss";

// THE COLLAPSED WALL-TAB — the vertical strip a collapsed panel becomes, with the edge handle that
// makes the strip itself the grab bar (RFC-052). The scratchpad wore this shape alone until the
// agents page's document area needed it and got a hand-made near-copy instead. The classname-
// passthrough convention let the COSTUME be copied per page too — his catch: "the tabs have
// different styles on these different pages" — so the costume is now .wall-tab in this folder's
// own stylesheet, and the caller supplies only the dock to stand in:
//
//   <div className="wall-dock wall-dock--slot-1">
//     <WallTab side="right" label="Scratchpad" onPull={pull} onOpen={open} />
//   </div>
export default function WallTab({ side = "right", label, onPull, onOpen }) {
  return (
    <>
      <div
        className={`panel-divider panel-divider--edge panel-divider--edge-${side}`}
        title={`Drag to pull the ${String(label).toLowerCase()} out`}
        onMouseDown={onPull}
      />
      <button type="button" className="wall-tab" title={`Expand the ${String(label).toLowerCase()}`} onClick={onOpen}>
        {side === "right" ? `‹ ${label}` : `${label} ›`}
      </button>
    </>
  );
}
