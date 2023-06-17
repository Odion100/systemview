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
const path = require("path");

const parentDirectory = path.resolve(__dirname, "..");

const input = cli.input;
const flags = cli.flags;
const { clear, debug } = flags;

function startApp() {
  // Start React app
  const arg = parseInt();
  const port = isNaN(arg) ? 3000 : arg;
  const env = Object.create(process.env);
  env.PORT = port;
  log(`Launching SystemView UI @http://localhost:${port}/`);
  const AppProcess = spawn("node", ["server"], {
    stdio: ["inherit"],
    shell: true,
    env,
    cwd: parentDirectory,
  });

  AppProcess.on("close", (code) => {
    console.log(`React app exited with code ${code}`);
  });
}

function startApi() {
  log(`Launching SystemView API @http://localhost:${3300}/systemview/api`);

  const AppProcess = spawn("node", ["api"], {
    stdio: ["inherit"],
    shell: true,
    cwd: parentDirectory,
  });

  AppProcess.on("close", (code) => {
    console.log(`React app exited with code ${code}`);
  });
}
(async () => {
  init({ clear });
  if (input.includes(`help`)) {
    cli.showHelp(0);
  }
  if (input[0] === "start") {
    startApi();
    startApp();
  } else if (input.includes("test")) {
    // Run tests
  }

  debug && log(flags);
})();
