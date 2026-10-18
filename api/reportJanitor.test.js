// THE BACKSTOP'S CLAIMS. The one rule with teeth is the conjunction: a report is collected only
// when it is OLD **and** UNPOINTED — every other combination is kept, because the clock is a
// backup behind the agent's relevance sweeps, never the mechanism. Real fs in a temp dir; the
// run-record half is real JSON files shaped exactly like ~/.autobot/jobs/*/runs/*.json.
const assert = require("node:assert");
const { test, beforeEach, afterEach, describe } = require("node:test");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { collectReports, BACKSTOP_MS } = require("./reportJanitor");

const DAY = 24 * 60 * 60 * 1000;
let tmp, root, runsDir, NOW;

const reportFile = (name, ageDays) => {
  const p = path.join(root, ".systemview", name);
  fs.writeFileSync(p, "# a report");
  const t = new Date(NOW - ageDays * DAY);
  fs.utimesSync(p, t, t);
  return `.systemview/${name}`;
};
const runRecord = (job, id, body) => {
  const dir = path.join(runsDir, job, "runs");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `${id}.json`), JSON.stringify(body));
};
const collect = () => collectReports(root, { runsDir, now: NOW });

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "sv-janitor-"));
  root = path.join(tmp, "proj");
  runsDir = path.join(tmp, "jobs");
  fs.mkdirSync(path.join(root, ".systemview"), { recursive: true });
  fs.mkdirSync(runsDir, { recursive: true });
  NOW = 1792176000000; // fixed, so age is arithmetic rather than wall-clock
});
afterEach(() => fs.rmSync(tmp, { recursive: true, force: true }));

describe("the conjunction — old AND unpointed, nothing else", () => {
  test("old + unpointed is collected; the other three quadrants survive", () => {
    const oldUnpointed = reportFile("report.pc.old-unpointed.md", 40);
    const oldPointed = reportFile("report.pc.old-pointed.md", 40);
    const youngUnpointed = reportFile("report.pc.young-unpointed.md", 3);
    const youngPointed = reportFile("report.pc.young-pointed.md", 3);
    runRecord("proactive-work", "r1", { report: { path: oldPointed } });
    runRecord("proactive-work", "r2", { reports: [{ path: youngPointed }] });

    const res = collect();

    assert.deepStrictEqual(res.deleted, [oldUnpointed]);
    assert.strictEqual(res.kept, 3);
    assert.strictEqual(fs.existsSync(path.join(root, oldUnpointed)), false);
    for (const rel of [oldPointed, youngUnpointed, youngPointed])
      assert.strictEqual(fs.existsSync(path.join(root, rel)), true, `${rel} must survive`);
  });

  test("exactly at the backstop is still young — the clock takes what is PAST it", () => {
    reportFile("report.pc.on-the-line.md", BACKSTOP_MS / DAY);
    const res = collect();
    assert.deepStrictEqual(res.deleted, []);
  });
});

describe("the index loses the rows of what left, and only those", () => {
  test("deleted paths leave the index; kept paths stay", () => {
    const dead = reportFile("report.pc.dead.md", 40);
    const alive = reportFile("report.pc.alive.md", 2);
    fs.writeFileSync(
      path.join(root, ".systemview", "reports.index.json"),
      JSON.stringify({ pc: [{ name: "dead", path: dead }, { name: "alive", path: alive }], __hidden: [] }),
    );
    collect();
    const idx = JSON.parse(fs.readFileSync(path.join(root, ".systemview", "reports.index.json"), "utf8"));
    assert.deepStrictEqual(idx.pc.map((r) => r.name), ["alive"]);
    assert.deepStrictEqual(idx.__hidden, []); // non-array keys and other shapes untouched
  });
});

describe("what is never its business", () => {
  test("non-report files in .systemview are untouched at any age", () => {
    const p = path.join(root, ".systemview", "reports.index.json");
    fs.writeFileSync(p, "{}");
    const old = new Date(NOW - 400 * DAY);
    fs.utimesSync(p, old, old);
    const notes = path.join(root, ".systemview", "notes.md");
    fs.writeFileSync(notes, "x");
    fs.utimesSync(notes, old, old);
    const res = collect();
    assert.deepStrictEqual(res.deleted, []);
    assert.ok(fs.existsSync(p) && fs.existsSync(notes));
  });

  test("a root with no .systemview, or a missing runs dir, is a quiet no-op", () => {
    assert.deepStrictEqual(collectReports(path.join(tmp, "nowhere"), { runsDir, now: NOW }), { deleted: [], kept: 0 });
    reportFile("report.pc.orphan.md", 40);
    // runsDir absent: nothing is pointed, so OLD still collects — the records' absence must not
    // protect garbage forever, only a record itself protects a report.
    const res = collectReports(root, { runsDir: path.join(tmp, "no-jobs"), now: NOW });
    assert.strictEqual(res.deleted.length, 1);
  });

  test("a malformed run record points at nothing and fails toward keeping files", () => {
    const old = reportFile("report.pc.near-miss.md", 40);
    runRecord("proactive-work", "bad", null); // JSON "null"
    const dir = path.join(runsDir, "proactive-work", "runs");
    fs.writeFileSync(path.join(dir, "broken.json"), "{not json");
    runRecord("proactive-work", "good", { report: { path: old } });
    const res = collect();
    assert.deepStrictEqual(res.deleted, []); // the good record still protected it
  });
});
