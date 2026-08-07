import React, { useState, useContext, useEffect, useCallback } from "react";
import { useHistory, useLocation } from "react-router-dom";
import "./styles.scss";
import DescriptionBox from "../../atoms/DescriptionBox/DescriptionBox";
import { EditorThemeToggle, useEditorDark } from "../../atoms/CodeView/editorTheme";
import Markdown from "../../atoms/Markdown/Markdown";
import CodePane from "../CodePane/CodePane";
import ServiceContext from "../../ServiceContext";
import Stage from "../Stage/Stage";
import { Client } from "../../systemClient";
import LogAnalyzer from "../LogAnalyzer/LogAnalyzer";
import { useHelpTopic, setHelpTopic } from "../../atoms/Help/helpStore";
import HELP_TOPICS from "../../atoms/Help/helpTopics";

function InlineLogs({ projectCode, serviceId, moduleName, methodName }) {
  const { connectedServices } = useContext(ServiceContext);
  const [entries, setEntries] = useState([]);
  const [live, setLive] = useState(false); // auto-refresh (poll) off by default — opt-in monitor
  const [armClear, setArmClear] = useState(false); // two-step confirm for Clear logs (no window.confirm)

  const loadLogs = useCallback(async () => {
    // Which services to pull logs from: a specific service when one is selected, else EVERY service in
    // the project — so the PROJECT level shows all logs (the old code looked a service up by an undefined
    // serviceId, found none, and showed nothing at the top namespace).
    const targets = serviceId
      ? connectedServices.filter((s) => s.projectCode === projectCode && s.serviceId === serviceId)
      : connectedServices.filter((s) => s.projectCode === projectCode);
    if (!targets.length) { setEntries([]); return; }
    try {
      const perService = await Promise.all(
        targets.map(async (s) => {
          try {
            const { SystemView } = Client.createService(s.system.connectionData);
            // Pull enough history to cover a whole test run — each call writes a start AND an end line, so a
            // full run is several hundred lines; the old limit of 100 evicted the earliest tests (you'd run
            // all tests and the FIRST one's log was already gone). getLog returns the newest N.
            const result = await SystemView.getLog({ limit: 2000 });
            if (!Array.isArray(result)) return [];
            return result.map((e) => ({ ...e, serviceId: e.serviceId || s.serviceId }));
          } catch {
            return [];
          }
        })
      );
      // Each service now owns its OWN log file (systemview.<serviceId>.logs), so getLog returns only that
      // service's records — aggregating across services just merges distinct sets, no duplication possible.
      let all = perService.flat();
      if (methodName && moduleName) {
        all = all.filter((e) => e.moduleMethod === `${moduleName}.${methodName}`);
      } else if (moduleName) {
        all = all.filter((e) => e.moduleMethod && e.moduleMethod.startsWith(`${moduleName}.`));
      }
      // Cap to the newest 1000 across services, then present OLDEST→NEWEST (newest at the bottom) so it
      // matches the Logs page and the monitor can auto-scroll down to follow incoming entries.
      all.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)); // newest first…
      all = all.slice(0, 1000).reverse(); // …keep newest 1000, then flip so the newest sit at the bottom
      setEntries(all);
    } catch {
      setEntries([]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectCode, serviceId, moduleName, methodName, connectedServices]);

  // Wipe stored logs. Logs are stored PER SERVICE, so this is scope-aware: at the service level it clears
  // THIS service's log; at the project level it clears every service in the project. Guarded by a two-step
  // in-UI confirm (the Clear-logs button arms first) — NO window.confirm dialog.
  const clearLogs = useCallback(async () => {
    const targets = serviceId
      ? connectedServices.filter((s) => s.projectCode === projectCode && s.serviceId === serviceId)
      : connectedServices.filter((s) => s.projectCode === projectCode);
    await Promise.all(
      targets.map(async (s) => {
        try {
          const { SystemView } = Client.createService(s.system.connectionData);
          await SystemView.clearLog();
        } catch {
          /* ignore */
        }
      })
    );
    setEntries([]);
    setArmClear(false);
  }, [connectedServices, projectCode, serviceId]);

  // Clear IMMEDIATELY on a namespace switch so the previous scope's logs never linger while the new set
  // loads (the "logs don't clear when you switch" bug). Also drop out of Monitor and disarm Clear — those
  // are per-scope choices, they should not carry across a navigation.
  useEffect(() => {
    setEntries([]);
    setLive(false);
    setArmClear(false);
  }, [projectCode, serviceId, moduleName, methodName]);

  // Load once on scope change; auto-refresh every 5s only while "live" (the monitor toggle). The follow-
  // scroll + new-entry flash live inside LogAnalyzer (it owns the scrolling table body), driven by `follow`.
  useEffect(() => {
    loadLogs();
    if (!live) return undefined;
    const timer = setInterval(loadLogs, 5000);
    return () => clearInterval(timer);
  }, [loadLogs, live]);

  return (
    <div className="inline-logs">
      {/* The full Logs analyzer (field filter/highlight + frequency dashboard + JSON/table), scoped to the
          current namespace's entries. Refresh + Monitor ride in the analyzer's toolbar. Keyed by the
          namespace so switching location REMOUNTS it — the filters/analyzers reset for the new scope. */}
      <LogAnalyzer
        key={`${projectCode || ""}/${serviceId || ""}/${moduleName || ""}/${methodName || ""}`}
        entries={entries}
        follow={live}
        toolbarExtras={
          <>
            <button className="logs-viewmode__btn" title="Refresh now" onClick={loadLogs}>
              ↻ Refresh
            </button>
            <button
              className={`logs-monitor-btn${live ? " logs-monitor-btn--on" : ""}`}
              title={live ? "Monitoring — auto-refreshing (click to pause)" : "Paused (click to monitor)"}
              onClick={() => setLive((l) => !l)}
            >
              {live ? "● Monitor" : "○ Monitor"}
            </button>
            {/* Clearing wipes logs on the services themselves. Logs are stored PER SERVICE, so it's offered
                at the SERVICE level (clears that service) AND the PROJECT level (clears every service) — but
                not at module/method, where a clear would surprise you by wiping the whole service. Two-step
                confirm (arm, then confirm) instead of a browser dialog, matching the saved-test delete. */}
            {projectCode && !moduleName &&
              (armClear ? (
                <span className="logs-clear-confirm">
                  Clear {serviceId || "all"} logs?
                  <button className="logs-clear-btn logs-clear-btn--yes" onClick={clearLogs}>
                    yes
                  </button>
                  <button className="logs-clear-btn logs-clear-btn--no" onClick={() => setArmClear(false)}>
                    no
                  </button>
                </span>
              ) : (
                <button
                  className="logs-clear-btn"
                  title={serviceId ? `Clear logs for ${serviceId}` : "Clear all logs for this project"}
                  onClick={() => setArmClear(true)}
                >
                  Clear logs
                </button>
              ))}
          </>
        }
      />
    </div>
  );
}

// Shown in the center when NOTHING is selected in the nav — SystemView's own help, so the Specs area is
// useful on arrival instead of blank.
const SYSTEMVIEW_HELP = `# SystemView

A documentation + testing surface for your **SystemLynx** services — and, increasingly, any codebase.

## Get started
- **Connect a service** — in the left **SystemLynx** tab, click **＋** and paste a \`loadService\` URL
  (\`https://host/route\`). Your services → modules → methods show up as a navigable tree.
- **Navigate** — click a service, module, or method. The center shows its **Documentation**, **Logs**, and
  **Stories**; the right **Scratch Pad** builds and runs tests against it.
- **Write docs** — click into the Documentation pane and type. It saves to the repo (\`specs/docs/\`) and
  travels with your code.
- **Build tests** — in the Scratch Pad, assemble Before / Main / Events / After steps, run them, and save.
  A test is an **ordered list of named sections**: reusable **shared actions** (built in the Actions tab)
  drop in as sections via **+ actions**, stored as \`{use}\` references — edit the action once, every test
  follows. Main holds multiple steps on any namespaces; the header **chip** is the \`service.module.method\`
  the test saves under — click it to retarget with the method picker.
- **Reference earlier outputs** — anywhere in an arg *or an evaluation's expected value*:
  \`tv(test.before[0].results.sum)\`, \`tv(test.seedSum[1].results.product)\` — so one step's response can
  be asserted against another's. \`random(n)\` inside a string makes it unique on every run.
- **Tell the story** — assemble **Stories**: named, runnable arrangements of docs, diffs, files, and tests
  that show what you did and prove it works.

## Tips
- Click a **selected** nav item again to **deselect** and come back here.
- The **File systems** tab opens your codebase directly (RFC-022) — coming.

_Select something on the left to dive in._`;

export default function Documentation({
  projectCode,
  serviceId,
  moduleName,
  methodName,
  // RFC-022 — the page-level lens + the file open from the Codebase nav. In the file lens the center
  // is CODE (edit-first CodePane) instead of Documentation/Logs; Stories stays.
  lens = "systemlynx",
  codeFile = null,
  onCloseFile = () => {},
}) {
  const { connectedServices } = useContext(ServiceContext);
  const fileLens = lens === "files" && !!codeFile;

  // Middle-panel scope — what the docs / logs / stories target. It DEFAULTS to the nav selection, but the
  // breadcrumb below can retarget it up or down INDEPENDENTLY of the nav: you can read logs (or stories, or
  // docs) at the project level while the nav tree + scratchpad stay pinned to a single method. Navigating
  // in the nav resets this to follow the nav again.
  const [scope, setScope] = useState({ projectCode, serviceId, moduleName, methodName });
  useEffect(() => {
    setScope({ projectCode, serviceId, moduleName, methodName });
  }, [projectCode, serviceId, moduleName, methodName]);
  const { projectCode: sProject, serviceId: sService, moduleName: sModule, methodName: sMethod } = scope;
  // The terminal level of the current middle scope — the breadcrumb highlights this segment blue, the rest
  // grey. Clicking a segment truncates the scope to that level.
  const scopeLevel = sMethod ? "method" : sModule ? "module" : sService ? "service" : "project";
  const nothingSelected = !sProject && !sService && !sModule && !sMethod;

  // The active tab persists in the URL (?tab=window) so it survives navigation, refresh, and can be
  // deep-linked. selectTab writes it; a back/forward that changes the URL syncs back into state.
  const history = useHistory();
  const location = useLocation();
  const urlTab = new URLSearchParams(location.search).get("tab") || "docs";
  const [tab, setTab] = useState(urlTab);
  // A ? icon anywhere in the app sets a help topic; while one is open it takes the middle panel's
  // content spot. Picking a tab dismisses it — the tab is an explicit "show me that instead".
  const helpTopic = useHelpTopic();
  const helpOpen = !!helpTopic;
  const selectTab = useCallback((t) => {
    setHelpTopic(null);
    setTab(t);
    const p = new URLSearchParams(window.location.search);
    p.set("tab", t);
    history.replace({ search: p.toString() });
  }, [history]);
  useEffect(() => { setTab(urlTab); }, [urlTab]);

  // Stories (RFC-018) is the third peer tab here — Documentation / Logs / Stories. The Stage stays mounted
  // (its socket subscription must be live), so we track pane count ONLY to badge the tab with a dot. We do
  // NOT auto-switch to it: navigating to a namespace that has stories would flip you off the tab you were
  // on for no reason — jarring. The dot tells you stories exist; you click in when you want them.
  const [stageCount, setStageCount] = useState(0);
  const handleStageChange = useCallback((count) => {
    setStageCount(count);
  }, []);

  const service =
    connectedServices.find(
      (s) => s.serviceId === sService && s.projectCode === sProject
    ) ||
    // Project level (no service selected): any service of the project gives a Plugin handle — the
    // project doc lives at the project root, so every service's plugin reads the same {projectCode}.md.
    (!sService
      ? connectedServices.find((s) => s.projectCode === sProject)
      : undefined);
  const { Plugin } = service ? Client.createService(service.system.connectionData) : {};

  const [doc, setDocument] = useState({
    documentation: "",
    namespace: { serviceId: sService, moduleName: sModule, methodName: sMethod },
  });

  const fetchDocument = async (Plugin) => {
    setDocument({ documentation: "", namespace: { serviceId: sService, moduleName: sModule, methodName: sMethod } });
    try {
      if (Plugin) {
        const results = await Plugin.getDoc({ serviceId: sService, moduleName: sModule, methodName: sMethod });
        setDocument(results);
      }
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => {
    fetchDocument(Plugin);
    // Tab is NOT reset on navigation — it persists via the URL so you stay where you were.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sMethod, sModule, sService, Plugin]);

  useEffect(() => {
    // if (Plugin) Plugin.on(`reconnect`, fetchDocument.bind({}, Plugin));
  }, [Plugin]);

  return (
    <section className="documentation">
      <div className="documentation-view">
        {/* Tabs ALWAYS show — SystemView mode doesn't switch the page, it just shows a different document.
            The selected namespace rides at the END of this same row (no separate title row → more vertical
            space for the document / stories / logs below). */}
        <div className="doc-tabs">
          {fileLens ? (
            // File lens: the center is CODE (edit-first). Logs stay with the service lens.
            <button
              className={`doc-tab ${tab !== "window" ? "doc-tab--active" : ""}`}
              onClick={() => selectTab("docs")}
            >
              Code
            </button>
          ) : (
            <>
              <button
                className={`doc-tab ${tab === "docs" ? "doc-tab--active" : ""}`}
                onClick={() => selectTab("docs")}
              >
                Documentation
              </button>
              <button
                className={`doc-tab ${tab === "logs" ? "doc-tab--active" : ""}`}
                onClick={() => selectTab("logs")}
              >
                Logs
              </button>
            </>
          )}
          <button
            className={`doc-tab ${tab === "window" ? "doc-tab--active" : ""}`}
            onClick={() => selectTab("window")}
          >
            Stories{stageCount > 0 ? <span className="doc-tab__dot" /> : null}
          </button>
          {/* The scope breadcrumb. Each segment is CLICKABLE: it retargets the middle panel (docs/logs/
              stories) to that level WITHOUT moving the nav or scratchpad. The segment matching the current
              middle scope is highlighted blue; the rest (project included) are grey. Segments come from the
              nav path (its depth is the deepest you can drill), so you can move freely up and down it. */}
          {fileLens && (
            <span className="doc-tabs__ns" title="The codebase this file belongs to">
              <span className="doc-tabs__ns-seg doc-tabs__ns-seg--active">
                {codeFile.projectCode}
              </span>
              <span className="doc-tabs__ns-paren"> codebase</span>
            </span>
          )}
          {!fileLens && (
          <span className="doc-tabs__ns" title="Scope for docs / logs / stories — click a level to retarget it">
            {projectCode && (
              <>
                <span
                  className={`doc-tabs__ns-seg${scopeLevel === "project" ? " doc-tabs__ns-seg--active" : ""}`}
                  onClick={() => setScope({ projectCode })}
                >
                  {projectCode}
                </span>
                {serviceId && <span className="doc-tabs__ns-sep">»</span>}
              </>
            )}
            {serviceId && (
              <span
                className={`doc-tabs__ns-seg${scopeLevel === "service" ? " doc-tabs__ns-seg--active" : ""}`}
                onClick={() => setScope({ projectCode, serviceId })}
              >
                {serviceId}
              </span>
            )}
            {moduleName && (
              <>
                <span className="doc-tabs__ns-dot">.</span>
                <span
                  className={`doc-tabs__ns-seg${scopeLevel === "module" ? " doc-tabs__ns-seg--active" : ""}`}
                  onClick={() => setScope({ projectCode, serviceId, moduleName })}
                >
                  {moduleName}
                </span>
              </>
            )}
            {methodName && (
              <>
                <span className="doc-tabs__ns-dot">.</span>
                <span
                  className={`doc-tabs__ns-seg${scopeLevel === "method" ? " doc-tabs__ns-seg--active" : ""}`}
                  onClick={() => setScope({ projectCode, serviceId, moduleName, methodName })}
                >
                  {methodName}
                </span>
                <span className="doc-tabs__ns-paren">(…)</span>
              </>
            )}
          </span>
          )}
        </div>
        {/* An open HELP topic takes the content spot — whatever tab was showing waits behind it. */}
        {helpOpen && (
          <div className="documentation-view__data-table">
            <HelpPane topicKey={helpTopic} />
          </div>
        )}
        {/* RFC-022 — the Code center: edit-first file pane fed by the Codebase nav's selection. */}
        {!helpOpen && fileLens && tab !== "window" && (
          <div className="documentation-view__data-table">
            <CodePane file={codeFile} onClose={onCloseFile} />
          </div>
        )}
        {!helpOpen && !fileLens && tab === "docs" && (
          <div className="documentation-view__data-table">
            {/* The doc IS a file panel — a framed pane with a header/badge. When nothing is selected it
                shows SystemView's own help; otherwise the per-namespace doc (getDoc/saveDoc). The doc's
                Edit/Save/Close live IN this header, exactly like the Code pane's — the rendered document
                below is for reading, never click-to-edit. */}
            <DocDescription
              key={`${sService}.${sModule}.${sMethod}`}
              doc={doc}
              setDocument={setDocument}
              Plugin={Plugin}
              readOnly={nothingSelected}
              label={
                nothingSelected
                  ? "SystemView"
                  : sMethod && sModule && sService
                  ? `${sService}.${sModule}.${sMethod}`
                  : sModule && sService
                  ? `${sService}.${sModule}`
                  : sService || sProject || ""
              }
              helpText={nothingSelected ? SYSTEMVIEW_HELP : null}
            />
          </div>
        )}
        {!helpOpen && !fileLens && tab === "logs" && (
          <InlineLogs
            projectCode={sProject}
            serviceId={sService}
            moduleName={sModule}
            methodName={sMethod}
          />
        )}
        {/* Stage stays mounted (subscription live for auto-focus); tab just toggles visibility.
            In the CODEBASE lens the stories scope is the whole PROJECT — you're looking at the
            codebase, not the nav's namespace selection, so every story shows regardless. */}
        <div
          className="documentation-view__window"
          style={{ display: !helpOpen && tab === "window" ? "block" : "none" }}
        >
          <Stage
            projectCode={lens === "files" && codeFile ? codeFile.projectCode : sProject}
            serviceId={lens === "files" ? undefined : sService}
            moduleName={lens === "files" ? undefined : sModule}
            methodName={lens === "files" ? undefined : sMethod}
            onStageChange={handleStageChange}
          />
        </div>
      </div>
    </section>
  );
}

// A help topic shown in the doc pane's clothes: same header band + md-view read box, its own
// "help" badge tint, Close returns to whatever tab was showing. Read-only by design — help content
// lives in src/atoms/Help/helpTopics.js, not in the repo's specs/docs.
const HelpPane = ({ topicKey }) => {
  const [editorDark] = useEditorDark("docs");
  const t = HELP_TOPICS[topicKey] || {
    title: topicKey,
    body: "_No help written for this topic yet — add it in `src/atoms/Help/helpTopics.js`._",
  };
  return (
    <div className="doc-pane">
      <div className={`doc-pane__header ${!editorDark ? "doc-pane__header--light" : ""}`}>
        <span className="doc-pane__kind doc-pane__kind--help">help</span>
        <span className="doc-pane__label">{t.title}</span>
        <span className="doc-pane__actions">
          <EditorThemeToggle scope="docs" />
          <button type="button" className="doc-pane__btn" onClick={() => setHelpTopic(null)}>
            Close
          </button>
        </span>
      </div>
      <div className="doc-pane__body">
        <div className={`md-view md-view--${editorDark ? "dark" : "light"}`}>
          <Markdown dark={editorDark} children={t.body} />
        </div>
      </div>
    </div>
  );
};

// The doc pane, whole: header (badge + namespace label + the Edit/Save/Close controls) and the body
// (rendered document, or the dark editor while editing). Same shape as the Code pane — the header
// owns the mode, the document below is for reading.
const DocDescription = ({ doc, setDocument, Plugin, label, readOnly, helpText }) => {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(doc.documentation);
  const [editorDark] = useEditorDark("docs");

  const saveDocument = async () => {
    if (!Plugin) return;
    try {
      const results = await Plugin.saveDoc({ ...doc, documentation: text });
      setDocument(results);
      setEditing(false);
    } catch (error) {
      console.error(error);
    }
  };
  const cancel = () => {
    setText(doc.documentation);
    setEditing(false);
  };

  useEffect(() => {
    setText(doc.documentation);
    setEditing(false);
  }, [doc]);

  const shown = helpText != null ? helpText : text;
  return (
    <div className="doc-pane">
      <div className={`doc-pane__header ${!editorDark ? "doc-pane__header--light" : ""}`}>
        <span className="doc-pane__kind">doc</span>
        <span className="doc-pane__label">{label}</span>
        <span className="doc-pane__actions">
          {/* The document follows the DOCS theme even in READ mode — the toggle rides the ONE
              corner cluster, right beside Edit (a second auto-margined span floated it to center). */}
          <EditorThemeToggle scope="docs" />
          {!readOnly &&
            (!editing ? (
              <button type="button" className="doc-pane__btn" onClick={() => setEditing(true)}>
                Edit
              </button>
            ) : (
              <>
                <button
                  type="button"
                  className="doc-pane__btn doc-pane__btn--save"
                  onClick={saveDocument}
                >
                  Save
                </button>
                <button type="button" className="doc-pane__btn" onClick={cancel}>
                  Close
                </button>
              </>
            ))}
        </span>
      </div>
      <div className="doc-pane__body">
        <div className={`md-view md-view--${editorDark ? "dark" : "light"}`}>
          {editing ? (
            <div className="edit-box edit-box--edit">
              <DescriptionBox text={text || ""} setValue={setText} dark={editorDark} />
            </div>
          ) : shown ? (
            <Markdown dark={editorDark} children={shown} />
          ) : (
            <div className="doc-empty">
              <span className="doc-empty__icon">✎</span>
              No documentation yet — hit Edit to write it.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
