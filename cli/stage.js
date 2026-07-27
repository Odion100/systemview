// RFC-018 — the CLI's drive surface for the AI Window. Thin verbs over the API stage methods: each
// resolves a target project (via the unified fuzzy resolver, `projectCode:` prefix and all), builds
// pane descriptors (locators only — never bytes), and calls the API, which broadcasts `stage-updated`
// to every open UI. The UI fetches real bytes from each service's plugin at render time.
const log = require("./logger");
const { createClient } = require("systemlynx");
const { createCookieHttpClient } = require("./cookieClient");
const resolveTarget = require("./utils/resolveTarget");
const resolveNamespace = require("./utils/resolveNamespace");

const Client = createClient(createCookieHttpClient());

async function loadApi(uiUrl) {
  const { SystemView } = await Client.loadService(`${uiUrl}/systemview/api`);
  return SystemView;
}

const first = (v) => (Array.isArray(v) ? v[0] : v);
const list = (v) => (Array.isArray(v) ? v : v == null ? [] : [v]);

// `--lines A-B` or `--match s` → a highlight descriptor the pane emphasizes without losing the whole.
function parseHighlight(flags) {
  if (flags.lines) {
    const [a, b] = String(flags.lines).split("-").map((n) => parseInt(n, 10));
    if (a) return { lines: [a, b || a] };
  }
  if (flags.match) return { match: flags.match };
  return null;
}

const filePane = (serviceId, path, highlight) => ({
  kind: "file", target: { serviceId, path }, ...(highlight ? { highlight } : {}),
});
const sourcePane = (serviceId, module, method, highlight) => ({
  kind: "source", target: { serviceId, module, method }, ...(highlight ? { highlight } : {}),
});
const diffPane = (serviceId, path) => ({ kind: "diff", target: { serviceId, path } });
const markdownPane = (text) => ({ kind: "markdown", target: { text } });

// A `test` pane names the saved test to render (as a runnable worked example). A trailing `:N` pins
// ONE test by index (for a report you don't want every test for a method, just the one you made).
// Resolve the owning service from the namespace so the UI fetches the test from the right plugin.
function testFrom(spec, services) {
  const raw = String(spec);
  // A test pane can name ANY namespace level, so a story can pull "all tests" at that scope:
  //   *            → the whole project (every service's tests)
  //   TestService  → all tests under a service
  //   Math         → all tests under a module
  //   Math.add     → that method's tests   (Math.add:1 → just index 1)
  if (raw === "*" || raw === "all") return { kind: "test", target: {} };

  const im = raw.match(/^(.*?):(\d+)$/);
  const nsInput = im ? im[1] : raw;
  const index = im ? parseInt(im[2], 10) : undefined;

  // Catalog the namespace levels actually present. A bare "Math" is the MODULE (all its methods), NOT
  // a fuzzy match on the first Math.* method — resolveNamespace substring-matches the joined path, so
  // it would otherwise return Math.add first. Service/module names win before method resolution.
  const serviceIds = new Set();
  const moduleNames = new Set();
  services.forEach((s) => {
    serviceIds.add(s.serviceId);
    const mods = (s.system && s.system.connectionData && s.system.connectionData.modules) || [];
    mods.forEach((mod) => moduleNames.add(mod.name));
  });
  if (!nsInput.includes(".")) {
    if (serviceIds.has(nsInput)) return { kind: "test", target: { serviceId: nsInput } };
    if (moduleNames.has(nsInput)) return { kind: "test", target: { moduleName: nsInput } };
  }

  // Method-level (Mod.method or a fuzzy method name) — the most specific, resolve the owning service.
  const m = resolveNamespace(nsInput, services).find((r) => r.methodName);
  if (m) {
    const target = { serviceId: m.serviceId, moduleName: m.moduleName, methodName: m.methodName };
    if (index != null) target.index = index;
    return { kind: "test", target };
  }
  // Fallback: dotted Mod.method that didn't resolve — take it literally against the first service.
  const parts = nsInput.split(".");
  const methodName = parts.pop();
  const moduleName = parts.pop();
  const target = { serviceId: services[0].serviceId, moduleName, methodName };
  if (index != null) target.index = index;
  return { kind: "test", target };
}

// Map a `Mod.method` (or fuzzy `signUp`) to the service that actually owns it, so the UI calls the
// RIGHT service's plugin for its source. Falls back to dot-splitting + the first service in scope.
function sourceFrom(spec, services, highlight) {
  const m = resolveNamespace(spec, services)[0];
  if (m) return sourcePane(m.serviceId, m.moduleName, m.methodName, highlight);
  const parts = String(spec).split(".");
  const method = parts.pop();
  const module = parts.pop();
  return sourcePane(services[0].serviceId, module, method, highlight);
}

// Build a SINGLE pane from flags (for `show` / `stage add`). Priority: explicit --file > --source >
// --text > a bare namespace that resolves to a method (→ its source). null when nothing was given.
function paneFromFlags(resolved, flags, highlight) {
  const services = resolved.services;
  const sid0 = services[0].serviceId;
  const file = first(flags.file);
  const source = first(flags.source);
  const diff = first(flags.diff);
  const test = first(flags.test);
  const text = first(flags.text);
  if (file) return filePane(sid0, file, highlight);
  if (source) return sourceFrom(source, services, highlight);
  if (diff) return diffPane(sid0, diff);
  if (test) return testFrom(test, services);
  if (text) return markdownPane(text);
  if (resolved.resolvedNamespace) {
    const m = resolveNamespace(resolved.resolvedNamespace, services)[0];
    if (m) return sourcePane(m.serviceId, m.moduleName, m.methodName, highlight);
  }
  return null;
}

async function resolveScope(SystemView, targetArg) {
  const resolved = await resolveTarget(SystemView, targetArg);
  if (!resolved.services || !resolved.services.length) return null;
  return resolved;
}

const describe = (p) =>
  p.kind === "file" ? p.target.path
  : p.kind === "source" ? `${p.target.module || ""}.${p.target.method}`
  : p.kind === "markdown" ? "text" : p.kind;

// `show <target> [--file p | --source Mod.method | --text "…"]` — focus one exact thing (single layout).
async function show(targetArg, { uiUrl, json = false, ...flags } = {}) {
  const SystemView = await loadApi(uiUrl);
  const resolved = await resolveScope(SystemView, targetArg);
  if (!resolved) { log.error(`No connected services for "${targetArg || ""}"`); return 1; }
  const pane = paneFromFlags(resolved, flags, parseHighlight(flags));
  if (!pane) {
    log.error('Nothing to show — pass --file <path>, --source <Mod.method>, --text "…", or a method namespace.');
    return 1;
  }
  const projectCode = resolved.services[0].projectCode;
  const stage = await SystemView.showTarget(projectCode, pane);
  if (json) process.stdout.write(JSON.stringify(stage, null, 2) + "\n");
  else log.success(`stage ${projectCode} → ${pane.kind} ${describe(pane)}`);
  return 0;
}

// `assemble <target> [--text … --source … --file …]…` — set the whole stage at once (grid by default).
async function assemble(targetArg, { uiUrl, json = false, ...flags } = {}) {
  const SystemView = await loadApi(uiUrl);
  const resolved = await resolveScope(SystemView, targetArg);
  if (!resolved) { log.error(`No connected services for "${targetArg || ""}"`); return 1; }
  const services = resolved.services;
  const sid0 = services[0].serviceId;
  const buildPane = ({ kind, value }) => {
    if (kind === "markdown") return markdownPane(value);
    if (kind === "source") return sourceFrom(value, services);
    if (kind === "file") return filePane(sid0, value);
    if (kind === "diff") return diffPane(sid0, value);
    if (kind === "test") return testFrom(value, services);
    return null;
  };
  // Preserve command order (flags.paneSeq) so markdown interleaves with code/diff/test — the story.
  // Fall back to by-kind grouping only if paneSeq is unavailable (e.g. a caller that didn't pass it).
  let panes;
  if (flags.paneSeq && flags.paneSeq.length) {
    panes = flags.paneSeq.map(buildPane).filter(Boolean);
  } else {
    panes = [];
    list(flags.text).forEach((t) => panes.push(markdownPane(t)));
    list(flags.source).forEach((s) => panes.push(sourceFrom(s, services)));
    list(flags.file).forEach((f) => panes.push(filePane(sid0, f)));
    list(flags.diff).forEach((d) => panes.push(diffPane(sid0, d)));
    list(flags.test).forEach((t) => panes.push(testFrom(t, services)));
  }
  if (!panes.length) { log.error("assemble needs at least one --text / --source / --file / --diff / --test."); return 1; }
  const projectCode = services[0].projectCode;
  const stage = await SystemView.assembleStage(projectCode, { panes, layout: flags.layout });
  if (json) process.stdout.write(JSON.stringify(stage, null, 2) + "\n");
  else log.success(`stage ${projectCode} → ${panes.length} pane(s) [${stage.layout}]`);
  return 0;
}

// `stage add <target> [flags]` / `stage clear <target>`.
async function stage(sub, targetArg, { uiUrl, json = false, ...flags } = {}) {
  const SystemView = await loadApi(uiUrl);
  const resolved = await resolveScope(SystemView, targetArg);
  if (!resolved) { log.error(`No connected services for "${targetArg || ""}"`); return 1; }
  const projectCode = resolved.services[0].projectCode;
  if (sub === "clear") {
    const s = await SystemView.clearStage(projectCode);
    if (json) process.stdout.write(JSON.stringify(s, null, 2) + "\n");
    else log.success(`stage ${projectCode} cleared`);
    return 0;
  }
  if (sub === "add") {
    const pane = paneFromFlags(resolved, flags, parseHighlight(flags));
    if (!pane) { log.error('stage add needs --file / --source / --text.'); return 1; }
    const s = await SystemView.addPane(projectCode, pane);
    if (json) process.stdout.write(JSON.stringify(s, null, 2) + "\n");
    else log.success(`stage ${projectCode} + ${pane.kind} ${describe(pane)} (${s.panes.length} pane(s))`);
    return 0;
  }
  log.error(`Unknown stage subcommand "${sub || ""}" — use: stage add | stage clear`);
  return 1;
}

// `highlight <target> --lines A-B | --match s` — emphasize a region of the last pane on the stage.
async function highlight(targetArg, { uiUrl, json = false, ...flags } = {}) {
  const SystemView = await loadApi(uiUrl);
  const resolved = await resolveScope(SystemView, targetArg);
  if (!resolved) { log.error(`No connected services for "${targetArg || ""}"`); return 1; }
  const hl = parseHighlight(flags);
  if (!hl) { log.error("highlight needs --lines A-B or --match <string>."); return 1; }
  const projectCode = resolved.services[0].projectCode;
  const s = await SystemView.highlightPane(projectCode, undefined, hl);
  if (json) process.stdout.write(JSON.stringify(s, null, 2) + "\n");
  else log.success(`stage ${projectCode} highlight ${hl.lines ? hl.lines.join("-") : hl.match}`);
  return 0;
}

// `view save <target> <name>` / `view open <target> <name>` / `view list <target>` / `view delete …`
// — persist the current stage as a reopenable communication (stored per RFC-017 in .systemview/views).
async function view(sub, targetArg, name, { uiUrl, json = false } = {}) {
  const SystemView = await loadApi(uiUrl);
  const resolved = await resolveScope(SystemView, targetArg);
  if (!resolved) { log.error(`No connected services for "${targetArg || ""}"`); return 1; }
  const projectCode = resolved.services[0].projectCode;

  if (sub === "list") {
    const names = await SystemView.listViews(projectCode);
    if (json) process.stdout.write(JSON.stringify(names, null, 2) + "\n");
    else {
      log.info(`saved views for ${projectCode}:`);
      (names || []).forEach((n) => console.log("    " + n));
      if (!names || !names.length) console.log("    (none)");
    }
    return 0;
  }
  if (sub === "save") {
    if (!name) { log.error("view save needs a name: view save <project> <name>"); return 1; }
    await SystemView.saveView(projectCode, name);
    log.success(`saved view "${name}" for ${projectCode}`);
    return 0;
  }
  if (sub === "open") {
    if (!name) { log.error("view open needs a name: view open <project> <name>"); return 1; }
    const s = await SystemView.openView(projectCode, name);
    if (json) process.stdout.write(JSON.stringify(s, null, 2) + "\n");
    else log.success(`opened view "${name}" → ${s.panes.length} pane(s) [${s.layout}]`);
    return 0;
  }
  if (sub === "delete") {
    if (!name) { log.error("view delete needs a name"); return 1; }
    await SystemView.deleteView(projectCode, name);
    log.success(`deleted view "${name}"`);
    return 0;
  }
  log.error(`Unknown view subcommand "${sub || ""}" — use: view save | open | list | delete`);
  return 1;
}

// `selection <target>` — read the user's current selection in the AI Window (the reverse channel), so
// "why'd you write THAT?" already knows which "that." The agent pulls this; the UI pushes it on click.
async function selection(targetArg, { uiUrl, json = false } = {}) {
  const SystemView = await loadApi(uiUrl);
  const resolved = await resolveScope(SystemView, targetArg);
  if (!resolved) { log.error(`No connected services for "${targetArg || ""}"`); return 1; }
  const projectCode = resolved.services[0].projectCode;
  const sel = await SystemView.getSelection(projectCode);
  if (json) process.stdout.write(JSON.stringify(sel, null, 2) + "\n");
  else if (!sel) log.info(`no current selection in ${projectCode}`);
  else log.info(`selection in ${projectCode}: ${sel.kind || "?"} ${JSON.stringify(sel.target || {})}`);
  return 0;
}

// `story <target> "<name>" [--ns namespace] [--text/--source/--file/--diff/--test]…` — upsert a NAMED
// story filed on a namespace. Unlike the single live stage, a project holds MANY stories (like a method
// holds many tests). This creates a new one — or replaces the same-named one under that namespace —
// with the given panes, in command order. `--ns` defaults to the project (project-level namespace).
async function story(targetArg, name, { uiUrl, json = false, ...flags } = {}) {
  const SystemView = await loadApi(uiUrl);
  const resolved = await resolveScope(SystemView, targetArg);
  if (!resolved) { log.error(`No connected services for "${targetArg || ""}"`); return 1; }
  if (!name) { log.error('story needs a name: story <target> "<name>" [--ns ns] [--text/--source/--file/--diff/--test]'); return 1; }
  const services = resolved.services;
  const sid0 = services[0].serviceId;
  const projectCode = services[0].projectCode;
  const namespace = flags.ns || projectCode;

  // A `--note "markdown"` attaches the agent's own prose to a TEST pane — it travels WITH the test block.
  const withNote = (pane) => {
    if (pane && pane.kind === "test" && flags.note) pane.target.note = flags.note;
    return pane;
  };
  const buildPane = ({ kind, value }) => {
    if (kind === "markdown") return markdownPane(value);
    if (kind === "source") return sourceFrom(value, services);
    if (kind === "file") return filePane(sid0, value);
    if (kind === "diff") return diffPane(sid0, value);
    if (kind === "test") return withNote(testFrom(value, services));
    return null;
  };
  let panes;
  if (flags.paneSeq && flags.paneSeq.length) {
    panes = flags.paneSeq.map(buildPane).filter(Boolean);
  } else {
    panes = [];
    list(flags.text).forEach((t) => panes.push(markdownPane(t)));
    list(flags.source).forEach((s) => panes.push(sourceFrom(s, services)));
    list(flags.file).forEach((f) => panes.push(filePane(sid0, f)));
    list(flags.diff).forEach((d) => panes.push(diffPane(sid0, d)));
    list(flags.test).forEach((t) => panes.push(withNote(testFrom(t, services))));
  }

  const existing = ((await SystemView.listStories(projectCode)) || []).find(
    (s) => s.name === name && s.namespace === namespace,
  );
  let target;
  if (existing) target = await SystemView.getStory(projectCode, existing.id);
  else target = await SystemView.createStory(projectCode, { namespace, name, layout: flags.layout || "column" });
  target.namespace = namespace;
  target.name = name;
  if (flags.layout) target.layout = flags.layout;
  target.panes = panes.map((p, i) => ({ id: `pane_${i}_${Math.random().toString(36).slice(2, 7)}`, ...p }));
  const saved = await SystemView.saveStory(projectCode, target);
  if (json) process.stdout.write(JSON.stringify(saved, null, 2) + "\n");
  else log.success(`story "${name}" @ ${namespace} → ${saved.panes.length} pane(s) [${saved.layout}]`);
  return 0;
}

// `stories <target>` — list every saved story in a project, with its namespace and pane count.
async function stories(targetArg, { uiUrl, json = false } = {}) {
  const SystemView = await loadApi(uiUrl);
  const resolved = await resolveScope(SystemView, targetArg);
  if (!resolved) { log.error(`No connected services for "${targetArg || ""}"`); return 1; }
  const projectCode = resolved.services[0].projectCode;
  const listed = (await SystemView.listStories(projectCode)) || [];
  if (json) { process.stdout.write(JSON.stringify(listed, null, 2) + "\n"); return 0; }
  log.info(`stories for ${projectCode}:`);
  if (!listed.length) console.log("    (none)");
  listed.forEach((s) => console.log(`    ${s.name}  ·  ${s.namespace}  (${(s.panes || []).length} pane(s))`));
  return 0;
}

module.exports = { show, assemble, stage, highlight, view, selection, story, stories };
