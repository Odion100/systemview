import React, { useRef } from "react";
import NavRail from "./NavRail";
import SystemNavigator from "../SystemNavigator/SystemNavigator";
import useWallPanel from "../WallPanel/useWallPanel";

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
  // THE ONE ENGINE (organisms/WallPanel) — this wrapper ran on `usePanelDrag`, an earlier nav-only
  // extraction of the same logic, which made two engines the day useWallPanel was born. Folded
  // 2026-10-16; same keys (`sv.navW`/`sv.navOpen`), so nothing about the panel's memory changed.
  // The row is the panel's parent — measured through a getter so the engine reads it live.
  const navRef = useRef(null);
  const rowLike = { get current() { return navRef.current && navRef.current.parentElement; } };
  const { open, setOpen, w, setW, startDrag, startPull } =
    useWallPanel({ name: "nav", side: "left", rowRef: rowLike, defaultW: 25, min: 12, max: 45, collapseAt: 7 });
  const toggle = setOpen;
  const resetW = () => setW(25);

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
          {/* A FILE IN THE TREE HAD NOWHERE TO GO. `SystemNavigator`'s `onOpenFile` defaults to a
              no-op, and this wrapper never passed one — so on every page that uses the travelling
              navigator instead of Specs, clicking a file in the codebase did literally nothing. Not
              an error, not a navigation: nothing. Dispatching the same event the `:file` chip has
              always dispatched hands it to whatever page is listening, which opens it in the side
              panel. Specs keeps its own handler; nothing there changes. */}
          <SystemNavigator
            projectCode={projectCode}
            onCollapse={() => toggle(false)}
            onOpenFile={(d) => window.dispatchEvent(new CustomEvent("sv:openFileInNav", { detail: d }))}
          />
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
