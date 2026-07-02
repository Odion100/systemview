const fs = require("fs");
const path = require("path");
const chalk = require("chalk");
const log = require("./logger");
const { createClient } = require("systemlynx");
const { createCookieHttpClient } = require("./cookieClient");
const cookieHttpClient = createCookieHttpClient();
const Client = createClient(cookieHttpClient);

const LEVEL_COLOR = {
  trace: (s) => chalk.dim(s),
  info: (s) => chalk.white(s),
  warn: (s) => chalk.yellow(s),
  error: (s) => chalk.red(s),
  debug: (s) => chalk.blue(s),
};

function colorLevel(level) {
  const fn = LEVEL_COLOR[level] || ((s) => s);
  return fn((level || "info").padEnd(5));
}

const SKIP_KEYS = new Set([
  "timestamp",
  "projectCode",
  "serviceId",
  "moduleMethod",
  "traceId",
  "level",
  "message",
  "duration",
]);

function formatRow(entry, verbose) {
  const d = new Date(entry.timestamp);
  const time =
    d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) +
    " " +
    d.toLocaleTimeString("en-US", { hour12: false });
  const project = entry.projectCode || "—";
  const service = entry.serviceId || "—";
  const method = entry.moduleMethod || "—";
  const level = colorLevel(entry.level);
  const msg = entry.message || "";
  const dur = entry.duration != null ? chalk.dim(` ${entry.duration}ms`) : "";
  const traceId = chalk.dim(entry.traceId || "—");
  const main = `  ${chalk.dim(time)}  ${chalk.cyan(project)} › ${chalk.cyan(service)}   ${method.padEnd(15)}  ${level}  ${traceId}  ${msg}${dur}`;
  if (verbose) {
    const extra = {};
    Object.keys(entry).forEach((k) => {
      if (!SKIP_KEYS.has(k)) extra[k] = entry[k];
    });
    if (Object.keys(extra).length) {
      return (
        main +
        "\n" +
        JSON.stringify(extra, null, 2)
          .split("\n")
          .map((l) => "      " + chalk.yellow(l))
          .join("\n")
      );
    }
  }
  return main;
}

function parseFilters(filters) {
  return (filters || [])
    .map((f) => {
      const eq = f.indexOf("=");
      if (eq === -1) return null;
      return { field: f.slice(0, eq), value: f.slice(eq + 1) };
    })
    .filter(Boolean);
}

function matchesFilters(entry, andFilters, orFilters) {
  const check = ({ field, value }) => {
    const v = entry[field];
    return v != null && String(v).includes(value);
  };
  const andPass = andFilters.length === 0 || andFilters.every(check);
  const orPass = orFilters.length === 0 || orFilters.some(check);
  if (andFilters.length && orFilters.length) return andPass || orPass;
  return andPass && orPass;
}

module.exports = async function logsCommand(
  url,
  projectCode,
  namespace,
  { level, limit = 50, clear, json, follow, current, verbose, filter, or: orFilters },
) {
  const andFilters = parseFilters(filter);
  const orFiltersParsed = parseFilters(orFilters);

  if (follow) {
    const manifestFile = path.join(process.cwd(), "systemview.manifest.json");
    if (!fs.existsSync(manifestFile)) {
      log.warn("No manifest found. Use: systemview connect <serviceId> <url>");
      return;
    }
    const manifest = JSON.parse(fs.readFileSync(manifestFile, "utf8"));
    const services = manifest.services || [manifest];
    if (!services.length) {
      log.warn("No services in manifest. Use: systemview connect <serviceId> <url>");
      return;
    }

    console.log("");
    console.log(chalk.bold("  Streaming logs"));
    console.log("");

    console.log(chalk.dim(`  Services (${services.length}):`));
    const connected = [];
    for (const { serviceId, system } of services) {
      const { serviceUrl } = system.connectionData;
      try {
        const svc = await Client.loadService(serviceUrl);
        svc.SystemViewLogs.on("log", (entry) => {
          if (namespace && !(entry.moduleMethod && entry.moduleMethod.includes(namespace))) return;
          if (andFilters.length || orFiltersParsed.length) {
            if (!matchesFilters(entry, andFilters, orFiltersParsed)) return;
          }
          if (level && entry.level !== level) return;
          console.log(formatRow(entry, verbose));
        });
        console.log(`    ${chalk.green("✓")} ${chalk.cyan(serviceId).padEnd(20)} ${chalk.dim(serviceUrl)}`);
        connected.push(serviceId);
      } catch (err) {
        console.log(`    ${chalk.red("✗")} ${chalk.cyan(serviceId).padEnd(20)} ${chalk.dim(serviceUrl)} ${chalk.red("(failed to connect)")}`);
      }
    }

    const activeFilters = [];
    if (namespace) activeFilters.push(`namespace: ${chalk.white(namespace)}`);
    if (level) activeFilters.push(`level: ${chalk.white(level)}`);
    if (andFilters.length) activeFilters.push(`filter: ${chalk.white(andFilters.map((f) => `${f.field}=${f.value}`).join(", "))}`);
    if (orFiltersParsed.length) activeFilters.push(`or: ${chalk.white(orFiltersParsed.map((f) => `${f.field}=${f.value}`).join(", "))}`);
    if (verbose) activeFilters.push(`verbose: ${chalk.white("on")}`);

    if (activeFilters.length) {
      console.log("");
      console.log(chalk.dim(`  Filters:`));
      activeFilters.forEach((f) => console.log(`    ${chalk.dim(f)}`));
    }

    console.log("");

    if (!connected.length) {
      log.warn("No services connected.");
      return;
    }

    if (current) {
      try {
        const api = `${url}/systemview/api`;
        const { SystemView } = await Client.loadService(api);
        const all = await SystemView.getLogs({ projectCode: manifest.projectCode, level, limit });
        let entries = all || [];
        if (namespace) entries = entries.filter((e) => e.moduleMethod && e.moduleMethod.includes(namespace));
        if (andFilters.length || orFiltersParsed.length) entries = entries.filter((e) => matchesFilters(e, andFilters, orFiltersParsed));
        if (entries.length) {
          console.log(chalk.dim(`  ── current (${entries.length}) ──`));
          entries.forEach((e) => console.log(formatRow(e, verbose)));
          console.log(chalk.dim(`  ── streaming ──`));
        }
      } catch (err) {
        log.warn("Could not fetch current logs: " + err.message);
      }
    }

    return;
  }

  const api = `${url}/systemview/api`;
  const { SystemView } = await Client.loadService(api);

  if (clear) {
    const confirmed = await promptConfirm("Clear all logs? (y/N) ");
    if (!confirmed) { log.warn("Aborted."); return; }
    await SystemView.clearLogs();
    log.success("Logs cleared.");
    return;
  }

  const entries = await (async () => {
    const all = await SystemView.getLogs({ projectCode, level, limit });
    let filtered = all || [];
    if (namespace) filtered = filtered.filter((e) => e.moduleMethod && e.moduleMethod.includes(namespace));
    if (andFilters.length || orFiltersParsed.length) filtered = filtered.filter((e) => matchesFilters(e, andFilters, orFiltersParsed));
    return filtered;
  })();

  if (json) {
    console.log(JSON.stringify(entries, null, 2));
    return;
  }

  if (!entries.length) {
    log.warn("No logs found.");
    return;
  }

  console.log("");
  entries.forEach((e) => console.log(formatRow(e, verbose)));
  console.log("");
  log.plain(chalk.dim(`  ${entries.length} entries`));
};

function promptConfirm(question) {
  return new Promise((resolve) => {
    process.stdout.write(question);
    process.stdin.setEncoding("utf8");
    process.stdin.once("data", (data) => {
      resolve(data.trim().toLowerCase() === "y");
    });
  });
}
