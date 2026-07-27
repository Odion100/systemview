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
const { readFolderManifest } = require("./manifestStore");
const probe = require("./probe");
const logsCommand = require("./logs");
const stageCmd = require("./stage");
// Surgical story pane-ops → the storyOp verb they map to.
const STORY_OPS = { "story-add": "add", "story-rm": "rm", "story-move": "move", "story-edit": "edit", "story-layout": "layout", "story-rename": "rename", "story-delete": "delete" };
const { createClient } = require("systemlynx");
const { createCookieHttpClient } = require("./cookieClient");
const cookieHttpClient = createCookieHttpClient();
const Client = createClient(cookieHttpClient);
const { setCaseSensitive } = require("./utils/matchNamespace");
const toggle = require("./toggle");

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

const connectedUrls = new Set();

async function loadManifest() {
  // RFC-017: services come from the per-service files under `.systemview/`, assembled on read. An
  // explicit `--manifest <path>` still points at a single combined file (e.g. a saved snapshot).
  let manifest = null;
  if (flags.manifest) {
    try { manifest = JSON.parse(fs.readFileSync(flags.manifest, "utf8")); } catch {}
  } else {
    manifest = readFolderManifest();
  }
  if (!manifest || !manifest.services || !manifest.services.length) return;
  try {
    const { projectCode } = manifest;
    const services = manifest.services;
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

// Load the sticky case-sensitivity setting (persisted on the UI, default insensitive) into the
// namespace matcher before a namespace command resolves. Change it with the `toggle` command
// (`toggle cs` / `toggle ci`, or bare `cs`/`ci`) — see cli/toggle.js.
async function loadCaseSetting() {
  const NS_CMDS = ["test", "list", "logs", "log", "open"];
  if (!NS_CMDS.includes(input[0])) return;
  try {
    await launchApp(DEFAULT_PORT); // idempotent — ensure the UI is up so the setting reads
    const { CLI } = await Client.loadService(`${UI_URL}/systemview/api`);
    const settings = await CLI.getSettings();
    setCaseSensitive(settings.caseSensitive);
  } catch {
    setCaseSensitive(false); // UI down / older server → default insensitive
  }
}

(async () => {
  if (process.argv.includes("--version") || process.argv.includes("-v")) {
    console.log(VERSION);
    flushAndExit(0);
  }

  init();
  await loadCaseSetting();

  const command = input[0];

  if (command === "open") {
    await open();
  } else if (command === "toggle" || ["cs", "ci", "case-sensitive", "case-insensitive"].includes(command)) {
    await launchApp(DEFAULT_PORT);
    let CLI = null;
    try { ({ CLI } = await Client.loadService(`${UI_URL}/systemview/api`)); } catch {}
    // Raw token after "toggle" — a `--cs`-style arg is stripped from meow's `input`.
    const toggleArg =
      command === "toggle" ? process.argv[process.argv.indexOf("toggle") + 1] : command;
    await toggle(CLI, toggleArg);
    flushAndExit(0);
  } else if (command === "list") {
    await list();
  } else if (command === "help" || input.includes("help")) {
    showHelp();
  } else if (command === "test") {
    await startTest();
  } else if (["exit", "q", "shutdown", "stop"].includes(command)) {
    await quitApp();
  } else if (command === "connect") {
    await connectService(input[1], {
      useManifest: flags.useManifest,
      save: process.argv.includes("--save"),
      force: flags.force,
      connectedUrls,
      uiUrl: UI_URL,
    });
    // --save-session: opt in to cross-process session persistence. Records the policy in the manifest
    // so a later `probe` that captures a Set-Cookie (e.g. a sign-in) saves it for the next probe to
    // reuse. Saving is implied — no manifest yet? one is created; an existing one is amended.
    if (flags.saveSession) {
      const { setSessionPolicy } = require("./manifestHeaders");
      const policy = setSessionPolicy({ save: true });
      if (policy) log.success("session persistence enabled — a captured sign-in cookie will be saved for later probes");
      else log.warn("could not write the session policy to the manifest");
    }
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
      await manifestCommands.clean();
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
      saveSession: flags.saveSession,
      global: flags.global,
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
      highlight: flags.highlight,
      save: flags.save,
      saved: flags.saved,
      saveLimit: flags.saveLimit,
    });
    if (!flags.follow) flushAndExit(0);
  } else if (["show", "assemble", "stage", "highlight", "view", "selection", "story", "stories"].includes(command) || STORY_OPS[command]) {
    // RFC-018 AI Window — drive the open UI's stage. Needs the UI up (that's what renders the stage).
    await launchApp(DEFAULT_PORT);
    const opts = {
      uiUrl: UI_URL,
      json: flags.json,
      file: flags.file, source: flags.source, text: flags.text, diff: flags.diff, test: flags.test,
      paneSeq: flags.paneSeq,
      lines: flags.lines, match: flags.match, layout: flags.layout, ns: flags.ns, note: flags.note,
      at: flags.at, from: flags.from, to: flags.to,
    };
    let exitCode = 0;
    if (STORY_OPS[command]) exitCode = await stageCmd.storyOp(STORY_OPS[command], input[1], input[2], opts); // story-add/rm/move/edit/layout/rename/delete <target> <name>
    else if (command === "show") exitCode = await stageCmd.show(input[1], opts);
    else if (command === "assemble") exitCode = await stageCmd.assemble(input[1], opts);
    else if (command === "highlight") exitCode = await stageCmd.highlight(input[1], opts);
    else if (command === "view") exitCode = await stageCmd.view(input[1], input[2], input[3], opts); // view <sub> <target> <name>
    else if (command === "selection") exitCode = await stageCmd.selection(input[1], opts);
    else if (command === "story") exitCode = await stageCmd.story(input[1], input[2], opts); // story <target> <name>
    else if (command === "stories") exitCode = await stageCmd.stories(input[1], opts); // stories <target>
    else exitCode = await stageCmd.stage(input[1], input[2], opts); // stage <add|clear> <target>
    flushAndExit(exitCode || 0);
  } else {
    await startApp();
  }
})();
