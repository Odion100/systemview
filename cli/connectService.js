const fs = require("fs");
const path = require("path");
const { HttpClient, createClient } = require("systemlynx");
const { createCookieHttpClient } = require("./cookieClient");
const cookieHttpClient = createCookieHttpClient();
const Client = createClient(cookieHttpClient);
const log = require("./logger");

async function probeService(url) {
  const connectionData = await HttpClient.request({ url });
  if (!connectionData.SystemLynxService) {
    throw new Error(`No SystemLynx service found at ${url}`);
  }
  const client = Client.createService(connectionData);
  const connection = await client.Plugin.getConnection();
  return connection; // { projectCode, serviceId, system, specList }
}

function readManifest(manifestFile) {
  if (!fs.existsSync(manifestFile)) return null;
  try {
    return JSON.parse(fs.readFileSync(manifestFile, "utf8"));
  } catch {
    return null;
  }
}

function writeManifest(manifestFile, connection) {
  const manifest = readManifest(manifestFile) || { projectCode: connection.projectCode, services: [] };
  if (!manifest.services) manifest.services = [];
  const entry = { serviceId: connection.serviceId, system: connection.system, specList: connection.specList };
  const idx = manifest.services.findIndex((s) => s.serviceId === connection.serviceId);
  if (idx > -1) manifest.services[idx] = entry;
  else manifest.services.push(entry);
  manifest.projectCode = connection.projectCode;
  fs.writeFileSync(manifestFile, JSON.stringify(manifest, null, 2));
}

module.exports = async function connectService(serviceId, url, { manifest: manifestPath } = {}) {
  const manifestFile = manifestPath || path.join(process.cwd(), "systemview.manifest.json");

  if (!url) {
    // Re-probe all services already in the manifest
    const manifest = readManifest(manifestFile);
    if (!manifest || !manifest.services || !manifest.services.length) {
      log.warn("No manifest found. Use: systemview connect <serviceId> <url>");
      return;
    }
    log.info(`Re-probing ${manifest.services.length} service(s)...`);
    for (const { serviceId: id, system } of manifest.services) {
      try {
        const connection = await probeService(system.connectionData.serviceUrl);
        writeManifest(manifestFile, connection);
        log.success(`${id} updated`);
      } catch (err) {
        log.error(`${id} failed: ${err.message}`);
      }
    }
    printManifestSummary(readManifest(manifestFile));
    return;
  }

  log.info(`Connecting to ${serviceId || "service"} @ ${url}...`);
  try {
    const connection = await probeService(url);
    writeManifest(manifestFile, connection);
    printManifestSummary(readManifest(manifestFile));
  } catch (err) {
    log.error(`Connection failed: ${err.message}`);
  }
};

function printManifestSummary(manifest) {
  if (!manifest) return;
  log.plain(`\n  Project: ${manifest.projectCode}`);
  log.plain(`  Services:`);
  (manifest.services || []).forEach(({ serviceId, system }) => {
    log.plain(`    - ${serviceId} @ ${system.connectionData.serviceUrl}`);
  });
  log.plain("");
}
