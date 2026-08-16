import React, { useCallback, useContext, useEffect, useMemo, useState } from "react";
import ServiceContext from "../../ServiceContext";
import loadServiceWithHeaders from "../../utils/loadService";
import CodeEditor from "../../atoms/CodeView/CodeEditor";
import { changeMarksOf, hunksOf, stagedContentFor } from "../../atoms/CodeView/gitLines";
import DiffView from "../../atoms/DiffView/DiffView";
import { useEditorDark, EditorThemeToggle } from "../../atoms/CodeView/editorTheme";
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
  // AN IMAGE IS NOT TEXT. Opening a .png from the tree read its bytes as a string and printed them
  // into the editor. The bytes never had to travel that way: the hub already serves repo files raw
  // at /sv-raw for the ::image block, so the pane just points an <img> at the same route — no read,
  // no base64, no megabyte of mangled binary through the service call.
  const isImage = /\.(png|jpe?g|gif|webp|svg|avif|bmp|ico)$/i.test(file.path || "");
  // Markdown opens in PREVIEW by default (the rendered document) — the per-file memory now stores
  // the opt-OUT, so only an explicit flip to Edit sticks.
  const [preview, setPreview] = useState(
    () => isMd && localStorage.getItem(`sv.mdPreview.${file.path}`) !== "false",
  );
  // Theme GROUPS by content: md files follow the docs family, code files the code family, diff the diff family.
  const [codeDark] = useEditorDark("code");
  const [docsDark] = useEditorDark("docs");
  const [diffDark] = useEditorDark("diff");

  // Git diff: `hasDiff` = the file differs from HEAD (the nav's orange dot, answered here);
  // `diffMode` flips the body to the side-by-side DiffView; `diffData` is fetched on entry.
  const [hasDiff, setHasDiff] = useState(false);
  // DIFF IS A MODE, NOT A PER-FILE CHOICE. Flip it once and the next file you open comes up as a
  // diff too — when it has one. It used to reset on every file, so a pass through five changed
  // files was five identical clicks.
  const [diffMode, setDiffMode] = useState(
    () => localStorage.getItem("sv.diffMode") === "true",
  );
  const [diffData, setDiffData] = useState(null);
  // base = the file at HEAD. Fetched for any changed file, not just on entering diff, because the
  // PLAIN view now marks its changed lines too.
  const [base, setBase] = useState(null);
  // The STAGED copy (git show :path). null = no index entry at all (untracked).
  const [index, setIndex] = useState(null);
  // The pane's EFFECTIVE theme + which family its header toggle flips.
  const themeScope = diffMode ? "diff" : isMd ? "docs" : "code";
  const editorDark = diffMode ? diffDark : isMd ? docsDark : codeDark;

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
    // The MODE survives the file change (that's the point of it); its DATA does not.
    setDiffData(null);
    setHasDiff(false);
    setBase(null);
    setIndex(null);
    // No host yet ≠ no access: on a refresh this effect fires before the services have connected.
    // Stay in the loading state — `!!host` in the deps re-runs the load the moment the host arrives
    // (and the auto-close effect above handles a host that's genuinely gone).
    if (!host) return undefined;
    // An image is fetched by the <img> tag, not read into state — don't pull the bytes twice.
    if (isImage) {
      setContent("");
      setSavedContent("");
      return undefined;
    }
    let live = true;
    (async () => {
      try {
        const res = await Plugin.readFile({ path: file.path });
        if (!live) return;
        setContent(res.content);
        setSavedContent(res.content);
        try {
          const ch = Plugin.changedFiles ? await Plugin.changedFiles() : null;
          const changed = !!(ch && ch.files && ch.files.some((f) => f.path === file.path));
          if (!live) return;
          setHasDiff(changed);
          // One extra call, only for a file that actually differs: it feeds BOTH the edge marks in
          // the plain view and the diff view if the mode is on, so nothing is fetched twice.
          if (changed) {
            const d = await Plugin.getDiff({ path: file.path });
            if (!live) return;
            setBase(d.base);
            setIndex(d.index == null ? null : d.index);
            setDiffData(d);
          }
        } catch {}
      } catch (e) {
        if (live) setError(e.message || "could not read file");
      }
    })();
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file.projectCode, file.serviceId, file.path, !!host]);

  // Which lines differ from HEAD, recomputed against what's on screen — so a line you just typed
  // marks itself without saving first. Cheap: trimmed prefix/suffix, then LCS on what's left.
  // The arithmetic itself lives in gitLines.js, shared with the file embeds in a document.
  const changeMarks = useMemo(() => changeMarksOf(base, index, content), [base, index, content]);
  const hunks = useMemo(() => hunksOf(base, index, content), [base, index, content]);

  // STAGE JUST THIS RUN, not the whole file.
  const stageHunkAt = async (h, unstage) => {
    // SAY WHY when nothing happens. Every one of these used to be a silent return, which is how a
    // button that did nothing looked identical to a button that was broken.
    if (!Plugin) return setError("no file host for this project");
    if (!Plugin.stageHunk)
      return setError("this project's plugin predates line-level staging — restart the service");
    if (content == null) return;
    const built = stagedContentFor(h, { base, index, content, unstage });
    if (built.error) return setError(built.error);
    const out = built.content;
    setError("");
    try {
      await Plugin.stageHunk({ path: file.path, content: out });
      // Re-read rather than assume: the index is git's now, not ours.
      const d = await Plugin.getDiff({ path: file.path });
      setBase(d.base);
      setIndex(d.index == null ? null : d.index);
      // Tell the rest of the window. Staging here used to leave the nav on the old state until
      // something forced it — his report: "I had to unstage and stage it just for it to kick in".
      window.dispatchEvent(new CustomEvent("sv:git"));
    } catch (e) {
      setError(e.message || "could not stage those lines");
    }
  };

  // …and listen for everyone else's. Staging from the nav has to move these stripes too.
  useEffect(() => {
    const onGit = async () => {
      if (!Plugin || !hasDiff) return;
      try {
        const d = await Plugin.getDiff({ path: file.path });
        setBase(d.base);
        setIndex(d.index == null ? null : d.index);
      } catch {}
    };
    window.addEventListener("sv:git", onGit);
    return () => window.removeEventListener("sv:git", onGit);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file.path, hasDiff, !!host]);

  // Entering diff mode fetches a FRESH base/head (edits + saves since the last look must show).
  // The choice is a MODE and it sticks — leaving it off for the next file is what made this five
  // clicks for five files.
  const toggleDiff = async () => {
    if (diffMode) {
      localStorage.setItem("sv.diffMode", "false");
      return setDiffMode(false);
    }
    try {
      const d = await Plugin.getDiff({ path: file.path });
      setDiffData(d);
      setBase(d.base);
      setIndex(d.index == null ? null : d.index);
      setDiffMode(true);
      localStorage.setItem("sv.diffMode", "true");
    } catch (e) {
      setError(e.message || "could not load diff");
    }
  };

  const dirty = content !== null && content !== savedContent;

  // Doc undo: `conflict` = someone else saved since this tab loaded (the write was refused, their
  // version is in conflict.current); `hist` = the History dropdown ({loading, snaps}) or null.
  const [conflict, setConflict] = useState(null);
  const [hist, setHist] = useState(null);

  const save = useCallback(async (force) => {
    if (!Plugin || content === null) return;
    setSaving(true);
    try {
      // `base` = what this tab loaded — the plugin refuses the write if the disk moved meanwhile
      // (stale-tab guard). `force` resends without base after the human chose to overwrite.
      const res = await Plugin.writeFile(
        force ? { path: file.path, content } : { path: file.path, content, base: savedContent },
      );
      if (res && res.conflict) {
        setConflict(res);
      } else {
        setSavedContent(content);
        setConflict(null);
        setError("");
      }
    } catch (e) {
      setError(e.message || "save failed");
    }
    setSaving(false);
  }, [Plugin, content, file.path, savedContent]);

  const openHistory = async () => {
    if (hist) return setHist(null);
    setHist({ loading: true, snaps: [] });
    try {
      const h = await Plugin.fileHistory({ path: file.path });
      setHist({ loading: false, snaps: h.snaps || [] });
    } catch (e) {
      setHist(null);
      setError(e.message || "could not load history");
    }
  };
  // Restoring is a normal write of the snapshot's content — the current version gets snapshotted
  // first (server-side), so undoing an undo is just another restore.
  const restoreSnap = async (ts) => {
    try {
      const snap = await Plugin.readSnapshot({ path: file.path, ts });
      await Plugin.writeFile({ path: file.path, content: snap.content });
      setContent(snap.content);
      setSavedContent(snap.content);
      setConflict(null);
      setHist(null);
      setError("");
    } catch (e) {
      setError(e.message || "restore failed");
    }
  };
  const ago = (ts) => {
    const s = Math.max(1, Math.round((Date.now() - ts) / 1000));
    if (s < 60) return `${s}s ago`;
    if (s < 3600) return `${Math.round(s / 60)}m ago`;
    if (s < 86400) return `${Math.round(s / 3600)}h ago`;
    return `${Math.round(s / 86400)}d ago`;
  };

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
          <EditorThemeToggle scope={themeScope} />
          {/* Shown while the MODE is on even where this file has no diff — otherwise opening an
              unchanged file takes away the only control that turns the mode back off. */}
          {(hasDiff || diffMode) && (
            <button
              type="button"
              className={`${CLASSNAME}__btn ${diffMode ? `${CLASSNAME}__btn--pinned` : ""}`}
              title={
                diffMode
                  ? hasDiff
                    ? "Diff mode is on — every changed file opens like this. Click to leave it."
                    : "Diff mode is on, but this file matches HEAD. Click to leave it."
                  : "This file differs from git HEAD — show the diff, and keep showing diffs"
              }
              onClick={toggleDiff}
            >
              Diff
            </button>
          )}
          {isMd && !(diffMode && hasDiff) && (
            <button type="button" className={`${CLASSNAME}__btn`} onClick={togglePreview}>
              {preview ? "Edit" : "Preview"}
            </button>
          )}
          <button
            type="button"
            className={`${CLASSNAME}__btn ${hist ? `${CLASSNAME}__btn--pinned` : ""}`}
            title="Saved versions of this file — click one to restore it (the current version is kept in history too)"
            onClick={openHistory}
          >
            ⏱
          </button>
          <button
            type="button"
            className={`${CLASSNAME}__btn ${CLASSNAME}__btn--save`}
            onClick={() => save()}
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
      {/* HISTORY — the snapshot ring: every save filed the previous version; click restores. */}
      {hist && (
        <div className={`${CLASSNAME}__history`}>
          {hist.loading ? (
            <span className={`${CLASSNAME}__history-note`}>loading…</span>
          ) : !hist.snaps.length ? (
            <span className={`${CLASSNAME}__history-note`}>
              no saved versions yet — history starts with the next save
            </span>
          ) : (
            hist.snaps.map((s) => (
              <button
                key={s.ts}
                type="button"
                className={`${CLASSNAME}__history-item`}
                title={new Date(s.ts).toLocaleString()}
                onClick={() => restoreSnap(s.ts)}
              >
                {ago(s.ts)} <span className={`${CLASSNAME}__history-bytes`}>{s.bytes}b</span>
              </button>
            ))
          )}
        </div>
      )}
      {/* CONFLICT — the stale-tab guard refused the save: someone else's version is on disk. */}
      {conflict && (
        <div className={`${CLASSNAME}__conflict`}>
          <span>
            Someone else saved this file after you loaded it — your save was held so it wouldn't
            wipe theirs.
          </span>
          <button type="button" className={`${CLASSNAME}__btn`} onClick={() => save(true)}>
            Save mine anyway
          </button>
          <button
            type="button"
            className={`${CLASSNAME}__btn`}
            onClick={() => {
              setContent(conflict.current);
              setSavedContent(conflict.current);
              setConflict(null);
            }}
          >
            Take theirs
          </button>
        </div>
      )}
      <div className={`${CLASSNAME}__body ${!diffMode && editorDark ? `${CLASSNAME}__body--dark` : ""} ${!editorDark ? `${CLASSNAME}__body--light` : ""}`}>
        {error && <div className={`${CLASSNAME}__error`}>{error}</div>}
        {!error && content === null && <div className={`${CLASSNAME}__loading`}>loading…</div>}
        {!error && isImage && (
          <div className={`${CLASSNAME}__image`}>
            <img
              className={`${CLASSNAME}__image-img`}
              src={`/sv-raw/${encodeURIComponent(file.projectCode)}/${encodeURIComponent(
                file.serviceId,
              )}?path=${encodeURIComponent(file.path)}`}
              alt={file.path}
            />
          </div>
        )}
        {!error && !isImage && content !== null && (diffMode && diffData ? (
          // The diff EDITS the working file: head = the editor's live content (unsaved edits show),
          // typing in the right side feeds the same dirty/Save/⌘S machinery as the plain editor.
          <DiffView base={diffData.base} head={content} language={diffData.language} dark={editorDark} onChange={setContent} />
        ) : preview && isMd ? (
          <div className={`md-view md-view--${editorDark ? "dark" : "light"}`}>
            <Markdown
              dark={editorDark}
              scope={{ projectCode: file.projectCode, serviceId: file.serviceId }}
              commentKey={`file-${file.path}`}
              // A checklist toggled in Preview saves the file — same writeFile the editor uses.
              onSourceChange={
                Plugin
                  ? async (next) => {
                      setContent(next);
                      try {
                        const res = await Plugin.writeFile({ path: file.path, content: next, base: savedContent });
                        if (res && res.conflict) setConflict(res);
                        else setSavedContent(next);
                      } catch (e) {
                        setError(e.message || "save failed");
                      }
                    }
                  : null
              }
            >
              {content}
            </Markdown>
          </div>
        ) : (
          // Every file edits with syntax coloring; the GLOBAL editor theme (default dark) decides the
          // canvas — the rendered md Preview follows it too.
          // `file.lines` is set when a :file[path#L40-70] link opened this — select + center it.
          <CodeEditor
            value={content}
            language={file.language}
            onChange={setContent}
            dark={editorDark}
            focusLines={file.lines || null}
            changeMarks={changeMarks}
            hunks={hunks}
            onStageHunk={stageHunkAt}
          />
        ))}
      </div>
    </div>
  );
};

export default CodePane;
