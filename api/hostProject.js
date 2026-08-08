const fs = require("fs");
const path = require("path");
const net = require("net");
const { createApp } = require("systemlynx");

// RFC-027 — the hub HOSTS a real service for a codebase with none. The committed folder (named by
// the project code) holds the whole thing: service.json + methods/ (one file per module — the
// filename IS the module name, the exported object IS the module) + specs/. This unit reads that
// folder, stands up a SystemLynx app inside the hub's process, and applies the full systemview-plugin
// pointed at the TARGET repo — so a hosted service gets the identical surface a plugin-run service
// has (docs, tests, actions, logs, stories, file providers) and registers through the same
// connect() door, flagged `hosted`.
//
// Hosting is its OWN unit (his t5 separation-of-concerns catch): discovery (loadManifest) stays
// pure; the CLI's boot hosting step and `systemview init` both land here via SystemView.hostProject.

const plugin = require("../systemview-plugin");
// A second Connections instance over the SAME connections.json — only for confirming a hosted
// service's registration landed before hostProject resolves (callers like `systemview test` list
// tests immediately after; resolving on `ready` alone races the plugin's async connect()).
const ConnectedServices = require("./Connections")();

// One live entry per hosted folder: `${projectDir}|${folder}` → { app, config, port, watchers }.
const hosting = new Map();

function getFreePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.unref();
    srv.on("error", reject);
    srv.listen(0, () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
  });
}

// Config → validated shape, or a thrown error with a message worth reading. Runs BEFORE anything
// is hosted or announced (his t1 rule: a broken config surfaces at boot, not as a dead card later).
function validateProject(projectDir, folder) {
  const dir = path.resolve(projectDir, folder);
  if (!fs.existsSync(dir)) throw new Error(`hosted folder not found: ${dir}`);
  const configPath = path.join(dir, "service.json");
  let config;
  try {
    config = JSON.parse(fs.readFileSync(configPath, "utf8"));
  } catch (err) {
    throw new Error(`unreadable ${configPath}: ${err.message}`);
  }
  if (!config.serviceId || typeof config.serviceId !== "string")
    throw new Error(`${configPath} needs a "serviceId"`);
  const methodsDir = path.join(dir, "methods");
  let files;
  try {
    files = fs.readdirSync(methodsDir).filter((f) => /\.(js|cjs)$/.test(f));
  } catch {
    throw new Error(`no methods/ folder in ${dir}`);
  }
  if (!files.length) throw new Error(`no module files in ${methodsDir}`);
  return { dir, configPath, config, methodsDir, files };
}

// require each module file FRESH (cache-busted) — a re-host serves the saved code, not the cached
// export. The filename is the module name; the exported object is served as-is.
function loadModules(methodsDir, files) {
  const modules = {};
  for (const f of files) {
    const abs = path.join(methodsDir, f);
    try {
      delete require.cache[require.resolve(abs)];
    } catch {}
    let mod;
    try {
      mod = require(abs);
    } catch (err) {
      throw new Error(`${abs} failed to load: ${err.message}`);
    }
    if (!mod || (typeof mod !== "object" && typeof mod !== "function"))
      throw new Error(`${abs} must export an object of methods (module.exports = { ... })`);
    modules[path.basename(f).replace(/\.(js|cjs)$/, "")] = mod;
  }
  return modules;
}

module.exports = function createHostProject(hubPort = 3000) {
  const hubUrl = `http://localhost:${hubPort}/systemview/api`;

  async function startHosted(projectDir, folder, port) {
    const { dir, config, methodsDir, files } = validateProject(projectDir, folder);
    // The folder's NAME is the project code — a renamed project self-labels (RFC-027 t8).
    const projectCode = path.basename(dir);
    const serviceId = config.serviceId;
    const usePort = port || Number(config.port) || (await getFreePort());

    const app = createApp();
    const modules = loadModules(methodsDir, files);
    Object.entries(modules).forEach(([name, mod]) => app.module(name, mod));
    app.use(
      plugin({
        connection: hubUrl,
        specs: path.join(dir, "specs"),
        root: projectDir,
        projectCode,
        serviceId,
        hosted: folder,
      }),
    );
    app.startService({ route: `${serviceId.toLowerCase()}/api`, port: usePort, host: "localhost" });
    const system = await new Promise((resolve, reject) => {
      app.on("ready", resolve);
      // A port collision or a throwing module constructor otherwise hangs the boot silently.
      setTimeout(() => reject(new Error(`hosting ${projectCode}.${serviceId} timed out`)), 15000);
    });
    return {
      app,
      projectCode,
      serviceId,
      port: usePort,
      dir,
      methodsDir,
      serviceUrl: system && system.connectionData ? system.connectionData.serviceUrl : `http://localhost:${usePort}/${serviceId.toLowerCase()}/api`,
      moduleNames: Object.keys(modules),
    };
  }

  // ONE serialized re-host per entry (close → start on the SAME port): the watcher and the UI's
  // module operations both land here, chained on entry.busy so overlapping triggers can't race the
  // port. The fresh registration carries new methods/modules into connectionData, so a saved
  // function appears in the nav without a hub restart.
  function rehost(key, entry) {
    entry.busy = (entry.busy || Promise.resolve()).then(async () => {
      if (hosting.get(key) !== entry) return;
      try {
        await new Promise((r) => entry.live.app.close(r));
      } catch {}
      try {
        const live = await startHosted(entry.projectDir, entry.folder, entry.live.port);
        entry.live = live;
      } catch (err) {
        hosting.delete(key);
        entry.watchers.forEach((w) => { try { w.close(); } catch {} });
        // THE FOLDER IS THE STATE: deleting it IS deleting the project. Clean the registration
        // (manifest file) and the store entry, or the dead service haunts the nav and every boot
        // retries a folder that isn't coming back. A broken module file (folder still there) only
        // unhosts — fix the file and re-host by saving.
        if (!fs.existsSync(entry.live.dir)) {
          try {
            fs.unlinkSync(
              path.join(entry.projectDir, ".systemview", `${entry.live.serviceId}.manifest.json`),
            );
          } catch {}
          try {
            ConnectedServices.deleteService(entry.live.projectCode, entry.live.serviceId);
          } catch {}
          console.log(
            `[SystemView]: ${entry.live.projectCode} — folder deleted, service unhosted and deregistered\n`,
          );
        } else {
          console.log(`[SystemView]: re-host failed for ${entry.folder}: ${err.message}\n`);
        }
        throw err;
      }
    });
    // Swallow for chaining (a failed re-host unhosts and logs); callers who care await the returned
    // promise and get the rejection.
    const result = entry.busy;
    entry.busy = entry.busy.catch(() => {});
    return result;
  }

  // The save-watcher: a change in methods/ or service.json re-hosts. Debounced; convenience, not
  // mechanism.
  function watch(key, entry) {
    let timer = null;
    const trigger = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        if (hosting.get(key) !== entry) return; // superseded meanwhile
        // A UI module op already re-hosted for the change it wrote — don't do it twice.
        if (entry.lastOpRehost && Date.now() - entry.lastOpRehost < 1500) return;
        rehost(key, entry).catch(() => {});
      }, 400);
    };
    const watchers = [];
    try { watchers.push(fs.watch(entry.live.methodsDir, trigger)); } catch {}
    try { watchers.push(fs.watch(path.join(entry.live.dir, "service.json"), trigger)); } catch {}
    entry.watchers = watchers;
  }

  // The module method: SystemView.hostProject({ projectDir, folder }). Idempotent — an already-
  // hosted folder answers with its live registration (init and every boot can call it blindly).
  async function hostProject({ projectDir, folder } = {}) {
    if (!projectDir || !folder) throw new Error("hostProject: projectDir and folder are required");
    const key = `${path.resolve(projectDir)}|${folder}`;
    const existing = hosting.get(key);
    if (existing)
      return {
        projectCode: existing.live.projectCode,
        serviceId: existing.live.serviceId,
        serviceUrl: existing.live.serviceUrl,
        modules: existing.live.moduleNames,
        folder,
        alreadyHosted: true,
      };
    const live = await startHosted(projectDir, folder);
    // Don't resolve until the service's own registration (through the shared connect() door) is in
    // the store at ITS live URL — otherwise a caller listing tests right after can miss it.
    const deadline = Date.now() + 5000;
    while (Date.now() < deadline) {
      const { service } = ConnectedServices.findService(undefined, live.projectCode, live.serviceId);
      if (service && service.system && service.system.connectionData.serviceUrl === live.serviceUrl)
        break;
      await new Promise((r) => setTimeout(r, 100));
    }
    const entry = { projectDir: path.resolve(projectDir), folder, live, watchers: [] };
    hosting.set(key, entry);
    watch(key, entry);
    return {
      projectCode: live.projectCode,
      serviceId: live.serviceId,
      serviceUrl: live.serviceUrl,
      modules: live.moduleNames,
      folder,
    };
  }

  // RFC-027 §4 — configuration FROM THE UI, as file operations on the committed folder. You get one
  // service (renameable) and you can add/delete/rename modules — each module is a file, so each op
  // is a file op, followed by an awaited re-host so the caller reads back the updated registration.
  // Specs (docs/tests) are the user's data — never touched here; a renamed module keeps its old
  // spec files until their owner moves them.
  const MODULE_NAME = /^[A-Za-z_$][A-Za-z0-9_$]*$/;
  const moduleTemplate = (name) => `// methods/${name}.js — this file IS the \`${name}\` module.
// Every exported function becomes a callable method. Save, and the service updates live.

module.exports = {
  // async myMethod({ ... }) { return { ok: true }; },
};
`;

  async function hostedOp({ projectCode, op, name, to } = {}) {
    const found = [...hosting.entries()].find(([, e]) => e.live.projectCode === projectCode);
    if (!found) throw new Error(`no hosted service for project "${projectCode}"`);
    const [key, entry] = found;
    const { methodsDir, dir } = entry.live;

    // DELETE — init's opposite, for on-the-fly projects only: unhost, remove the registration,
    // remove the store entry, and remove the COMMITTED FOLDER itself. Callers confirm first.
    if (op === "deleteProject") {
      const { projectCode: pc, serviceId: id } = entry.live;
      await unhost(pc, id);
      try {
        fs.rmSync(dir, { recursive: true, force: true });
      } catch (err) {
        throw new Error(`could not remove ${dir}: ${err.message}`);
      }
      try {
        ConnectedServices.deleteService(pc, id);
      } catch {}
      return { deleted: true, projectCode: pc, serviceId: id, folder: entry.folder };
    }

    if (op === "addModule") {
      if (!MODULE_NAME.test(name || "")) throw new Error(`"${name}" is not a valid module name`);
      const file = path.join(methodsDir, `${name}.js`);
      if (fs.existsSync(file)) throw new Error(`module ${name} already exists`);
      fs.writeFileSync(file, moduleTemplate(name), "utf8");
    } else if (op === "deleteModule") {
      const file = path.join(methodsDir, `${name}.js`);
      if (!fs.existsSync(file)) throw new Error(`no module file ${name}.js`);
      fs.unlinkSync(file);
    } else if (op === "renameModule") {
      if (!MODULE_NAME.test(to || "")) throw new Error(`"${to}" is not a valid module name`);
      const from = path.join(methodsDir, `${name}.js`);
      const target = path.join(methodsDir, `${to}.js`);
      if (!fs.existsSync(from)) throw new Error(`no module file ${name}.js`);
      if (fs.existsSync(target)) throw new Error(`module ${to} already exists`);
      fs.renameSync(from, target);
    } else if (op === "renameService") {
      if (!MODULE_NAME.test(to || "")) throw new Error(`"${to}" is not a valid service name`);
      const configPath = path.join(dir, "service.json");
      const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
      const oldId = config.serviceId;
      if (oldId === to) return { ok: true, unchanged: true };
      config.serviceId = to;
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2), "utf8");
      // The re-hosted plugin writes `<newId>.manifest.json`; without this the old file would make
      // the next boot look like two services sharing one folder.
      try { fs.unlinkSync(path.join(entry.projectDir, ".systemview", `${oldId}.manifest.json`)); } catch {}
    } else {
      throw new Error(`unknown hosted op "${op}"`);
    }

    entry.lastOpRehost = Date.now();
    await rehost(key, entry);
    const live = hosting.get(key) && hosting.get(key).live;
    if (!live) throw new Error(`re-host failed after ${op}`);
    return {
      projectCode: live.projectCode,
      serviceId: live.serviceId,
      serviceUrl: live.serviceUrl,
      modules: live.moduleNames,
      folder: entry.folder,
    };
  }

  // Deleting a hosted service/project from the UI or `disconnect` must actually UNHOST: stop the
  // app, close the watchers, and remove the manifest registration — otherwise the next boot
  // resurrects what the user just deleted. The committed folder is the user's data; it stays.
  async function unhost(projectCode, serviceId) {
    const matches = [...hosting.entries()].filter(
      ([, e]) =>
        e.live.projectCode === projectCode && (!serviceId || e.live.serviceId === serviceId),
    );
    for (const [key, entry] of matches) {
      hosting.delete(key);
      entry.watchers.forEach((w) => { try { w.close(); } catch {} });
      try {
        await new Promise((r) => entry.live.app.close(r));
      } catch {}
      try {
        fs.unlinkSync(
          path.join(entry.projectDir, ".systemview", `${entry.live.serviceId}.manifest.json`),
        );
      } catch {}
    }
    return matches.length > 0;
  }

  return { hostProject, hostedOp, unhost };
};
