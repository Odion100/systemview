const { exec } = require("child_process");

module.exports = function openBrowser(url) {
  if (!url || typeof url !== "string" || url.trim() === "") {
    console.error("Invalid URL provided");
    return;
  }

  const browserCommand = process.platform === "win32" ? "start" : "open";

  exec(`${browserCommand} ${url}`, (error, stdout, stderr) => {
    if (error) {
      console.error(`Failed to open browser: ${error.message}`);
    } else if (stderr) {
      console.error(`Failed to open browser: ${stderr}`);
    } else {
      console.log("Browser opened successfully!");
    }
  });
};
