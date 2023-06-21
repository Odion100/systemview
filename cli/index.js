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

const input = cli.input;
const flags = cli.flags;
const { clear, debug } = flags;
const DEFAULT_PORT = 3000;
async function launch(_port) {
  const port = isNaN(_port) ? DEFAULT_PORT : _port;
  try {
    await launchApp(port);
  } catch (error) {
    log("Launch failed:" + error.message, "error");
    console.log(error);
  }
}
(async () => {
  init({ clear });
  if (input.includes(`help`)) {
    cli.showHelp(0);
  } else if (input.includes("test")) {
    const api = `http://localhost:${DEFAULT_PORT}/systemview/api`;
    try {
      input.shift();
      if (await appIsRunning(api)) {
        await runTests(api, ...input);
      } else {
        await launch();
        await runTests(api, ...input);
      }
    } catch (error) {
      console.error("Error executing tests:", error.message);
    }
  } else if (["exit", "q", "shutdown"].includes(input[0])) {
    const port = isNaN(input[1]) ? DEFAULT_PORT : input[1];
    const api = `http://localhost:${port}/systemview/api`;
    if (await appIsRunning(api)) {
      const url = `${api}/SystemView/shutdown`;
      const method = "put";
      log("SystemView is running from another terminal", "info", "info");
      log("Attempting remote shutdown...", "info", "info");
      HttpClient.request({ url, method })
        .then(() => console.log("SystemView shutdown successful!"))
        .catch(async (error) => {
          if (await appIsRunning(api)) {
            log("Remote shutdown failed!", "error", "error");
          } else {
            console.log("SystemView shutdown successful!");
          }
        });
    } else {
      log(`SystemView instance not found @${api}`, "warning", "warning");
      console.log("Please include the port if default port is not being used:");
      log("systemview shutdown 4000", "info", "example");
    }
  } else if (input[0] === "start") {
    launch(input[1]);
  } else {
    launch();
  }

  cli.input = [];
  debug && log(flags);
})();
