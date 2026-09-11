import React, { useRef, useState } from "react";
import "./styles.scss";
import CodeEditor from "../../atoms/CodeView/CodeEditor";
import Markdown from "../../atoms/Markdown/Markdown";
import { useAppDark } from "../../atoms/appTheme";

const clampW = (v) => Math.min(60, Math.max(20, v));

// RFC-055 — THE DOC PANEL. His design: the agents page follows the same three-panel pattern as
// Specs — nav on the left, the profile+context in the middle, and the RIGHT panel is where the
// documents open for editing. Click a doc (or a skill — a skill IS a doc) in the profile and it
// lands here, on the real machinery: CodeMirror to edit, the Markdown renderer to preview —
// not a bare textarea.
const DocPanel = ({ doc, onChange, onSave, onClose, saving = false }) => {
  const [dark] = useAppDark();
  // Non-markdown files (the raw definition JSON) have no meaningful preview — edit only.
  const md = !doc || !doc.language || doc.language === "markdown";
  // Preview first (his call): you open a doc to READ it; edit is the deliberate second step.
  const [mode, setMode] = useState(md ? "preview" : "edit"); // "preview" | "edit"
  // Resizable by its left edge — % of the row, persisted, same clamp discipline as the other panels.
  const [w, setW] = useState(() => {
    const v = parseFloat(localStorage.getItem("sv.docPanel.w"));
    return isNaN(v) ? 34 : clampW(v);
  });
  const panelRef = useRef(null);
  const startResize = (e) => {
    e.preventDefault();
    const row = panelRef.current && panelRef.current.parentElement;
    if (!row) return;
    const rect = row.getBoundingClientRect();
    const move = (ev) => setW(clampW(((rect.right - ev.clientX) / rect.width) * 100));
    const up = () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
      setW((cur) => {
        localStorage.setItem("sv.docPanel.w", String(cur));
        return cur;
      });
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
  };
  if (!doc) return null;
  const dirty = doc.text !== doc.orig;

  return (
    <div
      className="doc-panel"
      data-sv="doc-panel"
      ref={panelRef}
      style={{ flex: `0 0 ${w}%`, maxWidth: `${w}%` }}
    >
      <div className="doc-panel__resize" title="Drag to resize" onMouseDown={startResize} />
      <div className="doc-panel__head">
        <div className="doc-panel__title">
          <span className="doc-panel__label">{doc.label}</span>
          <span className="doc-panel__load">
            {doc.kind === "skill" ? "loads on demand" : doc.kind === "def" ? "the definition on disk" : "loaded every session"}
          </span>
        </div>
        <div className="doc-panel__actions">
          <button
            className={`doc-panel__mode${mode === "edit" ? " doc-panel__mode--on" : ""}`}
            onClick={() => setMode("edit")}
          >
            edit
          </button>
          {md && (
            <button
              className={`doc-panel__mode${mode === "preview" ? " doc-panel__mode--on" : ""}`}
              onClick={() => setMode("preview")}
            >
              preview
            </button>
          )}
          <button className="doc-panel__close" title="Close" onClick={onClose}>
            ✕
          </button>
        </div>
      </div>
      <div className="doc-panel__where">{doc.where}</div>
      <div className="doc-panel__body">
        {mode === "edit" || !md ? (
          <CodeEditor value={doc.text} language={doc.language || "markdown"} dark={dark} onChange={onChange} />
        ) : (
          <div className="doc-panel__preview">
            <Markdown dark={dark}>{doc.text}</Markdown>
          </div>
        )}
      </div>
      {dirty && (
        <div className="doc-panel__foot">
          <button className="doc-panel__save" onClick={onSave} disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </button>
          <button className="doc-panel__revert" onClick={() => onChange(doc.orig)}>
            Revert
          </button>
        </div>
      )}
    </div>
  );
};

export default DocPanel;
