const fs = require("fs");
const path = require("path");
const {
  deleteFile,
  getFile,
  ensureDir,
  getName,
  getFilesByNamespace,
} = require("./utils");
module.exports = ({ App, specs, projectCode, serviceId, module = {} }) => {
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
      if (methodName) {
        const fileName = `${specs}/tests/${moduleName}.${methodName}.json`;
        const tests = JSON.parse(getFile(fileName) || "[]");
        return tests;
      } else if (moduleName) {
        return getFilesByNamespace(`${specs}/tests/`, moduleName);
      } else {
        return getFilesByNamespace(`${specs}/tests/`);
      }
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
      return { projectCode, serviceId, system, specList };
    };
    this.getLog = ({ limit } = {}) => {
      const logsFile = path.join(process.cwd(), "systemview.logs");
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
    this.getManifest = () => {
      const manifestFile = path.join(process.cwd(), "systemview.manifest.json");
      try { return JSON.parse(fs.readFileSync(manifestFile, "utf8")); }
      catch { return null; }
    };
  };
};
