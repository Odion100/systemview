const fs = require("fs");
const path = require("path");
const { HttpClient, createClient } = require("systemlynx");
const { createCookieHttpClient } = require("./cookieClient");
const { getHeaders } = require("./manifestHeaders");
const cookieHttpClient = createCookieHttpClient();
const Client = createClient(cookieHttpClient);
const log = require("./logger");
const { readFolderManifest, removeServiceFile, manifestDir } = require("./manifestStore");

const DEFAULT_MANIFEST = path.join(process.cwd(), ".systemview", "manifest.json");

async function getUiSvc(uiUrl) {
  try {
    const { SystemView } = await Client.loadService(`${uiUrl}/systemview/api`);
    return SystemView;
  } catch {
    return null;
  }
}

module.exports.save = function saveManifest(manifestServices, manifestFile = DEFAULT_MANIFEST) {
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
  const headers = getHeaders();
  const manifest = {
    projectCode,
    services: byProject[projectCode],
    ...(headers && Object.keys(headers).length && { headers }),
  };
  fs.mkdirSync(path.dirname(manifestFile), { recursive: true });
  fs.writeFileSync(manifestFile, JSON.stringify(manifest, null, 2));
  const headerOrigins = Object.keys(headers || {});
  const cookieOrigins = headerOrigins.filter((o) => headers[o] && headers[o].Cookie);
  const parts = [`${manifest.services.length} service(s)`];
  if (headerOrigins.length) parts.push(`headers for ${headerOrigins.length} origin(s)`);
  if (cookieOrigins.length) parts.push(`cookies for ${cookieOrigins.length} origin(s)`);
  log.success(`Manifest saved to ${manifestFile} — ${parts.join(", ")}`);
};

// RFC-017: re-probe each per-service file under `.systemview/` and DELETE the stale ones (instead of
// rewriting a shared array). Each `<serviceId>.manifest.json` is independent, so pruning is a file unlink.
module.exports.clean = async function cleanManifest() {
  const manifest = readFolderManifest();
  if (!manifest || !manifest.services || !manifest.services.length) {
    log.warn("No per-service manifest files found in " + manifestDir());
    return;
  }
  log.info(`Re-probing ${manifest.services.length} service(s)...`);
  let kept = 0;
  let removed = 0;
  for (const entry of manifest.services) {
    const url = entry.system && entry.system.connectionData && entry.system.connectionData.serviceUrl;
    if (!url) continue;
    try {
      await HttpClient.request({ url });
      kept++;
      log.success(`alive: ${entry.serviceId}`);
    } catch {
      removeServiceFile(entry.serviceId);
      removed++;
      log.warn(`stale: ${entry.serviceId} (removed)`);
    }
  }
  log.success(`Manifest cleaned. ${kept} service(s) remaining, ${removed} removed.`);
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
