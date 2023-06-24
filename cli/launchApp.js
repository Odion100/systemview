const log = require("./utils/log");
const appIsRunning = require("./appIsRunning");
const launchSystemView = require("../api");
const startLineReader = require("./startLineReader");

module.exports = async function launchApp(port) {
  const ui = `http://localhost:${port}`;
  const api = `${ui}/systemview/api`;
  function logConnection() {
    log("connected!", "success");
    console.log(`SystemView UI running @${ui}`);
    console.log(`SystemView API running @${api}`);
  }

  if (await appIsRunning(api)) {
    log("SystemView is running from another terminal", "info", "info");
    logConnection();
  } else {
    log("Launching...");
    await launchSystemView(port);
    logConnection();
    return startLineReader(ui);
  }
};
