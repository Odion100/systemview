const fsGit = require("fs");
const path_ = require("path");

// ── THE MACHINE DOOR (RFC-069, approved 2026-10-15) ─────────────────────────────────────────
// A file outside every project root is a legal address now: ("", absolute path). These verbs are
// the second door — `inside()` above is untouched, because it guards the PROJECT door against
// relative-path traversal, and this door has no relative grammar to abuse: absolute only, `~`
// expanded, normalized. Reads answer anything the hub's own process can read (dotfiles included —
// his standing ruling: he is approving the system the whole time); writes need the parent to
// exist; delete unlinks a FILE or an empty directory and refuses a tree by name — `rm`, not
// `rm -rf` (his call at the RFC review).
function machinePath(raw) {
  let p = String(raw || "").trim().replace(/^file:\/\//, "");
  if (p.startsWith("~/")) p = path_.join(require("os").homedir(), p.slice(2));
  if (!path_.isAbsolute(p)) return null; // the relative grammar belongs to projects
  return path_.normalize(p);
}
async function readPath({ path: raw } = {}) {
  const abs = machinePath(raw);
  if (!abs) return { ok: false, error: "the machine door takes an absolute path — relative paths belong to a project" };
  try {
    return { ok: true, path: abs, machine: true, content: fsGit.readFileSync(abs, "utf8") };
  } catch (e) {
    return { ok: false, error: String(e.message || e) };
  }
}
async function writePath({ path: raw, content } = {}) {
  const abs = machinePath(raw);
  if (!abs) return { ok: false, error: "the machine door takes an absolute path — relative paths belong to a project" };
  if (!fsGit.existsSync(path_.dirname(abs)))
    return { ok: false, error: `the folder ${path_.dirname(abs)} does not exist — the machine door creates files, never directory cascades` };
  try {
    fsGit.writeFileSync(abs, String(content == null ? "" : content));
    return { ok: true, path: abs, machine: true };
  } catch (e) {
    return { ok: false, error: String(e.message || e) };
  }
}
async function deletePath({ path: raw } = {}) {
  const abs = machinePath(raw);
  if (!abs) return { ok: false, error: "the machine door takes an absolute path — relative paths belong to a project" };
  try {
    const st = fsGit.statSync(abs);
    if (st.isDirectory()) {
      if (fsGit.readdirSync(abs).length)
        return { ok: false, error: `${abs} is a directory with contents — this door deletes a file or an empty folder, never a tree` };
      fsGit.rmdirSync(abs);
    } else {
      fsGit.unlinkSync(abs);
    }
    return { ok: true, path: abs, machine: true };
  } catch (e) {
    return { ok: false, error: String(e.message || e) };
  }
}
async function listPath({ path: raw } = {}) {
  const abs = machinePath(raw);
  if (!abs) return { ok: false, error: "the machine door takes an absolute path — relative paths belong to a project" };
  try {
    const rows = fsGit.readdirSync(abs, { withFileTypes: true }).map((d) => ({ name: d.name, dir: d.isDirectory() }));
    return { ok: true, path: abs, machine: true, entries: rows };
  } catch (e) {
    return { ok: false, error: String(e.message || e) };
  }
}

module.exports = { machinePath, readPath, writePath, deletePath, listPath };
