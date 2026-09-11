import React, { useCallback, useState } from "react";
import NavRail from "./NavRail";
import SystemNavigator from "../SystemNavigator/SystemNavigator";
import usePanelDrag from "./usePanelDrag";

// RFC-052/RFC-055 — THE NAVIGATOR TRAVELS. Not an "agent nav", not a second side panel with its
// own rules (his call: "we already have a navigation tab — what the fuck do you need a new nav
// for?"). This is the SAME navigator Specs has — Projects and Agents tabs inside ITS strip, the
// codebase cards and the agent cards both riding along — wrapped in the same nav-panel shell with
// the same gestures: divider drag, collapse past the edge, pull the collapsed strip back out.
// Same width key, same open key, so it is one panel wherever you meet it.
//
// The collapsed rail holds `#sv-agent-rail`, so docked agents portal in and survive a refresh on
// any page.
const AgentNav = ({ projectCode = null }) => {
  const [open, setOpen] = useState(() => localStorage.getItem("sv.navOpen") !== "false");
  const toggle = useCallback((next) => {
    setOpen(next);
    localStorage.setItem("sv.navOpen", String(next));
  }, []);
  const { w, navRef, startDrag, startPull, resetW } = usePanelDrag({ setOpen: toggle });

  return (
    <>
      <div
        data-sv="nav"
        ref={navRef}
        className={`nav-panel ${open ? "col-3 nav-panel--open" : "nav-panel--collapsed"}`}
        style={open ? { flex: `0 0 ${w}%`, maxWidth: `${w}%` } : undefined}
      >
        {!open && (
          <NavRail
            label="Navigator"
            onExpand={() => toggle(true)}
            edgeTitle="Drag to pull the navigator out"
            edgeProps={{ onMouseDown: startPull }}
          />
        )}
        <div className="nav-panel__body" style={{ display: open ? "block" : "none" }}>
          <SystemNavigator projectCode={projectCode} onCollapse={() => toggle(false)} />
        </div>
      </div>
      {open && (
        <div
          className="panel-divider"
          title="Drag to resize · double-click to reset"
          onMouseDown={startDrag}
          onDoubleClick={resetW}
        />
      )}
    </>
  );
};

export default AgentNav;
