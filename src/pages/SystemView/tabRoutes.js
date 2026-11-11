// WHERE A TAB GOES WHEN CLICKED — extracted from Documentation's routeTo so the
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
  // HOW WE WORK IS A TAB YOU CAN OPEN, not only the floor you fall to. It began as the empty-strip
  // page, which meant the only way to read it was to close every document — *"I'm not going to
  // close all my documents to have the tab strip empty to get to it."* One per project, like the
  // board: it is a view of one thing, so a second tab would be the same page twice.
  // THE DASHBOARD. Three of them are in the tree at once on purpose — three lanes each built a
  // whole answer from the same brief and his own point of view, and the way to choose between
  // designs is to flip between them on real data, not to read three descriptions. `?dash=a|b|c`
  // rides the route so a choice survives a refresh and can be linked.
  if (t.kind === "dash") {
    p.set("tab", "dash");
    p.delete("rdoc");
    return { pathname: `/specs/${pc}`, search: `?${p.toString()}` };
  }
  if (t.kind === "how") {
    p.set("tab", "how");
    p.delete("rdoc");
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
  if (t.kind === "dash") return "Dashboard";
  if (t.kind === "how") return "How we work";
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

// ─── THE OTHER DIRECTION: WHICH TAB A URL WANTS ───────────────────────────────────────────────
//
// `buildRoute` is tab → URL. This is URL → tab, and it lives here because the two directions are
// one map: split across two files they drift, which is the exact drift `buildRoute`'s own extraction
// was done to kill.
//
// WHY IT IS PURE, AND WHY THAT IS THE FIX RATHER THAN A TIDY-UP.
//
// His bug, 2026-11-10: *"restart, land on how-we-work because everything else is loading. And then
// if you close a tab, or you open another document, a bunch of other tabs open."*
//
// The cause was a FEEDBACK LOOP, not a cache. The centre's URL→store effect had `onFloor` in its
// dependency array, and `onFloor` was computed from `pane.tabs.length === 0` — a value the effect
// itself changes by calling `openTab`. So closing the last tab ran this:
//
//   1. strip empties            → onFloor true   → effect fires → opens `how:<pc>`
//   2. strip now has one tab    → onFloor false  → effect fires → opens `doc:<ns>`
//
// One close, two tabs, and every further transition added another. The same dance ran twice on a
// cold start, because `tabsPc` is `projectCode || "@none"` and `@none` is a real cached store with
// its own localStorage key — so before the project resolved, the floor was seeded into a phantom
// project nobody can see. That is the "cache somehow" he suspected: there really is one, and
// nothing ever shows it.
//
// So the planner takes the URL and the scope and NOTHING FROM THE STORE. A function that cannot
// read what it writes cannot feed back into itself, and the floor decision — the one thing that
// genuinely needs to know whether the strip is empty — is left to the caller as a ONE-SHOT, read
// imperatively at the moment it is made rather than subscribed to.
//
// Returns the ONE tab this URL state wants, or null for "this state opens nothing" — which is a
// real answer (project level with no service selected opens no document; the landing is background).
export function tabForUrl({ urlTab, sService, sModule, sMethod, reportPath, projectCode } = {}) {
  const ns = `${sService || ""}.${sModule || ""}.${sMethod || ""}`;
  const docTab = () =>
    sService
      ? { key: `doc:${ns}`, kind: "doc", doc: { serviceId: sService, moduleName: sModule, methodName: sMethod } }
      : null;

  if (urlTab === "logs")
    // LOGS ACCUMULATE PER SCOPE — "logs here and logs there" are two different things you are
    // watching, so the key IS the place.
    return { key: `logs:${ns}`, kind: "logs", logs: { serviceId: sService, moduleName: sModule, methodName: sMethod } };
  if (urlTab === "links" || urlTab === "cmds") return { key: `${urlTab}:${projectCode}`, kind: urlTab };
  if (urlTab === "dash") return { key: `dash:${projectCode}`, kind: "dash" };
  if (urlTab === "how") return { key: `how:${projectCode}`, kind: "how" };
  if (urlTab === "board") return { key: `board:${projectCode}`, kind: "board" };
  if (urlTab === "stats") return { key: `stats:${projectCode}`, kind: "stats" };
  if (urlTab === "reports")
    // A report OPEN gets its own tab, keyed by its path. Bare `tab=reports` is not a picker — his
    // ruling, loudly — so it falls back to whatever the scope would have shown.
    return reportPath ? { key: `report:${reportPath}`, kind: "report", report: { path: reportPath } } : docTab();
  return docTab();
}

// THE FLOOR — How-we-work as a real, selected, closable tab rather than a page nobody can address.
// Separate from `tabForUrl` on purpose: this is the only decision that needs to know the strip is
// EMPTY, and keeping it out of the planner is what keeps the planner unable to feed back.
export const floorTab = (projectCode) => ({ key: `how:${projectCode}`, kind: "how" });

// IS THIS A PROJECT WORTH SEEDING A FLOOR INTO? `@none` is the placeholder `tabsPc` wears before
// the project resolves on a cold start, and seeding it wrote a tab into a store no surface will
// ever show again. A floor belongs to a real project or to nothing.
export const seedable = (projectCode) => !!projectCode && projectCode !== "@none";
