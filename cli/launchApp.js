const log = require("./utils/log");
const { spawn } = require("child_process");
const path = require("path");
const appIsRunning = require("./appIsRunning");
const parentDirectory = path.resolve(__dirname, "..");
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function logConnection(api, app) {
  log("connected!", "success");
  console.log(`SystemView API running @${api}`);
  console.log(`SystemView UI running @${app}`);
}
module.exports = async function launchApp(_port) {
  const port = isNaN(_port) ? 3000 : _port;
  const env = Object.create(process.env);
  const api = `http://localhost:${3300}/systemview/api`;
  const app = `http://localhost:${port}/`;
  env.PORT = port;

  if (await appIsRunning([api, app])) {
    log("SystemView is running from another terminal", "info", "info");
    logConnection(api, app);
    return true;
  } else {
    log("Launching...");

    const appProcess = spawn("node", ["api & node server"], {
      stdio: ["inherit"],
      shell: true,
      env,
      cwd: parentDirectory,
    });

    appProcess.on("close", (code) => {
      console.log(`SystemView APP exited with code ${code}`);
    });
    const shutdown = () => {
      if (appProcess) appProcess.kill();
    };

    await delay(2000);
    const isRunning = await appIsRunning([api, app]);
    if (isRunning) {
      logConnection(api, app);
      return shutdown;
    }
  }
};
