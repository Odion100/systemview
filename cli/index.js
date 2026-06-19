#!/usr/bin/env node

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const { input, flags, showHelp } = require("./utils/cli");
const init = require("./utils/init");
const log = require("./logger");
const launchApp = require("./launchApp");
const runTests = require("./runTests");
const appIsRunning = require("./appIsRunning");
const openBrowser = require("./openBrowser");
const connectService = require("./connectService");
const probe = require("./probe");
const { HttpClient } = require("systemlynx");

const DEFAULT_PORT = 3000;

async function startApp() {
  const port = isNaN(input[1]) ? DEFAULT_PORT : Number(input[1]);
  try {
    await launchApp(port, { interactive: true });
  } catch (error) {
    log.error("Launch failed: " + error.message);
  }
}

async function startTest() {
  const project_code = input[1];
  const namespace = input[2];
  const url = `http://localhost:${DEFAULT_PORT}`;
  try {
    await launchApp(DEFAULT_PORT);
    const exitCode = await runTests(url, project_code, namespace, {
      json: flags.json,
      verbose: flags.verbose,
      manifest: flags.manifest,
      headers: flags.headers,
    });
    process.exit(exitCode);
  } catch (error) {
    log.error("Error executing tests: " + error.message);
    process.exit(1);
  }
}

async function open() {
  const project_code = input[1];
  const namespace = input[2];
  const ui = `http://localhost:${DEFAULT_PORT}`;
  const api = `${ui}/systemview/api`;
  if (!(await appIsRunning(api))) {
    await launchApp(DEFAULT_PORT);
  }
  openBrowser(ui, project_code, namespace);
  process.exit(0);
}

async function quitApp() {
  const port = isNaN(input[1]) ? DEFAULT_PORT : Number(input[1]);
  const api = `http://localhost:${port}/systemview/api`;

  if (await appIsRunning(api)) {
    log.info("Attempting remote shutdown...");
    const url = `${api}/SystemView/shutdown`;
    try {
      await HttpClient.request({ url, method: "put" });
      log.success("SystemView shutdown successful!");
      process.exit(0);
    } catch (error) {
      if (!(await appIsRunning(api))) {
        log.success("SystemView shutdown successful!");
        process.exit(0);
      } else {
        log.error("Remote shutdown failed!");
        process.exit(1);
      }
    }
  } else {
    log.warn(`No SystemView instance found @ ${api}`);
    process.exit(0);
  }
}

(async () => {
  init();
  const command = input[0];

  if (command === "open") {
    await open();
  } else if (command === "help" || input.includes("help")) {
    showHelp();
  } else if (command === "test") {
    await startTest();
  } else if (["exit", "q", "shutdown", "stop"].includes(command)) {
    await quitApp();
  } else if (command === "connect") {
    await connectService(input[1], input[2], { manifest: flags.manifest });
    process.exit(0);
  } else if (command === "probe") {
    const exitCode = await probe(input[1], input[2], { json: flags.json, manifest: flags.manifest, headers: flags.headers });
    process.exit(exitCode || 0);
  } else {
    await startApp();
  }
})();
