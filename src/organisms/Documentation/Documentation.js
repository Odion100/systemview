import React, { useState, useContext, useEffect, useCallback } from "react";
import "./styles.scss";
import DescriptionBox from "../../atoms/DescriptionBox/DescriptionBox";
import EditBox from "../../molecules/EditBox/EditBox";
import Title from "../../atoms/Title/Title";
import Markdown from "../../atoms/Markdown/Markdown";
import ServiceContext from "../../ServiceContext";
import { Client } from "systemlynx-client";

const LEVEL_CLASS = { trace: "dim", log: "log", info: "info", warn: "warn", error: "error", debug: "debug" };

function formatTime(ts) {
  return new Date(ts).toLocaleTimeString("en-US", { hour12: false });
}

function InlineLogRow({ entry, isExpanded, onToggle }) {
  const level = entry.level || "info";
  const isTrace = level === "trace";
  const hasData = Boolean(entry.data);
  const msg = isTrace
    ? (entry.data && entry.data.duration != null ? `${entry.data.duration}ms` : "")
    : (typeof entry.message === "string" ? entry.message : JSON.stringify(entry.message) || "");

  return (
    <>
      <tr
        className={`log-row${isTrace ? " log-row--dim" : ""} ${hasData ? "log-row--clickable" : ""} ${isExpanded ? "log-row--active" : ""}`}
        onClick={() => hasData && onToggle()}
      >
        <td className="log-cell log-cell--time">{formatTime(entry.timestamp)}</td>
        <td className="log-cell log-cell--method">{entry.moduleMethod || "—"}</td>
        <td className="log-cell log-cell--level">
          <span className={`log-level log-level--${LEVEL_CLASS[level] || "info"}`}>{level}</span>
        </td>
        <td className="log-cell log-cell--msg">
          {msg}
          {!isTrace && entry.data && entry.data.duration != null && (
            <span className="log-duration"> {entry.data.duration}ms</span>
          )}
        </td>
      </tr>
      {isExpanded && hasData && (
        <tr className="log-row log-row--expanded" onClick={onToggle}>
          <td colSpan={4} className="log-cell--detail">
            <div className="log-data-wrap">
              <button
                className="log-data-copy"
                title="Copy JSON"
                onClick={(e) => { e.stopPropagation(); try { navigator.clipboard.writeText(JSON.stringify(entry.data, null, 2)); } catch {} }}
              >
                copy
              </button>
              <pre className="log-data">{JSON.stringify(entry.data, null, 2)}</pre>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function InlineLogs({ projectCode, serviceId, moduleName, methodName }) {
  const { SystemViewService } = useContext(ServiceContext);
  const [entries, setEntries] = useState([]);
  const [expandedKey, setExpandedKey] = useState(null);

  // Derive filter scope from current nav level
  const scopeFilter = methodName && moduleName
    ? { moduleMethod: `${moduleName}.${methodName}` }
    : moduleName
    ? { moduleName }
    : { serviceId };

  const loadLogs = useCallback(async () => {
    try {
      const result = await SystemViewService.SystemView.getLogs({
        projectCode: projectCode || undefined,
        serviceId: serviceId || undefined,
        limit: 100,
      });
      if (!Array.isArray(result)) return;
      let all = result;
      // Client-side filter to method/module scope
      if (scopeFilter.moduleMethod) {
        all = all.filter((e) => e.moduleMethod === scopeFilter.moduleMethod);
      } else if (scopeFilter.moduleName) {
        all = all.filter((e) => e.moduleMethod && e.moduleMethod.startsWith(`${scopeFilter.moduleName}.`));
      }
      setEntries(all);
    } catch {}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [SystemViewService, projectCode, serviceId, moduleName, methodName]);

  useEffect(() => {
    loadLogs();
    const timer = setInterval(loadLogs, 5000);
    return () => clearInterval(timer);
  }, [loadLogs]);

  if (entries.length === 0) return <p className="inline-logs__empty">No log entries for this scope.</p>;

  return (
    <div className="inline-logs">
      <table className="logs-table">
        <thead>
          <tr>
            <th className="log-th log-th--time">Time</th>
            <th className="log-th log-th--method">Module.Method</th>
            <th className="log-th log-th--level">Level</th>
            <th className="log-th log-th--msg">Message</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry, i) => {
            const key = `${i}-${entry.timestamp}`;
            return (
              <InlineLogRow
                key={i}
                entry={entry}
                isExpanded={expandedKey === key}
                onToggle={() => setExpandedKey((prev) => prev === key ? null : key)}
              />
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default function Documentation({ projectCode, serviceId, moduleName, methodName }) {
  const { connectedServices } = useContext(ServiceContext);
  const [tab, setTab] = useState("docs");

  const service = connectedServices.find(
    (s) => s.serviceId === serviceId && s.projectCode === projectCode
  );
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
    setTab("docs");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [methodName, moduleName, serviceId, Plugin]);

  useEffect(() => {
    // if (Plugin) Plugin.on(`reconnect`, fetchDocument.bind({}, Plugin));
  }, [Plugin]);

  return (
    <section className="documentation">
      <div className="documentation-view">
        <div className="row">
          <DocTitle serviceId={serviceId} moduleName={moduleName} methodName={methodName} />
        </div>
        <div className="doc-tabs">
          <button
            className={`doc-tab ${tab === "docs" ? "doc-tab--active" : ""}`}
            onClick={() => setTab("docs")}
          >
            Documentation
          </button>
          <button
            className={`doc-tab ${tab === "logs" ? "doc-tab--active" : ""}`}
            onClick={() => setTab("logs")}
          >
            Logs
          </button>
        </div>
        {tab === "docs" ? (
          <div className="row documentation-view__data-table">
            <DocDescription doc={doc} setDocument={setDocument} Plugin={Plugin} />
          </div>
        ) : (
          <InlineLogs
            projectCode={projectCode}
            serviceId={serviceId}
            moduleName={moduleName}
            methodName={methodName}
          />
        )}
      </div>
    </section>
  );
}

const DocTitle = ({ serviceId, moduleName, methodName, variable_name = "..." }) => {
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
          ) : (
            serviceId && <>{`${serviceId}`}</>
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
