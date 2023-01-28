const SystemViewModule = require("./SystemViewModule");

module.exports = function ({
  SystemViewConnection = "http://localhost:3300/systemview/api",
  specs = "./systemview",
  projectCode,
  serviceId,
}) {
  return function (App) {
    App.loadService("SystemView", SystemViewConnection)
      .module("SystemView", SystemViewModule(specs))
      .on("ready", async function (system) {
        try {
          const { SystemView } = this.useService("SystemView");
          console.log(SystemView);
          await SystemView.connect({ system, projectCode, serviceId });
          console.log("SystemView connected");
        } catch (error) {
          console.log("SystemView connection failed", error);
        }
      });
  };
};
