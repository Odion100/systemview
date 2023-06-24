#!/usr/bin/env node

/**
 * SystemView
 * A documentation and testing suite for SystemLynx
 *
 * @author Odion Edwards <none>
 */
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
const init = require("./utils/init");
const cli = require("./utils/cli");
const log = require("./utils/log");

const launchApp = require("./launchApp");
const runTests = require("./runTests");
const appIsRunning = require("./appIsRunning");
const { HttpClient } = require("systemlynx");
const startLineReader = require("./startLineReader");

const input = cli.input;
const flags = cli.flags;
const { clear, debug } = flags;
const DEFAULT_PORT = 3000;

async function startApp(input = []) {
  const port = isNaN(input[1]) ? DEFAULT_PORT : input[1];
  const api = `http://localhost:${port}/systemview/api`;
  try {
    await launchApp(port);
    return startLineReader(api);
  } catch (error) {
    log("Launch failed:" + error.message, "error");
    console.log(error);
  }
}

async function startTest(input = []) {
  const api = `http://localhost:${DEFAULT_PORT}/systemview/api`;
  input.shift();
  try {
    const lineReader = await startApp();
    setTimeout(async () => {
      await runTests(api, ...input);
      lineReader.prompt();
    }, 0);
  } catch (error) {
    console.error("Error executing tests:", error.message);
  }
}

async function quitApp(input = []) {
  const port = isNaN(input[1]) ? DEFAULT_PORT : input[1];
  const api = `http://localhost:${port}/systemview/api`;

  if (await appIsRunning(api)) {
    log("SystemView is running from another terminal", "info", "info");
    log("Attempting remote shutdown...", "info", "info");

    const url = `${api}/SystemView/shutdown`;
    const method = "put";
    HttpClient.request({ url, method })
      .then(() => console.log("SystemView shutdown successful!"))
      .catch(async (error) => {
        if (await appIsRunning(api)) {
          log("Remote shutdown failed!", "error", "error");
          console.error(error);
        } else {
          console.log("SystemView shutdown successful!");
        }
      });
  } else {
    log(`SystemView instance not found @${api}`, "warning", "warning");
    console.log("Please include the port if default port is not being used:");
    log("systemview shutdown 4000", "info", "example");
  }
}

(async () => {
  init({ clear });
  if (input.includes(`help`)) {
    cli.showHelp(0);
  } else if (input.includes("test")) {
    startTest(input);
  } else if (["exit", "q", "shutdown"].includes(input[0])) {
    quitApp(input);
  } else if (input[0] === "start") {
    startApp();
  } else {
    startApp();
  }
  cli.input = [];
  debug && log(flags);
})();
