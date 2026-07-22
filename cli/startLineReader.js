const runTests = require("./runTests");
const listTests = require("./listTests");
const connectService = require("./connectService");
const manifestCommands = require("./manifest");
const probe = require("./probe");
const openBrowser = require("./openBrowser");
const logsCommand = require("./logs");
const log = require("./logger");
const cli = require("./utils/cli");
const readline = require("readline");
const { createClient } = require("systemlynx");
const { createCookieHttpClient } = require("./cookieClient");
const Client = createClient(createCookieHttpClient());
const { setCaseSensitive } = require("./utils/matchNamespace");
const toggle = require("./toggle");

module.exports = async function startLineReader(url, { connectedUrls = new Set() } = {}) {
  const lineReader = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  let CLI = null;
  try {
    ({ CLI } = await Client.loadService(`${url}/systemview/api`));
    const history = await CLI.getHistory();
    lineReader.history = [...history].reverse();
    try {
      const settings = await CLI.getSettings();
      setCaseSensitive(settings.caseSensitive);
      log.info(
        `Namespace matching: ${settings.caseSensitive ? "case-SENSITIVE" : "case-insensitive"}   (toggle: cs / ci)`,
      );
    } catch {}
  } catch {}

  let stopLogs = null;

  const parseArgs = (args) => {
    const flags = { filter: [], or: [], include: [], highlight: [], skip: [], headers: {} };
    const positional = [];
    for (let i = 0; i < args.length; i++) {
      if (args[i] === "--level" && args[i + 1]) { flags.level = args[++i]; }
      else if (args[i] === "--limit" && args[i + 1]) { flags.limit = parseInt(args[++i], 10); }
      else if (args[i] === "--filter" && args[i + 1]) { flags.filter.push(args[++i]); }
      else if (args[i] === "--or" && args[i + 1]) { flags.or.push(args[++i]); }
      else if (args[i] === "--include" && args[i + 1]) { flags.include.push(args[++i]); }
      else if (args[i] === "--highlight" && args[i + 1]) { flags.highlight.push(args[++i]); }
      else if (args[i] === "--skip" && args[i + 1]) { flags.skip.push(args[++i]); }
      else if (args[i] === "--phase" && args[i + 1]) { flags.phase = args[++i]; }
      else if (args[i] === "--index" && args[i + 1]) { flags.index = parseInt(args[++i], 10); }
      else if (args[i] === "--header" && args[i + 1]) {
        const val = args[++i];
        const colonIdx = val.indexOf(":");
        if (colonIdx !== -1) flags.headers[val.slice(0, colonIdx).trim()] = val.slice(colonIdx + 1).trim();
      }
      else if (args[i] === "--verbose") { flags.verbose = true; }
      else if (args[i] === "--current") { flags.current = true; }
      else if (args[i] === "--follow" || args[i] === "-f") { flags.follow = true; }
      else if (args[i] === "--clear") { flags.clear = true; }
      else if (args[i] === "--json") { flags.json = true; }
      else if (args[i] === "--bail") { flags.bail = true; }
      else if (args[i] === "--dry-run") { flags.dryRun = true; }
      else if (args[i] === "--force") { flags.force = true; }
      else if (args[i] === "--manifest") { flags.useManifest = true; }
      else if (args[i] === "--saved") { flags.saved = true; }
      else if (args[i] === "--save" && args[i + 1] && !args[i + 1].startsWith("-")) { flags.save = args[++i]; }
      else if (args[i] === "--save") { flags.save = true; }
      else if (args[i] === "--save-limit" && args[i + 1]) { flags.saveLimit = parseInt(args[++i], 10); }
      else if (!args[i].startsWith("-")) { positional.push(args[i]); }
    }
    return { flags, positional };
  };

  const handleInput = async (input = "") => {
    const parts = input.trim().split(/\s+/);
    const command = parts[0];
    if (!command) { lineReader.prompt(); return; }
    const { flags, positional } = parseArgs(parts.slice(1));

    if (["exit", "q"].includes(command)) {
      process.exit(0);
    } else if (["stop", "shutdown"].includes(command)) {
      const api = `${url}/systemview/api`;
      try {
        const { SystemView } = await Client.loadService(api);
        await SystemView.shutdown();
      } catch {}
      const appIsRunning = require("./appIsRunning");
      if (!(await appIsRunning(api))) {
        log.success("SystemView stopped.");
        process.exit(0);
      } else {
        log.error("Shutdown failed.");
        lineReader.prompt();
      }
    } else if (command === "test") {
      try {
        await runTests(url, positional[0], positional[1], {
          headers: flags.headers,
          json: flags.json,
          verbose: flags.verbose,
          bail: flags.bail,
          dryRun: flags.dryRun,
          phase: flags.phase,
          index: flags.index,
          skip: flags.skip,
        });
      } catch (e) { console.error(e.message); }
      lineReader.prompt();
    } else if (command === "list") {
      try {
        await listTests(url, positional[0], positional[1], {
          connectedUrls,
          verbose: flags.verbose,
        });
      } catch (e) { console.error(e.message); }
      lineReader.prompt();
    } else if (command === "toggle") {
      // parts[1] (raw) not positional[0] — a `--cs`-style arg gets eaten by the flag parser.
      try { await toggle(CLI, parts[1]); } catch (e) { console.error(e.message); }
      lineReader.prompt();
    } else if (["cs", "ci", "case-sensitive", "case-insensitive"].includes(command)) {
      try { await toggle(CLI, command); } catch (e) { console.error(e.message); }
      lineReader.prompt();
    } else if (command === "logs") {
      if (stopLogs) { stopLogs(); stopLogs = null; }
      logsCommand(positional[0], positional[1], {
        ...flags,
        uiUrl: url,
      }).then((stop) => { if (stop) stopLogs = stop; });
    } else if (command === "stoplogs" || command === "unsubscribe") {
      if (stopLogs) { stopLogs(); stopLogs = null; log.success("Log streaming stopped."); }
      else { log.warn("No active log stream."); }
      lineReader.prompt();
    } else if (command === "clearlogs" || command === "flush") {
      if (stopLogs) { stopLogs(); stopLogs = null; }
      logsCommand(null, null, { clear: true, uiUrl: url });
      lineReader.prompt();
    } else if (command === "connect") {
      try {
        await connectService(positional[0], {
          useManifest: flags.useManifest,
          force: flags.force,
          connectedUrls,
          uiUrl: url,
        });
      } catch (e) { console.error(e.message); }
      lineReader.prompt();
    } else if (command === "disconnect") {
      try {
        await manifestCommands.disconnect(positional[0], positional[1], {
          connectedUrls,
          uiUrl: url,
        });
      } catch (e) { console.error(e.message); }
      lineReader.prompt();
    } else if (command === "manifest") {
      const sub = positional[0];
      try {
        if (sub === "save") {
          manifestCommands.save(undefined, undefined, {});
        } else if (sub === "clean") {
          await manifestCommands.clean();
        } else {
          console.log("  Usage: manifest <save|clean>");
        }
      } catch (e) { console.error(e.message); }
      lineReader.prompt();
    } else if (command === "probe") {
      try {
        await probe(positional[0], positional[1], { json: flags.json, headers: flags.headers, uiUrl: url });
      } catch (e) { console.error(e.message); }
      lineReader.prompt();
    } else if (command === "open") {
      openBrowser(url, positional[0], positional[1]);
      lineReader.prompt();
    } else if (command === "help") {
      cli.showHelp(false);
      lineReader.prompt();
    } else {
      lineReader.prompt();
    }
  };

  lineReader.prompt();
  lineReader.on("line", async (input) => {
    const trimmed = input.trim();
    if (trimmed && CLI) {
      try { await CLI.saveHistory(trimmed); } catch {}
    }
    handleInput(trimmed);
  });
  lineReader.on("close", () => process.exit(0));
  return lineReader;
};
