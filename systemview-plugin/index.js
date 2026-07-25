const fs = require("fs");
const path = require("path");
const SystemViewModule = require("./SystemViewModule");
const createStats = require("./stats");
const { getSpecList, ensureDir } = require("./utils");

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
  // RFC-017: all SystemView runtime files live under this folder in the observed project's cwd.
  dir = ".systemview",
  limit = 100,
  projectCode,
  serviceId,
  module,
  headers = {},
  // Declares this service COOKIE-CREDENTIALED (RFC-013): its CORS reflects the origin and allows
  // credentials, and it authenticates via session cookies — so browser clients must send
  // withCredentials even though it declares no header profile. Rides the registration to the UI.
  credentials = false,
  useSystemViewLogs = true,
  useSystemViewUI = true,
  // Write/refresh this service's entry in the local systemview.manifest.json on startup. INDEPENDENT
  // of the UI — a service with no local UI still writes its manifest so the CLI (or a remote UI) can
  // reach it via the manifest. Default on; set false to opt out.
  writeManifest = true,
  trace: traceConfig = true,
  // RFC-015 Reports: roll up the trace stream into bounded per-method + time-bucketed stats.
  // `true` (default) / `false`, or an object of overrides ({ bucketMs, retention, file }).
  stats: statsConfig = true,
  redact = [],
  exclude = [],
}) {
  return function (App) {
    // RFC-017: one folder for everything SystemView writes into the project.
    const SV_DIR = path.resolve(process.cwd(), dir);
    ensureDir(SV_DIR);
    const LOG_FILE = path.resolve(SV_DIR, logs);
    const excludeModules = new Set([
      ...SKIP_MODULES,
      ...exclude.filter((s) => !s.includes(".")),
    ]);
    const excludeMethods = new Set(exclude.filter((s) => s.includes(".")));
    let sv;

    // -- RFC-015 stats aggregator (bounded rollups; per-serviceId file so cwd-sharing siblings
    //    don't collide on the read-modify-write) --
    const statsEnabled = statsConfig !== false;
    const statsOpts = typeof statsConfig === "object" && statsConfig ? statsConfig : {};
    const statsFile = path.resolve(
      SV_DIR,
      statsOpts.file || `systemview.stats.${serviceId || "default"}.json`,
    );
    const statsAgg = statsEnabled
      ? createStats({ serviceId, projectCode, ...statsOpts, file: statsFile })
      : null;

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

    function getStats() {
      if (!statsAgg) return { serviceId, projectCode, methods: [], series: [] };
      statsAgg.flush(); // persist latest on read
      return statsAgg.snapshot();
    }

    function clearStats() {
      if (statsAgg) statsAgg.clear();
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
      this.getStats = getStats;
      this.clearStats = clearStats;
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
          if (statsAgg)
            statsAgg.record(`${req.module_name}.${req.fn}`, {
              duration: Date.now() - req._svStart,
              error: true,
              status: (err && err.status) || 500,
            });
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
        if (statsAgg)
          statsAgg.record(`${req.module_name}.${req.fn}`, {
            duration: Date.now() - req._svStart,
          });
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

    // Register the Plugin module on EVERY service, hub or not — its methods (getManifest/getTests/getDoc/
    // getConnection + the user's own `module` functions) must be reachable remotely so a UI-less remote
    // service can be inspected and TESTED. Registration is now independent of the UI connection.
    function registerPluginModule() {
      App.module(
        "Plugin",
        SystemViewModule({ specs, App, projectCode, serviceId, module, credentials, svDir: SV_DIR }),
      );
    }

    // The actual UI connection — load the hub and push this service's registration on ready. UI-only.
    function connectToUI() {
      App.loadService("SystemViewUI", connection);
      App.on("ready", async function connectSystemView({ connectionData, modules, routing, services }) {
        const system = { connectionData, modules, routing, services };
        const specList = getSpecList(specs);
        try {
          const { SystemView: SystemViewSvc } = this.useService("SystemViewUI");
          await SystemViewSvc.connect({ system, projectCode, serviceId, specList, credentials });
          console.log(`[SystemView]: ${projectCode}.${serviceId} connected!\n`);
        } catch (err) {
          console.log(`[SystemView]: ${projectCode}.${serviceId} connection failed\n`);
        }
      });
    }

    // RFC-017: write THIS service's OWN file — `.systemview/<serviceId>.manifest.json`. No read-modify-
    // write of a shared file, so N services starting at once never clobber each other (that stampede was
    // the deploy-boot wedge). getManifest() and the CLI glob these files and assemble the whole project.
    function persistManifest(system) {
      try {
        const { connectionData } = system;
        const specList = getSpecList(specs);
        // Persist ONLY serializable connectionData — never the live `system` (its `modules` are live
        // instances, `services` are socket-backed clients; JSON.stringify walking their getters can block).
        const entry = { projectCode, serviceId, system: { connectionData }, specList, credentials };
        // Operator-authored config headers ride as DEFAULTS under this service's own origin; the
        // assembler merges them (captured cookies win at read time).
        if (headers && Object.keys(headers).length) {
          let origin = null;
          try { origin = new URL(connectionData.serviceUrl).origin; } catch {}
          if (origin) entry.headers = { [origin]: { ...headers } };
        }
        fs.writeFileSync(
          path.join(SV_DIR, `${serviceId}.manifest.json`),
          JSON.stringify(entry, null, 2),
        );
      } catch (err) {
        console.log(`[SystemView]: failed to write manifest: ${err.message}\n`);
      }
    }

    if (useSystemViewLogs) registerSystemViewLogs();
    registerPluginModule(); // ALWAYS — the plugin's methods must be reachable with or without a hub
    if (useSystemViewUI) connectToUI();
    if (writeManifest)
      App.on("ready", function ({ connectionData, modules, routing, services }) {
        persistManifest({ connectionData, modules, routing, services });
      });
    if (statsAgg) {
      const flushTimer = setInterval(() => statsAgg.flush(), 30000);
      if (flushTimer.unref) flushTimer.unref();
    }
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
