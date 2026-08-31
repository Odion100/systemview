import React from "react";
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
  const raw = label || attrs.path || "";
  const { path, lines } = parseFileSpec(raw);

  // THE FILE HOST IS THE PROJECT, NOT A SERVICE — the same rule `::file` moved to when files became
  // the shell's (see FileEmbed). This chip was the last holdout: it hunted connected services
  // carrying a Plugin, so a reference into a project whose services were down went dead, and the
  // project named in `{project=…}` could only be honoured if that project happened to be running.
  // The hub knows every project's root; the only question is WHICH project the reference belongs to.
  const projectCode = attrs.project || scope.projectCode;
  // A NAMED PROJECT BRINGS NO SERVICE WITH IT. `scope.serviceId` belongs to the document's project,
  // so carrying it across into another one points the pane at a foreign service.
  const serviceId = attrs.project ? attrs.service || null : attrs.service || scope.serviceId || null;

  const range = lines ? `:${lines[0]}${lines[1] !== lines[0] ? `-${lines[1]}` : ""}` : "";

  if (!path || !projectCode) {
    return (
      <span
        className="md-chip md-chip--file md-chip--dead"
        title="This reference doesn't belong to a project, so there's no folder to read it from — name one with {project=…}."
      >
        <span className="md-chip__kind">file</span>
        {path || raw}
        {range}
        <span className="md-chip__why">no project</span>
      </span>
    );
  }

// CLICK OPENS. NOTHING HERE IS A WEB LINK. His ruling, twice over: *"no more only revealing…
// that's been annoying to me"* and *"they're not real links — none of these are really supposed to
// be links."* Reveal-only made a reference into a gesture you had to follow up by hand, and with
// the chat panel over the navigator the gesture was invisible — indistinguishable from a dead
// control. And being a real `<a href>` is what let the browser treat an app affordance as a web
// link (that is how every same-origin link ended up in a new tab: RFC-051 round, ChatLink).
// So: a BUTTON that opens. ⌘-click still opens too — one behaviour, no modifier to learn.
  const open = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const detail = { projectCode, serviceId, path, language: langOf(path), lines };
    window.dispatchEvent(new CustomEvent("sv:openFileInNav", { detail }));
  };

  return (
    <button type="button" className="md-chip md-chip--file" onClick={open} title={`Open ${path}${range}`}>
      <span className="md-chip__kind">file</span>
      {path}
      {range ? <span className="md-chip__range">{range}</span> : null}
    </button>
  );
};

export default FileLink;
