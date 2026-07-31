import React, { useState, useContext, useEffect, useCallback } from "react";
import { useHistory, useLocation } from "react-router-dom";
import "./styles.scss";
import DescriptionBox from "../../atoms/DescriptionBox/DescriptionBox";
import EditBox from "../../molecules/EditBox/EditBox";
import Title from "../../atoms/Title/Title";
import Markdown from "../../atoms/Markdown/Markdown";
import ServiceContext from "../../ServiceContext";
import Stage from "../Stage/Stage";
import { Client } from "../../systemClient";
import { LogRow } from "../../pages/Logs/Logs";

function InlineLogs({ projectCode, serviceId, moduleName, methodName }) {
  const { connectedServices } = useContext(ServiceContext);
  const [entries, setEntries] = useState([]);
  const [expandedKey, setExpandedKey] = useState(null);

  const serviceData = connectedServices.find(
    (s) => s.serviceId === serviceId && s.projectCode === projectCode
  );

  const loadLogs = useCallback(async () => {
    if (!serviceData) return;
    try {
      const { SystemView } = Client.createService(serviceData.system.connectionData);
      const result = await SystemView.getLog({ limit: 100 });
      if (!Array.isArray(result)) return;
      let all = result;
      if (methodName && moduleName) {
        all = all.filter((e) => e.moduleMethod === `${moduleName}.${methodName}`);
      } else if (moduleName) {
        all = all.filter((e) => e.moduleMethod && e.moduleMethod.startsWith(`${moduleName}.`));
      }
      setEntries(all);
    } catch {}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serviceData, moduleName, methodName]);

  useEffect(() => {
    loadLogs();
    const timer = setInterval(loadLogs, 5000);
    return () => clearInterval(timer);
  }, [loadLogs]);

  if (entries.length === 0) return <p className="inline-logs__empty">No log entries for this scope.</p>;

  return (
    <div className="inline-logs">
      <div className="logs-table-header">
        <div className="log-th log-th--time">Time</div>
        <div className="log-th log-th--method">Module.Method</div>
        <div className="log-th log-th--level">Level</div>
        <div className="log-th log-th--msg">Message</div>
      </div>
      <div className="logs-table">
        {entries.map((entry, i) => {
          const key = `${i}-${entry.timestamp}`;
          return (
            <LogRow
              key={i}
              entry={entry}
              isExpanded={expandedKey === key}
              onToggle={() => setExpandedKey((prev) => prev === key ? null : key)}
              compact
            />
          );
        })}
      </div>
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
  Reusable **named actions** live under the Actions tab.
- **Tell the story** — assemble **Stories**: named, runnable arrangements of docs, diffs, files, and tests
  that show what you did and prove it works.

## Tips
- Click a **selected** nav item again to **deselect** and come back here.
- The **File systems** tab opens your codebase directly (RFC-022) — coming.

_Select something on the left to dive in._`;

export default function Documentation({ projectCode, serviceId, moduleName, methodName }) {
  const nothingSelected = !projectCode && !serviceId && !moduleName && !methodName;
  const { connectedServices } = useContext(ServiceContext);

  // The active tab persists in the URL (?tab=window) so it survives navigation, refresh, and can be
  // deep-linked. selectTab writes it; a back/forward that changes the URL syncs back into state.
  const history = useHistory();
  const location = useLocation();
  const urlTab = new URLSearchParams(location.search).get("tab") || "docs";
  const [tab, setTab] = useState(urlTab);
  const selectTab = useCallback((t) => {
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
      (s) => s.serviceId === serviceId && s.projectCode === projectCode
    ) ||
    // Project level (no service selected): any service of the project gives a Plugin handle — the
    // project doc lives at the project root, so every service's plugin reads the same {projectCode}.md.
    (!serviceId
      ? connectedServices.find((s) => s.projectCode === projectCode)
      : undefined);
  const { Plugin } = service ? Client.createService(service.system.connectionData) : {};

  const [doc, setDocument] = useState({
    documentation: "",
    namespace: { serviceId, moduleName, methodName },
  });

  const fetchDocument = async (Plugin) => {
    setDocument({ documentation: "", namespace: { serviceId, moduleName, methodName } });
    try {
      if (Plugin) {
        const results = await Plugin.getDoc({ serviceId, moduleName, methodName });
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
  }, [methodName, moduleName, serviceId, Plugin]);

  useEffect(() => {
    // if (Plugin) Plugin.on(`reconnect`, fetchDocument.bind({}, Plugin));
  }, [Plugin]);

  return (
    <section className="documentation">
      <div className="documentation-view">
        <div className="row">
          <DocTitle projectCode={projectCode} serviceId={serviceId} moduleName={moduleName} methodName={methodName} />
        </div>
        {/* Tabs ALWAYS show — SystemView mode doesn't switch the page, it just shows a different document. */}
        <div className="doc-tabs">
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
          <button
            className={`doc-tab ${tab === "window" ? "doc-tab--active" : ""}`}
            onClick={() => selectTab("window")}
          >
            Stories{stageCount > 0 ? <span className="doc-tab__dot" /> : null}
          </button>
        </div>
        {tab === "docs" && (
          <div className="documentation-view__data-table">
            {/* The doc IS a file panel — a framed pane with a header/badge. When nothing is selected it
                shows SystemView's own help; otherwise the per-namespace doc (getDoc/saveDoc). */}
            <div className="doc-pane">
              <div className="doc-pane__header">
                <span className="doc-pane__kind">doc</span>
                <span className="doc-pane__label">
                  {nothingSelected
                    ? "SystemView"
                    : methodName && moduleName && serviceId
                    ? `${serviceId}.${moduleName}.${methodName}`
                    : moduleName && serviceId
                    ? `${serviceId}.${moduleName}`
                    : serviceId || projectCode || ""}
                </span>
              </div>
              <div className="doc-pane__body">
                {nothingSelected ? (
                  <div className="md-view">
                    <Markdown>{SYSTEMVIEW_HELP}</Markdown>
                  </div>
                ) : (
                  <DocDescription doc={doc} setDocument={setDocument} Plugin={Plugin} />
                )}
              </div>
            </div>
          </div>
        )}
        {tab === "logs" && (
          <InlineLogs
            projectCode={projectCode}
            serviceId={serviceId}
            moduleName={moduleName}
            methodName={methodName}
          />
        )}
        {/* Stage stays mounted (subscription live for auto-focus); tab just toggles visibility. */}
        <div
          className="documentation-view__window"
          style={{ display: tab === "window" ? "block" : "none" }}
        >
          <Stage
            projectCode={projectCode}
            serviceId={serviceId}
            moduleName={moduleName}
            methodName={methodName}
            onStageChange={handleStageChange}
          />
        </div>
      </div>
    </section>
  );
}

const DocTitle = ({ projectCode, serviceId, moduleName, methodName, variable_name = "..." }) => {
  return (
    <Title
      style={{ marginBottom: "5px" }}
      text={
        <span className="documentation-view__title">
          {methodName && moduleName && serviceId ? (
            <>
              {`${serviceId}.${moduleName}.${methodName}`}
              <span className="documentation-view__parentheses">(</span>
              <span className="documentation-view__parameter btn">{variable_name}</span>
              <span className="documentation-view__parentheses">)</span>
            </>
          ) : moduleName && serviceId ? (
            <>{`${serviceId}.${moduleName}`}</>
          ) : serviceId ? (
            <>{`${serviceId}`}</>
          ) : (
            projectCode && <>{projectCode}</>
          )}
        </span>
      }
    />
  );
};

const DocDescription = ({ doc, setDocument, Plugin }) => {
  const { serviceId, methodName, moduleName } = doc;
  const [text, setText] = useState(doc.documentation);

  const saveDocument = async (setFormDisplay) => {
    if (Plugin) {
      try {
        const results = await Plugin.saveDoc({ ...doc, documentation: text });
        setDocument(results);
        setFormDisplay(false);
      } catch (error) {
        console.error(error);
      }
    }
  };

  const updateDoc = (documentation) => setText(documentation);
  const cancel = () => setText(doc.documentation);

  useEffect(() => {
    setText(doc.documentation);
  }, [doc]);

  return (
    // RFC-018 — the doc renders through the SAME `.md-view` look as a markdown file pane (formatted read +
    // dark unified editor). Same functionality (getDoc/saveDoc, per-namespace); just the new look.
    <div className="md-view">
      <EditBox
        mainObject={
          text ? (
            <Markdown children={text} />
          ) : (
            <div className="doc-empty">
              <span className="doc-empty__icon">✎</span>
              No documentation yet — click to write it.
            </div>
          )
        }
        hiddenForm={<DescriptionBox text={text || ""} setValue={updateDoc} />}
        formSubmit={saveDocument}
        stateChange={[serviceId, methodName, moduleName]}
        onCancel={cancel}
      />
    </div>
  );
};
