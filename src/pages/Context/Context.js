import React, { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useHistory, useLocation } from "react-router-dom";
import PageHeader from "../../organisms/PageHeader/PageHeader";
import AgentNav from "../../organisms/AgentNav/AgentNav";
import AgentProfile from "../../organisms/AgentProfile/AgentProfile";
import ContextManager from "../../organisms/ContextManager/ContextManager";
import CallStats from "../../organisms/CallStats/CallStats";
import CenterTabs, { useOpenByPath } from "../../organisms/CenterTabs/CenterTabs";
import DocPanel from "../../organisms/DocPanel/DocPanel";
import CodePane from "../../organisms/CodePane/CodePane";
import { getTabs, subscribeTabs, openTab, focusTab, closeTab, fileKey } from "../SystemView/tabsStore";
import { buildRoute } from "../SystemView/tabRoutes";
import { fileForDoc } from "./openAs";
import { langOfPath } from "../SystemView/SystemView";
import AgentChat from "../../organisms/AgentChat/AgentChat";
import { saveDoc, saveSkill, saveDef, saveHelp } from "../../utils/hostAgents";
import { saveJob } from "../../utils/hostJobs";
import useOpenedFile from "../../organisms/DocPanel/useOpenedFile";
import Board from "../../organisms/Board/Board";
import useWallPanel from "../../organisms/WallPanel/useWallPanel";
import WallTab from "../../organisms/WallPanel/WallTab";
import "./styles.scss";
import "./docarea.scss";

// RFC-055 — ONE PAGE, THREE PANELS (his design): the navigator on the left (the same one Specs
// has), the agent profile + context store in the middle, and the RIGHT panel is where documents
// open for editing — click a doc or a skill in the profile and it lands there on the code
// view/markdown machinery. Same expandable-panel rhythm as Specs.
//
// THE URL REMEMBERS WHERE HE IS (his call: "I'm tired of refreshing and not being where I am").
// ?agent=<id>&doc=doc:<key>|skill:<where>:<name>&scope=<scope> — selection, the open document,
// and the knowledge filter all round-trip through the query string, so a refresh lands exactly
// where he left. Same URL-backed discipline Specs already runs on.
const Context = () => {
  const { projectCode } = useParams();
  const history = useHistory();
  const location = useLocation();

  // Read once at mount — these seed the restore; live state owns itself afterwards.
  const seed = useMemo(() => {
    const p = new URLSearchParams(location.search);
    const rawDoc = p.get("doc");
    let doc = null;
    if (rawDoc) {
      const [kind, a, b] = rawDoc.split(":");
      doc = kind === "skill" ? { kind: "skill", where: a, name: b } : kind === "def" ? { kind: "def" } : kind === "help" ? { kind: "help", key: a } : { kind: "doc", key: a };
    }
    return { agent: p.get("agent"), doc, scope: p.get("scope"), view: p.get("view") };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // RFC-057 — PAGE LEVEL, NOT A CHIP AT THE BOTTOM. His correction after the store's statistics
  // panel landed in the scope row: store stats belong beside the store because they are ABOUT the
  // store, but "are these tools being used properly" is about the system and you should not have to
  // scroll past a notes list to reach it. URL-backed like everything else on this page.
  const [view, setView] = useState(seed.view === "stats" ? "stats" : "agents");
  const [agentId, setAgentId] = useState(seed.agent);
  // THE SAME TABS, THE SAME STATE (his correction, twice, 2026-10-15: *"it needs to actually be
  // the same component everywhere — meaning the same state"*). This view subscribes to the SAME
  // tabsStore the Code page's center runs on: a document opened here is a tab there and vice
  // versa — one open set per project, two hosts. Documents WITH a real path open as FILE tabs
  // through the machine door (RFC-069) in the real CodePane; documents with a SAVE DOOR instead
  // of a file — the def prompt, the def record, skills, jobs, help — ride as kind "agentdoc",
  // rendered by DocPanel with the door they always had.
  const tabsPc = projectCode || "@none";
  const [tabsState, setTabsState] = useState(() => getTabs(tabsPc));
  useEffect(() => {
    setTabsState(getTabs(tabsPc));
    return subscribeTabs(tabsPc, setTabsState);
  }, [tabsPc]);
  const pane = tabsState.panes[0];
  const [activeKey, setActiveKey] = useState(null);
  // Blob CONTENT is session state — the store persists the open set (addresses), never text. A
  // persisted agentdoc tab seen after a reload asks to be reopened from the profile.
  const [blobDocs, setBlobDocs] = useState({});
  const doc = (activeKey && blobDocs[activeKey]) || null;
  const activeTab = pane.tabs.find((t) => t.key === activeKey) || null;
  const docKeyOf = (d) =>
    `agentdoc:${d.kind}:${d.agentId || ""}:${d.kind === "skill" ? `${d.where}:${d.name}` : d.kind === "def" ? "def" : d.jobId || d.key || d.name || ""}`;
  const closeKey = (k) => {
    const nextKey = closeTab(tabsPc, k);
    setBlobDocs((cur) => { const { [k]: _gone, ...rest } = cur; return rest; });
    setActiveKey(nextKey || null);
    setUrl((p) => p.delete("doc"));
  };
  // With tabs standing but nothing focused (a reload), land on the last tab this page can render.
  useEffect(() => {
    if (activeKey || !pane.tabs.length) return;
    const last = [...pane.tabs].reverse().find((t) => t.kind === "file" || t.kind === "agentdoc");
    if (last) setActiveKey(last.key);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pane.tabs.length]);
  const plusDoor = useOpenByPath(tabsPc);
  const [focus, setFocus] = useState(() => (seed.scope ? { scope: seed.scope, n: 1 } : null));
  const [saving, setSaving] = useState(false);

  // THE DOCUMENT AREA IS A PANEL, WITH A PANEL'S MANNERS — on the EXTRACTED RFC-052 engine
  // (organisms/WallPanel), the same hook the Code page's nav and scratchpad run on. His correction,
  // twice in one day: first *"it's not resizable… you've got to be able to close it… the same
  // behavior the scratch pad has"*, then — after a hand-rolled copy shipped glitchy and off the
  // wall — *"we do it on the navigation tab as well… it should be componentized."* Collapsing never
  // closes tabs; the store keeps the open set.
  const rowRef = useRef(null);
  const { open: docOpen, setOpen: setDocOpen, w: docW, setW: setDocW, startDrag: docDrag, startPull: docPull } =
    useWallPanel({
      // the scratchpad's exact numbers — right-side panels, one feel (his: "this should be
      // universal… look how far the mouse stretches before it pulls"): min 22 made the reopen
      // gate sit a quarter of the row away.
      name: "ctxDoc", side: "right", rowRef, defaultW: 44, min: 15, max: 60, collapseAt: 9,
      pullGuard: (e) => !!(e.target.closest && e.target.closest(".agent-chat")),
    });
  // THE DOCUMENT PANEL STARTS CLOSED EVERY TIME YOU COME TO THIS PAGE. `useWallPanel` remembers
  // `open` in localStorage, which is right for a scratchpad and wrong here: he came back to the
  // Agents page with a document still fully open from last time, and the agents were behind it with
  // nothing to say so — *"you won't know that the agent stuff is hidden behind the document."* The
  // width still persists; only the open state is reset on mount. Opening a document (a click, or a
  // `?doc=` restore) still opens the panel — that is a deliberate act, not a leftover.
  useEffect(() => {
    setDocOpen(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  // One writer for the query string — replace, not push, so back still leaves the page cleanly.
  const setUrl = (mut) => {
    const p = new URLSearchParams(window.location.search);
    mut(p);
    const s = p.toString();
    history.replace(`${window.location.pathname}${s ? `?${s}` : ""}`);
  };

  // One resolver for every page (see useOpenedFile) — a file clicked anywhere on this page opens
  // as a FILE TAB in the shared store, machine-addressed when it has no project (RFC-069).
  // THE CHAT'S BOARD ICON ASKS THIS PAGE FIRST (his report, 2026-10-17: the links above the chat
  // "don't open up on the agent page… just open up the document display wherever it is"). Same
  // offer/handled contract the file door uses; only silence navigates.
  useEffect(() => {
    const onKind = (e) => {
      const d = (e && e.detail) || {};
      if (d.kind !== "board" || (d.projectCode && d.projectCode !== projectCode)) return;
      d.handled = true;
      openTab(tabsPc, { key: `board:${tabsPc}`, kind: "board" });
      // AND BRING IT TO FRONT — opening a tab you then have to go find is adding, not opening
      // (his catch: "it just adds the tab"). This page's active is local state, so the door sets it.
      setActiveKey(`board:${tabsPc}`);
      setDocOpen(true);
    };
    window.addEventListener("sv:openCenterKind", onKind);
    return () => window.removeEventListener("sv:openCenterKind", onKind);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectCode, tabsPc]);
  useOpenedFile(projectCode, (f) => {
    const file = {
      machine: !!f.machine || !f.projectCode || undefined,
      projectCode: f.machine ? "" : f.projectCode || projectCode || "",
      path: f.path,
      serviceId: f.serviceId || undefined,
      language: f.language || langOfPath(f.path),
      lines: f.lines || null,
    };
    const k = fileKey(file);
    openTab(tabsPc, { key: k, kind: "file", file });
    focusTab(tabsPc, k);
    setActiveKey(k);
    setDocOpen(true); // a clicked file is asking for the panel
  });

  const saveOpenDoc = async () => {
    // A read-only doc (a shipped skill — readable in full, not yours to change) has no save control
    // in the panel; this is the second lock, so no other path can reach a write the host refuses.
    if (!doc || doc.readOnly) return;
    setSaving(true);
    try {
      let res;
      if (doc.kind === "def") {
        // THE RAW DEFINITION FILE — parsed and handed back whole (saveDef normalizes). A JSON
        // typo throws before anything is written; the panel stays dirty so nothing is lost.
        const rec = JSON.parse(doc.text);
        res = await saveDef({ id: rec.id, name: rec.name, ...(rec.def || {}), projectCode: rec.projectCode, cwd: rec.cwd, permissionMode: rec.permissionMode, def: undefined });
        window.dispatchEvent(new CustomEvent("sv:botHub")); // the profile re-reads on this signal
      } else if (doc.kind === "skill") {
        res = await saveSkill(doc.agentId, doc.name, doc.where, doc.text);
      } else if (doc.kind === "job") {
        // A JOB IS SAVED FROM HERE NOW (2026-10-13). It used to return early, on the argument that
        // `job-authoring` into `jobsWrite` is what guarantees the six parts are in it — and that
        // argument confused AUTHORING with TYPING. He went to write one and found no way in: *"maybe
        // I got one from somewhere else and I copy and paste it, or write it myself."* Refusing the
        // paste did not make any job better written; it just meant every job on the machine had to
        // come through an agent.
        //
        // The host still refuses a save with an empty document (`jobs.save`: "a job needs its
        // document — job.json is a projection of it, not a substitute"), and `requires:` is still
        // read out of the front matter rather than typed anywhere else. So the guarantees that were
        // real are still real; what is gone is a lock that only stopped him.
        res = await saveJob({ id: doc.jobId, doc: doc.text });
        window.dispatchEvent(new CustomEvent("sv:botHub"));
      } else if (doc.kind === "help") {
        // page-level help — scoped to no agent, one shared file
        res = await saveHelp(doc.key, doc.text);
      } else {
        res = await saveDoc(doc.agentId, doc.key, doc.text);
      }
      if (res && res.ok === false) throw new Error(res.error || "save failed");
      setBlobDocs((cur) => (activeKey && cur[activeKey] ? { ...cur, [activeKey]: { ...cur[activeKey], orig: cur[activeKey].text } } : cur));
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="system-viewer" data-sv="page">
      <PageHeader projectCode={projectCode} current="context" />
      {/* The engine measures THE ROW — the one container whose rect stands still while the panel
          resizes. It sat on .ctx-center for a day, which SHRINKS as the panel grows, so the math
          went negative over the document: instant collapse, dead pulls — his "doesn't resize and
          close properly", root cause. */}
      <div className="row" ref={rowRef}>
        <AgentNav projectCode={projectCode} />
        <div className="center-panel ctx-center">
          <div className="ctx-page">
            <div className="ctx-page__views">
              {[["agents", "Agents & context"], ["stats", "Statistics"]].map(([k, label]) => (
                <button
                  key={k}
                  className={`ctx-page__view${view === k ? " ctx-page__view--on" : ""}`}
                  onClick={() => {
                    setView(k);
                    setUrl((p) => (k === "agents" ? p.delete("view") : p.set("view", k)));
                  }}
                >
                  {label}
                </button>
              ))}
            </div>

            {view === "stats" && <CallStats projectCode={projectCode} agentId={agentId} />}


            {/* HIDDEN, NOT UNMOUNTED. Gating this on `view` with a conditional threw the profile
                away on every tab switch — and remounting re-read the MOUNT-TIME url seed, which
                still named the doc he had closed, so coming back to this tab re-opened the side
                panel every time. A tab is a view of state you keep, not a component you destroy. */}
            <div style={view === "agents" ? undefined : { display: "none" }}>
            <AgentProfile
              projectCode={projectCode}
              urlAgent={seed.agent}
              urlDoc={seed.doc}
              onSelect={(id) => {
                setAgentId(id);
                // tabs STAND across agent switches now — each doc carries its own agentId, so
                // saving still lands on the right agent; closing is the tab's ✕, not a side effect
                setUrl((p) => {
                  if (id) p.set("agent", id);
                  else {
                    p.delete("agent");
                    p.delete("doc");
                  }
                });
              }}
              onOpenDoc={(next) => {
                // IF IT IS A FILE, POINT AT THE FILE (RFC-069). *"You can pull up that file and
                // that will work everywhere."* Presence, the system context and the CLAUDE.md stack
                // carry their path in `where`; a SKILL carries `path` and a JOB is `<dir>/job.md` —
                // all of them open as machine-file tabs in the real CodePane and save through the
                // machine door.
                //
                // THE POINT IS NOT TIDINESS, IT IS THAT AN ADDRESS SURVIVES AND A BLOB DOES NOT.
                // An agentdoc tab holds its text in this page's memory while the store persists
                // only the open set, so a refresh or a back/forward restored the TAB and had
                // nothing to put in it — *"the document is gone"*, under a hint telling him to
                // reopen it from the profile. A path is re-read, so there is nothing to restore.
                // What is left behind a save door is only what has no file: the definition prompt
                // and the def record.
                const filePath = fileForDoc(next);
                if (filePath) {
                  const file = { machine: true, projectCode: "", path: filePath, language: langOfPath(filePath) };
                  const k = fileKey(file);
                  if (k === activeKey) return closeKey(k); // SAME CHIP STILL TOGGLES (his call)
                  openTab(tabsPc, { key: k, kind: "file", file });
                  focusTab(tabsPc, k);
                  setActiveKey(k);
                  setDocOpen(true); // opening a document is asking for the panel
                  setUrl((p) => p.delete("doc"));
                  return;
                }
                const k = docKeyOf(next);
                if (k === activeKey) return closeKey(k);
                setDocOpen(true);
                setBlobDocs((cur) => ({ ...cur, [k]: next }));
                openTab(tabsPc, { key: k, kind: "agentdoc", adoc: { agentId: next.agentId, kind: next.kind, label: next.label || next.name || next.key } });
                focusTab(tabsPc, k);
                setActiveKey(k);
                setUrl((p) =>
                  p.set("doc", next.kind === "skill" ? `skill:${next.where}:${next.name}` : next.kind === "def" ? "def:file" : next.kind === "help" ? `help:${next.key}` : `doc:${next.key}`)
                );
              }}
              onFilterScope={(scope, note) => {
                setFocus((f) => ({ scope, note: note || null, n: (f ? f.n : 0) + 1 }));
                setUrl((p) => p.set("scope", scope));
              }}
            />
            {/* SEPARATE SECTION, close but distinguished (his call): a rule and its own label —
                this store searches universally, across every scope, not just the selected agent. */}
            <div className="ctx-store">
              <div className="ctx-store__head">
                Context store
                <span className="ctx-store__note">searches all scopes — not tied to the selected agent</span>
              </div>
              <ContextManager projectCode={projectCode} agentId={agentId} focus={focus} />
            </div>
            </div>
          </div>
        </div>
        {/* Drag handle: content ⇄ documents. Drag past the edge to collapse; double-click resets. */}
        {pane.tabs.length > 0 && docOpen && (
          <div
            className="panel-divider"
            title="Drag to resize · double-click to reset"
            onMouseDown={docDrag}
            onDoubleClick={() => setDocW(44)}
          />
        )}
        {pane.tabs.length > 0 && !docOpen && (
          <div className="wall-dock wall-dock--slot-1">
            <WallTab side="right" label="Documents" onPull={docPull} onOpen={() => setDocOpen(true)} />
          </div>
        )}
        {pane.tabs.length > 0 && docOpen && (
          <div
            // shrink 1, not 0 — nav can hold 45% and this 60%: past 100% the row used to shove this
            // panel's right edge (and its × buttons) off-screen; under pressure it gives, to its 320px floor
            className="ctx-docarea"
            style={{ flex: `0 1 ${docW}%`, maxWidth: `${docW}%` }}
          >
            {/* THE ONE STRIP — the same CenterTabs the Code page mounts, over the same store. This
                host's meaning: active is local state, a click on a kind this page can render
                focuses it, anything else routes to the Code page where that kind lives. */}
            <CenterTabs
              tabsPc={tabsPc}
              tabs={pane.tabs}
              isActive={(t) => t.key === activeKey}
              onOpen={(t) => {
                // board joined the renderable kinds with the 14-lane land, but this list wasn't
                // told — so clicking a board tab navigated to the Code page while the render
                // branch below sat unreachable (his catch). One list, kept beside the branches.
                if (t.kind === "file" || t.kind === "agentdoc" || t.kind === "board") {
                  focusTab(tabsPc, t.key);
                  setActiveKey(t.key);
                  return;
                }
                history.push(buildRoute(t, tabsPc, ""));
              }}
              afterClose={(nextKey, closed) => {
                if (closed) setBlobDocs((cur) => { const { [closed.key]: _gone, ...rest } = cur; return rest; });
                setActiveKey(nextKey || null);
              }}
              plus={plusDoor}
              onCollapse={() => setDocOpen(false)}
            />
            {activeTab && activeTab.kind === "file" && (
              <div className="ctx-docarea__body">
                <CodePane file={activeTab.file} onClose={() => closeKey(activeTab.key)} />
              </div>
            )}
            {activeTab && activeTab.kind === "agentdoc" && (doc ? (
              <DocPanel
                doc={doc}
                saving={saving}
                onChange={(text) => setBlobDocs((cur) => (cur[activeTab.key] ? { ...cur, [activeTab.key]: { ...cur[activeTab.key], text } } : cur))}
                onSave={saveOpenDoc}
                onClose={() => closeKey(activeTab.key)}
              />
            ) : (
              <div className="ctx-docarea__hint">
                this document's content lives behind its save door — reopen it from the profile on the left
              </div>
            ))}
            {activeTab && activeTab.kind === "board" && (
              <div className="doc-board">
                <Board projectCode={tabsPc} chrome="pane" />
              </div>
            )}
            {activeTab && activeTab.kind !== "file" && activeTab.kind !== "agentdoc" && activeTab.kind !== "board" && (
              <div className="ctx-docarea__hint">
                this tab lives on the Code page —{" "}
                <button type="button" onClick={() => history.push(buildRoute(activeTab, tabsPc, ""))}>open it there</button>
              </div>
            )}
          </div>
        )}
      </div>
      <AgentChat />
    </section>
  );
};

export default Context;
