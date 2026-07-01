const chalk = require("chalk");
const log = require("./logger");
const { createCookieClient } = require("./cookieClient");

const LEVEL_COLOR = {
  trace: (s) => chalk.dim(s),
  info:  (s) => chalk.white(s),
  warn:  (s) => chalk.yellow(s),
  error: (s) => chalk.red(s),
  debug: (s) => chalk.blue(s),
};

function colorLevel(level) {
  const fn = LEVEL_COLOR[level] || ((s) => s);
  return fn(level.padEnd(5));
}

function formatRow(entry) {
  const time = new Date(entry.timestamp).toLocaleTimeString("en-US", { hour12: false });
  const project = entry.projectCode || "—";
  const service = entry.serviceId || "—";
  const method  = entry.moduleMethod || "—";
  const level   = colorLevel(entry.level || "info");

  if (entry.level === "trace") {
    const dur = entry.data && entry.data.duration != null ? `  ${entry.data.duration}ms` : "";
    return `  ${chalk.dim(time)}  ${chalk.cyan(project)} › ${chalk.cyan(service)}   ${method.padEnd(30)}  ${level}${dur}`;
  } else {
    const msg = entry.message || "";
    return `  ${chalk.dim(time)}  ${chalk.cyan(project)} › ${chalk.cyan(service)}   ${"—".padEnd(30)}  ${level}  ${msg}`;
  }
}

module.exports = async function logsCommand(url, projectCode, serviceId, { level, limit = 50, clear, json }) {
  const api = `${url}/systemview/api`;
  const { SystemView } = await createCookieClient().loadService(api);

  if (clear) {
    const confirmed = await promptConfirm("Clear all logs? (y/N) ");
    if (!confirmed) { log.warn("Aborted."); return; }
    await SystemView.clearLogs();
    log.success("Logs cleared.");
    return;
  }

  const entries = await SystemView.getLogs({ projectCode, serviceId, level, limit });

  if (json) {
    console.log(JSON.stringify(entries, null, 2));
    return;
  }

  if (!entries || entries.length === 0) {
    log.warn("No logs found.");
    return;
  }

  console.log("");
  entries.forEach((entry) => {
    console.log(formatRow(entry));
  });
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
