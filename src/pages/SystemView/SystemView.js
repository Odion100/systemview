import React, { useState, useEffect, useRef } from "react";
import { useParams, useHistory, useLocation } from "react-router-dom";
import SystemNavigator from "../../organisms/SystemNavigator/SystemNavigator";
import Documentation from "../../organisms/Documentation/Documentation";
import TestPanel from "../../organisms/TestPanel/TestPanel";
import PageHeader from "../../organisms/PageHeader/PageHeader";
import AgentChat from "../../organisms/AgentChat/AgentChat";
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

  // The open file lives in the URL as well as in state, so the BROWSER BACK BUTTON works: opening a
  // file (from the codebase tree, a story pane, or a `:file[…]` link in a document) pushes a history
  // entry, and going back drops the params — which closes the file and puts the nav lens back where
  // it was. It also makes a file view shareable/deep-linkable, which the localStorage-only version
  // never was.
  const history = useHistory();
  const location = useLocation();
  const fileFromUrl = React.useMemo(() => {
    const p = new URLSearchParams(location.search);
    const path = p.get("file");
    if (!path) return null;
    const lines = p.get("flines");
    return {
      projectCode: p.get("fproj") || undefined,
      serviceId: p.get("fsvc") || undefined,
      path,
      language: p.get("flang") || "text",
      lines: lines ? lines.split("-").map((n) => parseInt(n, 10)) : null,
    };
  }, [location.search]);

  const closeFile = React.useCallback(() => {
    const p = new URLSearchParams(window.location.search);
    // Closing restores the center tab you were on before the file forced Code (ftab, set on open).
    const ftab = p.get("ftab");
    ["file", "fproj", "fsvc", "flang", "flines", "fnav", "ftab"].forEach((k) => p.delete(k));
    if (ftab) p.set("tab", ftab);
    history.push({ pathname: window.location.pathname, search: p.toString() });
  }, [history]);

  const openFile = React.useCallback(
    (detail) => {
      // The codebase nav closes with onOpenFile(null) — same exit as the pane's × button.
      if (!detail) return closeFile();
      const p = new URLSearchParams(window.location.search);
      // Remember the lens and center tab we came FROM so close/back can restore them. Opening a
      // file SHOWS the file: the center flips to Code — clicking a file from the Stage tab must
      // not leave you staring at Stage with the file silently selected behind it.
      if (!p.get("file")) {
        p.set("fnav", navTab);
        p.set("ftab", p.get("tab") || "docs");
      }
      p.set("tab", "docs");
      p.delete("help"); // opening a file is explicit navigation — help must not stay over it
      p.set("file", detail.path);
      if (detail.projectCode) p.set("fproj", detail.projectCode);
      if (detail.serviceId) p.set("fsvc", detail.serviceId);
      if (detail.language) p.set("flang", detail.language);
      if (detail.lines && detail.lines[0]) p.set("flines", detail.lines.join("-"));
      else p.delete("flines");
      history.push({ pathname: window.location.pathname, search: p.toString() });
    },
    [history, navTab, closeFile],
  );

  // URL → state. This is the ONLY writer of codeFile/navTab for file opens, so forward and back
  // both land in a consistent place.
  useEffect(() => {
    const p = new URLSearchParams(location.search);
    if (fileFromUrl) {
      setNavTab("files");
      setCodeFile((cur) =>
        cur && cur.path === fileFromUrl.path && String(cur.lines) === String(fileFromUrl.lines)
          ? cur
          : fileFromUrl,
      );
    } else {
      setCodeFile(null);
      const prev = p.get("fnav");
      if (prev) setNavTab(prev);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fileFromUrl && fileFromUrl.path, fileFromUrl && String(fileFromUrl.lines), location.search]);

  // A story pane's file link, or a ⌘-click on a `:file[…]` chip, OPENS a file here.
  useEffect(() => {
    const onOpen = (e) => openFile(e.detail);
    window.addEventListener("sv:openFileInNav", onOpen);
    return () => window.removeEventListener("sv:openFileInNav", onOpen);
  }, [openFile]);

  // HELP rides the URL as `?help=<topic>` (RFC-026). Opening a topic PUSHES — every topic is a
  // history entry, so the back button walks help→help→document with no special casing. Closing
  // REPLACES (a close is not a place you go back to). Any real navigation drops the param.
  useEffect(() => {
    const onHelp = (e) => {
      const topic = (e.detail || {}).topic;
      const p = new URLSearchParams(window.location.search);
      if (topic) {
        if (p.get("help") === topic) return;
        p.set("help", topic);
        history.push({ pathname: window.location.pathname, search: p.toString() });
      } else {
        if (!p.get("help")) return;
        p.delete("help");
        history.replace({ pathname: window.location.pathname, search: p.toString() });
      }
    };
    window.addEventListener("sv:help", onHelp);
    return () => window.removeEventListener("sv:help", onHelp);
  }, [history]);

  // REVEAL (RFC-025) — a `:ns[…]` or `:file[…]` chip clicked inside a document points the NAVIGATOR at
  // its target without touching the centre: the tree expands to it and highlights it, and the document
  // you were reading stays exactly where it was. Selecting is then YOUR click.
  // Deliberately NOT in the URL: this is a pointer, not a location, so it must not push history.
  // RFC-026 — reveals DON'T flip the lens: the codebase card carries services AND files, so a
  // namespace reveal resolves wherever you are. The one exception is a file reveal while on the
  // SystemLynx lens, which has nowhere to show a file.
  const [reveal, setReveal] = useState(null);
  useEffect(() => {
    const onReveal = (e) => {
      const d = e.detail || {};
      // Files and help rows only exist in the Codebases lens — those reveals flip to it; namespace
      // reveals resolve wherever you are.
      if (d.kind === "file" || d.kind === "help") setNavTab("files");
      setReveal(d);
    };
    window.addEventListener("sv:revealInNav", onReveal);
    return () => window.removeEventListener("sv:revealInNav", onReveal);
  }, []);
  // An explicit selection (navigating for real) retires the pointer — it has been acted on.
  useEffect(() => {
    setReveal(null);
  }, [projectCode, serviceId, moduleName, methodName]);
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
              onOpenFile={openFile}
              reveal={reveal}
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
            codeFile={codeFile}
            onCloseFile={closeFile}
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
      {/* RFC-028 — the agent bots: one per connected project, visible at ALL times (never tied to
          the namespace you're standing on); presence-true rings, view-stamped messages. */}
      <AgentChat />
    </section>
  );
};

export default SystemViewPage;
