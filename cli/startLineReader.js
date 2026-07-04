const runTests = require("./runTests");
const cli = require("./utils/cli");
const openBrowser = require("./openBrowser");
const logsCommand = require("./logs");
const readline = require("readline");

module.exports = function startLineReader(url) {
  const lineReader = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  let stopLogs = null;

  const handleInput = (input = "") => {
    const parts = input.trim().split(/\s+/);
    const command = parts[0];
    const args = parts.slice(1);

    const flags = { filter: [], or: [], include: [] };
    const positional = [];
    for (let i = 0; i < args.length; i++) {
      if (args[i] === "--level" && args[i + 1]) { flags.level = args[++i]; }
      else if (args[i] === "--limit" && args[i + 1]) { flags.limit = parseInt(args[++i], 10); }
      else if (args[i] === "--filter" && args[i + 1]) { flags.filter.push(args[++i]); }
      else if (args[i] === "--or" && args[i + 1]) { flags.or.push(args[++i]); }
      else if (args[i] === "--include" && args[i + 1]) { flags.include.push(args[++i]); }
      else if (args[i] === "--verbose") { flags.verbose = true; }
      else if (args[i] === "--current") { flags.current = true; }
      else if (args[i] === "--json") { flags.json = true; }
      else if (!args[i].startsWith("--")) { positional.push(args[i]); }
    }

    if (["exit", "q", "shutdown", "stop"].includes(command)) {
      process.exit(0);
    } else if (command === "test") {
      try { runTests(url, positional[0], positional[1]); } catch (e) { console.error(e.message); }
      lineReader.prompt();
    } else if (command === "logs") {
      if (stopLogs) { stopLogs(); stopLogs = null; }
      logsCommand(positional[0], positional[1], { ...flags, current: flags.current })
        .then((stop) => { if (stop) stopLogs = stop; });
    } else if (command === "clearlogs" || command === "flush") {
      if (stopLogs) { stopLogs(); stopLogs = null; }
      logsCommand(null, null, { clear: true });
    } else if (command === "help") {
      cli.showHelp(0);
    } else if (command === "open") {
      openBrowser(url, positional[0], positional[1]);
      lineReader.prompt();
    } else {
      lineReader.prompt();
    }
  };

  lineReader.prompt();
  lineReader.on("line", handleInput);
  lineReader.on("close", () => process.exit(0));
  return lineReader;
};
