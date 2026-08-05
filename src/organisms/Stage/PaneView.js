import React, { useEffect, useState } from "react";
import { useHistory } from "react-router-dom";
import Markdown from "../../atoms/Markdown/Markdown";
import CodeView from "../../atoms/CodeView/CodeView";
import CodeEditor from "../../atoms/CodeView/CodeEditor";
import { useEditorDark, EditorThemeToggle } from "../../atoms/CodeView/editorTheme";
import DiffView from "../../atoms/DiffView/DiffView";
import TestPane from "./TestPane";
import loadServiceWithHeaders from "../../utils/loadService";

// A `file` pane whose target is a markdown file renders like the Documentation tab — the formatted
// document in a static read frame; the header's Edit/Save/Cancel (same as code files) does the editing.
const isMarkdownPath = (p) => /\.(md|markdown)$/i.test(p || "");

// Grid panes size to their CONTENT (flex) with a default MAX height (the cap lives in CSS). A dragged
// height (heightPx) pins an explicit height and adds `pane--sized` so the code editor fills + scrolls it.

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

// Which side of the target the cursor is on → drop before/after it (reorder in either direction).
const sideAt = (e) => {
  const r = e.currentTarget.getBoundingClientRect();
  return e.clientX > r.left + r.width / 2 ? "after" : "before";
};

const PaneView = ({ pane, connectedServices, projectCode, onRemove, onPin, onSelect, onResize, onReply, onRemoveReply, onReview, reviewMode = "report", layout, onDragStartPane, onDragOverPane, onDragEndPane, onDropPane, dropSide }) => {
  const { kind, target = {}, highlight, pinned, span } = pane;
  // This pane's review mark: approval stories → approved/rejected; report stories → read.
  const review = (onReview && pane.review) || {};
  const [replying, setReplying] = useState(false);
  const [replyText, setReplyText] = useState("");
  const replies = pane.replies || [];
  const [state, setState] = useState({ loading: kind !== "markdown", error: null, data: null });
  // Phase 4 — edit-any-file. A file pane can flip to an editable CodeMirror and write back via the plugin.
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);

  // A grid pane carries its OWN size — `span` is `{ w, h }` (width % + height px). Resize the WIDTH from the
  // RIGHT edge or the LEFT edge (either one — the left grows the pane as you drag left), and the HEIGHT from
  // the BOTTOM edge. Live via local `drag` state, persist on release.
  const spanObj = span && typeof span === "object" ? span : null;
  const storedWidth = spanObj ? spanObj.w || 50 : typeof span === "number" ? span : span === "full" ? 100 : 50;
  const storedHeight = spanObj && spanObj.h != null ? spanObj.h : null;
  const [drag, setDrag] = useState(null); // { w } | { h } while dragging
  const widthPct = drag && drag.w != null ? drag.w : storedWidth;
  const heightPx = drag && drag.h != null ? drag.h : storedHeight;

  const startResize = (edge) => (e) => {
    e.preventDefault();
    e.stopPropagation();
    const paneEl = e.currentTarget.closest(".pane");
    const grid = paneEl && paneEl.parentElement;
    const gridWidth = (grid && grid.clientWidth) || 1;
    const startX = e.clientX, startY = e.clientY;
    const startH = storedHeight != null ? storedHeight : paneEl ? paneEl.offsetHeight : 300;
    const maxH = Math.round(window.innerHeight * 0.9);
    // Left edge widens as you drag LEFT (mirror of the right edge); both set this pane's own width.
    const wAt = (x) => {
      const dPct = ((x - startX) / gridWidth) * 100;
      return Math.max(20, Math.min(100, storedWidth + (edge === "left" ? -dPct : dPct)));
    };
    const hAt = (y) => Math.max(80, Math.min(maxH, startH + (y - startY)));
    const onMove = (ev) => setDrag(edge === "bottom" ? { h: hAt(ev.clientY) } : { w: wAt(ev.clientX) });
    const onUp = (ev) => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      setDrag(null);
      if (!onResize) return;
      if (edge === "bottom") onResize(pane.id, { w: storedWidth, h: Math.round(hAt(ev.clientY)) });
      else onResize(pane.id, { w: Math.round(wAt(ev.clientX)), h: storedHeight });
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };
  // Double-click a grip → RELEASE that axis back to flex. A drag PINS an explicit size (the pane
  // stops growing with its content); the double-click un-pins it — height back to auto (grows and
  // shrinks with the content again), width back to the default basis.
  const resetWidth = () => {
    if (onResize) onResize(pane.id, { w: 50, h: storedHeight });
  };
  const resetHeight = () => {
    if (onResize) onResize(pane.id, { w: storedWidth, h: null });
  };

  const Plugin = pluginFor(connectedServices, projectCode, target.serviceId);
  // Theme GROUPS: documents (md files + notes), code (file/source), diffs — each family flips
  // together; this pane follows (and its toggle flips) the family its content belongs to.
  const themeScope =
    kind === "diff"
      ? "diff"
      : kind === "markdown" || (kind === "file" && isMarkdownPath(target.path))
        ? "docs"
        : "code";
  const [editorDark] = useEditorDark(themeScope);
  const history = useHistory();

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
  useEffect(() => { if (data) setDraft(data.content != null ? data.content : data.head || ""); }, [data]);

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
  // DIFF panes edit IN PLACE — the right side is a live editor (no Edit mode); Save/Cancel appear in
  // the header the moment the draft diverges from the working file. `diffEpoch` remounts the merge
  // view on cancel so the editor snaps back to the file's real content.
  const [diffEpoch, setDiffEpoch] = useState(0);
  const diffDirty = kind === "diff" && !!data && draft !== (data.head || "");
  const saveDiff = async () => {
    if (!Plugin) return;
    setSaving(true);
    try {
      await Plugin.writeFile({ path: data.path || target.path, content: draft });
      setState((s) => ({ ...s, data: { ...s.data, head: draft } }));
    } catch (err) {
      setState((s) => ({ ...s, error: err.message }));
    } finally {
      setSaving(false);
    }
  };
  const cancelDiff = () => {
    setDraft(data.head || "");
    setDiffEpoch((n) => n + 1);
  };
  let body;
  if (kind === "markdown") {
    // Notes render through the SAME path md files use — the code pane's flat document look (md-view +
    // themed Markdown), no legacy edit-box frame.
    body = (
      <div className={`md-view md-view--${editorDark ? "dark" : "light"}`}>
        <Markdown dark={editorDark}>{target.text || ""}</Markdown>
      </div>
    );
  } else if (kind === "test") {
    body = <TestPane target={target} projectCode={projectCode} />;
  } else if (loading) {
    body = <div className="pane__status">Loading…</div>;
  } else if (error) {
    body = <div className="pane__status pane__status--error">Couldn’t load: {error}</div>;
  } else if (data && kind === "file" && editing) {
    // Editing (md included) is the SAME flow code files use: header Edit → editor body → header
    // Save/Cancel. One editing model everywhere.
    body = <CodeEditor value={draft} language={data.language} onChange={setDraft} dark={editorDark} />;
  } else if (data && isMdFile) {
    // Markdown file read = the rendered document, flat, the code pane's look. The Edit control lives
    // in the pane HEADER (like code files) — clicking the document never flips to edit.
    body = (
      <div className={`md-view md-view--${editorDark ? "dark" : "light"}`}>
        <Markdown dark={editorDark}>{mdReadContent}</Markdown>
      </div>
    );
  } else if (data && (kind === "file" || kind === "source")) {
    body = <CodeView code={data.content} language={data.language} highlight={effectiveHighlight} dark={editorDark} />;
  } else if (data && kind === "diff") {
    // Right side editable when a writable plugin is reachable — edit the working file from the diff.
    body = (
      <DiffView
        key={diffEpoch}
        base={data.base}
        head={data.head}
        language={data.language}
        dark={editorDark}
        onChange={Plugin ? setDraft : undefined}
      />
    );
  } else {
    body = <div className="pane__status">Nothing to show.</div>;
  }

  // Edit affordance is file-only (a source pane is a span of a larger file; editing whole files is the
  // safe unit). Shown once the file's loaded and a writable plugin is reachable — markdown included:
  // every file edits through the SAME header Edit/Save/Cancel.
  const canEdit = kind === "file" && data && Plugin;

  return (
    <div
      className={`pane pane--${kind} ${pinned ? "pane--pinned" : ""} ${review.verdict ? `pane--verdict-${review.verdict}` : ""} ${widthPct >= 100 ? "pane--full" : "pane--half"} ${heightPx != null ? "pane--sized" : ""}`}
      style={layout === "grid" ? { flexBasis: `calc(${widthPct}% - 10px)`, ...(heightPx != null ? { height: `${heightPx}px`, maxHeight: `${heightPx}px` } : {}) } : undefined}
      onDragOver={onDropPane ? (e) => {
        e.preventDefault();
        onDragOverPane && onDragOverPane(pane.id, sideAt(e));
      } : undefined}
      onDrop={onDropPane ? (e) => {
        e.preventDefault();
        onDropPane(pane.id, sideAt(e));
      } : undefined}
    >
      {dropSide && <div className={`pane__drop pane__drop--${dropSide}`} />}
      {/* Themed panes (code/md/notes/diffs): a LIGHT document takes the header back to the light band
          with it (matters in app-dark — full fidelity). Test panes keep the app-theme band. */}
      <div className={`pane__header ${!editorDark && ["file", "source", "diff", "markdown"].includes(kind) ? "pane__header--light" : ""}`}>
        {onDragStartPane && (
          <span
            className="pane__drag"
            draggable
            title="Drag to reorder"
            onDragStart={(e) => {
              e.dataTransfer.effectAllowed = "move";
              e.dataTransfer.setData("text/plain", pane.id);
              // Drag a ghost of the WHOLE pane, not just this ⠿ handle.
              const paneEl = e.currentTarget.closest(".pane");
              if (paneEl) { try { e.dataTransfer.setDragImage(paneEl, 24, 16); } catch { /* ignore */ } }
              onDragStartPane(pane.id);
            }}
            onDragEnd={() => onDragEndPane && onDragEndPane()}
          >
            ⠿
          </span>
        )}
        <span className="pane__kind">{kind === "markdown" ? "note" : kind}</span>
        {/* Clicking the label posts a selection back to the agent (reverse channel) — and NAVIGATES:
            a file label selects the file in the Codebases nav; a test label navigates the page to the
            test's NAMESPACE and, in the background, selects its spec file in the Codebases nav. */}
        <button
          type="button"
          className="pane__label pane__label--select"
          title="Select — the agent can read this via `systemview selection`"
          onClick={() => {
            if (kind === "file" && target.path) {
              window.dispatchEvent(
                new CustomEvent("sv:openFileInNav", {
                  detail: {
                    projectCode,
                    serviceId: target.serviceId,
                    path: target.path,
                    language:
                      (data && data.language) || (/\.mdx?$/i.test(target.path) ? "markdown" : "text"),
                  },
                }),
              );
            }
            if (kind === "test" && target.serviceId) {
              // A test link does BOTH: retarget the SCRATCHPAD to the test's namespace (URL push —
              // keeping the query so the center's tab doesn't flip; the open story is sticky and
              // stays up), AND select the spec file in the Codebases nav exactly like a file label.
              const segs = [projectCode, target.serviceId, target.moduleName, target.methodName]
                .filter(Boolean)
                .join("/");
              history.push({ pathname: `/specs/${segs}`, search: window.location.search });
              if (Plugin && Plugin.listFiles && target.moduleName && target.methodName) {
                Plugin.listFiles({ glob: `**/tests/${target.moduleName}.${target.methodName}.json` })
                  .then((res) => {
                    const f = res && res.files && res.files[0];
                    if (f)
                      window.dispatchEvent(
                        new CustomEvent("sv:openFileInNav", {
                          detail: {
                            projectCode,
                            serviceId: target.serviceId,
                            path: f.path,
                            language: "json",
                          },
                        }),
                      );
                  })
                  .catch(() => {});
              }
            }
            onSelect && onSelect(pane);
          }}
        >
          {paneLabel(kind, target, data, effectiveHighlight)}
        </button>
        {onResize && (
          <>
            <button
              type="button"
              className={`pane__action ${widthPct >= 100 ? "pane__action--pinned" : ""}`}
              title="Snap to full width (or drag the right / bottom edge for any size)"
              onClick={() => onResize(pane.id, { w: 100, h: storedHeight })}
            >
              full
            </button>
            <button
              type="button"
              className={`pane__action ${widthPct <= 50 ? "pane__action--pinned" : ""}`}
              title="Snap to half width"
              onClick={() => onResize(pane.id, { w: 50, h: storedHeight })}
            >
              ½
            </button>
          </>
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
        {/* Per-card review marks. APPROVAL story: ✓ approve / ✗ reject (click again to clear).
            REPORT story (default): a single ✓ "mark as read" — the sibling mark. */}
        {onReview && reviewMode === "approval" && (
          <span className="pane__review">
            <button
              type="button"
              className={`pane__review-btn pane__review-btn--ok ${review.verdict === "approved" ? "is-on" : ""}`}
              title="Approve this card (click again to clear)"
              onClick={() => onReview(pane.id, review.verdict === "approved" ? null : "approved")}
            >
              ✓
            </button>
            <button
              type="button"
              className={`pane__review-btn pane__review-btn--no ${review.verdict === "rejected" ? "is-on" : ""}`}
              title="Reject this card (click again to clear)"
              onClick={() => onReview(pane.id, review.verdict === "rejected" ? null : "rejected")}
            >
              ✗
            </button>
          </span>
        )}
        {onReview && reviewMode === "report" && (
          <span className="pane__review">
            <button
              type="button"
              className={`pane__review-btn pane__review-btn--read ${review.verdict === "read" ? "is-on" : ""}`}
              title={review.verdict === "read" ? "Read — click to unmark" : "Mark as read"}
              onClick={() => onReview(pane.id, review.verdict === "read" ? null : "read")}
            >
              ✓
            </button>
          </span>
        )}
        {/* Any pane whose body follows the editor theme (code, md, notes, diffs) carries the toggle
            in READ mode too — not just while editing (matches the code pane's header). */}
        {["file", "source", "diff", "markdown"].includes(kind) && !editing && <EditorThemeToggle scope={themeScope} />}
        {diffDirty && (
          <>
            <button type="button" className="pane__action pane__action--save" disabled={saving} onClick={saveDiff}>
              {saving ? "Saving…" : "Save"}
            </button>
            <button type="button" className="pane__action" disabled={saving} onClick={cancelDiff}>Cancel</button>
          </>
        )}
        {canEdit && !editing && (
          <button type="button" className="pane__action" onClick={startEdit}>Edit</button>
        )}
        {canEdit && editing && (
          <>
            <EditorThemeToggle scope={themeScope} />
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
      {/* Themed kinds: when the document/editor theme is LIGHT, the whole body surface goes light with
          it (read AND edit) — no dark gutters around a light document/editor under app-dark. */}
      <div className={`pane__body ${!editorDark && ["file", "source", "diff", "markdown"].includes(kind) ? "pane__body--light" : ""}`}>{body}</div>
      {/* One flat thread per pane. Your replies keep their original look; agent replies get their own. */}
      {onReply && (replies.length > 0 || replying) && (
        <div className="pane__replies">
          {replies.map((r, i) => (
            <div className={`pane__reply ${r.author === "agent" ? "pane__reply--agent" : ""}`} key={i}>
              <span className="pane__reply-badge">{r.author === "agent" ? "agent" : "reply"}</span>
              <span className="pane__reply-text">{r.text}</span>
              {onRemoveReply && (
                <button type="button" className="pane__reply-del" title="Delete reply" onClick={() => onRemoveReply(pane.id, i)}>×</button>
              )}
            </div>
          ))}
          {replying && (
            <div className="pane__reply-form">
              <textarea
                className="pane__reply-input"
                autoFocus
                placeholder="reply on this…"
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { onReply(pane.id, replyText); setReplyText(""); setReplying(false); }
                  if (e.key === "Escape") { setReplying(false); setReplyText(""); }
                }}
              />
              <div className="pane__reply-actions">
                <button type="button" className="pane__reply-post" disabled={!replyText.trim()} onClick={() => { onReply(pane.id, replyText); setReplyText(""); setReplying(false); }}>Post</button>
                <button type="button" className="pane__reply-cancel" onClick={() => { setReplying(false); setReplyText(""); }}>Cancel</button>
              </div>
            </div>
          )}
        </div>
      )}
      {/* The reply button stays where it was — floating, bottom-right, white (fades in on hover). */}
      {onReply && !replying && (
        <button type="button" className="pane__reply-fab" title="Reply / comment on this pane" onClick={() => setReplying(true)}>💬</button>
      )}
      {/* Width from the right edge, height from the bottom edge (double-click to fill the row / match it). */}
      {layout === "grid" && onResize && (
        <>
          <div className="pane__resize pane__resize--x" title="Drag to resize width · double-click to reset to the default width" onMouseDown={startResize("right")} onDoubleClick={resetWidth} />
          <div className="pane__resize pane__resize--y" title="Drag to resize height · double-click to release back to flex (grow with content)" onMouseDown={startResize("bottom")} onDoubleClick={resetHeight} />
        </>
      )}
    </div>
  );
};

export default PaneView;
