const fs = require("fs");
const path = require("path");
const SystemViewModule = require("./SystemViewModule");
const { getSpecList } = require("./utils");

const SKIP_MODULES = ["Plugin", "SystemView", "SystemViewLogs"];

module.exports = function ({
  connection = "http://localhost:3300/systemview/api",
  specs = "./specs",
  projectCode,
  serviceId,
  module,
}) {
  return function (App) {
    let SystemView;
    let makeLogger;
    let logsModule;

    App.module("SystemViewLogs", {});

    App.before("$all", (req, res, next) => {
      if (SKIP_MODULES.includes(req.module_name)) return next();
      req._svStart = Date.now();
      req._svTraceId = `${String(req._svStart).slice(-6)}-${Math.random().toString(36).slice(2, 6)}`;

      const _sendError = res.sendError;
      res.sendError = (error) => {
        if (req.Module) {
          req.Module._svPendingDuration = Date.now() - req._svStart;
          req.Module._svTraceId = req._svTraceId;
        }
        _sendError(error);
      };

      Object.assign(req.Module, makeLogger
        ? makeLogger(req.module_name, req.fn, req)
        : { log: () => {}, warn: () => {}, error: () => {}, debug: () => {} }
      );

      if (logsModule) {
        const entry = {
          projectCode,
          serviceId,
          moduleMethod: `${req.module_name}.${req.fn}`,
          traceId: req._svTraceId,
          level: "trace",
          message: `${req.module_name}.${req.fn} start`,
          arguments: req.arguments,
        };
        try { SystemView && SystemView.saveLog(entry); } catch {}
        logsModule.emit("log", { timestamp: new Date().toISOString(), ...entry });
      }

      next();
    });

    App.after("$all", async (req, res, next) => {
      if (SKIP_MODULES.includes(req.module_name)) return next();
      if (SystemView) {
        try {
          const entry = {
            projectCode,
            serviceId,
            moduleMethod: `${req.module_name}.${req.fn}`,
            traceId: req._svTraceId,
            level: "trace",
            message: `${req.module_name}.${req.fn} end`,
            arguments: req.arguments,
            returnValue: req.returnValue,
            duration: Date.now() - req._svStart,
          };
          await SystemView.saveLog(entry);
          if (logsModule) logsModule.emit("log", { timestamp: new Date().toISOString(), ...entry });
        } catch {}
      }
      next();
    });

    App.loadService("SystemView", connection)
      .module("Plugin", SystemViewModule({ specs, App, projectCode, serviceId, module }))
      .on("ready", async function connectSystemView({ connectionData, modules, routing, services }) {
        const system = { connectionData, modules, routing, services };
        const specList = getSpecList(specs);
        try {
          SystemView = this.useService("SystemView").SystemView;
          await SystemView.connect({ system, projectCode, serviceId, specList });
          console.log(`[SystemView]: ${projectCode}.${serviceId} connected!\n`);
        } catch (error) {
          console.log(`[SystemView]: ${projectCode}.${serviceId} connection failed\n`);
          SystemView = null;
        }

        logsModule = App.getModule("SystemViewLogs");

        if (SystemView) {
          const emitLog = (entry) => {
            SystemView.saveLog(entry);
            if (logsModule) logsModule.emit("log", { timestamp: new Date().toISOString(), ...entry });
          };

          makeLogger = (moduleName, methodName, req) => {
            const moduleMethod = methodName ? `${moduleName}.${methodName}` : moduleName;
            function buildEntry(level, message, logData) {
              const entry = { projectCode, serviceId, moduleMethod, traceId: req && req._svTraceId, level, message };
              if (req) entry.arguments = req.arguments;
              if (logData !== undefined) entry.log = logData;
              return entry;
            }
            return {
              log:   (message, data) => emitLog(buildEntry("log",   message, data)),
              warn:  (message, data) => emitLog(buildEntry("warn",  message, data)),
              error: (message, data) => emitLog(buildEntry("error", message, data)),
              debug: (message, data) => emitLog(buildEntry("debug", message, data)),
            };
          };

          if (typeof App.getModules === "function") {
            Object.entries(App.getModules()).forEach(([name, mod]) => {
              if (SKIP_MODULES.includes(name) || !mod) return;
              Object.assign(mod, makeLogger(name));
              if (typeof mod.on === "function") {
                mod.on("error", async (info) => {
                  try {
                    const entry = {
                      projectCode,
                      serviceId,
                      moduleMethod: `${info.module_name}.${info.fn}`,
                      traceId: mod._svTraceId,
                      level: "trace",
                      message: info.message,
                      arguments: info.arguments,
                      error: { message: info.message, status: info.status },
                      duration: mod._svPendingDuration,
                    };
                    await SystemView.saveLog(entry);
                    if (logsModule) logsModule.emit("log", { timestamp: new Date().toISOString(), ...entry });
                  } catch {}
                });
              }
            });
          }
        }

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
      });
  };
};
