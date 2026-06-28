const { exec } = require("child_process");
const resolveNamespace = require("./utils/resolveNamespace");

module.exports = function openBrowser(url, project_code, namespace, connectedServices) {
  if (!url || typeof url !== "string" || url.trim() === "") {
    console.error("Invalid URL provided");
    return;
  }

  const browserCommand = process.platform === "win32" ? "start" : "open";
  const code = project_code ? "/" + project_code : "";

  if (namespace && connectedServices && connectedServices.length) {
    const matches = resolveNamespace(namespace, connectedServices);
    if (matches.length) {
      matches.forEach(({ serviceId, moduleName, methodName }) => {
        const nsp = `/${serviceId}/${moduleName}/${methodName}`;
        const fullUrl = `${url}${code}${nsp}`;
        console.log(`opening... ${fullUrl}`);
        exec(`${browserCommand} ${fullUrl}`, (error, stdout, stderr) => {
          if (error) console.error(`Failed to open browser: ${error.message}`);
          else if (stderr) console.error(`Failed to open browser: ${stderr}`);
        });
      });
      return;
    }
  }

  const nsp = code && namespace ? "/" + namespace.replace(/\./g, "/") : "";
  console.log(`opening... ${url}${code}${nsp}`);
  exec(`${browserCommand} ${url}${code}${nsp}`, (error, stdout, stderr) => {
    if (error) console.error(`Failed to open browser: ${error.message}`);
    else if (stderr) console.error(`Failed to open browser: ${stderr}`);
    else console.log("Browser opened successfully!");
  });
};
