import React from "react";
import { DockSpots } from "../AgentChat/AgentChat";

// THE COLLAPSED NAV RAIL — ONE implementation (his rule: reuse, don't recreate). Used by Specs'
// navigator and by AgentNav on every other page. Holds the fixed `#sv-agent-rail`, so docked agents
// portal in wherever the nav lives — docking never means disappearing (RFC-052). The edge is
// drag-to-pull on Specs and click-to-expand elsewhere, so the caller supplies the edge handlers;
// everything else is identical and lives here, not copied per page.
export default function NavRail({ label = "Navigator", onExpand, edgeProps = {}, edgeTitle }) {
  return (
    <>
      <button type="button" className="nav-panel__toggle" title={`Expand the ${label.toLowerCase()}`} onClick={onExpand}>
        {label} ›
      </button>
      <div id="sv-agent-rail" className="nav-panel__rail">
        <DockSpots />
      </div>
      <div className="panel-divider panel-divider--edge panel-divider--edge-left" title={edgeTitle} {...edgeProps} />
    </>
  );
}
