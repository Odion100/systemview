import React, { useState, useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import SystemNavigator from "../../organisms/SystemNavigator/SystemNavigator";
import Documentation from "../../organisms/Documentation/Documentation";
import TestPanel from "../../organisms/TestPanel/TestPanel";
import PageHeader from "../../organisms/PageHeader/PageHeader";
import "./styles.scss";

const SystemViewPage = () => {
  const { projectCode, serviceId, moduleName, methodName } = useParams();
  // Both side panels de-expand into their corners so the middle (Stories/Docs) gets the space.
  // The open/collapsed state PERSISTS across refresh (localStorage) — you get the layout back exactly.
  const [navOpen, setNavOpen] = useState(
    () => localStorage.getItem("sv.navOpen") !== "false",
  );
  const [scratchOpen, setScratchOpen] = useState(
    () => localStorage.getItem("sv.scratchOpen") !== "false",
  );
  useEffect(() => {
    localStorage.setItem("sv.navOpen", String(navOpen));
  }, [navOpen]);
  useEffect(() => {
    localStorage.setItem("sv.scratchOpen", String(scratchOpen));
  }, [scratchOpen]);
  // RFC-022 — the LENS (SystemLynx services ⇄ Codebase files) and the file open in the Code center
  // live at the PAGE level: the nav picks, the center shows. Both persist across refresh.
  const [navTab, setNavTab] = useState(
    () => localStorage.getItem("sv.navTab") || "systemlynx",
  );
  useEffect(() => {
    localStorage.setItem("sv.navTab", navTab);
  }, [navTab]);
  const [codeFile, setCodeFile] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("sv.codeFile")) || null;
    } catch {
      return null;
    }
  });
  useEffect(() => {
    localStorage.setItem("sv.codeFile", JSON.stringify(codeFile));
  }, [codeFile]);
  // A story pane's file OR test link selects the file in the CODEBASES NAV (tab switch + tree
  // selection). The CENTER stays where it is — switching it to Code is the user's own click.
  useEffect(() => {
    const onOpen = (e) => {
      setNavTab("files");
      setCodeFile(e.detail);
    };
    window.addEventListener("sv:openFileInNav", onOpen);
    return () => window.removeEventListener("sv:openFileInNav", onOpen);
  }, []);
  // RESIZABLE PANELS — drag the divider between nav|center and center|scratchpad. Widths are % of the
  // row, clamped so nothing can be dragged to death, persisted so the layout comes back.
  const clampNav = (v) => Math.min(45, Math.max(12, v));
  const clampScratch = (v) => Math.min(50, Math.max(15, v));
  const [navW, setNavW] = useState(() => {
    const v = parseFloat(localStorage.getItem("sv.navW"));
    return isNaN(v) ? 25 : clampNav(v);
  });
  const [scratchW, setScratchW] = useState(() => {
    const v = parseFloat(localStorage.getItem("sv.scratchW"));
    return isNaN(v) ? 25 : clampScratch(v);
  });
  useEffect(() => {
    localStorage.setItem("sv.navW", String(navW));
  }, [navW]);
  useEffect(() => {
    localStorage.setItem("sv.scratchW", String(scratchW));
  }, [scratchW]);
  const rowRef = useRef(null);
  const dragRef = useRef(null); // "nav" | "scratch" while a divider is held
  const startDrag = (which) => (e) => {
    e.preventDefault();
    dragRef.current = which;
    document.body.classList.add("panel-resizing");
  };
  useEffect(() => {
    const up = () => {
      dragRef.current = null;
      document.body.classList.remove("panel-resizing");
    };
    const move = (e) => {
      if (!dragRef.current || !rowRef.current) return;
      const rect = rowRef.current.getBoundingClientRect();
      if (dragRef.current === "nav") {
        const raw = ((e.clientX - rect.left) / rect.width) * 100;
        // Dragged past the edge → COLLAPSE into the corner tab (another way to minimize).
        if (raw < 7) {
          setNavOpen(false);
          return up();
        }
        setNavW(clampNav(raw));
      } else {
        const raw = ((rect.right - e.clientX) / rect.width) * 100;
        if (raw < 9) {
          setScratchOpen(false);
          return up();
        }
        setScratchW(clampScratch(raw));
      }
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
    return () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <section className="system-viewer">
      <PageHeader projectCode={projectCode} current="specs" />
      <div className="row" ref={rowRef}>
        {/* Left navigator — collapses into the LEFT corner (its handle sits by "Load Service"). */}
        <div
          className={`nav-panel ${navOpen ? "col-3 nav-panel--open" : "nav-panel--collapsed"}`}
          style={navOpen ? { flex: `0 0 ${navW}%`, maxWidth: `${navW}%` } : undefined}
        >
          {!navOpen && (
            <button
              type="button"
              className="nav-panel__toggle"
              title="Expand the navigator"
              onClick={() => setNavOpen(true)}
            >
              Navigator ›
            </button>
          )}
          <div
            className="nav-panel__body"
            style={{ display: navOpen ? "block" : "none" }}
          >
            <SystemNavigator
              projectCode={projectCode}
              serviceId={serviceId}
              moduleName={moduleName}
              methodName={methodName}
              onCollapse={() => setNavOpen(false)}
              navTab={navTab}
              setNavTab={setNavTab}
              openFile={codeFile}
              onOpenFile={setCodeFile}
            />
          </div>
        </div>

        {/* Drag handle: nav ⇄ center. Drag past the edge to collapse; double-click resets the size. */}
        {navOpen && (
          <div
            className="panel-divider"
            title="Drag to resize · double-click to reset"
            onMouseDown={startDrag("nav")}
            onDoubleClick={() => setNavW(25)}
          />
        )}

        {/* Middle fills whatever the two side panels give back. Margin only when a side is collapsed,
            so its corner tab doesn't hover over the center. */}
        <div
          className={`center-panel col-${12 - (navOpen ? 3 : 0) - (scratchOpen ? 3 : 0)} ${!navOpen ? "center-panel--nav-collapsed" : ""} ${!scratchOpen ? "center-panel--scratch-collapsed" : ""}`}
          style={{ flex: "1 1 0%", maxWidth: "none", width: "auto", minWidth: 0 }}
        >
          <Documentation
            projectCode={projectCode}
            serviceId={serviceId}
            moduleName={moduleName}
            methodName={methodName}
            lens={navTab}
            codeFile={codeFile}
            onCloseFile={() => setCodeFile(null)}
          />
        </div>

        {/* Drag handle: center ⇄ scratchpad. Drag past the edge to collapse; double-click resets. */}
        {scratchOpen && (
          <div
            className="panel-divider"
            title="Drag to resize · double-click to reset"
            onMouseDown={startDrag("scratch")}
            onDoubleClick={() => setScratchW(25)}
          />
        )}

        {/* Right scratchpad — collapses into the RIGHT corner (its handle sits by "Scratch Pad"). */}
        <div
          className={`scratchpad ${scratchOpen ? "col-3 scratchpad--open" : "scratchpad--collapsed"}`}
          style={scratchOpen ? { flex: `0 0 ${scratchW}%`, maxWidth: `${scratchW}%` } : undefined}
        >
          {!scratchOpen && (
            <button
              type="button"
              className="scratchpad__toggle"
              title="Expand the scratchpad"
              onClick={() => setScratchOpen(true)}
            >
              ‹ Scratchpad
            </button>
          )}
          <div
            className="scratchpad__body"
            style={{ display: scratchOpen ? "block" : "none" }}
          >
            <TestPanel
              projectCode={projectCode}
              serviceId={serviceId}
              moduleName={moduleName}
              methodName={methodName}
              onCollapse={() => setScratchOpen(false)}
            />
          </div>
        </div>
      </div>
    </section>
  );
};

export default SystemViewPage;
