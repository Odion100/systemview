const fs = require("fs");
const path = require("path");
const SystemViewModule = require("./SystemViewModule");
const { getSpecList } = require("./utils");

const SKIP_MODULES = ["Plugin", "SystemView"];

module.exports = function ({
  connection = "http://localhost:3300/systemview/api",
  specs = "./specs",
  logs = "./systemview.logs",
  limit = 100,
  projectCode,
  serviceId,
  module,
  useSystemViewLogs = true,
  useSystemViewUI = true,
}) {
  return function (App) {
    const LOG_FILE = path.resolve(process.cwd(), logs);
    let sv;

    // -- SystemView log module --

    function makeBaseRecord(meta) {
      const moduleName = (meta && meta.moduleName) || "SystemView";
      const methodName = meta && meta.methodName;
      const moduleMethod = methodName ? `${moduleName}.${methodName}` : moduleName;
      return {
        timestamp: new Date().toISOString(),
        projectCode,
        serviceId,
        moduleName,
        ...(methodName && { methodName }),
        moduleMethod,
        ...(meta && meta.traceId && { traceId: meta.traceId }),
      };
    }

    // trace: fields (arguments, returnValue, duration, error, etc.) spread directly onto record
    function trace(message, fields, meta) {
      const record = { ...makeBaseRecord(meta), level: "trace", message, ...fields };
      try { fs.appendFileSync(LOG_FILE, JSON.stringify(record) + "\n"); } catch {}
      this.emit("log", record);
    }

    // manual log levels: data goes into "log" key (not "data"), arguments from meta
    function makeManualRecord(level, message, logData, meta) {
      return {
        ...makeBaseRecord(meta),
        ...(meta && meta.arguments !== undefined && { arguments: meta.arguments }),
        level,
        message,
        ...(logData !== undefined && { log: logData }),
      };
    }

    function log(message, logData, meta) {
      const record = makeManualRecord("log", message, logData, meta);
      try { fs.appendFileSync(LOG_FILE, JSON.stringify(record) + "\n"); } catch {}
      this.emit("log", record);
    }

    function warn(message, logData, meta) {
      const record = makeManualRecord("warn", message, logData, meta);
      try { fs.appendFileSync(LOG_FILE, JSON.stringify(record) + "\n"); } catch {}
      this.emit("log", record);
    }

    function error(message, logData, meta) {
      const record = makeManualRecord("error", message, logData, meta);
      try { fs.appendFileSync(LOG_FILE, JSON.stringify(record) + "\n"); } catch {}
      this.emit("log", record);
    }

    function debug(message, logData, meta) {
      const record = makeManualRecord("debug", message, logData, meta);
      try { fs.appendFileSync(LOG_FILE, JSON.stringify(record) + "\n"); } catch {}
      this.emit("log", record);
    }

    function getLog({ limit: requestedLimit } = {}) {
      try {
        const lines = fs.readFileSync(LOG_FILE, "utf8").split("\n").filter(Boolean).map(JSON.parse);
        return lines.slice(-(requestedLimit || limit));
      } catch { return []; }
    }

    function clearLog() {
      try { fs.writeFileSync(LOG_FILE, ""); } catch {}
      return true;
    }

    function SystemViewLogModule() {
      this.trace = trace;
      this.log = log;
      this.warn = warn;
      this.error = error;
      this.debug = debug;
      this.getLog = getLog;
      this.clearLog = clearLog;
    }

    // -- makeLogger: closes over sv; captures traceId + reqArguments at injection time --

    const makeLogger = (moduleName, methodName, traceId, reqArguments) => {
      const make = (level) => (message, logData) => {
        if (sv) sv[level](message, logData, {
          moduleName,
          ...(methodName && { methodName }),
          ...(traceId && { traceId }),
          ...(reqArguments !== undefined && { arguments: reqArguments }),
        });
      };
      return { log: make("log"), warn: make("warn"), error: make("error"), debug: make("debug") };
    };

    // -- module + plugin registration --

    function registerSystemViewLogs() {
      App.module("SystemView", SystemViewLogModule);

      App.before("$all", (req, res, next) => {
        if (SKIP_MODULES.includes(req.module_name)) return next();
        req._svStart = Date.now();
        req._svTraceId = `${String(req._svStart).slice(-6)}-${Math.random().toString(36).slice(2, 6)}`;

        const _sendError = res.sendError;
        res.sendError = (err) => {
          if (req.Module) {
            req.Module._svPendingDuration = Date.now() - req._svStart;
            req.Module._svTraceId = req._svTraceId;
          }
          _sendError(err);
        };

        Object.assign(req.Module, sv
          ? makeLogger(req.module_name, req.fn, req._svTraceId, req.arguments)
          : { log: () => {}, warn: () => {}, error: () => {}, debug: () => {} }
        );

        if (sv) {
          sv.trace(`${req.module_name}.${req.fn} start`, { arguments: req.arguments }, {
            moduleName: req.module_name,
            methodName: req.fn,
            traceId: req._svTraceId,
          });
        }

        next();
      });

      App.after("$all", (req, res, next) => {
        if (SKIP_MODULES.includes(req.module_name)) return next();
        if (sv) {
          sv.trace(`${req.module_name}.${req.fn} end`, {
            arguments: req.arguments,
            returnValue: req.returnValue,
            duration: Date.now() - req._svStart,
          }, {
            moduleName: req.module_name,
            methodName: req.fn,
            traceId: req._svTraceId,
          });
        }
        next();
      });
    }

    function registerSystemViewUIPlugin() {
      App.loadService("SystemView", connection)
        .module("Plugin", SystemViewModule({ specs, App, projectCode, serviceId, module }))
        .on("ready", async function connectSystemView({ connectionData, modules, routing, services }) {
          if (useSystemViewLogs) {
            sv = this.useModule("SystemView");

            if (typeof App.getModules === "function") {
              Object.entries(App.getModules()).forEach(([name, mod]) => {
                if (SKIP_MODULES.includes(name) || !mod) return;
                Object.assign(mod, makeLogger(name));
                if (typeof mod.on === "function") {
                  mod.on("error", (info) => {
                    if (!sv) return;
                    sv.trace(info.message, {
                      arguments: info.arguments,
                      error: { message: info.message, status: info.status },
                      duration: mod._svPendingDuration,
                    }, {
                      moduleName: info.module_name,
                      methodName: info.fn,
                      traceId: mod._svTraceId,
                    });
                  });
                }
              });
            }
          }

          const system = { connectionData, modules, routing, services };
          const specList = getSpecList(specs);

          try {
            const { SystemView: SystemViewSvc } = this.useService("SystemView");
            await SystemViewSvc.connect({ system, projectCode, serviceId, specList });
            console.log(`[SystemView]: ${projectCode}.${serviceId} connected!\n`);
          } catch (err) {
            console.log(`[SystemView]: ${projectCode}.${serviceId} connection failed\n`);
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
    }

    if (useSystemViewLogs) registerSystemViewLogs();
    if (useSystemViewUI) registerSystemViewUIPlugin();
    if (useSystemViewLogs && !useSystemViewUI) App.on("ready", function () { sv = this.useModule("SystemView"); });
  };
};
