// THE JANITOR. One abstraction, several OFFICES — his framing, 2026-11-02: *"a janitor is a
// janitor, he works over here in this office and over there in that office and he cleans up both."*
//
// So this module holds more than one sweep, and the thing that must stay separate is the RULES, not
// the code: a rule for one office may never change how another office is cleaned. That went wrong
// once already and the failure looked like helpfulness — the document sweep was given the power to
// rewrite job run records as part of deleting a document, which made one office's rule reach into
// another's bookkeeping. Office 2 below does the same cleanup and is CORRECT, because it stands on
// its own rule and does not care who deleted anything.
//
// OFFICE 1 — RETIRED DOCUMENTS, AND IT WAS NEVER ABOUT REPORTS. A report is one KIND of registered
// document; the rule is about documents. The leaf says `retired=`, so somebody decided this is
// over, and it goes — whatever kind it is and wherever it lives. No clock, no mtime, no age (his
// ruling: *"no need for a fucking 30-day floor for nothing, the documents have their life cycle"*).
// The window on a leaf is the reader's face; `retired=` is the fact.
//
// AND `retain=permanent` DOES NOT PROTECT A DOCUMENT FROM BEING RETIRED. Permanent means no clock
// will ever take this one; it does not mean nobody may decide it is over. A leaf carrying both
// `retain=permanent` and `retired=` is collected, because the retirement is the later fact.
//
// AND THE FILE SET COMES FROM THE REGISTRY, NEVER A GLOB. This used to scan `report.*.md` in
// `.systemview/`, which bakes in both wrong assumptions at once: that a document is a report, and
// that a document is findable by its filename. A document's identity is the leaf it declares and
// the registry is the index of those leaves — the same correction `arc-development` §3.1 needed.
//
// OFFICE 2 — POINTERS THAT LEAD NOWHERE. A run record naming a report file that does not exist is
// garbage whatever happened to the file: retired by office 1, deleted by hand, or never written.
// Measured before any of this: 29 of 66 run pointers led at files that were gone, because the job
// documents tell agents to delete a settled report and nothing ever updated the record.
//
// WHAT THE JANITOR WILL NOT TOUCH: `documents.json` itself. The registry's writes are the shell's
// alone (RFC-073 c40) — the hub only ever asks it. So a row left pointing at a document office 1
// deleted is REPORTED by this module and fixed by the parse that owns it, because a janitor
// cleaning another service's ledger is the rule-crossing this file exists to avoid.
const fs = require("fs");
const path = require("path");
const os = require("os");

const REGISTRY = () => process.env.AUTOBOT_DOCUMENTS || path.join(os.homedir(), ".autobot", "documents.json");
const RUNS_DIR = () => path.join(os.homedir(), ".autobot", "jobs");

// A REGISTRATION LEAF CARRYING `retired=`. Any kind — `::report`, `::rfc`, `::gap`, `::arc` — so the
// rule reads the word that matters and not the name of one kind that happens to use it today.
const RETIRED_RE = /^\s*::(?:report|rfc|gap|arc)\{[^}]*\bretired=/m;

/** Does this file's own leaf say it is retired? Unreadable fails toward KEEPING it. */
function isRetired(file) {
  try {
    // The leaf is the first block of the document, so the head is enough — documents can be long
    // and this runs over every registered one, hourly.
    const fd = fs.openSync(file, "r");
    const buf = Buffer.alloc(2048);
    const n = fs.readSync(fd, buf, 0, 2048, 0);
    fs.closeSync(fd);
    return RETIRED_RE.test(buf.slice(0, n).toString("utf8"));
  } catch {
    return false;
  }
}

/** Every registered document, as the shell keeps them. An unreadable registry is an empty answer. */
function registryRows(file) {
  try {
    const raw = JSON.parse(fs.readFileSync(file || REGISTRY(), "utf8"));
    const list = Array.isArray(raw) ? raw : Array.isArray(raw && raw.documents) ? raw.documents : [];
    return list.filter((r) => r && r.path);
  } catch {
    return [];
  }
}

/**
 * OFFICE 1 — collect every retired document this project holds.
 *
 * Returns `{ deleted, kept, dangling }` — `dangling` being the registry rows now pointing at
 * nothing, which this module reports and does not fix (see the header).
 */
function collectRetired(root, { projectCode, registryFile } = {}) {
  const rows = registryRows(registryFile).filter((r) => !projectCode || r.project === projectCode);
  if (!rows.length) return { deleted: [], kept: 0, dangling: [] };

  const deleted = [];
  let kept = 0;
  for (const row of rows) {
    const abs = path.isAbsolute(row.path) ? row.path : path.join(root, row.path);
    if (!fs.existsSync(abs)) continue; // already gone — office 2's business, not a deletion
    if (!isRetired(abs)) {
      kept += 1;
      continue;
    }
    try {
      fs.unlinkSync(abs);
      deleted.push(row.path);
    } catch {
      kept += 1; // unreadable is not collectable
    }
  }

  // THE DOCUMENT'S OWN INDEX ROW GOES WITH IT — the hub's file, the same artifact's registration,
  // and a delete is only a delete if it takes the file and the row.
  if (deleted.length) {
    const idxPath = path.join(root, ".systemview", "reports.index.json");
    try {
      const idx = JSON.parse(fs.readFileSync(idxPath, "utf8") || "{}");
      const gone = new Set(deleted);
      for (const k of Object.keys(idx)) {
        if (Array.isArray(idx[k])) idx[k] = idx[k].filter((r) => !(r && gone.has(r.path)));
      }
      fs.writeFileSync(idxPath, JSON.stringify(idx, null, 1));
    } catch {
      /* no index, nothing to clean */
    }
  }

  // Said, not fixed: `documents.json` belongs to the shell's parse.
  const dangling = deleted.slice();
  return { deleted, kept, dangling };
}

/**
 * OFFICE 2 — a run pointer naming a file that is not there.
 *
 * Its own rule, standing on its own: the reference is garbage whatever happened to the file. It
 * reads `~/.autobot/jobs/<job>/runs/*.json`, where a record carries `report {path}` and `reports[]`.
 */
function sweepDeadPointers({ runsDir, rootOf } = {}) {
  const dir = runsDir || RUNS_DIR();
  const resolve = (p) => {
    if (path.isAbsolute(p)) return p;
    const root = rootOf && rootOf(p);
    return root ? path.join(root, p) : null;
  };
  const alive = (ref) => {
    if (!ref || !ref.path) return false;
    const abs = resolve(String(ref.path));
    // UNRESOLVABLE IS NOT DEAD. A relative path with no root to hang it on is a path this sweep
    // cannot judge, and deleting a reference on a guess is worse than leaving it.
    if (!abs) return true;
    return fs.existsSync(abs);
  };

  const cleared = [];
  let jobs = [];
  try {
    jobs = fs.readdirSync(dir);
  } catch {
    return { cleared: [] };
  }
  for (const job of jobs) {
    const runs = path.join(dir, job, "runs");
    let names = [];
    try {
      names = fs.readdirSync(runs);
    } catch {
      continue;
    }
    for (const n of names) {
      if (!n.endsWith(".json")) continue;
      const file = path.join(runs, n);
      let rec;
      try {
        rec = JSON.parse(fs.readFileSync(file, "utf8"));
      } catch {
        continue; // a malformed record points at nothing and is not this sweep's to repair
      }
      let touched = false;
      if (rec.report && !alive(rec.report)) {
        delete rec.report;
        touched = true;
      }
      if (Array.isArray(rec.reports)) {
        const keep = rec.reports.filter(alive);
        if (keep.length !== rec.reports.length) {
          rec.reports = keep;
          touched = true;
        }
      }
      if (!touched) continue;
      try {
        fs.writeFileSync(file, JSON.stringify(rec, null, 1));
        cleared.push(`${job}/${n}`);
      } catch {
        /* the pointer stays dead and is reported by the next sweep */
      }
    }
  }
  return { cleared };
}

module.exports = { collectRetired, sweepDeadPointers, isRetired, registryRows };
