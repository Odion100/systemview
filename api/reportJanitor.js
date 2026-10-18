// THE REPORTS BACKSTOP (his rule, 2026-10-16: "Archives can only come into existence if they have
// some sort of maintenance. You can't set up an archive that doesn't eventually delete.")
//
// Reports are communication, and the exit that keeps the pile honest is JUDGMENT — an agent's
// relevance sweep, done regularly, deleting what no longer speaks to anything. This module is not
// that. It is the floor under it: the clock he called "just a backup — far, far back", catching
// only what every sweep missed. So it collects a report ONLY when BOTH hold:
//
//   1. OLD — file mtime past the backstop (default 30 days, deliberately farther back than the
//      14-day run-record sweep in autobot's pruneRuns, so a pointer lapses before the clock can
//      ever reach the report it points at);
//   2. UNPOINTED — its path appears in NO job run record (~/.autobot/jobs/*/runs/*.json carries
//      `report {path}` and `reports[]`; a pointed report is a job card's evidence, and deleting it
//      turns the card into a liar).
//
// It also removes the index entries it orphans — a delete is only a delete if it takes the file
// AND the row (the rule deleteReport already lives by).
const fs = require("fs");
const path = require("path");
const os = require("os");

const BACKSTOP_MS = 30 * 24 * 60 * 60 * 1000;

// Every report path a run record still points at, read fresh per collection — the records are the
// one source of "something still needs this", and caching them would hold a pointer past its sweep.
function pointedPaths(runsDir) {
  const pointed = new Set();
  let jobs = [];
  try { jobs = fs.readdirSync(runsDir); } catch { return pointed; }
  for (const job of jobs) {
    const dir = path.join(runsDir, job, "runs");
    let names = [];
    try { names = fs.readdirSync(dir); } catch { continue; }
    for (const n of names) {
      if (!n.endsWith(".json")) continue;
      try {
        const r = JSON.parse(fs.readFileSync(path.join(dir, n), "utf8"));
        const refs = [r.report, ...(Array.isArray(r.reports) ? r.reports : [])];
        for (const ref of refs) if (ref && ref.path) pointed.add(String(ref.path));
      } catch { /* a malformed record points at nothing, which fails toward keeping files */ }
    }
  }
  return pointed;
}

// Collect one project root. Returns what it did so the caller can say so — a janitor that deletes
// silently is a janitor nobody can audit.
function collectReports(root, { runsDir, now = Date.now(), backstopMs = BACKSTOP_MS } = {}) {
  const svDir = path.join(root, ".systemview");
  let names = [];
  try { names = fs.readdirSync(svDir); } catch { return { deleted: [], kept: 0 }; }
  const reports = names.filter((n) => /^report\..+\.md$/i.test(n));
  if (!reports.length) return { deleted: [], kept: 0 };

  const pointed = pointedPaths(runsDir || path.join(os.homedir(), ".autobot", "jobs"));
  const deleted = [];
  for (const n of reports) {
    const rel = `.systemview/${n}`;
    const abs = path.join(svDir, n);
    if (pointed.has(rel)) continue; // a job card's evidence is never the clock's to take
    let st;
    try { st = fs.statSync(abs); } catch { continue; }
    if (now - st.mtimeMs <= backstopMs) continue; // young enough that judgment still owns it — the clock takes only what is PAST the line
    try { fs.unlinkSync(abs); deleted.push(rel); } catch { /* unreadable ≠ collectable */ }
  }

  // The index rows of what just left — same both-halves rule as deleteReport.
  if (deleted.length) {
    const idxPath = path.join(svDir, "reports.index.json");
    try {
      const idx = JSON.parse(fs.readFileSync(idxPath, "utf8") || "{}");
      const gone = new Set(deleted);
      for (const k of Object.keys(idx)) {
        if (Array.isArray(idx[k])) idx[k] = idx[k].filter((r) => !(r && gone.has(r.path)));
      }
      fs.writeFileSync(idxPath, JSON.stringify(idx, null, 1));
    } catch { /* no index, nothing to clean */ }
  }
  return { deleted, kept: reports.length - deleted.length };
}

module.exports = { collectReports, pointedPaths, BACKSTOP_MS };
