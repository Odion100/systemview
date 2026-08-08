const runTests = require("./runTests");
const listTests = require("./listTests");
const connectService = require("./connectService");
const manifestCommands = require("./manifest");
const probe = require("./probe");
const openBrowser = require("./openBrowser");
const logsCommand = require("./logs");
const stageCmd = require("./stage");
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

  // Tokenizing + flag parsing are the SHARED cli.tokenize / cli.parseArgs — ONE pipeline for interactive
  // AND one-shot, so a flag added once works in both (they used to drift; that's how --save-session died
  // here). `parts` keeps the raw tokens for the toggle raw-arg path; positional/flags come from the parser.
  const handleInput = async (line = "") => {
    const parts = cli.tokenize(line.trim());
    const command = parts[0];
    if (!command) { lineReader.prompt(); return; }
    const { input, flags } = cli.parseArgs(parts);
    const positional = input.slice(1);

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
        await probe(positional[0], positional[1], { json: flags.json, headers: flags.headers, uiUrl: url, saveSession: flags.saveSession, global: flags.global });
      } catch (e) { console.error(e.message); }
      lineReader.prompt();
    } else if (command === "open") {
      openBrowser(url, positional[0], positional[1]);
      lineReader.prompt();
    } else if (["show", "assemble", "stage", "highlight", "view", "selection"].includes(command)) {
      // RFC-018 AI Window — drive THIS session's UI stage live from the REPL.
      const opts = {
        uiUrl: url, json: flags.json,
        file: flags.file, source: flags.source, text: flags.text, diff: flags.diff, test: flags.test,
        paneSeq: flags.paneSeq,
        lines: flags.lines, match: flags.match, layout: flags.layout,
      };
      try {
        if (command === "show") await stageCmd.show(positional[0], opts);
        else if (command === "assemble") await stageCmd.assemble(positional[0], opts);
        else if (command === "highlight") await stageCmd.highlight(positional[0], opts);
        else if (command === "view") await stageCmd.view(positional[0], positional[1], positional[2], opts);
        else if (command === "selection") await stageCmd.selection(positional[0], opts);
        else await stageCmd.stage(positional[0], positional[1], opts);
      } catch (e) { console.error(e.message); }
      lineReader.prompt();
    } else if (command === "init") {
      // RFC-027 — init from inside the session: same interview, sharing THIS line reader
      // (rl.question consumes the answer lines, so they never reach this handler).
      try {
        const initProject = require("./initProject");
        await initProject({ uiUrl: url, Client, rl: lineReader });
      } catch (e) { console.error(e.message); }
      lineReader.prompt();
    } else if (command === "delete") {
      // RFC-027 — init's opposite (hosted projects only), y/N confirmed on this same reader.
      try {
        const deleteHosted = require("./deleteHosted");
        await deleteHosted(positional[0], { uiUrl: url, Client, rl: lineReader, force: flags.force });
      } catch (e) { console.error(e.message); }
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
