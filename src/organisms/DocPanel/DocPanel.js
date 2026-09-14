import React, { useRef, useState } from "react";
import "./styles.scss";
import CodeEditor from "../../atoms/CodeView/CodeEditor";
import Markdown from "../../atoms/Markdown/Markdown";
import { useAppDark } from "../../atoms/appTheme";
import { lineHunks } from "../../atoms/CodeView/lineDiff";
import CodePane from "../CodePane/CodePane";

const clampW = (v) => Math.min(60, Math.max(20, v));

// RFC-055 — THE DOC PANEL. His design: the agents page follows the same three-panel pattern as
// Specs — nav on the left, the profile+context in the middle, and the RIGHT panel is where the
// documents open for editing. Click a doc (or a skill — a skill IS a doc) in the profile and it
// lands here, on the real machinery: CodeMirror to edit, the Markdown renderer to preview —
// not a bare textarea.
// A PROPOSED AGENT DOC, SIDE BY SIDE WITH THE ONE RUNNING. The `agent-authoring` skill never writes
// `def.prompt` — it drafts into a sidecar and stops, because an agent rewriting its own identity is
// the one edit that must not land quietly. This is where that stops: what it would cut, what it
// would add, the actual hunks, and two buttons.
//
// Reads as a diff and not as a wall of prose on purpose — the question he is answering is "what
// changed", and handing him two full documents makes him do the diff in his head.
const ProposalReview = ({ doc, onChange, dark }) => {
  const hunks = React.useMemo(() => lineHunks(doc.current || "", doc.text || ""), [doc.current, doc.text]);
  const [raw, setRaw] = useState(false);
  return (
    <div className="doc-panel__proposal">
      <div className="doc-panel__prop-meta">
        <span className="doc-panel__prop-by">proposed by {doc.by || doc.id}</span>
        <button className="doc-panel__prop-raw" onClick={() => setRaw((r) => !r)}>
          {raw ? "show the diff" : "show the whole doc"}
        </button>
      </div>
      {/* THE DOC ONLY EVER GROWS unless someone makes cutting the default. What it removed is the
          first thing shown, because it is the half nobody volunteers. */}
      {(doc.cut || doc.added) && (
        <div className="doc-panel__prop-why">
          {doc.cut && <div className="doc-panel__prop-cut"><b>cut</b> {doc.cut}</div>}
          {doc.added && <div className="doc-panel__prop-add"><b>added</b> {doc.added}</div>}
        </div>
      )}
      {raw ? (
        <CodeEditor value={doc.text} language="markdown" dark={dark} onChange={onChange} />
      ) : !hunks.length ? (
        <div className="doc-panel__prop-same">
          This proposal is identical to the doc already running — nothing to approve.
        </div>
      ) : (
        <div className="doc-panel__hunks">
          {hunks.map((h, i) => (
            <div className="doc-panel__hunk" key={i}>
              {h.base.map((l, j) => (
                <div className="doc-panel__line doc-panel__line--out" key={`b${j}`}>
                  <span className="doc-panel__sign">−</span>
                  {l || " "}
                </div>
              ))}
              {h.head.map((l, j) => (
                <div className="doc-panel__line doc-panel__line--in" key={`h${j}`}>
                  <span className="doc-panel__sign">+</span>
                  {l || " "}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const DocPanel = ({ doc, onChange, onSave, onClose, onApprove, onReject, saving = false }) => {
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
            {doc.kind === "skill"
              ? "loads on demand"
              : doc.kind === "def"
              ? "the definition on disk"
              : doc.kind === "file"
              ? // A code file opened from a chip is not context anybody loads — saying "loaded every
                // session" about it would be a confident lie in the one place that labels cost.
                "a file in the codebase"
              : "loaded every session"}
          </span>
        </div>
        <div className="doc-panel__actions">
          {doc.kind !== "file" && (
            <button
              className={`doc-panel__mode${mode === "edit" ? " doc-panel__mode--on" : ""}`}
              onClick={() => setMode("edit")}
            >
              edit
            </button>
          )}
          {md && doc.kind !== "file" && (
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
        {/* A CODE FILE IS *CodePane*'s JOB. I wrote a second, worse file viewer here — it decided
            "markdown" from `doc.language` alone, so a file that arrived without one rendered as
            markdown and every code document looked insane. CodePane already answers all of it:
            images, markdown preview, diffs, hunk staging, search, save. His rule, and he is right:
            one component, used in both places, not two that drift. */}
        {doc.kind === "file" ? (
          <CodePane file={{ projectCode: doc.projectCode, serviceId: doc.serviceId || null, path: doc.path, language: doc.language }} onClose={onClose} />
        ) : doc.kind === "proposal" ? (
          <ProposalReview doc={doc} onChange={onChange} dark={dark} />
        ) : mode === "edit" || !md ? (
          <CodeEditor value={doc.text} language={doc.language || "markdown"} dark={dark} onChange={onChange} />
        ) : (
          <div className="doc-panel__preview">
            <Markdown dark={dark}>{doc.text}</Markdown>
          </div>
        )}
      </div>
      {doc.kind === "proposal" && (
        <div className="doc-panel__foot">
          <button className="doc-panel__save" onClick={onApprove} disabled={saving}>
            {saving ? "Applying…" : "Approve & write"}
          </button>
          <button className="doc-panel__revert" onClick={onReject}>
            Reject
          </button>
          {/* THE DOC WAS FROZEN INTO THE SYSTEM PROMPT WHEN THE SESSION OPENED. Approving writes the
              file; the agent is still running the old one until it re-initializes. Saying so here is
              the difference between a change that landed and a change he thinks landed. */}
          <span className="doc-panel__prop-note">approving writes the doc — the agent runs it after a re-init</span>
        </div>
      )}
      {doc.kind !== "proposal" && dirty && (
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
