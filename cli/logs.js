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

function formatRow(entry, verbose, extraFields) {
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
  let row = `  ${chalk.dim(time)}  ${chalk.cyan(project)} › ${chalk.cyan(service)}   ${method.padEnd(15)}  ${level}  ${traceId}  ${msg}${dur}`;
  if (extraFields && extraFields.length) {
    const parts = extraFields.map((p) => `${chalk.dim(p + ":")} ${cellStr(getAtPath(entry, p))}`);
    row += "  " + parts.join("  ");
  }
  if (verbose) {
    const extra = {};
    Object.keys(entry).forEach((k) => {
      if (!SKIP_KEYS.has(k)) extra[k] = entry[k];
    });
    if (Object.keys(extra).length) {
      return (
        row +
        "\n" +
        JSON.stringify(extra, null, 2)
          .split("\n")
          .map((l) => "      " + chalk.yellow(l))
          .join("\n")
      );
    }
  }
  return row;
}

function getAtPath(entry, field) {
  return field.split(".").reduce((o, k) => (o != null ? o[k] : undefined), entry);
}

function cellStr(v) {
  if (v === null || v === undefined) return "—";
  if (typeof v === "object") return Array.isArray(v) ? `[${v.length}]` : "{…}";
  return String(v);
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
    if (field === "has") return getAtPath(entry, value) != null;
    if (field === "missing") return getAtPath(entry, value) == null;
    const v = getAtPath(entry, field);
    return v != null && String(v).includes(value);
  };
  const andPass = andFilters.length === 0 || andFilters.every(check);
  const orPass = orFilters.length === 0 || orFilters.some(check);
  if (andFilters.length && orFilters.length) return andPass || orPass;
  return andPass && orPass;
}

const DISPLAY_SKIP = new Set(["timestamp", "projectCode", "serviceId", "moduleMethod", "traceId", "level", "message", "duration"]);

function filterDisplayField(f) {
  if (f.field === "has" || f.field === "missing") return f.value;
  return f.field;
}

module.exports = async function logsCommand(
  projectCode,
  namespace,
  { level, limit = 50, clear, current, verbose, filter, or: orFilters, include },
) {
  const andFilters = parseFilters(filter);
  const orFiltersParsed = parseFilters(orFilters);
  const extraFields = [
    ...andFilters.map(filterDisplayField),
    ...orFiltersParsed.map(filterDisplayField),
    ...(include || []),
  ].filter((f, i, arr) => !DISPLAY_SKIP.has(f) && arr.indexOf(f) === i);

  const manifestFile = path.join(process.cwd(), "systemview.manifest.json");
  if (!fs.existsSync(manifestFile)) {
    log.warn("No manifest found. Use: systemview connect <serviceId> <url>");
    return;
  }
  const manifest = JSON.parse(fs.readFileSync(manifestFile, "utf8"));
  const allServices = manifest.services || [manifest];

  // Fuzzy resolve: check if the arg matches any module or method name in the manifest
  function isNamespaceArg(arg) {
    if (!arg) return false;
    return allServices.some(({ system }) =>
      (system.connectionData.modules || []).some(({ name, methods }) =>
        name.toLowerCase().includes(arg.toLowerCase()) ||
        (methods || []).some(({ fn }) => fn.toLowerCase().includes(arg.toLowerCase()))
      )
    );
  }

  let effectiveProjectCode = projectCode;
  let effectiveNamespace = namespace;
  if (projectCode && !namespace && isNamespaceArg(projectCode)) {
    effectiveNamespace = projectCode;
    effectiveProjectCode = null;
  }

  const services = allServices.filter((s) =>
    !effectiveProjectCode || !manifest.projectCode || manifest.projectCode === effectiveProjectCode
  );

  if (clear) {
    const confirmed = await promptConfirm("Clear all logs? (y/N) ");
    if (!confirmed) { log.warn("Aborted."); return; }
    for (const { system } of services) {
      try {
        const svc = await Client.loadService(system.connectionData.serviceUrl);
        await svc.SystemView.clearLog();
      } catch {}
    }
    log.success("Logs cleared.");
    return;
  }

  console.log("");
  console.log(chalk.bold("  Streaming logs"));
  console.log("");
  console.log(chalk.dim(`  Services (${services.length}):`));

  let stopped = false;
  const connected = [];
  for (const { serviceId, system } of services) {
    const { serviceUrl } = system.connectionData;
    try {
      const svc = await Client.loadService(serviceUrl);
      svc.SystemView.on("log", (entry) => {
        if (stopped) return;
        if (effectiveNamespace && !(entry.moduleMethod && entry.moduleMethod.includes(effectiveNamespace))) return;
        if (andFilters.length || orFiltersParsed.length) {
          if (!matchesFilters(entry, andFilters, orFiltersParsed)) return;
        }
        if (level && entry.level !== level) return;
        console.log(formatRow(entry, verbose, extraFields));
      });
      console.log(`    ${chalk.green("✓")} ${chalk.cyan(serviceId).padEnd(20)} ${chalk.dim(serviceUrl)}`);
      connected.push({ serviceId, svc });
    } catch {
      console.log(`    ${chalk.red("✗")} ${chalk.cyan(serviceId).padEnd(20)} ${chalk.dim(serviceUrl)} ${chalk.red("(failed to connect)")}`);
    }
  }

  const activeFilters = [];
  if (effectiveNamespace) activeFilters.push(`namespace: ${chalk.white(effectiveNamespace)}`);
  if (level) activeFilters.push(`level: ${chalk.white(level)}`);
  if (andFilters.length) activeFilters.push(`filter: ${chalk.white(andFilters.map((f) => `${f.field}=${f.value}`).join(", "))}`);
  if (orFiltersParsed.length) activeFilters.push(`or: ${chalk.white(orFiltersParsed.map((f) => `${f.field}=${f.value}`).join(", "))}`);
  if (extraFields.length) activeFilters.push(`include: ${chalk.white(extraFields.join(", "))}`);
  if (verbose) activeFilters.push(`verbose: ${chalk.white("on")}`);
  if (activeFilters.length) {
    console.log("");
    console.log(chalk.dim(`  Filters:`));
    activeFilters.forEach((f) => console.log(`    ${chalk.dim(f)}`));
  }
  console.log("");

  if (!connected.length) {
    log.warn("No services connected.");
    return () => {};
  }

  if (current) {
    const allEntries = [];
    for (const { svc } of connected) {
      try {
        let entries = await svc.SystemView.getLog({ limit });
        entries = entries || [];
        if (effectiveNamespace) entries = entries.filter((e) => e.moduleMethod && e.moduleMethod.includes(effectiveNamespace));
        if (andFilters.length || orFiltersParsed.length) entries = entries.filter((e) => matchesFilters(e, andFilters, orFiltersParsed));
        if (level) entries = entries.filter((e) => e.level === level);
        allEntries.push(...entries);
      } catch {}
    }
    if (allEntries.length) {
      console.log(chalk.dim(`  ── current (${allEntries.length}) ──`));
      allEntries.forEach((e) => console.log(formatRow(e, verbose, extraFields)));
      console.log(chalk.dim(`  ── streaming ──`));
    }
  }

  return () => { stopped = true; };
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
