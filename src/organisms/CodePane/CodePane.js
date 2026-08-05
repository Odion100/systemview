import React, { useCallback, useContext, useEffect, useState } from "react";
import ServiceContext from "../../ServiceContext";
import loadServiceWithHeaders from "../../utils/loadService";
import CodeEditor from "../../atoms/CodeView/CodeEditor";
import DiffView from "../../atoms/DiffView/DiffView";
import { usePaneDark, EditorThemeToggle } from "../../atoms/CodeView/editorTheme";
import Markdown from "../../atoms/Markdown/Markdown";
import "./styles.scss";

// RFC-022 — the CODE center. EDIT-FIRST: every file opens straight into the CM6 editor (the inversion
// of the read-first namespace lens). `.md` gets a Preview toggle in the header (edit ⇄ rendered,
// remembered per file). Save = the plugin's writeFile; dirty state shows until saved (⌘S / Ctrl+S or
// the Save button). Bytes come from the codebase's file host at render time — locators, not copies.

const CLASSNAME = "code-pane";

const CodePane = ({ file, onClose }) => {
  const { connectedServices } = useContext(ServiceContext);
  const [content, setContent] = useState(null); // null = loading
  const [savedContent, setSavedContent] = useState(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const isMd = file.language === "markdown";
  // Markdown opens in PREVIEW by default (the rendered document) — the per-file memory now stores
  // the opt-OUT, so only an explicit flip to Edit sticks.
  const [preview, setPreview] = useState(
    () => isMd && localStorage.getItem(`sv.mdPreview.${file.path}`) !== "false",
  );
  // PER-PANE theme — this file's pane owns its light/dark individually, keyed by the file itself.
  const paneKey = `file:${file.projectCode}/${file.serviceId}/${file.path}`;
  const [editorDark] = usePaneDark(paneKey);
  // Git diff: `hasDiff` = the file differs from HEAD (the nav's orange dot, answered here);
  // `diffMode` flips the body to the side-by-side DiffView; `diffData` is fetched on entry.
  const [hasDiff, setHasDiff] = useState(false);
  const [diffMode, setDiffMode] = useState(false);
  const [diffData, setDiffData] = useState(null);

  const host = connectedServices.find(
    (s) => s.serviceId === file.serviceId && s.projectCode === file.projectCode,
  );
  // The open file's codebase disconnected/was deleted → close the pane instead of sitting on a dead
  // error. Guarded on connectedServices being loaded (empty at boot ≠ gone).
  useEffect(() => {
    if (!host && connectedServices.length && onClose) onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [host, connectedServices.length]);
  const Plugin = host
    ? loadServiceWithHeaders(host.system.connectionData, host.headers, host.credentials).Plugin
    : null;

  useEffect(() => {
    setContent(null);
    setSavedContent(null);
    setError("");
    setPreview(isMd && localStorage.getItem(`sv.mdPreview.${file.path}`) !== "false");
    setDiffMode(false);
    setDiffData(null);
    setHasDiff(false);
    // No host yet ≠ no access: on a refresh this effect fires before the services have connected.
    // Stay in the loading state — `!!host` in the deps re-runs the load the moment the host arrives
    // (and the auto-close effect above handles a host that's genuinely gone).
    if (!host) return undefined;
    let live = true;
    (async () => {
      try {
        const res = await Plugin.readFile({ path: file.path });
        if (!live) return;
        setContent(res.content);
        setSavedContent(res.content);
        try {
          const ch = Plugin.changedFiles ? await Plugin.changedFiles() : null;
          if (live && ch && ch.files) setHasDiff(ch.files.some((f) => f.path === file.path));
        } catch {}
      } catch (e) {
        if (live) setError(e.message || "could not read file");
      }
    })();
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file.projectCode, file.serviceId, file.path, !!host]);

  // Entering diff mode fetches a FRESH base/head (edits + saves since the last look must show).
  const toggleDiff = async () => {
    if (diffMode) return setDiffMode(false);
    try {
      const d = await Plugin.getDiff({ path: file.path });
      setDiffData(d);
      setDiffMode(true);
    } catch (e) {
      setError(e.message || "could not load diff");
    }
  };

  const dirty = content !== null && content !== savedContent;

  const save = useCallback(async () => {
    if (!Plugin || content === null) return;
    setSaving(true);
    try {
      await Plugin.writeFile({ path: file.path, content });
      setSavedContent(content);
      setError("");
    } catch (e) {
      setError(e.message || "save failed");
    }
    setSaving(false);
  }, [Plugin, content, file.path]);

  // ⌘S / Ctrl+S saves while the pane is mounted.
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        save();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [save]);

  const togglePreview = () => {
    const next = !preview;
    setPreview(next);
    localStorage.setItem(`sv.mdPreview.${file.path}`, String(next));
  };

  const segments = file.path.split("/");

  return (
    <div className={CLASSNAME}>
      <div className={`${CLASSNAME}__header ${!editorDark ? `${CLASSNAME}__header--light` : ""}`}>
        <span className={`${CLASSNAME}__kind`}>code</span>
        {/* Breadcrumb — the path, its file name emphasized. */}
        <span className={`${CLASSNAME}__crumb`} title={file.path}>
          {segments.map((seg, i) => (
            <span key={i}>
              {i > 0 && <span className={`${CLASSNAME}__crumb-sep`}>/</span>}
              <span
                className={
                  i === segments.length - 1 ? `${CLASSNAME}__crumb-file` : `${CLASSNAME}__crumb-dir`
                }
              >
                {seg}
              </span>
            </span>
          ))}
        </span>
        {dirty && <span className={`${CLASSNAME}__dirty`} title="unsaved changes" />}
        <span className={`${CLASSNAME}__actions`}>
          <EditorThemeToggle paneKey={paneKey} />
          {hasDiff && (
            <button
              type="button"
              className={`${CLASSNAME}__btn ${diffMode ? `${CLASSNAME}__btn--pinned` : ""}`}
              title="This file differs from git HEAD — toggle the diff view"
              onClick={toggleDiff}
            >
              Diff
            </button>
          )}
          {isMd && !diffMode && (
            <button type="button" className={`${CLASSNAME}__btn`} onClick={togglePreview}>
              {preview ? "Edit" : "Preview"}
            </button>
          )}
          <button
            type="button"
            className={`${CLASSNAME}__btn ${CLASSNAME}__btn--save`}
            onClick={save}
            disabled={!dirty || saving}
          >
            {saving ? "Saving…" : "Save"}
          </button>
          {onClose && (
            <button
              type="button"
              className={`${CLASSNAME}__btn ${CLASSNAME}__btn--close`}
              title="Close file"
              onClick={onClose}
            >
              ×
            </button>
          )}
        </span>
      </div>
      <div className={`${CLASSNAME}__body ${!diffMode && editorDark ? `${CLASSNAME}__body--dark` : ""} ${!editorDark ? `${CLASSNAME}__body--light` : ""}`}>
        {error && <div className={`${CLASSNAME}__error`}>{error}</div>}
        {!error && content === null && <div className={`${CLASSNAME}__loading`}>loading…</div>}
        {!error && content !== null && (diffMode && diffData ? (
          <DiffView base={diffData.base} head={diffData.head} language={diffData.language} dark={editorDark} />
        ) : preview && isMd ? (
          <div className={`md-view md-view--${editorDark ? "dark" : "light"}`}>
            <Markdown dark={editorDark}>{content}</Markdown>
          </div>
        ) : (
          // Every file edits with syntax coloring; the GLOBAL editor theme (default dark) decides the
          // canvas — the rendered md Preview follows it too.
          <CodeEditor value={content} language={file.language} onChange={setContent} dark={editorDark} />
        ))}
      </div>
    </div>
  );
};

export default CodePane;
