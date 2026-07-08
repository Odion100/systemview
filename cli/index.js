#!/usr/bin/env node

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const fs = require("fs");
const path = require("path");
const { input, flags, showHelp } = require("./utils/cli");
const init = require("./utils/init");
const log = require("./logger");
const launchApp = require("./launchApp");
const runTests = require("./runTests");
const listTests = require("./listTests");
const appIsRunning = require("./appIsRunning");
const openBrowser = require("./openBrowser");
const connectService = require("./connectService");
const manifestCommands = require("./manifest");
const probe = require("./probe");
const logsCommand = require("./logs");
const { createClient } = require("systemlynx");
const { createCookieHttpClient } = require("./cookieClient");
const cookieHttpClient = createCookieHttpClient();
const Client = createClient(cookieHttpClient);

const DEFAULT_PORT = 3000;
const VERSION = require("../package.json").version;
const UI_URL = `http://localhost:${DEFAULT_PORT}`;

// process.exit() truncates buffered stdout when stdout is a pipe (agents/CI, and large `--json`
// output). Drain stdout + stderr first, then exit — otherwise big results get cut off mid-stream.
function flushAndExit(code = 0) {
  let pending = 2;
  const done = () => {
    if (--pending === 0) process.exit(code);
  };
  process.stdout.write("", done);
  process.stderr.write("", done);
}

const MANIFEST_FILE =
  flags.manifest || path.join(process.cwd(), "systemview.manifest.json");
const connectedUrls = new Set();

async function loadManifest() {
  if (!fs.existsSync(MANIFEST_FILE)) return;
  try {
    const manifest = JSON.parse(fs.readFileSync(MANIFEST_FILE, "utf8"));
    const { projectCode } = manifest;
    const services = manifest.services || [manifest];
    log.info(`Reading manifest: ${projectCode} — ${services.length} service(s)`);
    const api = `http://localhost:${DEFAULT_PORT}/systemview/api`;
    const { SystemView } = await Client.loadService(api);
    await Promise.all(
      services.map(async ({ system, serviceId, specList }) => {
        if (!system || !system.connectionData) return;
        const alive = await appIsRunning(system.connectionData.serviceUrl);
        if (alive) {
          Client.createService(system.connectionData);
          connectedUrls.add(system.connectionData.serviceUrl);
          try { await SystemView.connect({ system, projectCode, serviceId, specList }); } catch {}
        }
        log.info(`  ${serviceId || system.connectionData.serviceUrl} — ${alive ? "live" : "offline"}`);
      }),
    );
  } catch (err) {
    log.warn("Failed to read manifest: " + err.message);
  }
}

async function startApp() {
  const port = isNaN(input[1]) ? DEFAULT_PORT : Number(input[1]);
  try {
    await launchApp(port, { interactive: true, connectedUrls, onReady: loadManifest });
  } catch (error) {
    log.error("Launch failed: " + error.message);
  }
}

async function startTest() {
  const project_code = input[1];
  const namespace = input[2];
  try {
    await launchApp(DEFAULT_PORT);
    await loadManifest();
    const exitCode = await runTests(UI_URL, project_code, namespace, {
      json: flags.json,
      verbose: flags.verbose,
      headers: flags.headers,
      bail: flags.bail,
      dryRun: flags.dryRun,
      phase: flags.phase,
      index: flags.index,
      skip: flags.skip,
    });
    flushAndExit(exitCode);
  } catch (error) {
    log.error("Error executing tests: " + error.message);
    flushAndExit(1);
  }
}

async function list() {
  const project_code = input[1];
  const namespace = input[2];
  const api = `${UI_URL}/systemview/api`;
  if (!(await appIsRunning(api))) {
    await launchApp(DEFAULT_PORT);
  }
  await listTests(UI_URL, project_code, namespace, {
    connectedUrls,
    verbose: flags.verbose,
    json: flags.json,
  });
  flushAndExit(0);
}

async function open() {
  const project_code = input[1];
  const namespace = input[2];
  const api = `${UI_URL}/systemview/api`;
  if (!(await appIsRunning(api))) {
    await launchApp(DEFAULT_PORT);
  }

  let connectedServices = [];
  if (namespace && project_code) {
    try {
      const { SystemView } = await Client.loadService(api);
      connectedServices = (await SystemView.getServices(project_code)) || [];
    } catch {}
  }

  openBrowser(UI_URL, project_code, namespace, connectedServices);
  flushAndExit(0);
}

async function quitApp() {
  const port = isNaN(input[1]) ? DEFAULT_PORT : Number(input[1]);
  const api = `http://localhost:${port}/systemview/api`;

  if (await appIsRunning(api)) {
    log.info("Attempting remote shutdown...");
    try {
      const { SystemView } = await Client.loadService(api);
      await SystemView.shutdown();
    } catch {}
    if (!(await appIsRunning(api))) {
      log.success("SystemView shutdown successful!");
    } else {
      log.error("Remote shutdown failed!");
      flushAndExit(1);
    }
  } else {
    log.warn(`No SystemView instance found @ ${api}`);
  }
  flushAndExit(0);
}

(async () => {
  if (process.argv.includes("--version") || process.argv.includes("-v")) {
    console.log(VERSION);
    flushAndExit(0);
  }

  init();

  const command = input[0];

  if (command === "open") {
    await open();
  } else if (command === "list") {
    await list();
  } else if (command === "help" || input.includes("help")) {
    showHelp();
  } else if (command === "test") {
    await startTest();
  } else if (["exit", "q", "shutdown", "stop"].includes(command)) {
    await quitApp();
  } else if (command === "connect") {
    const useManifest = process.argv.includes("--manifest");
    await connectService(input[1], {
      useManifest,
      save: process.argv.includes("--save"),
      force: flags.force,
      connectedUrls,
      uiUrl: UI_URL,
    });
    flushAndExit(0);
  } else if (command === "disconnect") {
    await manifestCommands.disconnect(input[1], input[2], {
      connectedUrls,
      uiUrl: UI_URL,
    });
    flushAndExit(0);
  } else if (command === "manifest") {
    const sub = input[1];
    if (sub === "save") {
      log.warn("manifest save requires an interactive session. Run: systemview start");
    } else if (sub === "clean") {
      await manifestCommands.clean(MANIFEST_FILE);
    } else {
      log.warn("Usage: systemview manifest <save|clean>");
    }
    flushAndExit(0);
  } else if (command === "probe") {
    await launchApp(DEFAULT_PORT);
    const exitCode = await probe(input[1], input[2], {
      json: flags.json,
      manifest: flags.manifest,
      headers: flags.headers,
      uiUrl: UI_URL,
    });
    flushAndExit(exitCode || 0);
  } else if (command === "logs" || command === "log") {
    await launchApp(DEFAULT_PORT);
    await logsCommand(input[1], input[2], {
      uiUrl: UI_URL,
      level: flags.level,
      limit: flags.limit,
      clear: flags.clear,
      json: flags.json,
      current: flags.current,
      follow: flags.follow,
      verbose: flags.verbose,
      filter: flags.filter,
      or: flags.or,
      include: flags.include,
      save: flags.save,
      saved: flags.saved,
      saveLimit: flags.saveLimit,
    });
    if (!flags.follow) flushAndExit(0);
  } else {
    await startApp();
  }
})();
