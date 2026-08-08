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
  // RFC-027: the observed project's directory. Defaults to cwd (the plugin running inside its own
  // service). A HOSTED service runs in the hub's process, so the hub passes the target repo here —
  // every path (runtime dir, file providers, project doc) resolves against it instead of cwd.
  root = process.cwd(),
  // RFC-027: truthy = this service is CLI-HOSTED; the value is the committed folder's path relative
  // to `root` (e.g. "systemview"). Rides the registration, the manifest entry, and getConnection so
  // the hub can re-host on boot and the UI can mark the service plum.
  hosted = false,
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
  // RFC-015 §5 LB mode: normally auto-detected (App.getModule("Tentacle")), but the shipped
  // LoadBalancer is Service()-based with no plugin system yet — so a host that HOLDS the live
  // Tentacle handle (same process) can pass it explicitly and the plugin observes the cluster
  // through it. Explicit handle wins over detection.
  tentacle: tentacleHandle = null,
  redact = [],
  exclude = [],
}) {
  return function (App, system) {
    // RFC-017: one folder for everything SystemView writes into the project.
    const SV_DIR = path.resolve(root, dir);
    ensureDir(SV_DIR);
    // PER-SERVICE log file (mirrors the per-service stats file below). Sibling services in one project
    // share this cwd; a single shared log file meant every service's getLog returned the WHOLE file, so
    // aggregating logs across N services duplicated every record N times. Giving each service its own file
    // (systemview.<serviceId>.logs) makes getLog return only that service's records — reads merge cleanly
    // by timestamp with zero duplication, and it's already how things look when services run on separate
    // hosts. `logs` config still overrides the base name.
    const logBase = String(logs).replace(/\.logs$/, "");
    const LOG_FILE = path.resolve(SV_DIR, `${logBase}.${serviceId || "default"}.logs`);
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

    // -- RFC-015 §5: LOAD-BALANCER MODE. Detected on ready (a Tentacle module is present). The
    //    plugin then reads cluster state in-process and subscribes to the Tentacle's local
    //    lifecycle/routing events. `lb.routeCounts` = per-location assignment tallies from
    //    route_assigned (balance fairness); `lb.timeline` = bounded join/evict history. --
    const lb = { isLB: false, tentacle: null, routeCounts: {}, timeline: [] };
    const LB_TIMELINE_CAP = 100;
    const lbEvent = (type, data) => {
      lb.timeline.push({ type, ...data, ts: Date.now() });
      if (lb.timeline.length > LB_TIMELINE_CAP) lb.timeline.splice(0, lb.timeline.length - LB_TIMELINE_CAP);
    };

    function getCluster() {
      if (!lb.isLB || !lb.tentacle || typeof lb.tentacle.getClusterState !== "function")
        return { lb: false };
      return {
        lb: true,
        serviceId,
        projectCode,
        state: lb.tentacle.getClusterState(),
        routeCounts: lb.routeCounts,
        timeline: lb.timeline,
        generatedAt: Date.now(),
      };
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
      this.getCluster = getCluster;
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
        // RFC-015 Tier 2: ADOPT an inbound trace (stamped by a calling service's client hook) so a
        // cross-service call chain shares one traceId; the caller identity feeds the topology edges.
        const h = req.headers || {};
        req._svTraceId =
          h["x-sv-trace"] ||
          `${String(req._svStart).slice(-6)}-${Math.random().toString(36).slice(2, 6)}`;
        req._svCaller = h["x-sv-caller"];

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
              caller: req._svCaller,
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
            caller: req._svCaller,
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
        SystemViewModule({ specs, App, projectCode, serviceId, module, credentials, svDir: SV_DIR, root, hosted }),
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
          await SystemViewSvc.connect({ system, projectCode, serviceId, specList, credentials, hosted });
          console.log(`[SystemView]: ${projectCode}.${serviceId} connected!\n`);
        } catch (err) {
          console.log(
            `[SystemView]: ${projectCode}.${serviceId} connection failed — ${(err && err.message) || err}\n`,
          );
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
        // RFC-027: a hosted service's manifest entry keeps the folder pointer — this is what the
        // boot hosting unit reads to know WHAT to re-host (registration, never name-scanning).
        if (hosted) entry.hosted = hosted;
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

    // RFC-015 §5 — LB-mode detection + subscriptions. All in-process reads/local events; the LB
    // reports to SystemView the way every other service does, it just records cluster behavior.
    App.on("ready", function () {
      const Tentacle =
        tentacleHandle ||
        (typeof App.getModule === "function" && App.getModule("Tentacle"));
      if (!Tentacle || typeof Tentacle.on !== "function") return;
      lb.isLB = true;
      lb.tentacle = Tentacle;
      Tentacle.on("route_assigned", ({ route, location, policy }) => {
        const key = `${route}|${location}`;
        lb.routeCounts[key] = (lb.routeCounts[key] || 0) + 1;
        lb.lastPolicy = policy;
      });
      Tentacle.on("new_service", (d) => lbEvent("new_service", d || {}));
      Tentacle.on("new_clone", (d) => lbEvent("new_clone", d || {}));
      Tentacle.on("location_removed", (d) => lbEvent("location_removed", d || {}));
    });

    // RFC-015 report #7 (Module Coupling) — observe the SystemLynx RFC-008 local coupling signals.
    // The framework $emits on the CALLER module: use_module / use_service (who resolves whom) and
    // event_subscription (who listens to whose events, with the event name). Local-only $emits — a
    // co-loaded listener on each module's dispatcher catches them; nothing crosses the wire.
    if (statsAgg)
      App.on("ready", function () {
        if (typeof App.getModules !== "function") return;
        Object.entries(App.getModules()).forEach(([name, mod]) => {
          if (SKIP_MODULES.includes(name) || !mod || typeof mod.on !== "function") return;
          const sub = (kind) => (d) => {
            if (d && d.to) statsAgg.recordCoupling({ kind, from: d.from || name, to: d.to, event: d.event });
          };
          mod.on("use_module", sub("use_module"));
          mod.on("use_service", sub("use_service"));
          mod.on("event_subscription", sub("event_subscription"));
        });
      });

    // RFC-015 Tier 2 — OUTBOUND trace stamping (rides SystemLynx RFC-005 client hooks + RFC-007
    // caller-bound copies). On every call this service makes to a loaded peer, stamp:
    //   x-sv-trace  — the inbound request's trace when reachable (this.__caller.req), else a fresh id
    //   x-sv-caller — who is calling: serviceId[.Module[.method]]
    // The receiving service's plugin adopts the trace and records the caller → the topology edge.
    // Callers via `this.useService(...)` carry full context; middleware callers (`req.module.use…`)
    // degrade to module-level identity — still a real edge. Never throws into outbound traffic.
    if (statsAgg)
      App.on("ready", function () {
        if (!system || !Array.isArray(system.services)) return;
        system.services.forEach(({ name, client }) => {
          if (name === "SystemViewUI") return; // the hub connection is not system traffic
          if (!client || typeof client.before !== "function") return;
          client.before("$all", function (payload, next) {
            try {
              const caller = this && this.__caller;
              const req = caller && caller.req;
              const trace =
                (req && req._svTraceId) ||
                ((req && req.headers) || {})["x-sv-trace"] ||
                `${String(Date.now()).slice(-6)}-${Math.random().toString(36).slice(2, 6)}`;
              const from = caller && (caller.__name || (req && req.module_name));
              const fn = req && req.fn;
              this.setHeaders({
                "x-sv-trace": trace,
                "x-sv-caller": `${serviceId || "unknown"}${from ? `.${from}` : ""}${
                  from && fn ? `.${fn}` : ""
                }`,
              });
            } catch {
              /* stamping must never break the call */
            }
            next();
          });
        });
      });
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
