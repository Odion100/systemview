// TRANSITION (2026-08-24): the browser no longer calls this module to render files or git — the
// HUB serves the codebase directly (api/index.js), addressed by project code. The file/git
// providers attached below survive as the library the hub binds for HOSTED projects and as the
// plugin's own doc/test file access. The plugin's remit: documentation, tests, the chat-room
// module, connection/manifest registration, stats.
const fs = require("fs");
const path = require("path");
const {
  deleteFile,
  getFile,
  ensureDir,
  getName,
  getFilesByNamespace,
} = require("./utils");
const fileProviders = require("./fileProviders");
// RFC-027: `root` = the observed project's directory (default cwd — the plugin's own case). A HOSTED
// service runs inside the hub's process, so its root is the target repo, not the hub's cwd. `hosted`
// (the committed folder's path relative to root) rides the connection so the flag survives every
// refresh — same trap as `credentials` below.
module.exports = ({ App, specs, projectCode, serviceId, module = {}, credentials = false, svDir, root, hosted = false }) => {
  root = root ? path.resolve(root) : process.cwd();
  svDir = svDir || path.resolve(root, ".systemview");
  const providers = fileProviders.createFileProviders(root);
  specs = specs.substr(-1) === "/" ? specs.substr(0, specs.length - 1) : specs;
  const system = {};
  App.on("ready", (_system) => {
    system.connectionData = _system.connectionData;
    system.modules = _system.modules;
    system.routing = _system.routing;
    system.services = _system.services;
  });
  return function SystemViewPlugin() {
    Object.assign(this, module);

    // The UI hub is OPTIONAL — this module is registered on EVERY service (hub or not) so a remote,
    // UI-less service still serves getManifest/getTests/getDoc + your own functions. `saveDoc`/`saveTest`
    // push live spec updates to a CONNECTED UI; with no hub the write still lands on disk, push is skipped.
    const pushSpecList = () => {
      try {
        this.useService("SystemViewUI").SystemView.updateSpecList(getSpecList(), projectCode, serviceId);
      } catch {}
    };

    // Resolve where a doc lives. Service/module/method docs live in specs/docs/. A project-level doc
    // (namespace has no service/module/method) is a single {projectCode}.md at the project ROOT (cwd) —
    // shared by every service in the project, since they all run from the same working directory.
    const docPath = (namespace) => {
      const name = getName(namespace);
      return name
        ? `${specs}/docs/${name}.md`
        : path.join(root, `${projectCode}.md`);
    };

    this.saveDoc = ({ documentation, namespace, base }) => {
      const fileName = docPath(namespace);
      // Same two guards the editor's writeFile has (doc undo): `base` = what this tab loaded —
      // a mismatch on disk means someone else saved meanwhile, so answer { conflict } instead of
      // clobbering; and every overwrite/delete files the previous version in the snapshot ring
      // first, so a destroyed doc is one restore away.
      if (base !== undefined && base !== null) {
        const onDisk = getFile(fileName);
        if (onDisk && onDisk !== String(base) && onDisk !== String(documentation))
          return { conflict: true, current: onDisk, namespace };
      }
      providers.snapshot(path.resolve(root, fileName));
      if (getName(namespace)) ensureDir(`${specs}/docs/`);
      if (documentation) {
        fs.writeFileSync(fileName, documentation, "utf8");
      } else {
        deleteFile(fileName);
      }
      pushSpecList();
      return { documentation, namespace };
    };

    this.getDoc = (namespace) => {
      const fileName = docPath(namespace);
      const documentation = getFile(fileName) || "";
      return { namespace, documentation };
    };

    this.getTests = (namespace = {}) => {
      const { moduleName, methodName } = namespace;
      let tests;
      if (methodName) {
        const fileName = `${specs}/tests/${moduleName}.${methodName}.json`;
        // Same `slot` stamp the aggregated branches get (see getFilesByNamespace) — one contract.
        tests = JSON.parse(getFile(fileName) || "[]").map((t, i) =>
          t && typeof t === "object" ? { ...t, slot: i } : t
        );
      } else if (moduleName) {
        tests = getFilesByNamespace(`${specs}/tests/`, moduleName);
      } else {
        tests = getFilesByNamespace(`${specs}/tests/`);
      }
      // Several services in one project can share a specs folder, so a `Module.method.json` file may
      // hold tests for a sibling service. Return only THIS service's specs (by its own serviceId) so a
      // service's test panel / getTests never shows a sibling's tests. No-op when each service has its
      // own specs folder (every spec already matches).
      return tests.filter((t) => !serviceId || !t.namespace || t.namespace.serviceId === serviceId);
    };
    this.saveTest = (test, index) => {
      const fileName = `${specs}/tests/${getName(test.namespace)}.json`;
      const tests = JSON.parse(getFile(fileName) || "[]");
      if (typeof index === "number") {
        tests[index] = test;
      } else {
        tests.push(test);
      }
      fs.writeFileSync(fileName, JSON.stringify(tests), "utf8");
      pushSpecList();
      // index 0 is falsy — `index ||` misreported slot-0 overwrites as an append.
      return typeof index === "number" ? index : tests.length - 1;
    };
    this.deleteTest = (namespace, index) => {
      const fileName = `${specs}/tests/${getName(namespace)}.json`;
      const tests = JSON.parse(getFile(fileName) || "[]");
      tests.splice(index, 1);
      console.log(tests.length);
      if (tests.length) {
        fs.writeFileSync(fileName, JSON.stringify(tests), "utf8");
      } else {
        deleteFile(fileName);
        pushSpecList();
      }
    };
    // RFC-020 — shared actions. A shared action = a name + an ordered list of steps (the same shape as a
    // test's Before/Main/After array). PERMANENT ones live in `specs/actions/<name>.json` (a third sibling
    // to docs/ and tests/), travel with the repo, and are pulled into tests/stories via `{ use: <name> }`.
    // One action per file, keyed by NAME (not Module.method like tests).
    this.getActions = (namespace = {}) => {
      const dir = `${specs}/actions/`;
      let files;
      try {
        files = fs.readdirSync(dir).filter((f) => f.endsWith(".json"));
      } catch {
        return [];
      }
      const actions = files
        .map((f) => {
          try {
            return JSON.parse(fs.readFileSync(`${dir}${f}`, "utf8"));
          } catch {
            return null;
          }
        })
        .filter(Boolean);
      // Only THIS service's actions (siblings can share a specs folder), and optionally scope to a module.
      return actions.filter(
        (a) =>
          (!serviceId || !a.namespace || a.namespace.serviceId === serviceId) &&
          (!namespace.moduleName || (a.namespace && a.namespace.moduleName === namespace.moduleName))
      );
    };
    this.getAction = (name) => {
      try {
        return JSON.parse(getFile(`${specs}/actions/${name}.json`) || "null");
      } catch {
        return null;
      }
    };
    this.saveAction = (action) => {
      ensureDir(`${specs}/actions/`);
      const name = action && action.name;
      if (!name) return { error: true, message: "A shared action needs a name." };
      fs.writeFileSync(`${specs}/actions/${name}.json`, JSON.stringify(action), "utf8");
      pushSpecList();
      return { error: false, name };
    };
    this.deleteAction = (name) => {
      deleteFile(`${specs}/actions/${name}.json`);
      pushSpecList();
      return { error: false, name };
    };
    // Internal only — it was on the public surface for years with zero external callers; the spec
    // list travels inside getConnection() and the push, which is how every consumer reads it.
    const getSpecList = () => ({
      docs: fs.readdirSync(`${specs}/docs/`),
      tests: fs.readdirSync(`${specs}/tests/`),
      // actions/ is a newer sibling — may not exist in older repos, so tolerate its absence.
      actions: (() => {
        try {
          return fs.readdirSync(`${specs}/actions/`);
        } catch {
          return [];
        }
      })(),
    });
    this.getConnection = () => {
      const specList = getSpecList();
      // `credentials` and `hosted` must survive this path — refreshConnections re-pulls
      // getConnection(), so omitting either would silently strip it on every refresh (RFC-013/027).
      // `root` = where this project actually lives on disk. The hub cannot know it any other way,
      // and it needs it to keep a project's data WITH that project (chat rooms, TV state) instead
      // of piling every project's conversation into the hub. Rides getConnection() because
      // refreshConnections re-pulls it, so it lands without a separate registration step.
      return { projectCode, serviceId, system, specList, credentials, hosted, root };
    };
    // (Plugin.getLog was a duplicate door — every log read goes through SystemView.getLog in
    // index.js; the second copy here had zero callers and was retired in 2.23.0.)
    // RFC-017: assemble the whole project from the per-service files the plugins wrote (siblings share
    // this cwd, so one call returns every service — no hub needed), materialize the combined
    // `.systemview/manifest.json`, and return it. Safe to save here: getManifest is called on-demand by a
    // single caller (a CLI/UI request), NOT by the services stampeding at boot — that stampede was the
    // race, and it's gone now that each plugin writes only its own file.
    this.getManifest = () => {
      try {
        const files = fs
          .readdirSync(svDir)
          .filter((f) => f.endsWith(".manifest.json") && f !== "manifest.json");
        const services = [];
        const headers = {};
        for (const f of files) {
          try {
            const entry = JSON.parse(fs.readFileSync(path.join(svDir, f), "utf8"));
            if (!entry || !entry.serviceId) continue;
            // ONLY this service's OWN project. Siblings sharing a cwd write their manifests into the same
            // .systemview/, so a different-project service (e.g. a dedicated log-test service) must NOT be
            // folded into this project — otherwise `connect`/`getProjects`/the test runner lump them into
            // one project. Entries with no projectCode (legacy) are treated as belonging to this project.
            if (entry.projectCode && entry.projectCode !== projectCode) continue;
            if (entry.headers) Object.assign(headers, entry.headers); // per-origin config defaults
            services.push({
              serviceId: entry.serviceId,
              system: entry.system,
              specList: entry.specList,
              credentials: entry.credentials,
            });
          } catch {}
        }
        const manifest = { projectCode, services };
        if (Object.keys(headers).length) manifest.headers = headers;
        try {
          // Per-project cache file so two projects sharing a cwd don't clobber each other's manifest.json.
          fs.writeFileSync(
            path.join(svDir, `manifest.${projectCode}.json`),
            JSON.stringify(manifest, null, 2),
          );
        } catch {}
        return manifest;
      } catch {
        return null;
      }
    };

    // RFC-018 — ground-truth file/code providers. These run inside THIS service and read its own
    // source from `root` (cwd for a plugin-run service, the target repo for a hosted one),
    // path-guarded to that root. The AI Window's stage carries only locators; ☠ the browser calls
    // these directly (like getDoc) to fetch the real bytes at render time [RETIRED-2026-08-26 —
    // the browser fetches from the HUB now; these remain the hub's library for hosted projects].
    this.readFile = providers.readFile;
    this.readFileRaw = providers.readFileRaw;
    this.listFiles = providers.listFiles;
    this.changedFiles = providers.changedFiles;
    this.stageFiles = providers.stageFiles;
    this.stageHunk = providers.stageHunk;
    this.discardFiles = providers.discardFiles;
    // RFC-033 — ☠ these exist to serve a CLICK (the version-control panel, a `::commit` block in a
    // document) [RETIRED-2026-08-26 — those clicks go to the HUB now; this attachment is the hosted-
    // project library path]. Deliberately absent from the CLI: an agent can write the block, only a
    // human presses it.
    this.gitState = providers.gitState;
    this.commit = providers.commit;
    this.push = providers.push;
    this.search = providers.search;
    this.getDiff = providers.getDiff;
    this.writeFile = providers.writeFile;
    // RFC-034 — a file can be removed now, snapshotted first. The comment sidecars need it: the last
    // thread leaving takes its file with it.
    this.deleteFile = providers.deleteFile;
    // RFC-035 — the tree can rearrange itself: rename/move and duplicate, both refusing to overwrite.
    this.moveFile = providers.moveFile;
    this.copyFile = providers.copyFile;
    // Doc undo — the snapshot ring writeFile/saveDoc feed: list a file's saved versions, read one
    // back. Restore = a normal writeFile with the snapshot's content (which snapshots the current
    // version first, so undo always has an undo).
    this.fileHistory = providers.fileHistory;
    this.readSnapshot = providers.readSnapshot;

    // RFC-018 — saved views (the agent's communications as documents). A view = a stage description
    // {layout, panes}. Stored per-name in `.systemview/views/` so it TRAVELS with the repo (RFC-017):
    // a teammate who clones gets "here's what we did" reopenable. Name is basename-sanitized (no
    // traversal). Any service in a project can serve these — they share this cwd.
    const viewsDir = () => path.join(svDir, "views");
    const viewName = (name) => String(name || "").replace(/[^a-zA-Z0-9._-]/g, "_");
    this.saveView = ({ name, view }) => {
      const safe = viewName(name);
      if (!safe) throw new Error("saveView: a name is required");
      ensureDir(viewsDir());
      fs.writeFileSync(path.join(viewsDir(), `${safe}.json`), JSON.stringify(view || {}, null, 2), "utf8");
      return { name: safe };
    };
    this.getView = ({ name }) => {
      try {
        return JSON.parse(fs.readFileSync(path.join(viewsDir(), `${viewName(name)}.json`), "utf8"));
      } catch {
        return null;
      }
    };
    this.listViews = () => {
      try {
        return fs.readdirSync(viewsDir())
          .filter((f) => f.endsWith(".json"))
          .map((f) => f.replace(/\.json$/, ""));
      } catch {
        return [];
      }
    };
    this.deleteView = ({ name }) => {
      deleteFile(path.join(viewsDir(), `${viewName(name)}.json`));
      return { name: viewName(name) };
    };

    // (RFC-018 STORIES lived here until 2.23.0 — retired with the whole stories surface: the CLI
    // already answered every story verb with "stories are retired — write a REPORT instead", the
    // /stories page was unreachable, and these four methods' only callers were both. Old
    // `.systemview/stories/` files are left where they are; nothing reads or deletes them.)
  };
};
