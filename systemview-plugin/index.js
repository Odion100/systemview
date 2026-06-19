const fs = require("fs");
const path = require("path");
const SystemViewModule = require("./SystemViewModule");
const { getSpecList } = require("./utils");

module.exports = function ({
  connection = "http://localhost:3300/systemview/api",
  specs = "./specs",
  projectCode,
  serviceId,
  module,
}) {
  const LOGS_FILE = path.join(process.cwd(), "systemview.logs");

  function install(App) {
    App.loadService("SystemView", connection)
      .module(
        "Plugin",
        SystemViewModule({
          specs,
          App,
          projectCode,
          serviceId,
          module,
        })
      )
      .on(
        "ready",
        async function connectSystemView({ connectionData, modules, routing, services }) {
          const system = { connectionData, modules, routing, services };
          const specList = getSpecList(specs);
          try {
            const { SystemView } = this.useService("SystemView");
            await SystemView.connect({ system, projectCode, serviceId, specList });
            console.log(`[SystemView]: ${projectCode}.${serviceId} connected!\n`);
          } catch (error) {
            console.log(`[SystemView]: ${projectCode}.${serviceId} connection failed\n`);
          }
          // Write manifest so CLI can run tests without the SystemView server
          try {
            const manifestPath = path.join(process.cwd(), "systemview.manifest.json");
            let manifest = { projectCode, services: [] };
            if (fs.existsSync(manifestPath)) {
              try { manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8")); } catch {}
              if (!manifest.services) manifest.services = [];
            }
            const entry = { serviceId, system, specList };
            const idx = manifest.services.findIndex((s) => s.serviceId === serviceId);
            if (idx > -1) manifest.services[idx] = entry;
            else manifest.services.push(entry);
            manifest.projectCode = projectCode;
            try { manifest.probeHeaders = { Origin: new URL(connection).origin }; } catch {}
            fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
          } catch (err) {
            console.log(`[SystemView]: failed to write manifest: ${err.message}\n`);
          }
        }
      );
  }

  install.log = function (...args) {
    console.log(...args);
    const entry = JSON.stringify({
      ts: new Date().toISOString(),
      service: `${projectCode}.${serviceId}`,
      message: args.length === 1 ? args[0] : args,
    });
    fs.appendFileSync(LOGS_FILE, entry + "\n");
  };

  return install;
};
