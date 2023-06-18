#!/usr/bin/env node

/**
 * SystemView
 * A documentation and testing suite for SystemLynx
 *
 * @author Odion Edwards <none>
 */

const init = require("./utils/init");
const cli = require("./utils/cli");
const log = require("./utils/log");

const launchApp = require("./launchApp");
const startLineReader = require("./startLineReader");
const runTests = require("./runTests");

const input = cli.input;
const flags = cli.flags;
const { clear, debug } = flags;

(async () => {
  init({ clear });
  if (input.includes(`help`)) {
    cli.showHelp(0);
  } else if (input.includes("test")) {
    if (await launchApp()) await runTests(input[1]);
  } else {
    const shutdown = await launchApp();
    if (typeof shutdown === "function") startLineReader(shutdown);
  }

  cli.input = [];
  debug && log(flags);
})();
