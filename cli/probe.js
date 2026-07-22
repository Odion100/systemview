const fs = require("fs");
const path = require("path");
const { createClient } = require("systemlynx");
const { createCookieHttpClient } = require("./cookieClient");
const { takeNotices, persist, readSessionPolicy, setSessionPolicy, setManifestFile } = require("./manifestHeaders");
const log = require("./logger");

const cookieHttpClient = createCookieHttpClient();
const Client = createClient(cookieHttpClient);

module.exports = async function probe(namespace, argsStr, { json = false, manifest: manifestPath, headers: cliHeaders = {}, uiUrl, saveSession = false } = {}) {
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

  // Repoint the WHOLE header store at an explicit --manifest <path> up front — so the cookie is both
  // persisted to AND re-attached from the same manifest (load/capture/persist/policy all share it).
  // No-op without --manifest (stays on the cwd manifest). Must run before any service call below.
  const manifestFile = setManifestFile(manifestPath);
  // `--save-session` on a probe turns the persistence policy ON at call time (not just via `connect`) —
  // set it before the request so this same call's captured cookie is persisted below. Writes to the
  // resolved manifest (honors --manifest).
  if (saveSession) setSessionPolicy({ save: true }, manifestFile);

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
    // Persist any session captured on this call (e.g. a sign-in's Set-Cookie) so the NEXT probe
    // reuses it — the fix for "captured but never saved," which forced sessions to die per-process.
    // Gated by the manifest's opt-in `session.save` policy (set via `connect ... --save-session`);
    // without it, a read-only or one-off probe leaves the manifest untouched (the safe default).
    if (readSessionPolicy(manifestFile).save) persist(manifestFile);
    if (json) {
      process.stdout.write(JSON.stringify({ serviceId, moduleName, methodName, args, result }, null, 2) + "\n");
    } else {
      log.success("result:");
      console.log(JSON.stringify(result, null, 2));
      takeNotices().forEach((n) => log.info(n));
    }
    return 0;
  } catch (err) {
    if (json) {
      process.stdout.write(JSON.stringify({ serviceId, moduleName, methodName, args, error: err.message }, null, 2) + "\n");
    } else {
      log.error(err.message);
      takeNotices().forEach((n) => log.info(n));
    }
    return 1;
  }
};
