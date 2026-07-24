const fs = require("fs");
const path = require("path");
const {
  deleteFile,
  getFile,
  ensureDir,
  getName,
  getFilesByNamespace,
} = require("./utils");
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
    const { SystemView } = this.useService("SystemViewUI");

    Object.assign(this, module);

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
      SystemView.updateSpecList(this.getSpecList(), projectCode, serviceId);
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
      SystemView.updateSpecList(this.getSpecList(), projectCode, serviceId);
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
        SystemView.updateSpecList(this.getSpecList(), projectCode, serviceId);
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
  };
};
