import React from "react";

// THE COG AT THE RIGHT END OF THE TAB ROW. His placement: *"on the right side of the tabs all the
// way at the end."*
//
// IT IS NOW A BUTTON AND NOTHING ELSE. It used to own the settings panel too, opening it as a popup
// over the band — the right size for one nudge's seven knobs, and the wrong size the moment nudging
// became a list (RFC-078 §2.5). His shape: *"use that bottom area where the tabs are for the
// settings instead of something that pops up."* So the panel moved into the band area as a pane
// (BandSettings) and the open state moved up to the band that renders it, because the pane is a
// sibling of this row rather than a child of this button.
//
// IT COSTS NO HEIGHT and IT IS NOT A TAB. The tab row is a flex row, so the cog is pushed to the far
// end with `margin-left: auto`; and `bandTabs` decides which tabs exist from what has rows, while a
// settings cog has no rows and must never compete for that space. It is always there, including when
// the band has exactly one tab, because configuring the nudge is not a kind of work.
const NudgeCog = ({ open = false, onToggle }) => (
  <div className="agent-chat__bandcog">
    <button
      type="button"
      className={`agent-chat__bandcog-btn${open ? " agent-chat__bandcog-btn--on" : ""}`}
      title={open ? "close the settings" : "settings — nudges, the worklist chaser, auto-compaction"}
      aria-pressed={open}
      onClick={() => onToggle && onToggle(!open)}
    >
      ⚙
    </button>
  </div>
);

export default NudgeCog;
