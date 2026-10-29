// THE SHELL'S DOCUMENT REGISTRY, READ-ONLY — RFC-073 §1.1, same contract as shellProjects.js one
// file over: the shell owns `~/.autobot/documents.json` (its parse writes identity and derived
// state), the hub only ever asks. This is the window's door to "which documents exist, of which
// kind, and what did the last parse see" — the read the band's tabs move onto when the folder
// conventions go (slice 2), and the read the drawer's counts come from (c3, c4).
//
// Read UNCACHED every time, the rule the registry itself follows: the file is small, and a cached
// copy is how an edited registry stops taking effect with nobody able to work out why. No file,
// unreadable file, or junk is an EMPTY ANSWER, never a thrown one — a hub running where no shell
// has ever lived must behave exactly as it does today.
const fs = require("fs");
const path = require("path");
const os = require("os");

const FILE = () => process.env.AUTOBOT_DOCUMENTS || path.join(os.homedir(), ".autobot", "documents.json");

function rows() {
  try {
    const raw = JSON.parse(fs.readFileSync(FILE(), "utf8"));
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

/**
 * The registry, filtered — `{ projectCode, kind, arc }` all optional. Each row comes back as the
 * shell keeps it (`id kind path project at` + derived `state`), plus `stale`: whether the file on
 * disk is newer than the row's `parsed` stamp (§1.4 — the lag is VISIBLE, so a list can re-parse
 * lazily instead of trusting or polling). `root` resolves the mtime; without one the row still
 * answers, with `stale` undefined rather than guessed.
 */
function documentsRegistryOn({ rootOf } = {}) {
  return ({ projectCode, kind, arc } = {}) => {
    const out = rows().filter(
      (r) =>
        (!projectCode || r.project === projectCode) && (!kind || r.kind === kind) && (!arc || r.arc === arc),
    );
    const opened = openedMap();
    return out.map((r) => {
      const row = { ...r };
      if (opened[r.id]) row.openedAt = opened[r.id];
      try {
        const root = rootOf ? rootOf(r.project) : "";
        if (root && r.path && !path.isAbsolute(r.path)) {
          const mtime = fs.statSync(path.join(root, r.path)).mtimeMs;
          row.stale = !(r.state && r.state.parsed) || mtime > r.state.parsed;
        }
      } catch {
        row.missing = true; // the pointer leads nowhere — §1.4: the next check that touches it drops the row
      }
      return row;
    });
  };
}

// THE HUB'S ONE WRITE — a report filed through `show()` lands in `.systemview/`, a folder the
// shell's watcher ignores BY DESIGN, so the shell can never see the leaf the write door just
// prepended. Without this, a hub-filed report is registered nowhere and (since the lists read the
// registry) shown nowhere. Same whitelist as the shell's registry.cjs, same rule — the id is the
// identity, a move updates the row — and `state` is left to the shell's parse alone (c40). Writes
// here are rare (one per filed report) and the file is read-modify-written whole, as the shell
// does; the two writers interleave on different documents in practice.
const FIELDS = ["id", "kind", "path", "project", "arc", "at"];
function upsertRow(row = {}) {
  const clean = {};
  for (const k of FIELDS) if (row[k] != null && row[k] !== "") clean[k] = row[k];
  if (!clean.id || !clean.kind || !clean.path) return { ok: false, error: "a registration needs an id, a kind and a path" };
  clean.at = Date.now();
  const all = rows();
  const i = all.findIndex((r) => r.id === clean.id);
  if (i >= 0) all[i] = { ...all[i], ...clean };
  else all.push(clean);
  try {
    fs.mkdirSync(path.dirname(FILE()), { recursive: true });
    fs.writeFileSync(FILE(), JSON.stringify(all, null, 2) + "\n");
  } catch (e) {
    return { ok: false, error: String((e && e.message) || e) };
  }
  return { ok: true, row: i >= 0 ? all[i] : clean };
}

// THE OPENED LEDGER — the reader's half of RFC-076 §4.6. `openedAt` is a fact about HIS attention,
// not about the document, so it lives in the hub's OWN file rather than on the shell's rows: the
// shell regenerates documents.json on every parse, and a fact written between parses would die in
// the rewrite. One file, one owner, first-write-wins — a clock that restarts on every open would
// be measuring renders, not attention. The registry read joins it onto the row.
const OPENED = () => process.env.AUTOBOT_DOCUMENTS_OPENED || path.join(os.homedir(), ".autobot", "documents-opened.json");
function openedMap() {
  try {
    const raw = JSON.parse(fs.readFileSync(OPENED(), "utf8"));
    return raw && typeof raw === "object" ? raw : {};
  } catch {
    return {};
  }
}
function stampOpened(id, { restart = false } = {}) {
  const key = String(id || "").trim();
  if (!key) return { ok: false, error: "a first open needs the document's id" };
  const all = openedMap();
  // DIVERT IS A RESTART (RFC-076 §4.6): the one caller allowed to move an existing stamp is the
  // divert press — the clock re-measures attention from the moment he chose to keep the report.
  if (all[key] && !restart) return { ok: true, id: key, openedAt: all[key], already: true };
  all[key] = Date.now();
  try {
    fs.mkdirSync(path.dirname(OPENED()), { recursive: true });
    fs.writeFileSync(OPENED(), JSON.stringify(all, null, 2) + "\n");
  } catch (e) {
    return { ok: false, error: String((e && e.message) || e) };
  }
  return { ok: true, id: key, openedAt: all[key] };
}

module.exports = { documentsRegistryOn, upsertRow, stampOpened, openedMap, file: FILE, openedFile: OPENED };
