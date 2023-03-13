const fs = require("fs");

module.exports = (specs, projectCode, serviceId, helperMethods = {}) => {
  specs = specs.substr(-1) === "/" ? specs.substr(0, specs.length - 1) : specs;

  return function Plugin() {
    const { SystemView } = this.useService("SystemView");
    Object.assign(this, helperMethods);

    this.saveDoc = ({ documentation, namespace }) => {
      const fileName = `${specs}/docs/${getName(namespace)}.md`;
      ensureDir(`${specs}/docs/`);
      if (documentation) {
        fs.writeFileSync(fileName, documentation, "utf8");
      } else {
        deleteFile(fileName);
      }
      SystemView.updateSpecList(this.getSpecList(), projectCode, serviceId);
      return { documentation, namespace };
    };

    this.getDoc = (namespace) => {
      const fileName = `${specs}/docs/${getName(namespace)}.md`;
      const documentation = getFile(fileName) || "";
      return { namespace, documentation };
    };

    this.getTests = (namespace) => {
      const fileName = `${specs}/tests/${getName(namespace)}.txt`;
      const tests = JSON.parse(getFile(fileName) || "[]");
      return tests;
    };
    this.saveTest = (test, index) => {
      const fileName = `${specs}/tests/${getName(test.namespace)}.txt`;
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
      const fileName = `${specs}/tests/${getName(namespace)}.txt`;
      const tests = JSON.parse(getFile(fileName) || "[]");
      tests.splice(index, 1);
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
  };

  function deleteFile(fileName) {
    try {
      console.log(fileName);
      fs.unlinkSync(fileName);
    } catch (err) {
      console.error(err);
    }
  }
  function getFile(fileName) {
    try {
      return fs.readFileSync(fileName, "utf8");
    } catch (error) {
      console.log(error);
    }
  }
  function ensureDir(dir) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  function getName({ serviceId, moduleName, methodName }) {
    if (methodName) return `${moduleName}.${methodName}`;
    else if (moduleName) return moduleName;
    else if (serviceId) return serviceId;
  }
};
