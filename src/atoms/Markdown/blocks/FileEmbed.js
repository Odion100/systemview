import React, { useCallback, useContext, useEffect, useMemo, useState } from "react";
import ServiceContext from "../../../ServiceContext";
import loadServiceWithHeaders from "../../../utils/loadService";
import { useMarkdownScope } from "../context";
import { parseFileSpec } from "./FileLink";
import CodeEditor from "../../CodeView/CodeEditor";
import DiffView from "../../DiffView/DiffView";
import RowMenu from "../../RowMenu/RowMenu";
import { changeMarksOf, hunksOf, stagedContentFor, fileGitState } from "../../CodeView/gitLines";
import { useCodeComments } from "../../CodeView/codeComments";
import { useEditorDark } from "../../CodeView/editorTheme";
import { canGit, hasPlugin, pickHost } from "../../../utils/pluginHost";

// RFC-025 — the two story-pane kinds a document was still missing: a FILE pane and a DIFF pane.
//
//   ::file[src/atoms/Markdown/registry.js#L20-46]   the file itself, at a line range
//   ::diff[cli/index.js]                            working copy vs git HEAD
//
// Same distinction `run` uses: the INLINE form (`:file[…]`) is a chip that points at the file, the
// BLOCK form (`::file[…]`) brings the file into the document. Same atoms the story panes render
// (CodeView / DiffView), so a document and a story show a file identically.
//
// ONE EMBED, TWO VIEWS. `::file` and `::diff` are the same block — the name only picks which view
// it OPENS in. Whoever is reading gets the Diff toggle out of the header, exactly like a file open
// in the codebase panel, so a diff someone embedded is never a dead end when you want the whole
// file (or the other way round). Nothing changes for whoever WRITES the document: both directives
// stay, both mean what they always meant.

const EXT_LANG = {
  js: "javascript", jsx: "javascript", mjs: "javascript", cjs: "javascript",
  ts: "typescript", tsx: "typescript",
  json: "json", md: "markdown", markdown: "markdown",
  scss: "scss", css: "css", html: "html", yml: "yaml", yaml: "yaml",
  sh: "shell", py: "python", sql: "sql",
};
const langOf = (p) => EXT_LANG[(String(p).split(".").pop() || "").toLowerCase()] || "text";

// Same host rule as the file CHIP: the document's own service, then its project, then any connected
// file host — a help topic has no project of its own and should still be able to show a file.
function useFileHost(attrs, scope) {
  const { connectedServices = [] } = useContext(ServiceContext);
  const projectCode = attrs.project || scope.projectCode;
  const inProject = connectedServices.filter((s) => s.projectCode === projectCode && hasPlugin(s));
  // Within the project, a git-capable sibling outranks the named service: they read the same working
  // directory, so preferring it costs nothing and is the difference between the row menu offering
  // Stage and the menu quietly not having it.
  const named = inProject.find((s) => s.serviceId === (attrs.service || scope.serviceId));
  const mine = (named && canGit(named) && named) || pickHost(inProject) || named || null;
  if (mine) return mine;
  // NEVER BORROW ANOTHER PROJECT'S ROOT. This used to fall through to "any connected service with a
  // Plugin" — so when the document's own project happened to be disconnected, every embed resolved
  // against a DIFFERENT repo and came back "no such file" with a full path from somewhere the
  // reader had never heard of. Silently reading the wrong repo is worse than reading nothing.
  // The fallback only makes sense where there IS no project — a help topic, the hub itself.
  if (projectCode) return null;
  return connectedServices.find(hasPlugin) || null;
}

const Embed = ({ label, attrs = {}, opens }) => {
  const scope = useMarkdownScope();
  const projectCode = attrs.project || scope.projectCode;
  const host = useFileHost(attrs, scope);
  const [editorDark] = useEditorDark("docs");
  const raw = label || attrs.path || "";
  const { path, lines } = parseFileSpec(raw);
  const [view, setView] = useState(opens);
  // Stamped with the file it belongs to, so a changed path reads as absent rather than showing the
  // previous file's body for a frame.
  const key = `${path}@${host ? host.serviceId : ""}`;
  // ONE FETCH PAIR SERVES BOTH SIDES: readFile is the content (and the honest "no such file"), and
  // getDiff carries HEAD + the index, which is what the stripes, the diff and the right-click menu
  // are all made of. Nothing extra is read when you press Diff.
  const [file, setFile] = useState(null);
  const [git, setGit] = useState(null);
  const [err, setErr] = useState({});
  const [note, setNote] = useState("");
  const [menu, setMenu] = useState(null);

  const Plugin = useMemo(
    () => (host ? loadServiceWithHeaders(host.system.connectionData, host.headers, host.credentials).Plugin : null),
    [host],
  );
  const data = file && file.key === key ? file : null;
  const gitData = git && git.key === key ? git : null;
  const error = err.key === key ? err.file : null;
  const content = data ? data.content || "" : null;
  const base = gitData ? gitData.base : null;
  const index = gitData ? gitData.index : null;

  const load = useCallback(async () => {
    if (!Plugin) return;
    // The diff is best-effort: no git, no stripes, but the file still reads.
    const [f, g] = await Promise.all([
      Plugin.readFile({ path }).catch((e) => ({ __err: (e && e.message) || "could not read the file" })),
      Plugin.getDiff({ path }).catch(() => null),
    ]);
    if (f && f.__err) setErr({ key, file: f.__err });
    else {
      setErr({});
      setFile({ key, ...f });
    }
    if (g) setGit({ key, base: g.base, index: g.index == null ? null : g.index });
  }, [Plugin, path, key]);

  useEffect(() => {
    // Name the project AND the way out. Every block takes `{project=…}`, which is exactly what
    // you want when the file lives in another repo — and not knowing that is what makes people
    // copy files into their own project just to get them on screen.
    if (!path || !host) {
      const noHost = projectCode
        ? `no connected service in ${projectCode} can read files — name another with {project=…}`
        : "no file host";
      return setErr((prev) => (prev.key === key && prev.file === noHost ? prev : { key, file: noHost }));
    }
    if (data || error) return;
    load();
    // Primitives only: `data` is derived and gets a fresh identity every render, which would spin
    // the effect on each paint even though it has nothing left to fetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, !!data, !!error, load]);

  // Anyone else's git move — the nav staged something, the pane discarded something — moves these
  // stripes too. Same broadcast the open pane listens to.
  useEffect(() => {
    const onGit = () => load();
    window.addEventListener("sv:git", onGit);
    return () => window.removeEventListener("sv:git", onGit);
  }, [load]);

  // RFC-034 — the same threads the pane shows, from the same sidecar. Reading and replying only:
  // starting one needs a right-click on the code, and in a document that right-click is the
  // document's.
  const { threads, addReply, removeThread } = useCodeComments(Plugin, path);
  const [commentsOn, setCommentsOn] = useState(false);
  const onComment = useMemo(() => ({ addReply, removeThread }), [addReply, removeThread]);

  const changeMarks = useMemo(() => changeMarksOf(base, index, content), [base, index, content]);
  const hunks = useMemo(() => hunksOf(base, index, content), [base, index, content]);
  const state = useMemo(() => fileGitState(base, index, content), [base, index, content]);

  // STAGE ONE RUN from inside a document — the same index-only move the open pane makes. Reading is
  // still reading: nothing here writes the working tree.
  const stageHunkAt = async (h, unstage) => {
    if (!Plugin || !Plugin.stageHunk)
      return setNote("this project's plugin predates line-level staging — restart the service");
    const built = stagedContentFor(h, { base, index, content, unstage });
    if (built.error) return setNote(built.error);
    setNote("");
    try {
      await Plugin.stageHunk({ path, content: built.content });
      await load();
      window.dispatchEvent(new CustomEvent("sv:git"));
    } catch (e) {
      setNote((e && e.message) || "could not stage those lines");
    }
  };

  const runGit = async (fn) => {
    setNote("");
    try {
      await fn();
      await load();
      window.dispatchEvent(new CustomEvent("sv:git"));
    } catch (e) {
      setNote((e && e.message) || "git said no");
    }
  };

  const open = (e) => {
    if (!host) return;
    const detail = { projectCode: host.projectCode, serviceId: host.serviceId, path, language: langOf(path), lines };
    window.dispatchEvent(
      new CustomEvent(e.metaKey || e.ctrlKey ? "sv:openFileInNav" : "sv:revealInNav", {
        detail: e.metaKey || e.ctrlKey ? detail : { kind: "file", ...detail },
      })
    );
  };

  // The same right-click the file has in the codebase panel, on the same file — same verbs, same
  // order, same two-step on anything destructive. YOU CANNOT DISCARD WHAT YOU HAVE STAGED: unstage
  // first, so discard only appears when there is an unstaged difference to throw away.
  //
  // IT LIVES ON THE HEADER BAR, NOT THE WHOLE BLOCK. On the whole block it swallowed the DOCUMENT's
  // own right-click, and a code embed became the one place you could no longer wrap a block or use
  // the block menu — his catch, within a minute. The split is the honest one: the chrome is the
  // file, the body is the document.
  const openMenu = (e) => {
    if (!host || !path) return;
    e.preventDefault();
    e.stopPropagation();
    const name = path.split("/").pop();
    const items = [
      { label: "Open", action: () => open({ metaKey: true }) },
    ];
    if (state && (state.unstaged || state.untracked) && Plugin && Plugin.stageFiles)
      items.push({ label: "Stage", action: () => runGit(() => Plugin.stageFiles({ paths: [path] })) });
    if (state && state.staged && Plugin && Plugin.stageFiles)
      items.push({ label: "Unstage", action: () => runGit(() => Plugin.stageFiles({ paths: [path], unstage: true })) });
    if (state && state.untracked && Plugin && Plugin.discardFiles)
      items.push({
        label: "Delete file",
        danger: true,
        confirm: `Delete ${name}? (kept in history)`,
        action: () => runGit(() => Plugin.discardFiles({ paths: [path] })),
      });
    else if (state && state.unstaged && Plugin && Plugin.discardFiles)
      items.push({
        label: "Discard changes",
        danger: true,
        confirm: `Throw away the unstaged changes to ${name}? (kept in history)`,
        action: () => runGit(() => Plugin.discardFiles({ paths: [path] })),
      });
    items.push({ label: "Copy path", action: () => navigator.clipboard && navigator.clipboard.writeText(path) });
    items.push({ label: "Copy name", action: () => navigator.clipboard && navigator.clipboard.writeText(name) });
    // THE MENU SAYS WHAT STATE THE FILE IS IN, so "why does this offer discard?" is answerable
    // from the screen.
    setMenu({ x: e.clientX, y: e.clientY, title: `${path}${state ? state.label : ""}`, items });
  };

  if (!path) return <div className="md-embed md-embed--dead">::{opens} — name a path</div>;
  const range = lines ? `:${lines[0]}${lines[1] !== lines[0] ? `-${lines[1]}` : ""}` : "";
  const diffOn = view === "diff";
  const changed = !!state && !!state.label;

  return (
    <div className={`md-embed md-embed--${view}`}>
      <div className="md-embed__head" onContextMenu={openMenu} title="Right-click this bar for the file's own menu">
        {/* ONE KIND: code. The badge names the pane, not which side of it you're looking at —
            outside, a file open in the panel doesn't rename itself when you press Diff either. */}
        <span className="md-embed__kind md-embed__kind--quiet">code</span>
        <button type="button" className="md-embed__title md-embed__title--link" onClick={open} title="Show it in the codebase tree — ⌘-click to open it">
          {path}
          {range}
        </button>
        {/* The nav's changed dot, on the embed: this file differs from HEAD, and the menu says how. */}
        {changed && <span className="md-embed__dot" title={`This file is${state.label.replace(" · ", " ")}`} />}
        <span className="md-embed__scope">{host ? host.projectCode : ""}</span>
        {/* Only when there IS a conversation — an embed with nothing on it stays a plain embed. */}
        {threads.length > 0 && !diffOn && (
          <button
            type="button"
            className={`md-embed__view ${commentsOn ? "md-embed__view--on" : ""}`}
            title={`${threads.length} comment thread${threads.length === 1 ? "" : "s"} on this file`}
            onClick={() => setCommentsOn(!commentsOn)}
          >
            💬 {threads.length}
          </button>
        )}
        <button
          type="button"
          className={`md-embed__view ${diffOn ? "md-embed__view--on" : ""}`}
          title={diffOn ? "Showing the diff against HEAD — click for the file" : "Show what changed against HEAD"}
          onClick={() => setView(diffOn ? "file" : "diff")}
        >
          Diff
        </button>
      </div>
      {note && <div className="md-embed__note">{note}</div>}
      <div className="md-embed__file-body">
        {error ? (
          <div className="report-chart-empty">{error}</div>
        ) : content === null ? (
          <div className="report-chart-empty">loading…</div>
        ) : diffOn ? (
          base === content ? (
            <div className="report-chart-empty">no change against HEAD</div>
          ) : (
            // `base` is the git-HEAD version, `content` the working file — the same fields a story's
            // diff pane passes. READ-ONLY here, unlike that pane: a document is something you read,
            // and editing a file by accident while scrolling past a diff is nobody's intent. Click
            // the path to open it properly if you mean to change it.
            <DiffView
              base={base || ""}
              head={content}
              language={data.language || langOf(path)}
              dark={editorDark}
            />
          )
        ) : (
          // The EDITOR, held read-only — that's what carries the change stripes, the panel a stripe
          // opens and the per-run staging. CodeView has none of that, and a file in a document was
          // the only place left where you couldn't see what had changed.
          <CodeEditor
            value={content}
            language={data.language || langOf(path)}
            dark={editorDark}
            readOnly
            focusLines={lines || null}
            changeMarks={changeMarks}
            hunks={hunks}
            onStageHunk={stageHunkAt}
            // RFC-034 — the file's threads, read and replied to from inside the document. Same
            // sidecar the pane writes, so a conversation started in one is the same conversation in
            // the other. Writing a NEW one stays in the pane: the body's right-click belongs to the
            // document here, and that's the only way in.
            comments={threads}
            commentsOn={commentsOn}
            onComment={onComment}
          />
        )}
      </div>
      <RowMenu menu={menu} onClose={() => setMenu(null)} />
    </div>
  );
};

export const FileEmbed = (props) => <Embed {...props} opens="file" />;
export const DiffEmbed = (props) => <Embed {...props} opens="diff" />;
