import { getHub } from "./hub";
// THE FILES ARE THE SHELL'S. Not a service, not a plugin, not a thing that can be down.
//
// This module IS the file layer now. It used to live in hostProject.js as `hostBackedPlugin` — a
// folder wearing a fake SystemLynx service costume so it could slide through code that expected
// services. That costume was a bridge while the transition ran, and a bridge you keep building on
// is just the old building. His call, and it ends the transition: *"the plugin does not deal with
// files and git anymore."*
//
// So: no marker, no candidates, no picking. A project has a root the shell knows; you ask the
// shell. The plugin is documentation and tests, which is what it was designed for.
export const hasHostFiles = () =>
  !!(typeof window !== "undefined" && window.systemview && window.systemview.files);

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
export const hostFiles = (projectCode, root) => {
  const hub = () => {
    const h = getHub();
    if (!h) throw new Error("the hub is not connected yet");
    return h;
  };
  // The shell's bridge if it has the verb, the hub if it does not. NOT a preference between two
  // equals — the shell is the answer; the hub is what stops a missing verb from blanking a panel.
  const shellFiles = () => (typeof window !== "undefined" && window.systemview && window.systemview.files) || null;
  const viaShellOrHub = async (verb, fromShell, fromHub) => {
    const files = shellFiles();
    if (files && typeof files[verb] === "function") {
      // A MISSING VERB IS NOT THE ONLY WAY THE SHELL CAN HAVE NO ANSWER. The shell only knows the
      // projects that were added TO IT; a project that arrived as a service connection has a folder
      // in the connections registry and no entry in the shell's list at all — so `gitState("autobot")`
      // comes back `ok:false` with "unknown project" while the very same folder is sitting right
      // there. That is why one project's panel had the commit box and another's did not, and it was
      // the shell-first switch that introduced it. So the fallback catches BOTH shapes of "no
      // answer": no verb, and a verb that could not resolve the project.
      try {
        const res = await fromShell(files);
        if (!res || res.ok !== false) return res;
      } catch {
        /* fall through to the hub — a throwing bridge is a bridge with no answer */
      }
    }
    return fromHub(hub());
  };
  const f = () => {
    const files = typeof window !== "undefined" && window.systemview && window.systemview.files;
    if (!files) throw new Error("no file host — open SystemView in the desktop shell");
    return files;
  };
  return {
    readFile: async ({ path } = {}) => {
      const res = await hub().readFile(projectCode, { path, root });
      if (res && res.ok === false) throw new Error(res.error || "could not read that file");
      const content = typeof res === "string" ? res : (res && (res.content != null ? res.content : res.text)) || "";
      return { path, content, language: languageOf(path) };
    },
    writeFile: async ({ path, content } = {}) => {
      const res = await hub().writeFile(projectCode, { path, content, root });
      if (res && res.ok === false) throw new Error(res.error || "could not write that file");
      return res;
    },
    deleteFile: async ({ path } = {}) => {
      const res = await hub().deleteFile(projectCode, { path, root });
      if (res && res.ok === false) throw new Error(res.error || "could not delete that file");
      return res;
    },
    listFiles: async ({ dir = "." } = {}) => {
      const res = await hub().listFiles(projectCode, { dir, root });
      if (res && res.ok === false) throw new Error(res.error || "could not list that folder");
      return {
        dir: res.dir || "",
        files: (res.files || []).map((r) => ({ path: r.path, language: r.language || languageOf(r.path), size: r.size })),
        truncated: !!res.truncated,
      };
    },
    search: async ({ query, max } = {}) => {
      const res = await hub().searchFiles(projectCode, { query, max, root });
      if (res && res.ok === false) throw new Error(res.error || "search did not run");
      return res.results || [];
    },
    // GIT COMES FROM THE SHELL, which is where it belongs — his call and the right one: *"why would
    // we need the hub when we're the IDE running in the shell? That's a hack."* It is. The hub
    // version was built because the bridge had lost its git verbs the same day this file stopped
    // asking the plugin, and a dead code panel could not wait. autobot restored them; the shell is
    // the path again and the hub stays underneath ONLY so a gap on one side can never blank the
    // panel a second time. Two owners is what caused today; a fallback that is never the first
    // answer is not two owners.
    gitState: async () => {
      const st = await hub().gitState(projectCode, { root });
      if (st && st.ok === false) throw new Error(st.error || "git did not run");
      return st;
    },
    changedFiles: async () => {
      const res = await hub().changedFiles(projectCode, { root });
      if (res && res.ok === false) throw new Error(res.error || "git did not run");
      // The panel reads `{ files: [{ path, status }] }` and keys rows on `status`; `partial` is what
      // lets a staged-then-edited file draw its second row instead of claiming to be fully staged.
      const files = ((res && res.files) || []).map((f) => ({ ...f, status: f.status || f.change || "modified" }));
      return { files };
    },
    getDiff: async ({ path, staged } = {}) => {
      const res = await hub().getDiff(projectCode, { path, staged, root });
      if (res && res.ok === false) throw new Error(res.error || "git did not run");
      return res;
    },
    stageFiles: async ({ paths, unstage } = {}) => {
      const res = await hub().stageFiles(projectCode, { paths, unstage, root });
      if (res && res.ok === false) throw new Error(res.error || "git did not run");
      return res;
    },
    // The HUB, like every other git verb — this one was still pointed at the shell (which has no
    // such verb), so "+ stage" on a hunk always failed. `content` is the rebuilt index copy.
    stageHunk: async ({ path, content } = {}) => {
      const res = await hub().stageHunk(projectCode, { path, content, root });
      if (res && res.ok === false) throw new Error(res.error || "git did not run");
      return res;
    },
    // Held on the shell side pending his word (write and destructive), so these stay on the hub.
    discardFiles: async ({ paths } = {}) => {
      const res = await hub().discardFiles(projectCode, { paths, root });
      if (res && res.ok === false) throw new Error(res.error || "discard failed");
      return res;
    },
    push: async () => {
      const res = await hub().push(projectCode, { root });
      if (res && res.ok === false) throw new Error(res.error || "push failed");
      return res;
    },
    fileHistory: async ({ path, limit } = {}) => {
      const res = await hub().fileHistory(projectCode, { path, limit, root });
      if (res && res.ok === false) throw new Error(res.error || "could not read that history");
      return res;
    },
    readSnapshot: async ({ path, sha } = {}) => {
      const res = await hub().readSnapshot(projectCode, { path, sha, root });
      if (res && res.ok === false) throw new Error(res.error || "could not read that snapshot");
      return res;
    },
    commit: async ({ message } = {}) => {
      const res = await hub().commit(projectCode, { message, root });
      if (res && res.ok === false) throw new Error(res.error || "commit failed");
      return res;
    },
  };
};

