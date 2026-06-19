const log = require("./logger");
const appIsRunning = require("./appIsRunning");
const launchSystemView = require("../api");
const startLineReader = require("./startLineReader");

module.exports = async function launchApp(port, { interactive = false } = {}) {
  const ui = `http://localhost:${port}`;
  const api = `${ui}/systemview/api`;

  function logConnection() {
    log.success("connected!");
    console.log(`  SystemView UI  → ${ui}`);
    console.log(`  SystemView API → ${api}\n`);
  }

  if (await appIsRunning(api)) {
    if (interactive) {
      log.info("SystemView is running from another terminal");
      logConnection();
    }
    return;
  }

  if (interactive) log.info("Launching...");
  await launchSystemView(port);
  logConnection();

  if (interactive) {
    return startLineReader(ui);
  }
};
