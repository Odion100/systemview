import React, { useContext } from "react";
import ServiceContext from "../../../ServiceContext";
import { useMarkdownScope } from "../context";

// RFC-025 §4.1 — `:file[cli/stage.js#L40-70]`. Codebase connections (RFC-022) made a file reference
// a real, resolvable thing, so a doc can point AT the code instead of quoting it.
//
// The grammar is deliberately identical to the story `--file` flag's `parseFileSpec()` in
// cli/stage.js — `path#L40-70`, `path#L40`, `path:40-70`. One syntax, two consumers.
export function parseFileSpec(value) {
  const s = String(value || "");
  // `#L101-L125` IS A RANGE. It only accepted `#L101-125`, so the L on the second number made the
  // whole pattern miss — and a miss means the range stays glued to the path and gets handed to the
  // filesystem, which then reports ENOENT on a filename with "#L101-L125" in it. The right root,
  // the right host, and a path nobody could ever open. Both spellings, both separators.
  const m = s.match(/#L(\d+)(?:-L?(\d+))?$/i) || s.match(/:(\d+)(?:-(\d+))?$/);
  if (m) {
    const a = parseInt(m[1], 10);
    const b = m[2] ? parseInt(m[2], 10) : a;
    return { path: s.slice(0, m.index), lines: [a, b] };
  }
  return { path: s, lines: null };
}

const EXT_LANG = {
  js: "javascript", jsx: "javascript", mjs: "javascript", cjs: "javascript",
  ts: "typescript", tsx: "typescript",
  json: "json", md: "markdown", markdown: "markdown",
  scss: "scss", css: "css", html: "html", yml: "yaml", yaml: "yaml",
  sh: "shell", py: "python", sql: "sql",
};
const langOf = (p) => EXT_LANG[(p.split(".").pop() || "").toLowerCase()] || "text";

const FileLink = ({ label, attrs = {} }) => {
  const scope = useMarkdownScope();
  const { connectedServices = [] } = useContext(ServiceContext);
  const raw = label || attrs.path || "";
  const { path, lines } = parseFileSpec(raw);

  // Files are served by any service that exposes a Plugin (siblings share a cwd). Prefer the
  // document's own service, then its project, then ANY connected file host — a help topic or the hub
  // has no project in scope at all, and a file chip that reads "no file host" there would look
  // broken rather than honest.
  const hasPlugin = (s) =>
    ((s.system && s.system.connectionData && s.system.connectionData.modules) || []).some(
      (m) => m.name === "Plugin"
    );
  const projectCode = attrs.project || scope.projectCode;
  const inProject = connectedServices.filter((s) => s.projectCode === projectCode && hasPlugin(s));
  // Same rule as the embeds: a chip belonging to a project resolves against THAT project or not at
  // all. Borrowing another project's file host made a chip point into the wrong repo.
  const host =
    inProject.find((s) => s.serviceId === (attrs.service || scope.serviceId)) ||
    inProject[0] ||
    (projectCode ? null : connectedServices.find(hasPlugin)) ||
    null;

  const range = lines ? `:${lines[0]}${lines[1] !== lines[0] ? `-${lines[1]}` : ""}` : "";

  if (!path || !host) {
    return (
      <span
        className="md-chip md-chip--file md-chip--dead"
        title="No connected service in this project can read files — a codebase connection is needed to open it."
      >
        <span className="md-chip__kind">file</span>
        {path || raw}
        {range}
        <span className="md-chip__why">no file host</span>
      </span>
    );
  }

  const open = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const detail = { projectCode: host.projectCode, serviceId: host.serviceId, path, language: langOf(path), lines };
    // REVEAL by default (see NsLink): switch the nav to the Codebases lens, expand to the file and
    // highlight it — the document you're reading stays in the centre. Cmd/Ctrl-click OPENS it, which
    // is the old behaviour and still what you want when you're done reading.
    if (e.metaKey || e.ctrlKey) {
      window.dispatchEvent(new CustomEvent("sv:openFileInNav", { detail }));
      return;
    }
    // ON THE TV, A FILE CHIP IS A HAND-OFF. A report is read in a panel that floats over the page,
    // so revealing the file in the tree behind it leaves you looking at the report you were trying
    // to leave. From the TV the chip OPENS the file (and the TV puts itself away); everywhere else
    // reveal stays the default, because there the document you are reading is the page itself.
    if (e.target && e.target.closest && e.target.closest(".agent-chat__tv")) {
      window.dispatchEvent(new CustomEvent("sv:openFileInNav", { detail }));
      return;
    }
    window.dispatchEvent(new CustomEvent("sv:revealInNav", { detail: { kind: "file", ...detail } }));
  };

  return (
    <a className="md-chip md-chip--file" href={`#${path}`} onClick={open} title={`Show ${path}${range} in the codebase tree — ⌘-click to open it`}>
      <span className="md-chip__kind">file</span>
      {path}
      {range ? <span className="md-chip__range">{range}</span> : null}
    </a>
  );
};

export default FileLink;
