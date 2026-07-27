// CLI test-harness module.
//
// Runs the *real* SystemView CLI as a child process (never interactive) and returns its output,
// so CLI behavior can be validated by saved tests in the UI — change CLI code, re-run the test.
// Shelling out (rather than requiring the CLI fns in-process) keeps CLI state — cwd, manifest,
// its own client — isolated from this service. Commands connect to the already-running UI/services,
// so nothing needs launching here.

const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");

// Isolated manifest for the session-persistence fixture (RFC-016), so those cases never touch the
// shared cwd manifest other CLI tests depend on. Probing with `--manifest <this>` also dogfoods the
// header-source reconciliation (a session must persist to AND ride back from the same manifest).
const SESSION_MANIFEST = "test/service/.session.manifest.json";
const sessManifest = (m) => path.resolve(process.cwd(), m || SESSION_MANIFEST);

const CLI_ENTRY = path.join(process.cwd(), "cli", "index.js");

function runCli(args, { timeoutMs = 20000 } = {}) {
  return new Promise((resolve) => {
    // process.execPath = the same node running this service, so no PATH assumptions
    const child = spawn(process.execPath, [CLI_ENTRY, ...args], { cwd: process.cwd() });
    let stdout = "";
    let stderr = "";
    let done = false;
    const finish = (exitCode) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      resolve({ exitCode, stdout, stderr });
    };
    // safety net: kill a hung/streaming command so a test can never hang forever
    const timer = setTimeout(() => {
      try {
        child.kill("SIGTERM");
      } catch {}
      finish(-2);
    }, timeoutMs);
    child.stdout.on("data", (d) => (stdout += d));
    child.stderr.on("data", (d) => (stderr += d));
    child.on("close", (exitCode) => finish(exitCode));
    child.on("error", (err) => {
      stderr += String(err && err.message);
      finish(-1);
    });
  });
}

// pull the first parseable JSON object/array out of stdout (probe/test --json prepend nothing,
// but be tolerant of a stray banner line)
function parseJson(stdout) {
  const trimmed = (stdout || "").trim();
  try {
    return JSON.parse(trimmed);
  } catch {}
  const start = trimmed.search(/[[{]/);
  if (start > -1) {
    try {
      return JSON.parse(trimmed.slice(start));
    } catch {}
  }
  return null;
}

// Flatten a saved-story JSON (what `story`/`story-*` print with --json) into primitives the fixtures can
// assert on directly — the eval engine matches numbers/strings/booleans, not nested arrays.
function describeStory(result) {
  const s = result || {};
  const panes = Array.isArray(s.panes) ? s.panes : [];
  const p0 = panes[0] || {};
  const p1 = panes[1] || {};
  const hl0 = (p0.highlight && p0.highlight.lines) || [];
  return {
    ok: !!s.id,
    id: s.id || "",
    name: s.name || "",
    namespace: s.namespace || "",
    layout: s.layout || "",
    paneCount: panes.length,
    kindsJoined: panes.map((p) => p.kind).join(","), // pane ORDER, so move/rm/add are assertable
    pane0Kind: p0.kind || "",
    pane0Path: (p0.target && p0.target.path) || "",
    pane0HlFrom: hl0[0] || 0,
    pane0HlTo: hl0[1] || 0,
    pane1Kind: p1.kind || "",
    pane1Module: (p1.target && p1.target.moduleName) || "",
    pane1Method: (p1.target && p1.target.methodName) || "",
    pane1Note: (p1.target && p1.target.note) || "",
  };
}

const CLI = {
  // generic escape hatch — run any command, get raw output + exit code
  async run({ args = [] } = {}) {
    return runCli(args);
  },

  // --- RFC-018 story lifecycle dogfood. Drives the REAL `story` / `story-*` CLI verbs end-to-end, each
  //     in its OWN child process — so re-listing after a write proves it actually persisted to disk via
  //     the plugin (not just held in memory). One orchestrator so the fixture asserts every checkpoint of
  //     a single, self-contained, idempotent run (it cleans up leftovers first and deletes at the end).
  //     The test runner dispatches ONE method per fixture, so the whole lifecycle lives here, not across
  //     fixture steps. ---
  async storyLifecycle() {
    const target = "systemview-test";
    const ns = "systemview-test/__dogfood__";
    const nm = "cli-dogfood";
    const nm2 = "cli-dogfood-renamed";
    const mathFile = "test/service/Math/index.js";
    const J = (args) => runCli([...args, "--json"]);
    const shape = (r) => describeStory(parseJson(r.stdout));
    const namesOf = (r) => (parseJson(r.stdout) || []).map((s) => s && s.name).filter(Boolean);

    // Idempotency: clear any story left behind by an earlier interrupted run.
    await J(["story-delete", target, nm, "--ns", ns]);
    await J(["story-delete", target, nm2, "--ns", ns]);

    // 1. create — a file#L1-20 pane + a test pane carrying an agent --note. Upsert by name+ns.
    const c = await J(["story", target, nm, "--ns", ns, "--file", `${mathFile}#L1-20`, "--test", "Math.add", "--note", "adds two numbers"]);
    const create = shape(c);
    // 2. story-add — insert a markdown pane at index 0 (proves --at positional insert).
    const add = shape(await J(["story-add", target, nm, "--ns", ns, "--text", "intro", "--at", "0"]));
    // 3. story-move — 0 → 2 sends the markdown to the end.
    const move = shape(await J(["story-move", target, nm, "--ns", ns, "--from", "0", "--to", "2"]));
    // 4. story-edit — rebuild pane 0 with a new file range (proves #L re-parse on edit).
    const edit = shape(await J(["story-edit", target, nm, "--ns", ns, "--at", "0", "--file", `${mathFile}#L5-9`]));
    // 5. story-rm — drop the trailing markdown.
    const rm = shape(await J(["story-rm", target, nm, "--ns", ns, "--at", "2"]));
    // 6. story-layout — switch column → grid.
    const layout = shape(await J(["story-layout", target, nm, "--ns", ns, "--layout", "grid"]));
    // 7. story-rename — new slug (new file) + delete of the old.
    const rn = await J(["story-rename", target, nm, "--ns", ns, "--to", nm2]);
    // 8. stories — the renamed one is on disk, the old name is gone.
    const names1 = namesOf(await J(["stories", target]));
    // 9. story-delete — remove it.
    const d = await J(["story-delete", target, nm2, "--ns", ns]);
    // 10. stories — gone.
    const names2 = namesOf(await J(["stories", target]));

    return {
      createExit: c.exitCode,
      createPanes: create.paneCount,
      createNs: create.namespace,
      createPane0Kind: create.pane0Kind,
      createHlFrom: create.pane0HlFrom,
      createHlTo: create.pane0HlTo,
      createPane1Kind: create.pane1Kind,
      createPane1Module: create.pane1Module,
      createPane1Method: create.pane1Method,
      createPane1Note: create.pane1Note,
      addPanes: add.paneCount,
      addKinds: add.kindsJoined,
      moveKinds: move.kindsJoined,
      editPane0Kind: edit.pane0Kind,
      editHlFrom: edit.pane0HlFrom,
      editHlTo: edit.pane0HlTo,
      rmPanes: rm.paneCount,
      rmKinds: rm.kindsJoined,
      layout: layout.layout,
      renameExit: rn.exitCode,
      listHasRenamed: names1.includes(nm2),
      listStillHasOld: names1.includes(nm),
      deleteExit: d.exitCode,
      listHasAfterDelete: names2.includes(nm2),
    };
  },

  // `systemview probe <namespace> [args] --json [flags]` → parsed result.
  // `flags` lets a fixture pass extra CLI flags, e.g. ["--header", "testtoken: X"].
  async probe({ namespace, args, flags = [] } = {}) {
    const cliArgs = ["probe", namespace];
    if (args !== undefined && args !== null) {
      cliArgs.push(typeof args === "string" ? args : JSON.stringify(args));
    }
    cliArgs.push("--json", ...(Array.isArray(flags) ? flags : []));
    const { exitCode, stdout, stderr } = await runCli(cliArgs);
    return { exitCode, result: parseJson(stdout), stdout, stderr };
  },

  // `systemview test <project> [namespace] --json [flags]` → parsed result + exit code.
  // NOTE: always scope `namespace` away from the CLI module itself to avoid recursive test runs.
  async test({ project = "systemview-test", namespace, flags = [] } = {}) {
    const cliArgs = ["test", project];
    if (namespace) cliArgs.push(namespace);
    cliArgs.push("--json", ...(Array.isArray(flags) ? flags : []));
    const { exitCode, stdout, stderr } = await runCli(cliArgs);
    return { exitCode, result: parseJson(stdout), stdout, stderr };
  },

  // `systemview list [project] [namespace] --json` → parsed result
  async list({ project, namespace, flags = [] } = {}) {
    const cliArgs = ["list"];
    if (project) cliArgs.push(project);
    if (namespace) cliArgs.push(namespace);
    cliArgs.push("--json", ...(Array.isArray(flags) ? flags : []));
    const { exitCode, stdout, stderr } = await runCli(cliArgs);
    const result = parseJson(stdout);
    // Order-independent views so assertions don't depend on which service registered first.
    const services = Array.isArray(result) ? result : [];
    const serviceIds = services.map((s) => s && s.serviceId).filter(Boolean).sort();
    const moduleNames = [
      ...new Set(services.flatMap((s) => ((s && s.tests) || []).map((t) => t && t.namespace && t.namespace.moduleName))),
    ].filter(Boolean).sort();
    return {
      exitCode, result, stdout, stderr,
      serviceCount: services.length,
      hasTestService: serviceIds.includes("TestService"),
      moduleNames,
      onlyModule: moduleNames.length === 1 ? moduleNames[0] : "",
    };
  },

  // `systemview logs [project] [namespace] --current --json` → NDJSON entries + exit code.
  // --current (not --follow) prints existing entries and exits. Robust to the human banner lines
  // the command currently prints alongside the JSON — we pull only the JSON lines.
  async logs({ project = "systemview-test", namespace, flags = [] } = {}) {
    const cliArgs = ["logs"];
    if (project) cliArgs.push(project);
    if (namespace) cliArgs.push(namespace);
    cliArgs.push("--current", "--json", ...(Array.isArray(flags) ? flags : []));
    const { exitCode, stdout, stderr } = await runCli(cliArgs);
    const entries = [];
    for (const line of (stdout || "").split("\n")) {
      const t = line.trim();
      if (t.startsWith("{")) {
        try {
          entries.push(JSON.parse(t));
        } catch {}
      }
    }
    return { exitCode, entries, stdout, stderr };
  },

  // --- RFC-016 session-persistence helpers (file-mediated setup/teardown for the fixture) ---

  // Clear the isolated session manifest so a case starts from a known clean slate (no policy, no cookie).
  async resetSession({ manifest } = {}) {
    try {
      fs.unlinkSync(sessManifest(manifest));
    } catch {}
    return { ok: true };
  },

  // Delete ONLY the captured Cookie for an origin (keeping the session policy). Lets a case prove the
  // policy STAYED on: after clearing the cookie, a plain probe (no flag) must persist a fresh one again.
  async clearCookie({ manifest, origin = "http://localhost:5556" } = {}) {
    const p = sessManifest(manifest);
    try {
      const m = JSON.parse(fs.readFileSync(p, "utf8"));
      if (m.headers && m.headers[origin]) delete m.headers[origin].Cookie;
      fs.writeFileSync(p, JSON.stringify(m, null, 2));
    } catch {}
    return { ok: true };
  },

  // Read the isolated manifest back so a case can assert what actually landed on disk.
  async readManifest({ manifest, origin = "http://localhost:5556" } = {}) {
    let m = null;
    try {
      m = JSON.parse(fs.readFileSync(sessManifest(manifest), "utf8"));
    } catch {}
    const cookie = (m && m.headers && m.headers[origin] && m.headers[origin].Cookie) || "";
    return {
      exists: !!m,
      sessionSave: !!(m && m.session && m.session.save),
      cookie,
      hasHeaders: !!(m && m.headers && Object.keys(m.headers).length),
    };
  },

  // --- RFC-017 manifest-folder helpers (each plugin writes its OWN `.systemview/<serviceId>.manifest.json`
  //     so N services starting at once never clobber a shared file — the deploy-boot race is gone) ---

  // Inspect the `.systemview/` folder: which per-service files the plugins wrote, on disk.
  async manifestFiles() {
    const dir = path.join(process.cwd(), ".systemview");
    let all = [];
    try {
      all = fs.readdirSync(dir).filter((f) => f.endsWith(".manifest.json"));
    } catch {}
    const perService = all
      .filter((f) => f !== "manifest.json")
      .map((f) => f.replace(/\.manifest\.json$/, ""))
      .sort();
    return {
      exitCode: 0,
      files: perService,
      fileCount: perService.length,
      hasTestService: perService.includes("TestService"),
      hasGatedService: perService.includes("GatedService"),
      hasGatedSibling: perService.includes("GatedSibling"),
      hasCombined: all.includes("manifest.json"),
    };
  },

  // Call the plugin's getManifest over the wire — it globs the folder and assembles the whole project.
  // Proves one call to ANY service returns every sibling (the shared cwd is the aggregator, no hub needed).
  async getManifest({ serviceId = "TestService" } = {}) {
    const { exitCode, stdout } = await runCli(["probe", `${serviceId}.Plugin.getManifest`, "--json"]);
    const parsed = parseJson(stdout);
    const manifest = (parsed && parsed.result) || {}; // probe --json wraps the return under `.result`
    const services = manifest.services || [];
    const serviceIds = services.map((s) => s && s.serviceId).filter(Boolean).sort();
    return {
      exitCode,
      projectCode: manifest.projectCode || "",
      serviceIds,
      serviceCount: serviceIds.length,
      hasAllThree: ["GatedService", "GatedSibling", "TestService"].every((id) => serviceIds.includes(id)),
    };
  },

  // Seed a stale per-service file pointing at a dead URL, so `manifest clean` has something to prune.
  async seedStale({ serviceId = "GhostService", url = "http://localhost:5999/dead/api" } = {}) {
    const dir = path.join(process.cwd(), ".systemview");
    try {
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(
        path.join(dir, `${serviceId}.manifest.json`),
        JSON.stringify({ projectCode: "systemview-test", serviceId, system: { connectionData: { serviceUrl: url } }, specList: { tests: [], docs: [] } }, null, 2),
      );
    } catch {}
    return { ok: true, seeded: serviceId };
  },

  // Run `systemview manifest clean`, then read the folder back: it should re-probe each per-service file,
  // DELETE the stale (dead-URL) ones, and keep the live services.
  async cleanManifest({ ghost = "GhostService" } = {}) {
    const { exitCode, stdout, stderr } = await runCli(["manifest", "clean"]);
    const dir = path.join(process.cwd(), ".systemview");
    let remaining = [];
    try {
      remaining = fs
        .readdirSync(dir)
        .filter((f) => f.endsWith(".manifest.json") && f !== "manifest.json")
        .map((f) => f.replace(/\.manifest\.json$/, ""));
    } catch {}
    return {
      exitCode,
      remaining: remaining.sort(),
      ghostGone: !remaining.includes(ghost),
      testServiceKept: remaining.includes("TestService"),
      stdout,
      stderr,
    };
  },
};

module.exports = CLI;
