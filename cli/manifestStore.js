// RFC-017: the manifest is now per-service files under `.systemview/` (each plugin writes only its own
// `<serviceId>.manifest.json`, so N services starting at once never clobber a shared file). This helper
// globs those files and assembles the same `{ projectCode, services, headers }` shape the CLI has always
// consumed — the folder layout is the contract, mirrored from the plugin's getManifest().

const fs = require("fs");
const path = require("path");

const DEFAULT_DIR = ".systemview";

function manifestDir(cwd = process.cwd()) {
  return path.join(cwd, DEFAULT_DIR);
}

// Assemble the whole-project manifest from `.systemview/*.manifest.json`. Returns null when the folder
// has no per-service files (caller decides what "no manifest" means).
function readFolderManifest(dir = manifestDir()) {
  let files;
  try {
    files = fs.readdirSync(dir).filter((f) => f.endsWith(".manifest.json") && f !== "manifest.json");
  } catch {
    return null; // no folder
  }
  if (!files.length) return null;

  const services = [];
  const headers = {};
  let projectCode;
  for (const f of files) {
    try {
      const entry = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
      if (!entry || !entry.serviceId) continue;
      if (entry.projectCode) projectCode = entry.projectCode;
      if (entry.headers) Object.assign(headers, entry.headers);
      services.push({
        serviceId: entry.serviceId,
        system: entry.system,
        specList: entry.specList,
        credentials: entry.credentials,
      });
    } catch {
      /* skip a torn/partial file — the next read reconciles */
    }
  }
  if (!services.length) return null;
  const manifest = { projectCode, services };
  if (Object.keys(headers).length) manifest.headers = headers;
  return manifest;
}

// Delete a service's per-service file (used by `manifest clean` to drop stale services).
function removeServiceFile(serviceId, dir = manifestDir()) {
  try {
    fs.unlinkSync(path.join(dir, `${serviceId}.manifest.json`));
    return true;
  } catch {
    return false;
  }
}

module.exports = { manifestDir, readFolderManifest, removeServiceFile, DEFAULT_DIR };
