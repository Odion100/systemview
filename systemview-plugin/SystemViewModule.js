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
module.exports = ({ App, specs, projectCode, serviceId, module = {}, credentials = false, svDir }) => {
  svDir = svDir || path.resolve(process.cwd(), ".systemview");
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
        this.useService("SystemViewUI").SystemView.updateSpecList(this.getSpecList(), projectCode, serviceId);
      } catch {}
    };

    // Resolve where a doc lives. Service/module/method docs live in specs/docs/. A project-level doc
    // (namespace has no service/module/method) is a single {projectCode}.md at the project ROOT (cwd) —
    // shared by every service in the project, since they all run from the same working directory.
    const docPath = (namespace) => {
      const name = getName(namespace);
      return name
        ? `${specs}/docs/${name}.md`
        : path.join(process.cwd(), `${projectCode}.md`);
    };

    this.saveDoc = ({ documentation, namespace }) => {
      const fileName = docPath(namespace);
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
        tests = JSON.parse(getFile(fileName) || "[]");
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
      return index || tests.length - 1;
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
    this.getSpecList = () => ({
      docs: fs.readdirSync(`${specs}/docs/`),
      tests: fs.readdirSync(`${specs}/tests/`),
    });
    this.getConnection = () => {
      const specList = this.getSpecList();
      // `credentials` must survive this path — refreshConnections re-pulls getConnection(),
      // so omitting it here would silently un-credential the service on every refresh (RFC-013).
      return { projectCode, serviceId, system, specList, credentials };
    };
    this.getLog = ({ limit } = {}) => {
      const logsFile = path.join(svDir, "systemview.logs");
      try {
        const lines = fs.readFileSync(logsFile, "utf8")
          .split("\n")
          .filter(Boolean)
          .map((line) => JSON.parse(line));
        return limit ? lines.slice(-limit) : lines;
      } catch {
        return [];
      }
    };
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
        let pc = projectCode;
        for (const f of files) {
          try {
            const entry = JSON.parse(fs.readFileSync(path.join(svDir, f), "utf8"));
            if (!entry || !entry.serviceId) continue;
            if (entry.projectCode) pc = entry.projectCode;
            if (entry.headers) Object.assign(headers, entry.headers); // per-origin config defaults
            services.push({
              serviceId: entry.serviceId,
              system: entry.system,
              specList: entry.specList,
              credentials: entry.credentials,
            });
          } catch {}
        }
        const manifest = { projectCode: pc, services };
        if (Object.keys(headers).length) manifest.headers = headers;
        try {
          fs.writeFileSync(
            path.join(svDir, "manifest.json"),
            JSON.stringify(manifest, null, 2),
          );
        } catch {}
        return manifest;
      } catch {
        return null;
      }
    };

    // RFC-018 — ground-truth file/code providers. These run inside THIS service and read its own
    // source from cwd, path-guarded to the repo root. The AI Window's stage carries only locators;
    // the browser calls these directly (like getDoc) to fetch the real bytes at render time.
    this.readFile = fileProviders.readFile;
    this.listFiles = fileProviders.listFiles;
    this.search = fileProviders.search;
    this.getSource = fileProviders.getSource;
    this.getDiff = fileProviders.getDiff;
    this.writeFile = fileProviders.writeFile;

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

    // RFC-018 — STORIES. Unlike the single live stage, a project has MANY stories, each filed on a
    // namespace (project / service / module / method) with a free name — the same way a method has many
    // tests. Each is one file `.systemview/stories/<id>.json` holding { id, namespace, name, layout,
    // panes } so it travels with the repo. The full object round-trips (list returns whole stories) so
    // the /stories page can group by namespace without a second fetch.
    const storiesDir = () => path.join(svDir, "stories");
    const storyFile = (id) => path.join(storiesDir(), `${viewName(id)}.json`);
    this.saveStory = ({ story }) => {
      if (!story || !story.id) throw new Error("saveStory: story.id is required");
      ensureDir(storiesDir());
      fs.writeFileSync(storyFile(story.id), JSON.stringify(story, null, 2), "utf8");
      return { id: story.id };
    };
    this.getStory = ({ id }) => {
      try { return JSON.parse(fs.readFileSync(storyFile(id), "utf8")); }
      catch { return null; }
    };
    this.listStories = () => {
      try {
        return fs.readdirSync(storiesDir())
          .filter((f) => f.endsWith(".json"))
          .map((f) => { try { return JSON.parse(fs.readFileSync(path.join(storiesDir(), f), "utf8")); } catch { return null; } })
          .filter(Boolean);
      } catch { return []; }
    };
    this.deleteStory = ({ id }) => {
      deleteFile(storyFile(id));
      return { id };
    };
  };
};
