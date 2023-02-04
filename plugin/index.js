const SystemViewModule = require("./SystemViewModule");

module.exports = function ({
  SystemViewConnection = "http://localhost:3300/systemview/api",
  specs = "./specs",
  projectCode,
  serviceId,
}) {
  return function (App) {
    App.loadService("SystemView", SystemViewConnection)
      .module("SystemView", SystemViewModule(specs))
      .on("ready", async function connectSystemView(system) {
        try {
          const { SystemView } = this.useService("SystemView");
          console.log("reconnection");
          await SystemView.connect({ system, projectCode, serviceId });
          SystemView.on("reconnect", connectSystemView.bind(this, system));
        } catch (error) {
          console.log("SystemView connection failed", error);
        }
      });
  };
};
