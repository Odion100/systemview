const { readFolderManifest, removeServiceFile } = require("./manifestStore");
const log = require("./logger");

// RFC-027 — the boot HOSTING unit, deliberately separate from loadManifest (discovery): it reads
// the same folder manifest but acts only on `hosted` entries, asking the hub to stand each one up
// from its committed folder. Runs BEFORE loadManifest so the hosted service's fresh registration
// exists before discovery probes anything, and before the boot announces the UI (t1's rule:
// configs are read and validated before anything is presented). Idempotent — the hub answers an
// already-hosted folder with its live registration.
module.exports = async function hostConfiguredProjects(Client, uiUrl) {
  const manifest = readFolderManifest();
  if (!manifest || !manifest.services) return;
  const entries = manifest.services.filter((s) => s.hosted);
  if (!entries.length) return;

  let SystemView;
  try {
    ({ SystemView } = await Client.loadService(`${uiUrl}/systemview/api`));
  } catch (err) {
    log.warn(`hosting skipped — hub unreachable: ${err.message}`);
    return;
  }
  // Folder is the unit (one folder = one service); several entries can share one when a serviceId
  // was renamed and a stale manifest file lingers — de-dupe so the hub is asked once per folder.
  const folders = [...new Set(entries.map((e) => e.hosted))];
  for (const folder of folders) {
    try {
      const r = await SystemView.hostProject({ projectDir: process.cwd(), folder });
      log.info(
        `  ${r.projectCode}.${r.serviceId} — hosted @ ${r.serviceUrl} (${(r.modules || []).join(", ")})`,
      );
    } catch (err) {
      const msg = (err && err.message) || String(err);
      // THE FOLDER IS THE STATE: if it's gone, the project was deleted — prune the stale
      // registration (manifest file + store entry) instead of warning about it forever.
      if (/hosted folder not found/.test(msg)) {
        for (const e of entries.filter((s) => s.hosted === folder)) {
          removeServiceFile(e.serviceId);
          try { await SystemView.deleteService(e.projectCode, e.serviceId); } catch {}
        }
        log.warn(`  ${folder}/ is gone — hosted registration removed`);
      } else {
        log.warn(`  hosting failed for ${folder}/: ${msg}`);
      }
    }
  }
};
