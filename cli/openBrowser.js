const { exec } = require("child_process");

module.exports = function openBrowser(url, project_code, namespace) {
  if (!url || typeof url !== "string" || url.trim() === "") {
    console.error("Invalid URL provided");
    return;
  }

  const browserCommand = process.platform === "win32" ? "start" : "open";
  const code = project_code ? "/" + project_code : "";
  const nsp = code && namespace ? "/" + namespace.replace(/\./g, "/") : "";
  console.log(`opening... ${url}${code}${nsp}`);
  exec(`${browserCommand} ${url}${code}${nsp}`, (error, stdout, stderr) => {
    if (error) {
      console.error(`Failed to open browser: ${error.message}`);
    } else if (stderr) {
      console.error(`Failed to open browser: ${stderr}`);
    } else {
      console.log("Browser opened successfully!");
    }
  });
};
