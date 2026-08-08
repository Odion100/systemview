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
  return (
    inProject.find((s) => s.serviceId === (attrs.service || scope.serviceId)) ||
    inProject[0] ||
    connectedServices.find(hasPlugin) ||
    null
  );
}

const Frame = ({ kind, path, range, host, children, onOpen }) => (
  <div className={`md-embed md-embed--${kind}`}>
    <div className="md-embed__head">
      <span className="md-embed__kind">{kind}</span>
      <button type="button" className="md-embed__title md-embed__title--link" onClick={onOpen} title="Show it in the codebase tree — ⌘-click to open it">
        {path}
        {range}
      </button>
      <span className="md-embed__scope">{host ? host.projectCode : ""}</span>
    </div>
    <div className="md-embed__file-body">{children}</div>
  </div>
);

export const FileEmbed = ({ label, attrs = {} }) => {
  const scope = useMarkdownScope();
  const host = useFileHost(attrs, scope);
  const [editorDark] = useEditorDark("docs");
  const raw = label || attrs.path || "";
  const { path, lines } = parseFileSpec(raw);
  const [state, setState] = useState({ loading: true });

  useEffect(() => {
    let dead = false;
    (async () => {
      if (!path || !host) return setState({ error: "no file host" });
      try {
        const { Plugin } = loadServiceWithHeaders(host.system.connectionData, host.headers, host.credentials);
        const data = await Plugin.readFile({ path });
        if (!dead) setState({ data });
      } catch (e) {
        if (!dead) setState({ error: (e && e.message) || "could not read the file" });
      }
    })();
    return () => {
      dead = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, host && host.serviceId]);

  const open = (e) => {
    if (!host) return;
    const detail = { projectCode: host.projectCode, serviceId: host.serviceId, path, language: langOf(path), lines };
    window.dispatchEvent(
      new CustomEvent(e.metaKey || e.ctrlKey ? "sv:openFileInNav" : "sv:revealInNav", {
        detail: e.metaKey || e.ctrlKey ? detail : { kind: "file", ...detail },
      })
    );
  };

  if (!path) return <div className="md-embed md-embed--dead">::file — name a path</div>;
  const range = lines ? `:${lines[0]}${lines[1] !== lines[0] ? `-${lines[1]}` : ""}` : "";
  return (
    <Frame kind="file" path={path} range={range} host={host} onOpen={open}>
      {state.loading ? (
        <div className="report-chart-empty">loading…</div>
      ) : state.error ? (
        <div className="report-chart-empty">{state.error}</div>
      ) : (
        <CodeView
          code={state.data.content || ""}
          language={state.data.language || langOf(path)}
          // CodeView's contract is { lines: [a, b] } — the {from,to} shape silently resolves to
          // nothing (range shown in the header, no marks, no scroll).
          highlight={lines ? { lines: [lines[0], lines[1]] } : undefined}
          dark={editorDark}
        />
      )}
    </Frame>
  );
};

export const DiffEmbed = ({ label, attrs = {} }) => {
  const scope = useMarkdownScope();
  const host = useFileHost(attrs, scope);
  const [editorDark] = useEditorDark("docs");
  const path = (label || attrs.path || "").trim();
  const [state, setState] = useState({ loading: true });

  useEffect(() => {
    let dead = false;
    (async () => {
      if (!path || !host) return setState({ error: "no file host" });
      try {
        const { Plugin } = loadServiceWithHeaders(host.system.connectionData, host.headers, host.credentials);
        const data = await Plugin.getDiff({ path });
        if (!dead) setState({ data });
      } catch (e) {
        if (!dead) setState({ error: (e && e.message) || "could not read the diff" });
      }
    })();
    return () => {
      dead = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, host && host.serviceId]);

  const open = (e) => {
    if (!host) return;
    const detail = { projectCode: host.projectCode, serviceId: host.serviceId, path, language: langOf(path) };
    window.dispatchEvent(
      new CustomEvent(e.metaKey || e.ctrlKey ? "sv:openFileInNav" : "sv:revealInNav", {
        detail: e.metaKey || e.ctrlKey ? detail : { kind: "file", ...detail },
      })
    );
  };

  if (!path) return <div className="md-embed md-embed--dead">::diff — name a path</div>;
  return (
    <Frame kind="diff" path={path} range="" host={host} onOpen={open}>
      {state.loading ? (
        <div className="report-chart-empty">loading…</div>
      ) : state.error ? (
        <div className="report-chart-empty">{state.error}</div>
      ) : state.data.base === state.data.head ? (
        <div className="report-chart-empty">no change against HEAD</div>
      ) : (
        // `base` is the git-HEAD version, `head` the working file — the same fields a story's diff
        // pane passes. READ-ONLY here, unlike that pane: a document is something you read, and
        // editing a file by accident while scrolling past a diff is nobody's intent. Click the path
        // to open it properly if you mean to change it.
        <DiffView
          base={state.data.base || ""}
          head={state.data.head || ""}
          language={state.data.language || langOf(path)}
          dark={editorDark}
        />
      )}
    </Frame>
  );
};
