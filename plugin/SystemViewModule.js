const fs = require("fs");

module.exports = (specs) => {
  specs = specs.substr(-1) === "/" ? specs.substr(0, specs.length - 1) : specs;

  return function SystemView() {
    this.saveDoc = ({ documentation, namespace }) => {
      const fileName = `${specs}/docs/${getName(namespace)}.md`;
      ensureDir(`${specs}/docs/`);
      fs.writeFileSync(fileName, documentation, "utf8");

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
      if (typeof index === "number") tests[index] = test;
      else tests.push(test);
      fs.writeFileSync(fileName, JSON.stringify(tests), "utf8");
    };
    this.deleteTest = (namespace, index) => {
      const fileName = `${specs}/tests/${getName(namespace)}.txt`;
      const tests = JSON.parse(getFile(fileName) || "[]");
      tests.splice(index, 1);
      fs.writeFileSync(fileName, JSON.stringify(tests), "utf8");
    };
  };

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
