import React, { useContext, useEffect, useState } from "react";
import ServiceContext from "../../../ServiceContext";
import loadServiceWithHeaders from "../../../utils/loadService";
import { useMarkdownScope } from "../context";
import { parseFileSpec } from "./FileLink";
import CodeView from "../../CodeView/CodeView";
import DiffView from "../../DiffView/DiffView";
import { useEditorDark } from "../../CodeView/editorTheme";

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

const hasPlugin = (s) =>
  ((s.system && s.system.connectionData && s.system.connectionData.modules) || []).some((m) => m.name === "Plugin");

// Same host rule as the file CHIP: the document's own service, then its project, then any connected
// file host — a help topic has no project of its own and should still be able to show a file.
function useFileHost(attrs, scope) {
  const { connectedServices = [] } = useContext(ServiceContext);
  const projectCode = attrs.project || scope.projectCode;
  const inProject = connectedServices.filter((s) => s.projectCode === projectCode && hasPlugin(s));
  const mine =
    inProject.find((s) => s.serviceId === (attrs.service || scope.serviceId)) || inProject[0] || null;
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
  // Both versions are kept once fetched, so flipping back and forth costs one call each way —
  // and stamped with the file they belong to, so a changed path is treated as absent rather than
  // showing the previous file's body for a frame.
  const key = `${path}@${host ? host.serviceId : ""}`;
  const [file, setFile] = useState(null);
  const [diff, setDiff] = useState(null);
  const [err, setErr] = useState({});

  const diffData = diff && diff.key === key ? diff : null;
  // A diff already carries the working copy, so toggling diff → file needs no second read.
  const fileData =
    (file && file.key === key && file) ||
    (diffData && diffData.head != null ? { key, content: diffData.head, language: diffData.language } : null);
  const data = view === "diff" ? diffData : fileData;
  const error = err.key === key ? err[view] : null;

  useEffect(() => {
    let dead = false;
    (async () => {
      // Name the project AND the way out. Every block takes `{project=…}`, which is exactly what
      // you want when the file lives in another repo — and not knowing that is what makes people
      // copy files into their own project just to get them on screen.
      if (!path || !host) {
        if (error) return;
        const noHost = projectCode
          ? `no connected service in ${projectCode} can read files — name another with {project=…}`
          : "no file host";
        return setErr({ key, file: noHost, diff: noHost });
      }
      if (data || error) return;
      try {
        const { Plugin } = loadServiceWithHeaders(host.system.connectionData, host.headers, host.credentials);
        if (view === "diff") {
          const d = await Plugin.getDiff({ path });
          if (!dead) setDiff({ key, ...d });
        } else {
          const d = await Plugin.readFile({ path });
          if (!dead) setFile({ key, ...d });
        }
      } catch (e) {
        const message = (e && e.message) || (view === "diff" ? "could not read the diff" : "could not read the file");
        // Per view: a file with no git history reads fine and diffs badly, and the reader should
        // still be one click away from the version that works.
        if (!dead) setErr((prev) => ({ ...(prev.key === key ? prev : {}), key, [view]: message }));
      }
    })();
    return () => {
      dead = true;
    };
    // Primitives only: `data` is derived and gets a fresh identity every render, which would spin
    // the effect on each paint even though it has nothing left to fetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, view, !!data, !!error]);

  const open = (e) => {
    if (!host) return;
    const detail = { projectCode: host.projectCode, serviceId: host.serviceId, path, language: langOf(path), lines };
    window.dispatchEvent(
      new CustomEvent(e.metaKey || e.ctrlKey ? "sv:openFileInNav" : "sv:revealInNav", {
        detail: e.metaKey || e.ctrlKey ? detail : { kind: "file", ...detail },
      })
    );
  };

  if (!path) return <div className="md-embed md-embed--dead">::{opens} — name a path</div>;
  const range = lines ? `:${lines[0]}${lines[1] !== lines[0] ? `-${lines[1]}` : ""}` : "";
  const diffOn = view === "diff";

  return (
    <div className={`md-embed md-embed--${view}`}>
      <div className="md-embed__head">
        {/* ONE KIND: code. The badge names the pane, not which side of it you're looking at —
            outside, a file open in the panel doesn't rename itself when you press Diff either. */}
        <span className="md-embed__kind">code</span>
        <button type="button" className="md-embed__title md-embed__title--link" onClick={open} title="Show it in the codebase tree — ⌘-click to open it">
          {path}
          {range}
        </button>
        <span className="md-embed__scope">{host ? host.projectCode : ""}</span>
        <button
          type="button"
          className={`md-embed__view ${diffOn ? "md-embed__view--on" : ""}`}
          title={diffOn ? "Showing the diff against HEAD — click for the file" : "Show what changed against HEAD"}
          onClick={() => setView(diffOn ? "file" : "diff")}
        >
          Diff
        </button>
      </div>
      <div className="md-embed__file-body">
        {error ? (
          <div className="report-chart-empty">{error}</div>
        ) : !data ? (
          <div className="report-chart-empty">loading…</div>
        ) : diffOn ? (
          data.base === data.head ? (
            <div className="report-chart-empty">no change against HEAD</div>
          ) : (
            // `base` is the git-HEAD version, `head` the working file — the same fields a story's
            // diff pane passes. READ-ONLY here, unlike that pane: a document is something you read,
            // and editing a file by accident while scrolling past a diff is nobody's intent. Click
            // the path to open it properly if you mean to change it.
            <DiffView
              base={data.base || ""}
              head={data.head || ""}
              language={data.language || langOf(path)}
              dark={editorDark}
            />
          )
        ) : (
          <CodeView
            code={data.content || ""}
            language={data.language || langOf(path)}
            // CodeView's contract is { lines: [a, b] } — the {from,to} shape silently resolves to
            // nothing (range shown in the header, no marks, no scroll).
            highlight={lines ? { lines: [lines[0], lines[1]] } : undefined}
            dark={editorDark}
          />
        )}
      </div>
    </div>
  );
};

export const FileEmbed = (props) => <Embed {...props} opens="file" />;
export const DiffEmbed = (props) => <Embed {...props} opens="diff" />;
