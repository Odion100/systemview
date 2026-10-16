// WHERE A TAB GOES WHEN CLICKED — extracted from Documentation's routeTo (RFC-069 slice 4) so the
// Agents page can route the SAME tabs without copying the map. One grammar: every center tab kind
// resolves to a /specs location; the caller pushes it. Pure: (tab, pc, currentSearch) → {pathname,
// search} — no history, no window, so both pages and any future host can share it.
export function buildRoute(t, pc, currentSearch) {
  const p = new URLSearchParams(currentSearch || "");
  ["file", "fproj", "fsvc", "flang", "flines", "fside", "fnav", "ftab", "fmachine", "help"].forEach((k) => p.delete(k));
  if (t.kind === "file") {
    const f = t.file || {};
    p.set("tab", "docs");
    p.set("file", f.path);
    if (f.machine) p.set("fmachine", "1");
    if (f.projectCode) p.set("fproj", f.projectCode);
    if (f.serviceId) p.set("fsvc", f.serviceId);
    if (f.language) p.set("flang", f.language);
    if (f.lines && f.lines[0]) p.set("flines", f.lines.join("-"));
    if (f.side) p.set("fside", f.side);
    return { pathname: `/specs/${pc}`, search: `?${p.toString()}` };
  }
  if (t.kind === "stats") {
    p.set("tab", "stats");
    return { pathname: `/specs/${pc}`, search: `?${p.toString()}` };
  }
  if (t.kind === "board" || t.kind === "links" || t.kind === "cmds") {
    p.set("tab", t.kind);
    p.delete("rdoc");
    return { pathname: `/specs/${pc}`, search: `?${p.toString()}` };
  }
  if (t.kind === "logs") {
    p.set("tab", "logs");
    const lg = t.logs || {};
    const segs = [pc, lg.serviceId, lg.moduleName, lg.methodName].filter(Boolean);
    return { pathname: `/specs/${segs.join("/")}`, search: `?${p.toString()}` };
  }
  if (t.kind === "report") {
    p.set("tab", "reports");
    if (t.report && t.report.path) p.set("rdoc", t.report.path);
    else p.delete("rdoc");
    return { pathname: `/specs/${pc}`, search: `?${p.toString()}` };
  }
  // doc (a namespace), and the fallback
  p.set("tab", "docs");
  if (t.kind === "doc" && t.doc) {
    const d = t.doc;
    const segs = [pc, d.serviceId, d.moduleName, d.methodName].filter(Boolean);
    return { pathname: `/specs/${segs.join("/")}`, search: `?${p.toString()}` };
  }
  return { pathname: `/specs/${pc}`, search: `?${p.toString()}` };
}

// THE LABEL A TAB WEARS — same extraction, same reason: the Agents page must not grow a second
// opinion about what a report tab is called. `agentdoc` is the one new kind (RFC-069 §4.5's
// carve-out: the def prompt and other blob documents that have a SAVE DOOR rather than a file).
export function labelOfTab(t, pc) {
  if (t.kind === "file") {
    const f = t.file || {};
    return f.path ? String(f.path).split("/").pop() : "file";
  }
  if (t.kind === "stats") return `Stats · ${pc}`;
  if (t.kind === "board") return `Board · ${pc}`;
  if (t.kind === "links") return `Links · ${pc}`;
  if (t.kind === "cmds") return `Commands · ${pc}`;
  if (t.kind === "logs") return `Logs · ${(t.logs && (t.logs.methodName || t.logs.moduleName || t.logs.serviceId)) || pc}`;
  if (t.kind === "agentdoc") return (t.adoc && t.adoc.label) || "agent doc";
  if (t.kind === "report") {
    if (!t.report || !t.report.path) return "Reports";
    const m = t.report.path.match(/report\.([^.]+)\.(.+)\.md$/);
    const nm = m ? m[2].replace(/-/g, " ") : t.report.path.split("/").pop();
    return m && m[1] !== pc ? `${nm} · ${m[1]}` : nm;
  }
  return (t.doc && (t.doc.methodName || t.doc.moduleName || t.doc.serviceId)) || "Documentation";
}
