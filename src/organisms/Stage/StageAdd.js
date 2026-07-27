import React, { useState, useEffect, useMemo } from "react";
import loadServiceWithHeaders from "../../utils/loadService";
import PaneView from "./PaneView";

// RFC-018 — the custom, NAMESPACE-AWARE selector (not a flat "every method / every file" dump). You
// drill the real namespace tree — service → module → method — and for TESTS you can stop at ANY level
// (whole project, a service, a module, or one method) exactly like the CLI's `--test` grammar. Files
// are scoped per service ("service as folder": each service's plugin reads from its OWN directory) and
// searchable. `onAdd(pane)` captures the built pane; with no onAdd it falls back to the live stage.
//
// This is a HOOK returning { bar, drill }: the compact kinds bar goes IN the chips row (so it costs no
// vertical space), while the big drill lives in its OWN block below — separated so opening it never
// reflows or shoves the chips row around.
const KINDS = [
  { k: "source", label: "Source", hint: "a method's code" },
  { k: "test", label: "Test", hint: "saved tests — at any namespace level" },
  { k: "diff", label: "Diff", hint: "a file's changes vs git" },
  { k: "file", label: "File", hint: "a file in a service's folder" },
  { k: "markdown", label: "Note", hint: "your own markdown" },
];

export function useStageAdd({ projectCode, connectedServices, SystemView, current = {}, onAdd }) {
  const [kind, setKind] = useState(null);
  const [serviceId, setServiceId] = useState("");
  const [moduleName, setModuleName] = useState("");
  const [methodName, setMethodName] = useState("");
  const [note, setNote] = useState("");
  const [fileQuery, setFileQuery] = useState("");
  const [files, setFiles] = useState([]);
  const [filePath, setFilePath] = useState(""); // the SELECTED file — added only when you hit Add

  const svcs = useMemo(
    () => connectedServices.filter((s) => s.projectCode === projectCode),
    [connectedServices, projectCode],
  );

  useEffect(() => {
    setServiceId((sid) => sid || current.serviceId || (svcs[0] && svcs[0].serviceId) || "");
  }, [svcs, current.serviceId]);

  const service = useMemo(
    () => svcs.find((s) => s.serviceId === serviceId) || svcs[0],
    [svcs, serviceId],
  );
  const modules = useMemo(
    () => (service && service.system && service.system.connectionData && service.system.connectionData.modules) || [],
    [service],
  );
  const methods = useMemo(() => {
    const m = modules.find((mm) => mm.name === moduleName);
    return m ? (m.methods || []).map((f) => f.fn) : [];
  }, [modules, moduleName]);

  const isFileKind = kind === "file" || kind === "diff";
  const isNote = kind === "markdown";
  const isMethodKind = kind === "source" || kind === "test";

  const pluginFor = (sd) => {
    if (!sd) return null;
    const svc = loadServiceWithHeaders(sd.system.connectionData, sd.headers, sd.credentials);
    return svc && svc.Plugin ? svc.Plugin : null;
  };
  useEffect(() => {
    let cancelled = false;
    setFiles([]);
    setFilePath("");
    if (isFileKind && service) {
      const Plugin = pluginFor(service);
      if (Plugin) {
        Plugin.listFiles({})
          .then((r) => { if (!cancelled) setFiles(((r && r.files) || []).map((f) => f.path)); })
          .catch(() => {});
      }
    }
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFileKind, serviceId]);

  const emit = (pane) => {
    if (onAdd) onAdd(pane);
    else { try { SystemView.addPane(projectCode, pane); } catch { /* ignore */ } }
  };

  const addSource = () => {
    if (serviceId && moduleName && methodName)
      emit({ kind: "source", target: { serviceId, module: moduleName, method: methodName } });
  };
  const addTest = () => {
    const target = {};
    if (serviceId) target.serviceId = serviceId;
    if (moduleName) target.moduleName = moduleName;
    if (methodName) target.methodName = methodName;
    emit({ kind: "test", target });
  };
  const addFile = (p) => emit({ kind, target: { serviceId, path: p } });
  const addNote = () => {
    if (note.trim()) { emit({ kind: "markdown", target: { text: note.trim() } }); setNote(""); setKind(null); }
  };

  const filteredFiles = useMemo(() => {
    const q = fileQuery.trim().toLowerCase();
    const list = q ? files.filter((f) => f.toLowerCase().includes(q)) : files;
    return list.slice(0, 80);
  }, [files, fileQuery]);

  const testLevel = methodName
    ? `${moduleName}.${methodName}`
    : moduleName ? `all of ${serviceId}.${moduleName}`
    : serviceId ? `all tests in ${serviceId}`
    : "all tests · whole project";

  // A live PREVIEW of the current selection — you SEE the real file/diff/source/test before you commit
  // it. Built from the same locator the Add button will emit, rendered through the same PaneView.
  let previewPane = null;
  if (isFileKind && filePath) previewPane = { kind, target: { serviceId, path: filePath } };
  else if (kind === "source" && serviceId && moduleName && methodName) previewPane = { kind: "source", target: { serviceId, module: moduleName, method: methodName } };
  else if (kind === "test") previewPane = { kind: "test", target: { ...(serviceId ? { serviceId } : {}), ...(moduleName ? { moduleName } : {}), ...(methodName ? { methodName } : {}) } };

  // COMPACT BAR — kinds segmented control + (when a kind is active) the Add button. Sits in the chips
  // row. Note keeps its input in the drill (below), so the bar stays small.
  const bar = (
    <div className="stage-add__bar">
      <div className="stage-add__kinds">
        {KINDS.map(({ k, label, hint }) => (
          <button
            key={k}
            type="button"
            title={hint}
            className={`stage-add__kind ${kind === k ? "stage-add__kind--active" : ""}`}
            onClick={() => setKind((cur) => (cur === k ? null : k))}
          >
            {label}
          </button>
        ))}
      </div>
      {kind && !isNote && (
        <>
          {kind === "test" && <span className="stage-add__level">{testLevel}</span>}
          {isFileKind && filePath && <span className="stage-add__level">{filePath}</span>}
          <button
            type="button"
            className="stage-add__btn"
            onClick={() => {
              if (kind === "source") addSource();
              else if (kind === "test") addTest();
              else if (isFileKind) addFile(filePath);
              setKind(null); // collapse the selector + clear the preview — the item's now in the story
            }}
            disabled={
              kind === "source" ? !(moduleName && methodName)
              : kind === "test" ? false
              : !filePath
            }
          >
            ＋ Add {kind}
          </button>
        </>
      )}
    </div>
  );

  // THE DRILL — its own block, only when a kind is active. Never part of the chips flex row.
  const drill = !kind ? null : (
    <div className="stage-add__panel">
      {current.moduleName && current.methodName && (
        <div className="stage-add__current">
          <span className="stage-add__current-ns">{current.serviceId}.{current.moduleName}.{current.methodName}</span>
          <button type="button" className="stage-add__chip" onClick={() => emit({ kind: "source", target: { serviceId: current.serviceId, module: current.moduleName, method: current.methodName } })}>＋ Source</button>
          <button type="button" className="stage-add__chip" onClick={() => emit({ kind: "test", target: { serviceId: current.serviceId, moduleName: current.moduleName, methodName: current.methodName } })}>＋ Test</button>
        </div>
      )}
      {isNote ? (
        <div className="stage-add__row">
          <input
            className="stage-add__input"
            placeholder="a note (markdown) — becomes a block you can edit"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") addNote(); }}
          />
          <button type="button" className="stage-add__btn" onClick={addNote} disabled={!note.trim()}>＋ Add note</button>
        </div>
      ) : (
        <>
        <div className="stage-add__drill">
          <div className="stage-add__col">
            <div className="stage-add__col-label">Service</div>
            <div className="stage-add__opts">
              {kind === "test" && (
                <button type="button" className={`stage-add__opt ${serviceId === "" ? "is-sel" : ""}`} onClick={() => { setServiceId(""); setModuleName(""); setMethodName(""); }}>whole project</button>
              )}
              {svcs.map((s) => (
                <button key={s.serviceId} type="button" className={`stage-add__opt ${serviceId === s.serviceId ? "is-sel" : ""}`} onClick={() => { setServiceId(s.serviceId); setModuleName(""); setMethodName(""); }}>{s.serviceId}</button>
              ))}
            </div>
          </div>

          {isMethodKind && serviceId && (
            <div className="stage-add__col">
              <div className="stage-add__col-label">Module{kind === "test" ? " (optional)" : ""}</div>
              <div className="stage-add__opts">
                {modules.map((m) => (
                  <button key={m.name} type="button" className={`stage-add__opt ${moduleName === m.name ? "is-sel" : ""}`} onClick={() => { setModuleName(m.name); setMethodName(""); }}>{m.name}</button>
                ))}
              </div>
            </div>
          )}

          {isMethodKind && moduleName && (
            <div className="stage-add__col">
              <div className="stage-add__col-label">Method{kind === "test" ? " (optional)" : ""}</div>
              <div className="stage-add__opts">
                {methods.map((mn) => (
                  <button key={mn} type="button" className={`stage-add__opt ${methodName === mn ? "is-sel" : ""}`} onClick={() => setMethodName(mn)}>{mn}</button>
                ))}
              </div>
            </div>
          )}

          {isFileKind && serviceId && (
            <div className="stage-add__col stage-add__col--files">
              <div className="stage-add__col-label">File in {serviceId}</div>
              <input
                className="stage-add__input"
                placeholder="search this service's files…"
                value={fileQuery}
                onChange={(e) => setFileQuery(e.target.value)}
              />
              <div className="stage-add__files">
                {filteredFiles.map((f) => (
                  <button key={f} type="button" className={`stage-add__file ${filePath === f ? "is-sel" : ""}`} onClick={() => setFilePath(f)}>{f}</button>
                ))}
                {!filteredFiles.length && <div className="stage-add__empty">no matching files</div>}
              </div>
            </div>
          )}
        </div>
        {/* PREVIEW — see the real thing before you keep it. Add commits it; otherwise it's just a look. */}
        {previewPane && (
          <div className="stage-add__preview">
            <div className="stage-add__preview-label">Preview — hit “＋ Add {kind}” to keep it</div>
            <div className="stage stage--single stage-add__preview-body">
              <PaneView pane={{ id: "preview", ...previewPane }} projectCode={projectCode} connectedServices={connectedServices} />
            </div>
          </div>
        )}
        </>
      )}
    </div>
  );

  return { bar, drill };
}
