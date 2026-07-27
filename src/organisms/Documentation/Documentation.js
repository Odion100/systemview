import React, { useState, useContext, useEffect, useCallback, useRef } from "react";
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

export default function Documentation({ projectCode, serviceId, moduleName, methodName }) {
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

  // The AI Window (RFC-018) is the third peer tab here — Documentation / Logs / Window — so it lives
  // in the same per-namespace tab strip, not a separate switcher. The Stage stays mounted (its socket
  // subscription must be live to auto-focus), so we track pane count to badge the tab and to flip to
  // it only on the empty→non-empty transition (an agent just drove it) — never yanking a reader off.
  const [stageCount, setStageCount] = useState(0);
  const prevStageCount = useRef(0);
  const handleStageChange = useCallback((count) => {
    setStageCount(count);
    if (count > 0 && prevStageCount.current === 0) selectTab("window");
    prevStageCount.current = count;
  }, [selectTab]);

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
          <div className="row documentation-view__data-table">
            <DocDescription doc={doc} setDocument={setDocument} Plugin={Plugin} />
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
    <EditBox
      mainObject={
        <Markdown children={text || "Use markdown to create your documentation here"} />
      }
      hiddenForm={<DescriptionBox text={text || ""} setValue={updateDoc} />}
      formSubmit={saveDocument}
      stateChange={[serviceId, methodName, moduleName]}
      onCancel={cancel}
    />
  );
};
