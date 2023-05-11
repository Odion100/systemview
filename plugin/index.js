const SystemViewModule = require("./SystemViewModule");
const fs = require("fs");

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

const getSpecList = (specs) => {
  ensureDir(`${specs}/docs/`);
  ensureDir(`${specs}/tests/`);
  return {
    docs: fs.readdirSync(`${specs}/docs/`),
    tests: fs.readdirSync(`${specs}/tests/`),
  };
};
module.exports = function ({
  connection = "http://localhost:3300/systemview/api",
  specs = "./specs",
  projectCode,
  serviceId,
  helperMethods,
}) {
  return function (App) {
    App.loadService("SystemView", connection)
      .module("Plugin", SystemViewModule(specs, projectCode, serviceId, helperMethods))
      .on("ready", async function connectSystemView(system) {
        try {
          const { SystemView } = this.useService("SystemView");
          const specList = getSpecList(specs);
          console.log("reconnection");
          await SystemView.connect({ system, projectCode, serviceId, specList });
          SystemView.on("reconnect", connectSystemView.bind(this, system));
        } catch (error) {
          console.log("SystemView connection failed---->", error);
        }
      });
  };
};
