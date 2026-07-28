import React, { useEffect, useState } from "react";
import Markdown from "../../atoms/Markdown/Markdown";
import CodeView from "../../atoms/CodeView/CodeView";
import CodeEditor from "../../atoms/CodeView/CodeEditor";
import DiffView from "../../atoms/DiffView/DiffView";
import EditBox from "../../molecules/EditBox/EditBox";
import DescriptionBox from "../../atoms/DescriptionBox/DescriptionBox";
import TestPane from "./TestPane";
import loadServiceWithHeaders from "../../utils/loadService";

// A `file` pane whose target is a markdown file renders like the Documentation tab — formatted (read)
// with a click-to-edit box — instead of raw CodeMirror. Same EditBox/Markdown/DescriptionBox trio.
const isMarkdownPath = (p) => /\.(md|markdown)$/i.test(p || "");

// RFC-018 — one pane. The stage carries only a locator; THIS is where the real bytes are fetched, in
// the browser, from the target service's own plugin (readFile/getSource/getDiff) — exactly how
// Documentation fetches getDoc. That's the "UI vouches" split: the agent says what, the plugin proves it.

// Find the service that provides a pane's bytes and return its (header-authed) Plugin handle. Any
// service in the project can serve file reads (siblings share a cwd); a source pane names the owner.
function pluginFor(connectedServices, projectCode, serviceId) {
  const sd =
    connectedServices.find((s) => s.projectCode === projectCode && s.serviceId === serviceId) ||
    connectedServices.find((s) => s.projectCode === projectCode);
  if (!sd) return null;
  const svc = loadServiceWithHeaders(sd.system.connectionData, sd.headers, sd.credentials);
  return svc && svc.Plugin ? svc.Plugin : null;
}

const rangeSuffix = (hl) => {
  if (!hl || !Array.isArray(hl.lines)) return "";
  const [a, b] = hl.lines;
  return a ? `:${a}${b && b !== a ? "-" + b : ""}` : "";
};

const paneLabel = (kind, target, data, hl) => {
  if (kind === "source") return `${target.module ? target.module + "." : ""}${target.method}${data && data.path ? "  ·  " + data.path + rangeSuffix(hl) : ""}`;
  if (kind === "file") return `${(data && data.path) || target.path || kind}${rangeSuffix(hl)}`;
  if (kind === "diff") return (data && data.path) || target.path || kind;
  // Show WHICH tests — a method (Math.add #0), a module (Math · all tests), a service, or the project.
  if (kind === "test") {
    if (target.methodName) return `${target.moduleName ? target.moduleName + "." : ""}${target.methodName}${target.index != null ? " #" + target.index : ""}`;
    if (target.moduleName) return `${target.moduleName} · all tests`;
    if (target.serviceId) return `${target.serviceId} · all tests`;
    return "all tests · project";
  }
  return kind;
};

const PaneView = ({ pane, connectedServices, projectCode, onRemove, onPin, onSelect, onSpan, onDragStartPane, onDropPane }) => {
  const { kind, target = {}, highlight, pinned, span } = pane;
  const [state, setState] = useState({ loading: kind !== "markdown", error: null, data: null });
  // Phase 4 — edit-any-file. A file pane can flip to an editable CodeMirror and write back via the plugin.
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);

  const Plugin = pluginFor(connectedServices, projectCode, target.serviceId);

  useEffect(() => {
    // These kinds fetch their own content (or need none) — skip the plugin byte-fetch below.
    if (kind === "markdown" || kind === "callout" || kind === "checklist" || kind === "link" || kind === "test") return undefined;
    let cancelled = false;
    setState({ loading: true, error: null, data: null });
    setEditing(false);
    (async () => {
      if (!Plugin) {
        if (!cancelled) setState({ loading: false, error: "service not connected", data: null });
        return;
      }
      try {
        let data;
        if (kind === "file") data = await Plugin.readFile({ path: target.path });
        else if (kind === "source") data = await Plugin.getSource({ module: target.module, method: target.method });
        else if (kind === "diff") data = await Plugin.getDiff({ path: target.path });
        else throw new Error(`pane kind "${kind}" not supported yet`);
        if (!cancelled) setState({ loading: false, error: null, data });
      } catch (err) {
        if (!cancelled) setState({ loading: false, error: err.message, data: null });
      }
    })();
    return () => { cancelled = true; };
  }, [kind, target.serviceId, target.path, target.module, target.method, projectCode, Plugin]);

  const { loading, error, data } = state;

  // A source pane defaults its highlight to the method's own span (so "show me this function" frames
  // the function even inside the whole, scrollable file). An explicit highlight always wins.
  const effectiveHighlight =
    highlight ||
    (kind === "source" && data && data.startLine ? { lines: [data.startLine, data.endLine] } : null);

  const isMdFile = kind === "file" && isMarkdownPath(target.path);
  // Formatted-read content for a markdown file: if a line range was given, render just that section
  // (so a pane pinned to `docs/x.md#L40-70` shows a formatted excerpt, not the whole doc). Editing,
  // however, always operates on the WHOLE file — writing back a slice would truncate it.
  const mdReadContent = (() => {
    if (!data) return "";
    const hl = effectiveHighlight;
    if (hl && Array.isArray(hl.lines) && hl.lines[0]) {
      const [a, b] = hl.lines;
      return data.content.split("\n").slice(a - 1, b || a).join("\n");
    }
    return data.content;
  })();
  // Seed the editor draft from the loaded file so the markdown EditBox can open straight into edit.
  useEffect(() => { if (data) setDraft(data.content); }, [data]);

  const startEdit = () => { setDraft(data.content); setEditing(true); };
  const cancelEdit = () => setEditing(false);
  const saveEdit = async () => {
    if (!Plugin) return;
    setSaving(true);
    try {
      await Plugin.writeFile({ path: data.path, content: draft });
      setState((s) => ({ ...s, data: { ...s.data, content: draft, lines: draft.split("\n").length } }));
      setEditing(false);
    } catch (err) {
      setState((s) => ({ ...s, error: err.message }));
    } finally {
      setSaving(false);
    }
  };
  // The markdown EditBox drives its own read/edit toggle and hands us setEditMode on Save.
  const saveMdEdit = async (setEditMode) => {
    if (!Plugin) return;
    try {
      await Plugin.writeFile({ path: data.path, content: draft });
      setState((s) => ({ ...s, data: { ...s.data, content: draft, lines: draft.split("\n").length } }));
      if (setEditMode) setEditMode(false);
    } catch (err) {
      setState((s) => ({ ...s, error: err.message }));
    }
  };

  let body;
  if (kind === "markdown") {
    body = <div className="pane__markdown"><Markdown>{target.text || ""}</Markdown></div>;
  } else if (kind === "test") {
    body = <TestPane target={target} projectCode={projectCode} />;
  } else if (loading) {
    body = <div className="pane__status">Loading…</div>;
  } else if (error) {
    body = <div className="pane__status pane__status--error">Couldn’t load: {error}</div>;
  } else if (data && isMdFile) {
    // Markdown file → formatted read + click-to-edit, exactly like the Documentation tab. The pane
    // header/frame is unchanged; only the body reads as a doc instead of raw code.
    body = (
      <div className="md-view">
        <EditBox
          mainObject={<Markdown>{mdReadContent}</Markdown>}
          hiddenForm={<DescriptionBox text={draft} setValue={setDraft} />}
          formSubmit={saveMdEdit}
          onCancel={() => setDraft(data.content)}
        />
      </div>
    );
  } else if (data && kind === "file" && editing) {
    body = <CodeEditor value={draft} language={data.language} onChange={setDraft} dark />;
  } else if (data && (kind === "file" || kind === "source")) {
    body = <CodeView code={data.content} language={data.language} highlight={effectiveHighlight} />;
  } else if (data && kind === "diff") {
    body = <DiffView base={data.base} head={data.head} language={data.language} />;
  } else {
    body = <div className="pane__status">Nothing to show.</div>;
  }

  // Edit affordance is file-only (a source pane is a span of a larger file; editing whole files is the
  // safe unit). Shown once the file's loaded and a writable plugin is reachable. Markdown files edit
  // through their own EditBox (click the rendered doc), so they don't get the raw-code Edit button.
  const canEdit = kind === "file" && data && Plugin && !isMdFile;

  return (
    <div
      className={`pane pane--${kind} ${pinned ? "pane--pinned" : ""} ${span === "full" ? "pane--full" : "pane--half"}`}
      onDragOver={onDropPane ? (e) => e.preventDefault() : undefined}
      onDrop={onDropPane ? (e) => { e.preventDefault(); onDropPane(pane.id); } : undefined}
    >
      <div className="pane__header">
        {onDragStartPane && (
          <span
            className="pane__drag"
            draggable
            title="Drag to reorder"
            onDragStart={(e) => { e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", pane.id); onDragStartPane(pane.id); }}
          >
            ⠿
          </span>
        )}
        <span className="pane__kind">{kind === "markdown" ? "note" : kind}</span>
        {/* Clicking the label posts a selection back to the agent (reverse channel). */}
        <button
          type="button"
          className="pane__label pane__label--select"
          title="Select — the agent can read this via `systemview selection`"
          onClick={() => onSelect && onSelect(pane)}
        >
          {paneLabel(kind, target, data, effectiveHighlight)}
        </button>
        {onSpan && (
          <button
            type="button"
            className="pane__action"
            title="Toggle width — full row or share it"
            onClick={() => onSpan(pane.id, span === "full" ? "half" : "full")}
          >
            {span === "full" ? "½ width" : "full width"}
          </button>
        )}
        {onPin && (
          <button
            type="button"
            className={`pane__action ${pinned ? "pane__action--pinned" : ""}`}
            title={pinned ? "Unpin — will drop on the next assemble" : "Pin — survives the agent's next assemble"}
            onClick={() => onPin(pane.id, !pinned)}
          >
            {pinned ? "Pinned" : "Pin"}
          </button>
        )}
        {canEdit && !editing && (
          <button type="button" className="pane__action" onClick={startEdit}>Edit</button>
        )}
        {canEdit && editing && (
          <>
            <button type="button" className="pane__action pane__action--save" disabled={saving} onClick={saveEdit}>
              {saving ? "Saving…" : "Save"}
            </button>
            <button type="button" className="pane__action" disabled={saving} onClick={cancelEdit}>Cancel</button>
          </>
        )}
        {onRemove && (
          <button type="button" className="pane__remove" title="Remove from window (the file/test isn't deleted) — undo below" onClick={onRemove}>×</button>
        )}
      </div>
      <div className="pane__body">{body}</div>
    </div>
  );
};

export default PaneView;
