#!/usr/bin/env node

/**
 * SystemView
 * A documentation and testing suite for SystemLynx
 *
 * @author Odion Edwards <none>
 */
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
const openBrowser = require("./openBrowser");
const init = require("./utils/init");
const cli = require("./utils/cli");
const log = require("./utils/log");

const launchApp = require("./launchApp");
const runTests = require("./runTests");
const appIsRunning = require("./appIsRunning");
const { HttpClient } = require("systemlynx");

const input = cli.input;
const flags = cli.flags;
const { clear, debug } = flags;
const DEFAULT_PORT = 3000;

async function startApp() {
  const port = isNaN(input[1]) ? DEFAULT_PORT : input[1];
  try {
    await launchApp(port);
  } catch (error) {
    log("Launch failed:" + error.message, "error");
    console.log(error);
  }
}

async function startTest() {
  const api = `http://localhost:${DEFAULT_PORT}/systemview/api`;
  input.shift();
  try {
    const lineReader = await launchApp(DEFAULT_PORT);
    setTimeout(async () => {
      await runTests(api, ...input);
      if (lineReader) lineReader.prompt();
    }, 0);
  } catch (error) {
    console.error("Error executing tests:", error.message);
  }
}

async function open() {
  const port = isNaN(input[1]) ? DEFAULT_PORT : input[1];
  const ui = `http://localhost:${DEFAULT_PORT}`;
  const api = `${ui}/systemview/api`;
  if (await appIsRunning(api)) {
    openBrowser(ui);
    process.exit(0);
  } else {
    await launchApp(port);
    openBrowser(ui);
  }
}
async function quitApp() {
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
  if (input[0] === "open") {
    open();
  } else if (input.includes(`help`)) {
    cli.showHelp(0);
  } else if (input.includes("test")) {
    startTest();
  } else if (["exit", "q", "shutdown"].includes(input[0])) {
    quitApp();
  } else if (input[0] === "start") {
    startApp();
  } else {
    await startApp();
  }
  cli.input = [];
  debug && log(flags);
})();
