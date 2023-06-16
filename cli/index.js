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
const { spawn } = require("child_process");

const input = cli.input;
const flags = cli.flags;
const { clear, debug } = flags;

(async () => {
  init({ clear });
  if (input.includes(`help`)) {
    cli.showHelp(0);
  }
  if (input.includes("start")) {
    // Start React app
    log("Launching SystemView UI...");
    const reactAppProcess = spawn("npm", ["start"], {
      stdio: ["ignore", "ignore", "ignore"],
      shell: true,
    });

    reactAppProcess.on("close", (code) => {
      console.log(`React app exited with code ${code}`);
    });
  } else if (input.includes("test")) {
    // Run tests
  }

  debug && log(flags);
})();
