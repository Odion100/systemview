const fs = require("fs");
const path = require("path");
const chalk = require("chalk");
const log = require("./logger");
const { createClient } = require("systemlynx");
const { createCookieHttpClient } = require("./cookieClient");
const cookieHttpClient = createCookieHttpClient();
const Client = createClient(cookieHttpClient);
const resolveTarget = require("./utils/resolveTarget");
const { matchNamespace } = require("./utils/matchNamespace");

// Namespace match against a log entry's full Service.Module.method path (honoring the case mode), so
// bare service names ("Profiles"), dotted paths ("Posts.add"), and method names ("signUp") all filter.
const nsMatch = (entry, ns) =>
  matchNamespace(`${entry.serviceId || ""}.${entry.moduleMethod || ""}`, ns);

const DEFAULT_SNAPSHOT = "systemview-snapshot.ndjson";

const LEVEL_COLOR = {
  trace: (s) => chalk.dim(s),
  log: (s) => chalk.white(s),
  warn: (s) => chalk.yellow(s),
  error: (s) => chalk.red(s),
  debug: (s) => chalk.blue(s),
};

function colorLevel(level) {
  const fn = LEVEL_COLOR[level] || ((s) => s);
  return fn((level || "log").padEnd(5));
}

const SKIP_KEYS = new Set([
  "timestamp",
  "projectCode",
  "serviceId",
  "module",
  "method",
  "moduleMethod",
  "traceId",
  "level",
  "scope",
  "duration",
]);

function formatRow(entry, verbose, extraFields, highlighted) {
  const d = new Date(entry.timestamp);
  const time =
    d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) +
    " " +
    d.toLocaleTimeString("en-US", { hour12: false });
  const project = entry.projectCode || "—";
  const service = entry.serviceId || "—";
  const method = entry.moduleMethod || "—";
  const level = colorLevel(entry.level);
  const msg = highlighted ? chalk.bgYellow.black(entry.scope || "") : entry.scope || "";
  const dur = entry.duration != null ? chalk.dim(` ${entry.duration}ms`) : "";
  const traceId = chalk.dim(entry.traceId || "—");
  // Highlight (RFC-011): a left gutter marker keeps every row but flags matches (filter's twin).
  const gutter = highlighted ? chalk.bgYellow.black(" ► ") : "  ";
  let row = `${gutter}${chalk.dim(time)}  ${chalk.cyan(project)} › ${chalk.cyan(service)}   ${method.padEnd(15)}  ${level}  ${traceId}  ${msg}${dur}`;
  if (extraFields && extraFields.length) {
    const parts = extraFields.map(
      (p) => `${chalk.dim(p + ":")} ${cellStr(getAtPath(entry, p))}`,
    );
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

const DISPLAY_SKIP = new Set([
  "timestamp",
  "projectCode",
  "serviceId",
  "module",
  "method",
  "moduleMethod",
  "traceId",
  "level",
  "scope",
  "duration",
]);

function filterDisplayField(f) {
  if (f.field === "has" || f.field === "missing") return f.value;
  return f.field;
}

function appendSnapshot(filePath, entry, saveLimit) {
  try {
    let lines = [];
    if (fs.existsSync(filePath)) {
      lines = fs.readFileSync(filePath, "utf8").split("\n").filter(Boolean);
    }
    lines.push(JSON.stringify(entry));
    if (lines.length > saveLimit) lines = lines.slice(lines.length - saveLimit);
    fs.writeFileSync(filePath, lines.join("\n") + "\n");
  } catch {}
}

module.exports = async function logsCommand(
  projectCode,
  namespace,
  {
    uiUrl,
    level,
    limit = 300,
    clear,
    current,
    follow,
    verbose,
    filter,
    or: orFilters,
    include,
    highlight,
    json,
    save,
    saved,
    saveLimit = 500,
  },
) {
  const andFilters = parseFilters(filter);
  const orFiltersParsed = parseFilters(orFilters);
  const highlightClauses = parseFilters(highlight);
  const isHighlighted = (entry) =>
    highlightClauses.length > 0 && matchesFilters(entry, [], highlightClauses);
  const extraFields = [
    ...andFilters.map(filterDisplayField),
    ...orFiltersParsed.map(filterDisplayField),
    ...highlightClauses.map(filterDisplayField),
    ...(include || []),
  ].filter((f, i, arr) => !DISPLAY_SKIP.has(f) && arr.indexOf(f) === i);

  const savePath =
    save && typeof save === "string"
      ? path.resolve(process.cwd(), save)
      : path.resolve(process.cwd(), DEFAULT_SNAPSHOT);

  const printEntry = (entry) => {
    if (json) {
      console.log(JSON.stringify(entry));
      return;
    }
    console.log(formatRow(entry, verbose, extraFields, isHighlighted(entry)));
  };

  // --saved: read local snapshot, no live streaming
  if (saved) {
    if (!fs.existsSync(savePath)) {
      log.warn(`No snapshot found at: ${savePath}`);
      return;
    }
    let entries = [];
    try {
      entries = fs
        .readFileSync(savePath, "utf8")
        .split("\n")
        .filter(Boolean)
        .map((l) => JSON.parse(l));
    } catch (err) {
      log.error("Failed to read snapshot: " + err.message);
      return;
    }
    if (namespace)
      entries = entries.filter(
        (e) => nsMatch(e, namespace),
      );
    if (andFilters.length || orFiltersParsed.length)
      entries = entries.filter((e) => matchesFilters(e, andFilters, orFiltersParsed));
    if (level) entries = entries.filter((e) => e.level === level);
    entries = entries.slice(-limit);
    console.log("");
    console.log(chalk.bold(`  Snapshot: ${savePath}  (${entries.length} entries)`));
    console.log("");
    entries.forEach(printEntry);
    return;
  }

  let services = [];
  let effectiveNamespace = namespace;

  try {
    const { SystemView } = await Client.loadService(`${uiUrl}/systemview/api`);

    {
      const resolved = await resolveTarget(SystemView, projectCode);
      services = resolved.services;
      if (resolved.resolvedNamespace && !namespace) effectiveNamespace = resolved.resolvedNamespace;
      if (projectCode && !services.length) {
        log.warn(`No services found for: ${projectCode}`);
        return;
      }
    }
  } catch (err) {
    log.error("Failed to connect to SystemView: " + err.message);
    return;
  }

  if (!services.length) {
    log.warn("No services in store. Use: systemview connect <url>");
    return;
  }

  if (clear) {
    const confirmed = await promptConfirm("Clear all logs? (y/N) ");
    if (!confirmed) {
      log.warn("Aborted.");
      return;
    }
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

  const connected = [];
  for (const { serviceId, system } of services) {
    const { serviceUrl } = system.connectionData;
    try {
      const svc = await Client.loadService(serviceUrl);
      const unsub = svc.SystemView.on("log", (entry) => {
        if (
          effectiveNamespace &&
          !nsMatch(entry, effectiveNamespace)
        )
          return;
        if (andFilters.length || orFiltersParsed.length) {
          if (!matchesFilters(entry, andFilters, orFiltersParsed)) return;
        }
        if (level && entry.level !== level) return;
        if (save) appendSnapshot(savePath, entry, saveLimit);
        printEntry(entry);
        if (queryUrl && !json && entry.traceId) {
          const sep = queryUrl.includes("?") ? "&" : "?";
          console.log(`      ${chalk.dim(queryUrl + sep + "traceId=" + encodeURIComponent(entry.traceId))}`);
        }
        console.log("");
      });
      console.log(
        `    ${chalk.green("✓")} ${chalk.cyan(serviceId).padEnd(20)} ${chalk.dim(serviceUrl)}`,
      );
      connected.push({ serviceId, svc, unsub });
    } catch {
      console.log(
        `    ${chalk.red("✗")} ${chalk.cyan(serviceId).padEnd(20)} ${chalk.dim(serviceUrl)} ${chalk.red("(failed to connect)")}`,
      );
    }
  }

  if (save) {
    console.log(chalk.dim(`  Snapshot: ${savePath}  (limit ${saveLimit})`));
  }

  const activeFilters = [];
  if (effectiveNamespace)
    activeFilters.push(`namespace: ${chalk.white(effectiveNamespace)}`);
  if (level) activeFilters.push(`level: ${chalk.white(level)}`);
  if (andFilters.length)
    activeFilters.push(
      `filter: ${chalk.white(andFilters.map((f) => `${f.field}=${f.value}`).join(", "))}`,
    );
  if (orFiltersParsed.length)
    activeFilters.push(
      `or: ${chalk.white(orFiltersParsed.map((f) => `${f.field}=${f.value}`).join(", "))}`,
    );
  if (highlightClauses.length)
    activeFilters.push(
      `highlight: ${chalk.bgYellow.black(highlightClauses.map((f) => `${f.field}=${f.value}`).join(", "))}`,
    );
  if (extraFields.length)
    activeFilters.push(`include: ${chalk.white(extraFields.join(", "))}`);
  if (verbose) activeFilters.push(`verbose: ${chalk.white("on")}`);
  const queryUrl = uiUrl ? buildLogsUrl(uiUrl, { projectCode, effectiveNamespace, level, andFilters, orFilters }) : null;

  if (activeFilters.length) {
    console.log("");
    console.log(chalk.dim(`  Filters:`));
    activeFilters.forEach((f) => console.log(`    ${chalk.dim(f)}`));
  }
  if (queryUrl && !json) {
    console.log("");
    console.log(`  ${chalk.dim("UI:")} ${chalk.cyan(queryUrl)}`);
  }
  console.log("");

  if (!connected.length) {
    log.warn("No services connected.");
    return () => {};
  }

  if (current) {
    const allEntries = [];
    // Each service owns its own log file (systemview.<serviceId>.logs), so getLog returns only that
    // service's records — merging across services just concatenates distinct sets, no duplication.
    for (const { svc } of connected) {
      try {
        let entries = await svc.SystemView.getLog({ limit });
        entries = entries || [];
        if (effectiveNamespace)
          entries = entries.filter(
            (e) => nsMatch(e, effectiveNamespace),
          );
        if (andFilters.length || orFiltersParsed.length)
          entries = entries.filter((e) => matchesFilters(e, andFilters, orFiltersParsed));
        if (level) entries = entries.filter((e) => e.level === level);
        allEntries.push(...entries);
      } catch {}
    }
    if (allEntries.length) {
      console.log(chalk.dim(`  ── current (${allEntries.length}) ──`));
      allEntries.forEach((entry) => {
        printEntry(entry);
        if (queryUrl && !json && entry.traceId) {
          const sep = queryUrl.includes("?") ? "&" : "?";
          console.log(`      ${chalk.dim(queryUrl + sep + "traceId=" + encodeURIComponent(entry.traceId))}`);
        }
        console.log("");
      });
    }

    if (!follow) {
      connected.forEach(({ unsub }) => unsub());
      return () => {};
    }
    console.log(chalk.dim(`  ── streaming ──`));
  }

  return () => {
    connected.forEach(({ unsub }) => unsub());
  };
};

// The standalone /logs page is gone — logs now live in the Specs page's per-namespace Logs tab. Build a
// link INTO that: /specs/<projectCode>/<serviceId>/<moduleName>/<methodName>?tab=logs. The specs route is
// POSITIONAL, so we only extend the path when the namespace is a full service.module.method (3+ parts); a
// fuzzy 1–2 part namespace can't be placed reliably, so it falls back to the project-level Logs tab.
function buildLogsUrl(uiUrl, { projectCode, effectiveNamespace }) {
  const segs = [projectCode].filter(Boolean);
  const nsParts =
    effectiveNamespace && effectiveNamespace !== projectCode
      ? effectiveNamespace.split(".").filter(Boolean)
      : [];
  if (nsParts.length >= 3) {
    segs.push(nsParts[0], nsParts[1], nsParts.slice(2).join("."));
  }
  const path = "/specs/" + segs.map(encodeURIComponent).join("/");
  return `${uiUrl}${path}?tab=logs`;
}

function promptConfirm(question) {
  return new Promise((resolve) => {
    process.stdout.write(question);
    process.stdin.setEncoding("utf8");
    process.stdin.once("data", (data) => {
      resolve(data.trim().toLowerCase() === "y");
    });
  });
}
