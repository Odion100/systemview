// THE SHELL'S PROJECT REGISTRY, READ-ONLY — the third list of folders, and the one the hub could
// not see.
//
// The hub declares itself the single owner of files for one reason (api/index.js, "FILES, SERVED BY
// THE HUB"): THE HUB KNOWS EVERY PROJECT'S FOLDER. That sentence stopped being true the day a
// project could be added through the window. `+ Add project` writes to the SHELL's registry —
// `~/.autobot/projects.json` — and nothing ever told the hub. So a folder he had just picked drew a
// card and a tree, and every file it held answered "no folder for this project": the card knew the
// root (the shell told it), the hub did not, and the one call between them does not carry it from
// every surface.
//
// The fix is not a second way to get files. It is this list, in the same precedence chain as the
// other two, so the hub's claim is true again and there is still exactly one resolver. Everything
// downstream comes with it: the file verbs, git, the CLI's `projectPlugin` (a report an agent writes
// into that project), and the `.git` watcher.
//
// Read-only ON PURPOSE. The shell owns this file — it picks the folder, it enforces "a code means
// one directory", it migrates sessions on rename. The hub only ever asks.
const fs = require("fs");
const path = require("path");
const os = require("os");

const PROJECTS_FILE = path.join(os.homedir(), ".autobot", "projects.json");

// `{ code: dir }` — the shape `files-host.cjs` writes. No file, unreadable file, or a file holding
// something that is not an object is an EMPTY ANSWER, never a thrown one: a hub running where no
// shell has ever lived (a server, CI, another machine) must behave exactly as it does today.
function shellProjects() {
  try {
    const raw = JSON.parse(fs.readFileSync(PROJECTS_FILE, "utf8"));
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
    const out = {};
    Object.entries(raw).forEach(([code, dir]) => {
      if (code && typeof dir === "string" && dir) out[code] = dir;
    });
    return out;
  } catch {
    return {};
  }
}

// One project's folder, or null. The caller still checks that the directory EXISTS (`rootOf` does)
// — the registry can name a path that belongs to another machine (`bu1 -> /root/buAPI` does exactly
// that), and a path that is not there is not an answer.
function shellProjectRoot(projectCode) {
  if (!projectCode) return null;
  return shellProjects()[projectCode] || null;
}

module.exports = { shellProjects, shellProjectRoot, PROJECTS_FILE };
