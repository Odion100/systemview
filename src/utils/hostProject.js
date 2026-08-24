// A FOLDER, WEARING THE SHAPE OF A CONNECTED SERVICE — so the nav he already uses shows it.
//
// His correction, and it was the right one: *"why isn't it bringing in the project right here onto
// the nav? … why am I picking a file? I'm confused."* I had made adding a project navigate AWAY to a
// separate page, because I was so set on not touching the old one. Adding a codebase should put a
// codebase card in the Navigator beside the others. Full stop.
//
// THE CHEAP WAY TO DO THAT, and RFC-047 called it: every surface already asks `pickHost()` who reads
// the files and then does `loadServiceWithHeaders(host.system.connectionData).Plugin`. So a folder
// only has to answer those two questions. This builds an entry that looks like a service and
// declares the Plugin methods it really has — `loadService` recognises the marker and hands back a
// Plugin backed by `window.systemview.files` instead of HTTP. Nothing downstream changes, and
// `pluginFns` stays honest: a method that isn't listed is a button the UI won't draw.
const HOST_FNS = [
  "readFile", "writeFile", "listFiles", "search", "gitState", "getDiff", "stageFiles", "commit",
];

export const HOST_MARK = "__hostFiles";

export const hostProjectEntry = (projectCode, root) => ({
  projectCode,
  // Named for what it is. It appears in the card's services section as this, and "Files" says
  // truthfully that this project has a codebase and no running system.
  serviceId: "Files",
  root,
  system: {
    connectionData: {
      [HOST_MARK]: projectCode,
      serviceUrl: `host://${projectCode}`,
      modules: [{ name: "Plugin", methods: HOST_FNS.map((fn) => ({ fn, method: "post" })) }],
    },
  },
});

// The nav asks `listFiles({})` and expects THE WHOLE TREE FLAT — `{ files: [{path, language, size}] }`
// — because that is what the plugin has always answered. The host's `listFiles(projectCode, dir)`
// answers ONE directory. That mismatch is why a folder added with + showed a card and no files: not
// a missing capability, a shape. So the walk happens here, breadth-first, and the ignore list is the
// obvious one — nobody wants node_modules in the tree and reading it over IPC would take all day.
const IGNORE = new Set(["node_modules", ".git", ".next", "dist", "coverage", ".cache", "build"]);
const MAX_FILES = 8000;
const EXT_LANG = {
  js: "javascript", jsx: "javascript", mjs: "javascript", cjs: "javascript",
  ts: "typescript", tsx: "typescript", json: "json", md: "markdown", markdown: "markdown",
  scss: "scss", css: "css", html: "html", yml: "yaml", yaml: "yaml", sh: "shell", py: "python", sql: "sql",
};
const languageOf = (p) => EXT_LANG[(String(p).split(".").pop() || "").toLowerCase()] || "text";

const rowsOf = (res) => {
  const raw = Array.isArray(res) ? res : (res && (res.files || res.entries || res.rows)) || [];
  return raw
    .map((r) => (typeof r === "string" ? { path: r } : r))
    .filter((r) => r && r.path);
};

async function walkAll(files, projectCode) {
  const out = [];
  const queue = [""];
  const seen = new Set();
  while (queue.length && out.length < MAX_FILES) {
    const dir = queue.shift();
    if (seen.has(dir)) continue;
    seen.add(dir);
    let rows = [];
    try {
      rows = rowsOf(await files.listFiles(projectCode, dir));
    } catch {
      continue;
    }
    rows.forEach((r) => {
      const name = String(r.path).split("/").filter(Boolean).pop();
      const isDir = !!(r.dir || r.isDirectory || r.type === "dir");
      if (isDir) {
        if (!IGNORE.has(name)) queue.push(r.path);
        return;
      }
      out.push({ path: r.path, language: r.language || languageOf(r.path), size: r.size });
    });
  }
  return out;
}

// The object-arg shape every call site already speaks, mapped onto the host's positional calls.
// One place, so the two vocabularies meet exactly once.
export const hostBackedPlugin = (projectCode) => {
  const f = () => {
    const files = typeof window !== "undefined" && window.systemview && window.systemview.files;
    if (!files) throw new Error("no file host — open SystemView in the desktop shell");
    return files;
  };
  return {
    readFile: async ({ path } = {}) => {
      const res = await f().readFile(projectCode, path);
      const content = typeof res === "string" ? res : (res && (res.content != null ? res.content : res.text)) || "";
      return { path, content, language: languageOf(path) };
    },
    writeFile: async ({ path, content } = {}) => f().writeFile(projectCode, path, content),
    listFiles: async ({ dir = "." } = {}) => {
      const files = f();
      const start = dir === "." ? "" : dir;
      const first = rowsOf(await files.listFiles(projectCode, start));
      // If the host already answered recursively (no directory rows and paths with slashes below
      // the start), take it as-is rather than walking a tree that is already here.
      const hasDirs = first.some((r) => r.dir || r.isDirectory || r.type === "dir");
      if (!hasDirs)
        return {
          dir: start,
          files: first.map((r) => ({ path: r.path, language: r.language || languageOf(r.path), size: r.size })),
          truncated: false,
        };
      const all = await walkAll(files, projectCode);
      return { dir: start, files: all, truncated: all.length >= MAX_FILES };
    },
    search: async ({ query, max } = {}) => f().search(projectCode, query, max),
    gitState: async () => f().gitState(projectCode),
    getDiff: async ({ path } = {}) => f().getDiff(projectCode, path),
    stageFiles: async ({ paths, unstage } = {}) => f().stageFiles(projectCode, paths, unstage),
    commit: async ({ message } = {}) => f().commit(projectCode, message),
  };
};

// The folders the shell has registered, as service-shaped entries. Anything ALREADY connected is
// skipped: a project code means one folder, so a running service and a registered folder are the
// same project, and adding a second card for it would be the two-registries bug on screen.
// FORGETTING A FOLDER. The host has had `projects.remove` since the picker existed; SystemView
// simply never called it, so two folders he added to TEST bringing folders in could not be taken
// back out — *"I can't remove the projects that I put in just to test."* Adding without removing is
// a trap, and it is the reason he stopped adding.
// PICK, THEN NAME, THEN COMMIT — three acts, because they are three acts.
//
// `add(code)` opened the dialog AND registered in one call, so there was no moment between choosing
// a folder and committing it for the naming question to live in. I tried asking for the name FIRST
// and he was right to kill it: *"hit the plus button to then be asked for the fucking shit like
// that — that's a terrible flow."* You cannot name a thing before you have chosen it. The shell now
// separates the two, which is the whole reason this flow can exist.
//
//   pickFolder() -> { dir, defaultCode } | null   opens the dialog, registers NOTHING
//   put(code, dir) -> { code, dir } | { error }   the commit half
//   rename(code, next) -> { code, dir } | { error }  in place, and it migrates saved conversations
const projectsHost = () => {
  const p = typeof window !== "undefined" && window.systemview && window.systemview.projects;
  return p || null;
};

export const canPickThenName = () => {
  const p = projectsHost();
  return !!(p && typeof p.pickFolder === "function" && typeof p.put === "function");
};

// The dialog only. `null` means he cancelled, which is not an error and must not be reported as one.
// Returns just the directory: the NAME never comes from the folder — a project is named by him,
// before the folder exists, and the folder is an attachment to that name.
export const pickFolderOnly = async () => {
  const p = projectsHost();
  if (!p || typeof p.pickFolder !== "function") return null;
  const picked = await p.pickFolder();
  if (!picked || !picked.dir) return null;
  return { dir: picked.dir };
};

export const putHostProject = async (code, dir) => {
  const p = projectsHost();
  if (!p || typeof p.put !== "function") return { error: "this shell cannot register a folder yet" };
  try {
    return await p.put(code, dir);
  } catch (e) {
    return { error: (e && e.message) || "could not add that folder" };
  }
};

// RENAMING IS THE HALF `pick` CANNOT REACH: it fixes the projects that are ALREADY badly named,
// which is most of them. The shell migrates its saved conversations along with the code, so his
// chats follow the project instead of orphaning — with one honest caveat it reports itself: a
// session live in memory at rename time keeps the old code until it is reopened.
export const canRenameHostProject = () => {
  const p = projectsHost();
  return !!(p && typeof p.rename === "function");
};

export const renameHostProject = async (code, next) => {
  const p = projectsHost();
  if (!p || typeof p.rename !== "function") return { error: "this shell cannot rename a project yet" };
  try {
    return await p.rename(code, next);
  } catch (e) {
    return { error: (e && e.message) || "could not rename that project" };
  }
};

// THE MIGRATION — the actual transition, and the thing every other change tonight was standing in
// front of. His question, asked four times: *"these projects are connected the wrong way… did you
// transition them or not?"*
//
// The honest answer was NO. A project in the nav was a SystemLynx CONNECTION: it existed because
// `connections.json` had a row, its identity was whatever the plugin declared, and the shell had
// never heard of it. The host-folder path was purely ADDITIVE — a second way in that only applied
// to folders he added by hand. Nothing migrated, which is exactly why nobody disappeared and why
// nothing looked different: there was no transition for them to go through.
//
// It could not be done before tonight because `add(code)` opens a native dialog — you cannot
// migrate eight projects through eight file pickers. `put(code, dir)` registers silently, and every
// connection has always carried its `root`, so the mapping is already sitting in `connections.json`.
//
// AFTER THIS, A PROJECT IS A DIRECTORY. Its services are a thing that happens to be running inside
// it. Same code, same card, same services — but the shell now knows the project, so files, the
// terminal and agent sessions resolve from the project itself rather than from whichever plugin
// answered first. Idempotent by the host's own guard: re-putting the same folder under the same
// code is a no-op, so this can run on every load without asking.
export const migrateConnectedProjects = async (connected = []) => {
  const p = projectsHost();
  if (!p || typeof p.put !== "function" || typeof p.list !== "function") return { migrated: [], failed: [] };
  const norm = (d) => String(d || "").replace(/\/+$/, "");
  let known = [];
  try {
    const rows = (await p.list()) || [];
    known = (Array.isArray(rows) ? rows : Object.entries(rows).map(([projectCode, root]) => ({ projectCode, root })))
      .map((r) => (typeof r === "string" ? { projectCode: r } : r));
  } catch {
    return { migrated: [], failed: [] };
  }
  const haveCode = new Set(known.map((r) => r.projectCode));
  // ONE ROW PER PROJECT, not per service. A project with five services has five connection rows all
  // naming the same directory; registering it five times would be five identical no-ops and five
  // chances for one of them to report an error about a race with itself.
  const byCode = new Map();
  connected.forEach((s) => {
    if (!s || !s.projectCode || !s.root) return;
    if (haveCode.has(s.projectCode)) return; // the shell already knows it
    if (!byCode.has(s.projectCode)) byCode.set(s.projectCode, norm(s.root));
  });
  const migrated = [];
  const failed = [];
  for (const [code, dir] of byCode) {
    try {
      const res = await p.put(code, dir);
      if (res && res.error) failed.push({ code, dir, error: res.error });
      else migrated.push({ code, dir });
    } catch (e) {
      failed.push({ code, dir, error: (e && e.message) || "put failed" });
    }
  }
  return { migrated, failed };
};

export const removeHostProject = async (projectCode) => {
  const p = typeof window !== "undefined" && window.systemview && window.systemview.projects;
  if (!p || typeof p.remove !== "function") return false;
  try {
    await p.remove(projectCode);
    return true;
  } catch {
    return false;
  }
};

// Is this project one the HOST holds (a folder), rather than a SystemLynx connection? Answered off
// the entry itself so no caller has to know how the costume is stitched.
export const isHostProject = (services = []) =>
  services.some((s) => s && s.system && s.system.connectionData && s.system.connectionData[HOST_MARK]);

export const hostProjects = async (connected = []) => {
  const p = typeof window !== "undefined" && window.systemview && window.systemview.projects;
  if (!p || typeof p.list !== "function") return [];
  let rows = [];
  try {
    rows = (await p.list()) || [];
  } catch {
    return [];
  }
  // A PROJECT IS A DIRECTORY, NOT A NAME. Filtering on `projectCode` alone was the two-registries
  // bug on screen: the plugin DECLARES its code (`systemview-test`) and the host NAMES A FOLDER BY
  // ITS DIRECTORY (`systemview`), so the same folder arrived under two different names and drew two
  // cards. Proven, not assumed — stub the host with the directory systemview-test is connected from
  // and you get both cards side by side. Every connected service already records its `root`, so the
  // fact needed to catch this was sitting in `connections.json` the whole time, unread.
  const norm = (p) => String(p || "").replace(/\/+$/, "");
  const have = new Set(connected.map((s) => s.projectCode));
  const haveRoot = new Set(connected.map((s) => norm(s.root)).filter(Boolean));
  return (Array.isArray(rows) ? rows : Object.entries(rows).map(([projectCode, root]) => ({ projectCode, root })))
    .map((r) => (typeof r === "string" ? { projectCode: r } : r))
    .filter((r) => r && r.projectCode)
    .filter((r) => !have.has(r.projectCode) && !haveRoot.has(norm(r.root || r.path)))
    .map((r) => hostProjectEntry(r.projectCode, r.root || r.path || ""));
};

// THE HOST OWNS FILES. THE PLUGIN OWNS DOCUMENTATION AND TESTS. That is the whole rule, and it is
// what the plugin was designed for in the first place — his words: *"the only concern is
// documentation and testing now, like it originally was designed. That's it."*
//
// `hostProjects` above deliberately hides a folder whose project is ALREADY connected by services,
// because two entries for one directory drew two cards. Correct for cards — and wrong for FILES: it
// meant a project with services fell back to reading its own source over HTTP through the plugin,
// with a socket, a retry storm when that service was down, and a codebase panel that went blank
// because a test service wasn't running. The folder was known the whole time.
//
// This returns the host entry for a project that IS connected, tagged so it groups into that
// project's existing card instead of making a new one. It is a FILE PROVIDER, never a card.
export const hostFileProviders = async (connected = []) => {
  const p = typeof window !== "undefined" && window.systemview && window.systemview.projects;
  if (!p || typeof p.list !== "function") return [];
  let rows = [];
  try {
    rows = (await p.list()) || [];
  } catch {
    return [];
  }
  const norm = (s) => String(s || "").replace(/\/+$/, "");
  // ONE LIST OF FOLDERS, NOT TWO. This only ever returned providers for projects the SHELL already
  // listed — and a project that arrived as a service connection has its folder in the connections
  // registry and no entry in the shell at all. So that project got no folder, and with no folder
  // there is no file tree, no git and no commit box, while the project beside it (added through the
  // shell) had all three. His words, and they are the rule: *"one thing working one way and the same
  // thing working the other way IS the break."*
  //
  // So the two lists are reconciled instead of compared: a connected project with a real folder the
  // shell has not heard of is REGISTERED with it, through the shell's own `put` — no new verb, no
  // fallback path, no second way of getting files. After this the shell knows every project that has
  // a folder, and every panel asks exactly one place.
  try {
    const known = new Set(
      (Array.isArray(rows) ? rows : Object.entries(rows).map(([projectCode, root]) => ({ projectCode, root })))
        .map((r) => (typeof r === "string" ? r : r && r.projectCode))
        .filter(Boolean),
    );
    const missing = [];
    const seen = new Set();
    connected.forEach((s) => {
      if (!s || !s.projectCode || !s.root) return;
      if (known.has(s.projectCode) || seen.has(s.projectCode)) return;
      seen.add(s.projectCode);
      missing.push({ code: s.projectCode, dir: s.root });
    });
    if (missing.length && typeof p.put === "function") {
      await Promise.all(missing.map(({ code, dir }) => Promise.resolve(p.put(code, dir)).catch(() => null)));
      rows = (await p.list()) || rows;
    }
  } catch {
    /* registering is best-effort — a shell that refuses still gets the list it had */
  }
  // Which connected projects the shell knows a folder for — matched by code OR by root, the same
  // two-sided match the card dedupe uses (the plugin names a project, the host names a directory).
  const byCode = new Map();
  const byRoot = new Map();
  connected.forEach((s) => {
    if (s.projectCode) byCode.set(s.projectCode, s.projectCode);
    if (s.root) byRoot.set(norm(s.root), s.projectCode);
  });
  return (Array.isArray(rows) ? rows : Object.entries(rows).map(([projectCode, root]) => ({ projectCode, root })))
    .map((r) => (typeof r === "string" ? { projectCode: r } : r))
    .filter((r) => r && r.projectCode)
    .map((r) => {
      const root = r.root || r.path || "";
      // The code this folder belongs to in the CONNECTED world — its own name if that project is
      // connected, otherwise whoever is connected from this same directory.
      const code = byCode.get(r.projectCode) || byRoot.get(norm(root));
      return code ? { ...hostProjectEntry(code, root), fileProvider: true } : null;
    })
    .filter(Boolean);
};
