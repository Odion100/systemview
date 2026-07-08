const fs = require("fs");
const path = require("path");
const SystemViewModule = require("./SystemViewModule");
const { getSpecList } = require("./utils");

const SKIP_MODULES = ["Plugin", "SystemView"];

function redactClone(data, paths) {
  if (!paths.length || data == null) return data;
  const clone = JSON.parse(JSON.stringify(data));
  paths.forEach((p) => {
    const keys = p
      .replace(/\[(\w+)\]/g, ".$1")
      .split(".")
      .filter(Boolean);
    let node = clone;
    for (let i = 0; i < keys.length - 1; i++) {
      if (node == null) return;
      node = node[keys[i]];
    }
    if (node != null && keys.length) node[keys[keys.length - 1]] = "[REDACTED]";
  });
  return clone;
}

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
  trace: traceConfig = true,
  redact = [],
  exclude = [],
}) {
  return function (App) {
    const LOG_FILE = path.resolve(process.cwd(), logs);
    const excludeModules = new Set([
      ...SKIP_MODULES,
      ...exclude.filter((s) => !s.includes(".")),
    ]);
    const excludeMethods = new Set(exclude.filter((s) => s.includes(".")));
    let sv;

    // -- SystemView log module --

    function makeBaseRecord(meta) {
      const module = (meta && meta.moduleName) || "SystemView";
      const method = meta && meta.methodName;
      const moduleMethod = method ? `${module}.${method}` : module;
      return {
        ...(meta && meta.ctx),
        timestamp: new Date().toISOString(),
        projectCode,
        serviceId,
        module,
        ...(method && { method }),
        moduleMethod,
        ...(meta && meta.traceId && { traceId: meta.traceId }),
      };
    }

    // Request-scoped enrichment. Runs the `trace` fn (when provided) against the live req and
    // returns its context. Threaded via meta.ctx so makeBaseRecord spreads it onto EVERY record
    // that shares the request's traceId — auto-traces AND manual logs. Fresh per entry (compute is
    // cheap) so late-bound fields like req.session show up on entries emitted after they're set.
    // Out-of-request logs pass no req, so they get nothing (traceId "internal").
    function svCtx(req) {
      if (typeof traceConfig !== "function" || !req) return undefined;
      try {
        return traceConfig(req);
      } catch {
        return undefined;
      }
    }

    // trace: fields (arguments, returnValue, duration, error, etc.) spread directly onto record
    function trace(scope, fields, meta) {
      const record = { ...makeBaseRecord(meta), level: "trace", scope, ...fields };
      try {
        fs.appendFileSync(LOG_FILE, JSON.stringify(record) + "\n");
      } catch {}
      this.emit("log", record);
    }

    // manual log levels: first arg can be object {scope?, ...data} or string; data goes into "log" key
    function makeManualRecord(level, scopeOrData, logData, meta) {
      let scope, data;
      if (typeof scopeOrData === "object" && scopeOrData !== null) {
        scope = "";
        data = scopeOrData;
      } else {
        scope = scopeOrData || "";
        data = logData;
      }
      return {
        ...makeBaseRecord(meta),
        level,
        scope,
        ...(data != null ? { log: data } : {}),
      };
    }

    function log(scope, logData, meta) {
      const record = makeManualRecord("log", scope, logData, meta);
      try {
        fs.appendFileSync(LOG_FILE, JSON.stringify(record) + "\n");
      } catch {}
      this.emit("log", record);
    }

    function warn(scope, logData, meta) {
      const record = makeManualRecord("warn", scope, logData, meta);
      try {
        fs.appendFileSync(LOG_FILE, JSON.stringify(record) + "\n");
      } catch {}
      this.emit("log", record);
    }

    function error(scope, logData, meta) {
      const record = makeManualRecord("error", scope, logData, meta);
      try {
        fs.appendFileSync(LOG_FILE, JSON.stringify(record) + "\n");
      } catch {}
      this.emit("log", record);
    }

    function debug(scope, logData, meta) {
      const record = makeManualRecord("debug", scope, logData, meta);
      try {
        fs.appendFileSync(LOG_FILE, JSON.stringify(record) + "\n");
      } catch {}
      this.emit("log", record);
    }

    function getLog({ limit: requestedLimit } = {}) {
      try {
        const lines = fs
          .readFileSync(LOG_FILE, "utf8")
          .split("\n")
          .filter(Boolean)
          .map((line) => JSON.parse(line));
        return lines.slice(-(requestedLimit || limit));
      } catch {
        return [];
      }
    }

    function clearLog() {
      try {
        fs.writeFileSync(LOG_FILE, "");
      } catch {}
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

    const makeLogger = (moduleName, req) => {
      const make = (level) => (scope, logData) => {
        if (!sv) return;
        sv[level](scope, logData, {
          moduleName,
          ...(req
            ? { methodName: req.fn, traceId: req._svTraceId, ctx: svCtx(req) }
            : { traceId: "internal" }),
        });
      };
      return {
        log: make("log"),
        warn: make("warn"),
        error: make("error"),
        debug: make("debug"),
      };
    };

    // -- module + plugin registration --

    function registerSystemViewLogs() {
      App.module("SystemView", SystemViewLogModule);

      App.before("$all", (req, res, next) => {
        if (
          excludeModules.has(req.module_name) ||
          excludeMethods.has(`${req.module_name}.${req.fn}`)
        )
          return next();
        req._svStart = Date.now();
        req._svTraceId = `${String(req._svStart).slice(-6)}-${Math.random().toString(36).slice(2, 6)}`;

        if (req.Module) {
          Object.assign(req.Module, makeLogger(req.module_name, req));
        }

        const _sendError = res.sendError;
        res.sendError = (err) => {
          if (sv && traceConfig !== false) {
            sv.trace(
              "error",
              {
                arguments: redactClone(req.arguments, redact),
                error: {
                  message: err && err.message,
                  status: (err && err.status) || 500,
                },
                duration: Date.now() - req._svStart,
              },
              {
                moduleName: req.module_name,
                methodName: req.fn,
                traceId: req._svTraceId,
                ctx: svCtx(req),
              },
            );
          }
          _sendError(err);
        };

        if (sv && traceConfig !== false) {
          sv.trace(
            "start",
            { arguments: redactClone(req.arguments, redact) },
            {
              moduleName: req.module_name,
              methodName: req.fn,
              traceId: req._svTraceId,
              ctx: svCtx(req),
            },
          );
        }

        next();
      });

      App.after("$all", (req, res, next) => {
        if (
          excludeModules.has(req.module_name) ||
          excludeMethods.has(`${req.module_name}.${req.fn}`)
        )
          return next();
        if (sv && traceConfig !== false) {
          sv.trace(
            "end",
            {
              arguments: redactClone(req.arguments, redact),
              returnValue: redactClone(req.returnValue, redact),
              duration: Date.now() - req._svStart,
            },
            {
              moduleName: req.module_name,
              methodName: req.fn,
              traceId: req._svTraceId,
              ctx: svCtx(req),
            },
          );
        }
        next();
      });
    }

    function registerSystemViewUIPlugin() {
      App.loadService("SystemViewUI", connection)
        .module(
          "Plugin",
          SystemViewModule({ specs, App, projectCode, serviceId, module }),
        )
        .on(
          "ready",
          async function connectSystemView({
            connectionData,
            modules,
            routing,
            services,
          }) {
            const system = { connectionData, modules, routing, services };
            const specList = getSpecList(specs);

            try {
              const { SystemView: SystemViewSvc } = this.useService("SystemViewUI");
              await SystemViewSvc.connect({ system, projectCode, serviceId, specList });
              console.log(`[SystemView]: ${projectCode}.${serviceId} connected!\n`);
            } catch (err) {
              console.log(
                `[SystemView]: ${projectCode}.${serviceId} connection failed\n`,
              );
            }

            try {
              const manifestPath = path.join(process.cwd(), "systemview.manifest.json");
              let manifest = { projectCode, services: [] };
              if (fs.existsSync(manifestPath)) {
                try {
                  manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
                } catch {}
                if (!manifest.services) manifest.services = [];
              }
              const entry = { serviceId, system, specList };
              const idx = manifest.services.findIndex((s) => s.serviceId === serviceId);
              if (idx > -1) manifest.services[idx] = entry;
              else manifest.services.push(entry);
              manifest.projectCode = projectCode;
              // The plugin does not set request headers. Auth headers (e.g. an Origin for a dev
              // session, or a token) are the operator's config, authored in the manifest `headers`
              // section (literal or `@file`). SystemView forwards headers; it never mints them.
              fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
            } catch (err) {
              console.log(`[SystemView]: failed to write manifest: ${err.message}\n`);
            }
          },
        );
    }

    if (useSystemViewLogs) registerSystemViewLogs();
    if (useSystemViewUI) registerSystemViewUIPlugin();
    if (useSystemViewLogs)
      App.on("ready", function () {
        sv = this.useModule("SystemView");
        if (typeof App.getModules === "function") {
          Object.entries(App.getModules()).forEach(([name, mod]) => {
            if (excludeModules.has(name) || !mod) return;
            Object.assign(mod, makeLogger(name));
          });
        }
      });
  };
};
