import React, { useState, useEffect, useRef } from "react";
import ErrorBoundary from "../../atoms/ErrorBoundary/ErrorBoundary";
import { useParams, useHistory, useLocation } from "react-router-dom";
import { getTabs, openTab, fileKey } from "./tabsStore";
import SystemNavigator from "../../organisms/SystemNavigator/SystemNavigator";
import Documentation from "../../organisms/Documentation/Documentation";
import TestPanel from "../../organisms/TestPanel/TestPanel";
import PageHeader from "../../organisms/PageHeader/PageHeader";
import AgentChat from "../../organisms/AgentChat/AgentChat";
import NavRail from "../../organisms/AgentNav/NavRail";
import useWallPanel from "../../organisms/WallPanel/useWallPanel";
import WallTab from "../../organisms/WallPanel/WallTab";
import "./styles.scss";

// Extension → the editor's language names (see atoms/CodeView/languages.js). Anything unknown is
// text, honestly, rather than a guess that colors wrong.
export const langOfPath = (p = "") => {
  const ext = String(p).split(".").pop().toLowerCase();
  return (
    { js: "javascript", jsx: "javascript", mjs: "javascript", cjs: "javascript", ts: "typescript",
      tsx: "typescript", json: "json", md: "markdown", scss: "scss", sass: "sass", less: "less",
      css: "css", html: "html", xml: "xml", yml: "yaml", yaml: "yaml", py: "python", sql: "sql" }[ext] || "text"
  );
};

const SystemViewPage = ({ params = null }) => {
  // THE ADDRESS CAN ARRIVE AS A PROP, because this page stays MOUNTED while you are on Agents
  // (see KeptPane) and a route that does not match hands back nothing. `useParams()` is still the
  // answer when it does match, so nothing that renders this inside a plain Route changes.
  const matched = useParams();
  const { projectCode, serviceId, moduleName, methodName } = params || matched;
  // Both side panels de-expand into their corners so the middle (Stories/Docs) gets the space.
  // The open/collapsed state PERSISTS across refresh (localStorage) — you get the layout back exactly.
  // RFC-052 — the rail rises with the docked agent you click (see bringToFront in AgentChat).
  const [railZ, setRailZ] = useState(8400);
  useEffect(() => {
    const on = (e) => setRailZ((e.detail && e.detail.z) || 8400);
    window.addEventListener("sv:railFront", on);
    return () => window.removeEventListener("sv:railFront", on);
  }, []);
  // RFC-052 panels, on the EXTRACTED engine (organisms/WallPanel) — same storage keys, same clamps,
  // same thresholds as the hand-written version this replaces, so a saved layout survives the move.
  // Destructured under the names the rest of this file always used.
  const rowRef = useRef(null);
  const { open: navOpen, setOpen: setNavOpen, w: navW, setW: setNavW, startDrag: navDrag, startPull: navPull } =
    useWallPanel({ name: "nav", side: "left", rowRef, defaultW: 25, min: 12, max: 45, collapseAt: 7, pullGuard: (e) => !!(e.target.closest && e.target.closest(".agent-chat")), });
  const { open: scratchOpen, setOpen: setScratchOpen, w: scratchW, setW: setScratchW, startDrag: scratchDrag, startPull: scratchPull } =
    useWallPanel({ name: "scratch", side: "right", rowRef, defaultW: 25, min: 15, max: 50, collapseAt: 9, pullGuard: (e) => !!(e.target.closest && e.target.closest(".agent-chat")), });
  useEffect(() => {
    // The bot's pop-out codebase panel exists only BECAUSE the navigator is away — so it has to know
    // the moment that changes, rather than reading a flag it has no reason to re-check.
    window.dispatchEvent(new CustomEvent("sv:navOpen", { detail: { open: navOpen } }));
  }, [navOpen]);
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
      // RFC-069 — a MACHINE file: absolute path, no project. `fproj` is absent on purpose; the
      // flag is what tells the pane to read through the machine door instead of a project's.
      machine: p.get("fmachine") === "1" || undefined,
      projectCode: p.get("fmachine") === "1" ? "" : p.get("fproj") || undefined,
      serviceId: p.get("fsvc") || undefined,
      path,
      // THE LANGUAGE COMES FROM THE FILE, NOT FROM WHICH DOOR OPENED IT. Only some doors set
      // `flang` (the tree does; the version-control lens and the feed's diff button did not), so
      // the same .js file was colored from one click and gray from another — his "sometimes",
      // measured in his window: `flang: null`, editor told `text`, zero token spans. The
      // extension is always there; it is the fallback every door now shares.
      language: p.get("flang") || langOfPath(path),
      lines: lines ? lines.split("-").map((n) => parseInt(n, 10)) : null,
      // Which side of the index you opened from (the version-control lens) — in the URL like
      // everything else, so a refresh keeps showing what you asked for.
      side: p.get("fside") || undefined,
      // AT WHICH COMMIT. A file opened from a commit RECORD is not the file as it is now — it is
      // the file as it stood when that commit landed, with that commit's changes down the gutter.
      // Without this the record's rows would open today's working copy under a header naming a
      // commit from last month, which is the surface testifying.
      sha: p.get("fsha") || undefined,
    };
  }, [location.search]);

  const closeFile = React.useCallback(() => {
    const p = new URLSearchParams(window.location.search);
    // Closing restores the center tab you were on before the file forced Code (ftab, set on open).
    const ftab = p.get("ftab");
    ["file", "fproj", "fsvc", "flang", "flines", "fnav", "ftab", "fside", "fsha", "fmachine"].forEach((k) => p.delete(k));
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
      if (detail.machine) {
        p.set("fmachine", "1");
        p.delete("fproj");
        p.delete("fsvc");
      } else {
        p.delete("fmachine");
        if (detail.projectCode) p.set("fproj", detail.projectCode);
        if (detail.serviceId) p.set("fsvc", detail.serviceId);
      }
      // ALWAYS SET, OR ALWAYS CLEAR — never leave the last file's answer behind. Every other param
      // here has its else (`fside` deletes, `flines` drops on a different file); this one did not,
      // so a door that names no language handed the NEW file the OLD file's `flang`. Open a .md,
      // then open a .js from the changes list, and the URL says markdown about a JavaScript file —
      // pinned, surviving refreshes, seeding `sv.codeFile`. Downstream that is a document rendered
      // through the markdown renderer and an editor loading the wrong grammar: gray text with
      // nothing on screen to explain it.
      if (detail.language) p.set("flang", detail.language);
      else p.delete("flang");
      if (detail.lines && detail.lines[0]) p.set("flines", detail.lines.join("-"));
      else if (p.get("file") !== detail.path) p.delete("flines"); // a DIFFERENT file drops the range
      if (detail.side) p.set("fside", detail.side);
      else p.delete("fside"); // opened from the tree, not from a side of the index
      // ALWAYS SET OR ALWAYS CLEAR, the rule `flang` was fixed under: a record's file leaving its
      // sha behind would pin the NEXT file you open to a commit it has nothing to do with.
      if (detail.sha) p.set("fsha", detail.sha);
      else p.delete("fsha");
      // …same file, no lines given: leave whatever range is already there alone.
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
        cur &&
        cur.path === fileFromUrl.path &&
        String(cur.lines) === String(fileFromUrl.lines) &&
        cur.side === fileFromUrl.side &&
        cur.sha === fileFromUrl.sha
          ? cur
          : fileFromUrl,
      );
    } else {
      setCodeFile(null);
      const prev = p.get("fnav");
      if (prev) setNavTab(prev);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fileFromUrl && fileFromUrl.path, fileFromUrl && String(fileFromUrl.lines), fileFromUrl && fileFromUrl.side, fileFromUrl && fileFromUrl.sha, location.search]);

  // A REFERENCE OPENS BESIDE YOU — it does not take you off the page you are reading.
  //
  // His ruling, and he generalised it himself: *"stop taking you to the new page and just add a
  // tab right next door to the dashboard tab… and that's in general. The progress display in the
  // arcs or anything like that — you shouldn't navigate away, you should just open up the tab
  // next to you."* Following a reference off the dashboard used to throw the centre over to the
  // file and take the dashboard off screen, so reading a list of twelve owed documents meant
  // twelve round trips back.
  //
  // The tab lands directly after the one you are on and nothing else moves. It is a real tab:
  // pressing it routes to the file exactly as before, because `clickTab` already does that.
  //
  // THE EXCEPTION IS AN EMPTY STRIP. With nothing open there is nowhere to stay, and a tab
  // nobody is looking at over an empty centre is a hidden file — so that case navigates, which
  // `openTab`'s own `focus` rule already decides.
  //
  // IT IS OPT-IN, AND THAT IS THE WHOLE RULE — `beside: true` on the detail, set only by a surface
  // in the CENTRE: a document linking to another document, the dashboard, an arc's progress. His
  // correction, after I applied it to everything: *"why the hell am I clicking on files from the
  // chat and they're not opening? That only applies to when you're in the document and you're
  // opening up another document, or when you're in the document area and you're clicking a link
  // to another one."*
  //
  // The chat is not a place you are reading a document FROM, so a chip there means "show me this"
  // — the old behaviour, and the default again. A default of "beside" turned every file chip in
  // the conversation into a tab that silently appeared somewhere else.
  useEffect(() => {
    const onOpen = (e) => {
      const d = e.detail || {};
      const pane = (getTabs(projectCode).panes || [])[0] || { tabs: [], active: "" };
      if (d.navigate || !d.beside || !pane.tabs.length) return openFile(d);
      const file = {
        projectCode: d.machine ? "" : d.projectCode || "",
        path: d.path,
        ...(d.machine ? { machine: true } : {}),
        ...(d.serviceId ? { serviceId: d.serviceId } : {}),
        ...(d.language ? { language: d.language } : {}),
        ...(d.lines ? { lines: d.lines } : {}),
        ...(d.side ? { side: d.side } : {}),
        ...(d.sha ? { sha: d.sha } : {}),
      };
      if (!file.path) return undefined;
      return openTab(projectCode, { key: fileKey(file), kind: "file", file }, { beside: pane.active, focus: false });
    };
    window.addEventListener("sv:openFileInNav", onOpen);
    return () => window.removeEventListener("sv:openFileInNav", onOpen);
  }, [openFile, projectCode]);

  // RFC-029 `act` — a watchable run needs the scratchpad VISIBLE; the executor asks for it.
  useEffect(() => {
    // POINTING AT A CLOSED PANEL OPENS IT (his correction: "it didn't correctly do nothing — it was
    // supposed to open it"). Silence was the right answer for something that doesn't exist; a panel
    // that's merely collapsed is a different case, and the agent naming it is reason enough to show
    // it. The pointer retries once the panel is up.
    const onOpenRegion = (e) => {
      const r = ((e && e.detail) || {}).region;
      if (r === "nav") setNavOpen(true);
      else if (r === "scratchpad" || r === "tests") setScratchOpen(true);
    };
    // The `</>` in the bot's name-tag row: BRING THE CODEBASE UP. That's all it does — it was a
    // toggle for a moment and closing the nav is not what "bring up the codebase" means.
    const onCodebase = () => {
      setNavOpen(true);
      setNavTab("files");
    };
    window.addEventListener("sv:codebase", onCodebase);
    window.addEventListener("sv:openRegion", onOpenRegion);
    const onOpenScratch = () => setScratchOpen(true);
    window.addEventListener("sv:openScratchpad", onOpenScratch);
    return () => {
      window.removeEventListener("sv:codebase", onCodebase);
      window.removeEventListener("sv:openRegion", onOpenRegion);
      window.removeEventListener("sv:openScratchpad", onOpenScratch);
    };
  }, []);

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
    // A `::commit` block handing its message to the panel — the box only exists on the Codebases
    // lens, so arriving there is part of the hand-off. The nav card itself does the rest.
    const onCommitInNav = () => setNavTab("files");
    window.addEventListener("sv:commitInNav", onCommitInNav);
    return () => {
      window.removeEventListener("sv:revealInNav", onReveal);
      window.removeEventListener("sv:commitInNav", onCommitInNav);
    };
  }, []);
  // An explicit selection (navigating for real) retires the pointer — it has been acted on.
  useEffect(() => {
    setReveal(null);
  }, [projectCode, serviceId, moduleName, methodName]);
  return (
    <section className="system-viewer" data-sv="page">
      <PageHeader projectCode={projectCode} current="specs" />
      <div className="row" ref={rowRef}>
        {/* Left navigator — collapses into the LEFT corner (its handle sits by "Load Service"). */}
        <div
          data-sv="nav"
          className={`nav-panel ${navOpen ? "col-3 nav-panel--open" : "nav-panel--collapsed"}`}
          style={navOpen ? { flex: `0 0 ${navW}%`, maxWidth: `${navW}%` } : { zIndex: railZ }}
        >
          {/* RFC-052 — the collapsed rail is the SHARED NavRail (same one every other page uses);
              only the edge behaviour differs here — a drag-to-pull instead of a click. */}
          {!navOpen && (
            <NavRail
              label="Navigator"
              onExpand={() => setNavOpen(true)}
              edgeTitle="Drag to pull the navigator out"
              edgeProps={{ onMouseDown: navPull }}
            />
          )}
          <div
            className="nav-panel__body"
            style={{ display: navOpen ? "block" : "none" }}
          >
            {/* ONE COLUMN AT A TIME. A throw in the navigator used to take the centre, the
                scratchpad and the chat with it — now it greys its own column and the document you
                were reading stays on screen. */}
            <ErrorBoundary label="The navigator">
              <SystemNavigator
                projectCode={projectCode}
                serviceId={serviceId}
                moduleName={moduleName}
                methodName={methodName}
                onCollapse={() => setNavOpen(false)}
                openFile={codeFile}
                onOpenFile={openFile}
                reveal={reveal}
              />
            </ErrorBoundary>
          </div>
        </div>

        {/* Drag handle: nav ⇄ center. Drag past the edge to collapse; double-click resets the size. */}
        {navOpen && (
          <div
            className="panel-divider"
            title="Drag to resize · double-click to reset"
            onMouseDown={navDrag}
            onDoubleClick={() => setNavW(25)}
          />
        )}

        {/* Middle fills whatever the two side panels give back. Margin only when a side is collapsed,
            so its corner tab doesn't hover over the center. */}
        <div
          data-sv="center"
          className={`center-panel col-${12 - (navOpen ? 3 : 0) - (scratchOpen ? 3 : 0)} ${!navOpen ? "center-panel--nav-collapsed" : ""} ${!scratchOpen ? "center-panel--scratch-collapsed" : ""}`}
          style={{ flex: "1 1 0%", maxWidth: "none", width: "auto", minWidth: 0 }}
        >
          <ErrorBoundary label="The document">
            <Documentation
              projectCode={projectCode}
              serviceId={serviceId}
              moduleName={moduleName}
              methodName={methodName}
              codeFile={codeFile}
              onCloseFile={closeFile}
            />
          </ErrorBoundary>
        </div>

        {/* Drag handle: center ⇄ scratchpad. Drag past the edge to collapse; double-click resets. */}
        {scratchOpen && (
          <div
            className="panel-divider"
            title="Drag to resize · double-click to reset"
            onMouseDown={scratchDrag}
            onDoubleClick={() => setScratchW(25)}
          />
        )}

        {/* Right scratchpad — collapses into the RIGHT corner (its handle sits by "Scratch Pad"). */}
        <div
          data-sv="scratchpad"
          className={scratchOpen ? "scratchpad col-3 scratchpad--open" : "wall-dock wall-dock--slot-1"}
          style={scratchOpen ? { flex: `0 0 ${scratchW}%`, maxWidth: `${scratchW}%` } : undefined}
        >
          {!scratchOpen && (
            <WallTab side="right" label="Scratchpad" onPull={scratchPull} onOpen={() => setScratchOpen(true)} />
          )}
          <div
            className="scratchpad__body"
            style={{ display: scratchOpen ? "block" : "none" }}
          >
            <ErrorBoundary label="The scratchpad">
              <TestPanel
                projectCode={projectCode}
                serviceId={serviceId}
                moduleName={moduleName}
                methodName={methodName}
                onCollapse={() => setScratchOpen(false)}
              />
            </ErrorBoundary>
          </div>
        </div>
      </div>
      {/* RFC-028 — the agent bots: one per connected project, visible at ALL times (never tied to
          the namespace you're standing on); presence-true rings, view-stamped messages. */}
      {/* THE CHAT IS THE ONE HE CANNOT AFFORD TO LOSE — it holds the conversation. Both crashes
          on 2026-10-19 started in a panel INSIDE it (a board card with no account), so it carries
          its own boundary as well as the per-panel ones in the band. */}
      <ErrorBoundary label="The agent chat">
        <AgentChat />
      </ErrorBoundary>
    </section>
  );
};

export default SystemViewPage;
