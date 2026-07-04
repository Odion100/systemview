const fs = require("fs");
const path = require("path");
const { createClient } = require("systemlynx");
const { createCookieHttpClient } = require("./cookieClient");
const log = require("./logger");

const cookieHttpClient = createCookieHttpClient();
const Client = createClient(cookieHttpClient);

module.exports = async function probe(namespace, argsStr, { json = false, manifest: manifestPath, headers: cliHeaders = {}, uiUrl } = {}) {
  if (!namespace) {
    log.error("Usage: systemview probe <ServiceId.Module.method> [args]");
    return 1;
  }

  const parts = namespace.split(".");
  if (parts.length !== 3) {
    log.error("Namespace must be in format: ServiceId.Module.method");
    return 1;
  }

  const [serviceId, moduleName, methodName] = parts;

  let args = [];
  if (argsStr) {
    try {
      const parsed = JSON.parse(argsStr);
      args = Array.isArray(parsed) ? parsed : [parsed];
    } catch {
      args = [argsStr];
    }
  }

  let service = null;

  // Try UI server first
  if (uiUrl) {
    try {
      const { SystemView } = await Client.loadService(`${uiUrl}/systemview/api`);
      const projects = await SystemView.getProjects();
      const all = Object.values(projects).flat();
      service = all.find((s) => s.serviceId === serviceId);
    } catch {}
  }

  // Fall back to manifest file
  if (!service) {
    const manifestFile = manifestPath || path.join(process.cwd(), "systemview.manifest.json");
    if (!fs.existsSync(manifestFile)) {
      log.error(`Service "${serviceId}" not found. Connect it first with: systemview connect <url>`);
      return 1;
    }
    let manifest;
    try {
      manifest = JSON.parse(fs.readFileSync(manifestFile, "utf8"));
    } catch (err) {
      log.error(`Failed to read manifest: ${err.message}`);
      return 1;
    }
    const services = manifest.services || [manifest];
    service = services.find((s) => s.serviceId === serviceId);
    if (!service) {
      log.error(`Service "${serviceId}" not found in manifest`);
      return 1;
    }
  }

  if (!json) log.info(`${serviceId}.${moduleName}.${methodName}(${argsStr || ""})`);

  try {
    const client = Client.createService(service.system.connectionData);
    if (Object.keys(cliHeaders).length) client.setHeaders(cliHeaders);
    const result = await client[moduleName][methodName](...args);
    if (json) {
      process.stdout.write(JSON.stringify({ serviceId, moduleName, methodName, args, result }, null, 2) + "\n");
    } else {
      log.success("result:");
      console.log(JSON.stringify(result, null, 2));
    }
    return 0;
  } catch (err) {
    if (json) {
      process.stdout.write(JSON.stringify({ serviceId, moduleName, methodName, args, error: err.message }, null, 2) + "\n");
    } else {
      log.error(err.message);
    }
    return 1;
  }
};
