// DRIVING THE WINDOW, AS FOUR CAPABILITIES — nav, refresh, act, highlight.
//
// These lived in `cli/chat.js` and reached the hub the only way a terminal can: over HTTP, to the
// server it was already talking to. Under the hub that is a process calling itself across the
// network to read a registry it is holding in memory.
//
// Worse than the round trip was the SHAPE it forced. The hub exposed one method, `svDrive`, taking
// a `verb` string and switching on it — four MCP tools funnelling into one door so they could fan
// back out. A verb string is a command line's idea; the MCP has no commands, it has methods. The
// CLI does not get to dictate the agent face.
//
// What is left here is the part that is actually a capability: VALIDATION (never move someone to a
// namespace, stats tab, range or service that isn't there), address parsing, and the human label
// the window speaks. Every function is pure — registry in, command out — so the hub emits it and
// any other caller can too.
const SECTIONS = ["center", "nav", "scratchpad", "page", "stats"];
const STATS_TABS = ["state", "load", "reliability", "coverage", "change", "topology", "coupling"];
const RANGES = ["15m", "1h", "4h", "24h", "all"];
const SCOPES = ["docs", "reports", "nav", "stats", "all"];

const servicesOf = (projectCode, connections) =>
  (connections || []).filter((c) => String(c.projectCode).toLowerCase() === String(projectCode).toLowerCase());

// RFC-029 — resolve against the LIVE tree, at every granularity: "add", "Math.add" and
// "TestService.Math.add" all reach the same method. An unvalidated push once walked him to a
// namespace that did not exist, which is a worse outcome than a refusal.
function resolveNamespace(projectCode, nsInput, connections) {
  const rows = [];
  for (const svc of servicesOf(projectCode, connections)) {
    rows.push(svc.serviceId);
    const modules = (svc.system && svc.system.connectionData && svc.system.connectionData.modules) || [];
    for (const m of modules) {
      rows.push(`${svc.serviceId}.${m.name}`);
      for (const f of m.methods || []) rows.push(`${svc.serviceId}.${m.name}.${f.fn}`);
    }
  }
  const want = String(nsInput).toLowerCase().split(/[./]+/).filter(Boolean);
  const hits = [
    ...new Set(
      rows.filter((full) => {
        const segs = full.toLowerCase().split(".");
        if (!want.length || want.length > segs.length) return false;
        return segs.slice(segs.length - want.length).join(".") === want.join(".");
      })
    ),
  ];
  if (!hits.length)
    return { error: `no live namespace matches "${nsInput}" in ${projectCode} — nothing sent`, candidates: rows.slice(0, 40) };
  if (hits.length > 1) return { error: `"${nsInput}" is ambiguous`, candidates: hits.slice(0, 8) };
  return { namespace: hits[0] };
}

// `#L274-378` and `#L274-L378` are the same address — a naive split on "#L" left the second L stuck
// to the number, parsed it as NaN, and silently halved the range.
function splitRange(value) {
  const m = String(value).match(/^(.*?)#L(\d+)(?:-L?(\d+))?$/i);
  if (!m) return { path: String(value) };
  return { path: m[1], lines: [Number(m[2]), Number(m[3] || m[2])], text: `#L${m[2]}${m[3] ? `-${m[3]}` : ""}` };
}

function nav({ projectCode, namespace, file, report, stats, range, service, tab, topic, agents } = {}, connections = []) {
  if (!projectCode) return { error: "projectCode required" };
  const args = {};
  let label = "";

  if (stats !== undefined && stats !== null && stats !== false) {
    const s = {};
    const tabName = stats === true || stats === "open" ? null : String(stats);
    if (tabName) {
      if (!STATS_TABS.includes(tabName)) return { error: `no stats tab "${tabName}" — tabs: ${STATS_TABS.join(", ")}` };
      s.report = tabName;
    }
    if (range) {
      if (!RANGES.includes(range)) return { error: `no range "${range}" — ranges: ${RANGES.join(", ")}` };
      s.range = range;
    }
    if (service) {
      const ids = servicesOf(projectCode, connections).map((x) => x.serviceId);
      const hit = ids.find((x) => x.toLowerCase() === String(service).toLowerCase());
      if (!hit) return { error: `no service "${service}" in ${projectCode} — services: ${ids.join(", ") || "(none)"}` };
      s.service = hit;
    }
    args.stats = s;
    label = `opened stats${s.report ? ` — ${s.report}` : ""}${s.range ? `, last ${s.range === "all" ? "everything" : s.range}` : ""}${s.service ? `, focused on ${s.service}` : ""}`;
  } else if (report) {
    const r = splitRange(report);
    args.report = r.path;
    if (r.lines) args.lines = r.lines;
    label = `opened report ${r.path.split("/").pop()}${r.text || ""}`;
  } else if (file) {
    const f = splitRange(file);
    args.file = f.path;
    if (f.lines) args.lines = f.lines;
    label = `pulled up ${f.path}${f.text || ""}`;
  } else if (agents) {
    args.agents = true;
    label = "opened the agents page";
  } else if (tab && !SECTIONS.includes(tab)) {
    args.tab = tab;
    label = `switched to the ${tab} tab`;
  } else if (topic) {
    args.help = topic;
    label = `opened help: ${topic}`;
  } else if (namespace) {
    const r = resolveNamespace(projectCode, namespace, connections);
    if (r.error) return r;
    args.namespace = r.namespace;
    label = `navigated to ${r.namespace}`;
  } else {
    return { error: "nothing to navigate to — give a namespace, stats, report, file, tab, topic or agents" };
  }
  return { cmd: "nav", args, label };
}

function refresh({ projectCode, scope } = {}) {
  if (!projectCode) return { error: "projectCode required" };
  const s = SCOPES.includes(scope) ? scope : "all";
  return { cmd: "refresh", args: { scope: s }, label: `refreshed ${s === "all" ? "everything" : s}` };
}

function act({ projectCode, test, run } = {}) {
  if (!projectCode) return { error: "projectCode required" };
  if (run) return { cmd: "act", args: { run }, label: `pressed play on "${run}"` };
  if (test)
    return {
      cmd: "act",
      args: { test },
      label: test === "all" ? "ran ALL the saved tests" : `ran ${test} in the saved tests`,
    };
  return { error: 'act: give `test` (a Module.method or "all") or `run` (a block title)' };
}

// RFC-029 — highlight is NOT nav (his line: "highlight and selection are two different commands").
// It POINTS the tree at a thing: expands, marks, scrolls into view, and opens nothing.
function highlight({ projectCode, namespace, file } = {}, connections = []) {
  if (!projectCode) return { error: "projectCode required" };
  if (file) {
    const p = String(file).split("#L")[0];
    return { cmd: "highlight", args: { file: p }, label: `highlighted ${p}` };
  }
  if (!namespace) return { error: "highlight: give a namespace or a file" };
  const r = resolveNamespace(projectCode, namespace, connections);
  if (r.error) return r;
  return { cmd: "highlight", args: { namespace: r.namespace }, label: `highlighted ${r.namespace}` };
}

module.exports = { nav, refresh, act, highlight, resolveNamespace, splitRange, STATS_TABS, RANGES, SCOPES };
