const fs = require("fs");
const path = require("path");
const readline = require("readline");
const log = require("./logger");
const appIsRunning = require("./appIsRunning");
const { readFolderManifest, removeServiceFile } = require("./manifestStore");

// RFC-027 — `systemview delete <projectCode>`: init's OPPOSITE, and it only applies to projects
// made on the fly (hosted from a committed folder). It unhosts, removes the registration and the
// store entry, and removes the FOLDER itself — after a y/N confirm (EOF/anything-but-y = no).
// Everything else is a connection, not a deletable project: `disconnect` is the verb for those.
module.exports = async function deleteHosted(projectCode, { uiUrl, Client, rl: sharedRl = null, force = false } = {}) {
  if (!projectCode) {
    log.warn("Usage: systemview delete <projectCode>   (an init-made project)");
    return 1;
  }
  const manifest = readFolderManifest();
  const entry =
    manifest &&
    (manifest.services || []).find(
      (s) => s.hosted && (s.projectCode === projectCode || s.hosted === projectCode),
    );
  if (!entry) {
    log.warn(
      `"${projectCode}" is not an init-made (hosted) project here — for plain connections use: systemview disconnect ${projectCode}`,
    );
    return 1;
  }
  const dir = path.resolve(process.cwd(), entry.hosted);
  // The folder came from the manifest, but it still must be INSIDE this repo before an rm -rf.
  if (dir === process.cwd() || !dir.startsWith(process.cwd() + path.sep)) {
    log.error(`refusing to delete "${dir}" — not a folder inside this project`);
    return 1;
  }

  if (!force) {
    const rl =
      sharedRl || readline.createInterface({ input: process.stdin, output: process.stdout });
    const answer = await new Promise((resolve) => {
      let done = false;
      const settle = (v) => {
        if (done) return;
        done = true;
        rl.removeListener("close", onClose);
        resolve(v);
      };
      const onClose = () => settle("n");
      rl.once("close", onClose);
      rl.question(
        `  Delete ${entry.hosted}/ — the folder, its methods and specs? (y/N): `,
        (a) => settle(a.trim().toLowerCase()),
      );
    });
    if (!sharedRl) rl.close();
    if (!["y", "yes"].includes(answer)) {
      log.info("nothing deleted");
      return 0;
    }
  }

  // A running hub does the full job (unhost + registration + store + folder); with no hub the
  // local cleanup covers the folder and registration, and boot pruning handles the rest.
  const api = `${uiUrl}/systemview/api`;
  if (await appIsRunning(api)) {
    try {
      const { SystemView } = await Client.loadService(api);
      const r = await SystemView.hostedOp({ projectCode: entry.projectCode, op: "deleteProject" });
      log.success(`deleted ${r.folder}/ — ${r.projectCode}.${r.serviceId} unhosted and removed`);
      return 0;
    } catch (err) {
      log.warn(`hub delete failed (${(err && err.message) || err}) — deleting locally`);
    }
  }
  try {
    fs.rmSync(dir, { recursive: true, force: true });
  } catch (err) {
    log.error(`could not remove ${dir}: ${err.message}`);
    return 1;
  }
  removeServiceFile(entry.serviceId);
  log.success(`deleted ${entry.hosted}/ and its registration`);
  return 0;
};
