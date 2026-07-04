const fs = require("fs");
const path = require("path");
const { HttpClient, createClient } = require("systemlynx");
const { createCookieHttpClient } = require("./cookieClient");
const cookieHttpClient = createCookieHttpClient();
const Client = createClient(cookieHttpClient);
const log = require("./logger");

const DEFAULT_MANIFEST = path.join(process.cwd(), "systemview.manifest.json");

async function getUiSvc(uiUrl) {
  try {
    const { SystemView } = await Client.loadService(`${uiUrl}/systemview/api`);
    return SystemView;
  } catch {
    return null;
  }
}

module.exports.save = function saveManifest(manifestServices, manifestFile = DEFAULT_MANIFEST, probeHeaders = {}) {
  if (!manifestServices || !manifestServices.length) {
    log.warn("No services in session to save.");
    return;
  }
  const byProject = {};
  for (const { projectCode, serviceId, system, specList } of manifestServices) {
    if (!byProject[projectCode]) byProject[projectCode] = [];
    byProject[projectCode].push({ serviceId, system, specList });
  }
  const projectCodes = Object.keys(byProject);
  if (projectCodes.length > 1) {
    log.warn("Multiple project codes in session — saving first project only: " + projectCodes[0]);
  }
  const projectCode = projectCodes[0];
  const manifest = {
    projectCode,
    services: byProject[projectCode],
    ...(Object.keys(probeHeaders).length && { probeHeaders }),
  };
  fs.writeFileSync(manifestFile, JSON.stringify(manifest, null, 2));
  log.success(`Manifest saved to ${manifestFile} (${manifest.services.length} service(s))`);
};

module.exports.clean = async function cleanManifest(manifestFile = DEFAULT_MANIFEST) {
  if (!fs.existsSync(manifestFile)) {
    log.warn("No manifest file found at " + manifestFile);
    return;
  }
  let manifest;
  try {
    manifest = JSON.parse(fs.readFileSync(manifestFile, "utf8"));
  } catch {
    log.error("Failed to parse manifest.");
    return;
  }
  const services = manifest.services || [manifest];
  log.info(`Re-probing ${services.length} service(s)...`);
  const alive = [];
  for (const entry of services) {
    const url = entry.system && entry.system.connectionData && entry.system.connectionData.serviceUrl;
    if (!url) continue;
    try {
      await HttpClient.request({ url });
      alive.push(entry);
      log.success(`alive: ${entry.serviceId}`);
    } catch {
      log.warn(`stale: ${entry.serviceId} (removed)`);
    }
  }
  manifest.services = alive;
  fs.writeFileSync(manifestFile, JSON.stringify(manifest, null, 2));
  log.success(`Manifest cleaned. ${alive.length} service(s) remaining.`);
};

module.exports.disconnect = async function disconnect(projectCode, serviceId, { connectedUrls, uiUrl } = {}) {
  if (!projectCode) {
    log.warn("Usage: systemview disconnect <projectCode> [serviceId]");
    return;
  }
  const uiSvc = await getUiSvc(uiUrl);
  if (serviceId) {
    if (uiSvc) {
      try { await uiSvc.deleteService(projectCode, serviceId); } catch {}
    }
    if (connectedUrls) {
      for (const url of connectedUrls) {
        if (url.includes(serviceId)) connectedUrls.delete(url);
      }
    }
    log.success(`Disconnected: ${projectCode} › ${serviceId}`);
  } else {
    if (uiSvc) {
      try { await uiSvc.deleteProject(projectCode); } catch {}
    }
    log.success(`Disconnected project: ${projectCode}`);
  }
};
