const log = require("./utils/log");
const appIsRunning = require("./appIsRunning");
const launchSystemView = require("../api");
const startLineReader = require("./startLineReader");

function logConnection(api) {
  log("connected!", "success");
  console.log(`SystemView UI running @${api}`);
  console.log(`SystemView API running @${api}/systemview/api`);
}
module.exports = async function launchApp(port) {
  const api = `http://localhost:${port}/systemview/api`;
  if (await appIsRunning(api)) {
    log("SystemView is running from another terminal", "info", "info");
    logConnection(api);
  } else {
    log("Launching...");
    await launchSystemView(port);
    logConnection(api);
  }
};
