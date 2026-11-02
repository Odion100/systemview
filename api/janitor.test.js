// THE JANITOR'S CLAIMS — one abstraction, two offices, and the point of the tests is that the two
// RULES stay separate. A rule for one office may never change how the other is cleaned.
//
// OFFICE 1: a registered document whose leaf says `retired=` goes. Any kind — it was never about
// reports. No clock, no mtime, no age.
// OFFICE 2: a run pointer naming a file that is not there goes, whatever happened to the file.
//
// Real fs in a temp dir; the registry and the run records are real JSON shaped exactly like
// `~/.autobot/documents.json` and `~/.autobot/jobs/*/runs/*.json`.
const assert = require("node:assert");
const { test, beforeEach, afterEach, describe } = require("node:test");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { collectRetired, sweepDeadPointers, isRetired } = require("./janitor");

let tmp, root, runsDir, regFile;

const doc = (rel, leaf) => {
  const abs = path.join(root, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, `# a document\n\n${leaf}\n\nbody\n`);
  return rel;
};
const register = (rows) => fs.writeFileSync(regFile, JSON.stringify(rows));
const runRecord = (job, id, body) => {
  const dir = path.join(runsDir, job, "runs");
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${id}.json`);
  fs.writeFileSync(file, JSON.stringify(body));
  return file;
};
const readRun = (f) => JSON.parse(fs.readFileSync(f, "utf8"));
const collect = () => collectRetired(root, { projectCode: "pc", registryFile: regFile });

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "sv-janitor-"));
  root = path.join(tmp, "proj");
  runsDir = path.join(tmp, "jobs");
  regFile = path.join(tmp, "documents.json");
  fs.mkdirSync(path.join(root, ".systemview"), { recursive: true });
  fs.mkdirSync(runsDir, { recursive: true });
  register([]);
});
afterEach(() => fs.rmSync(tmp, { recursive: true, force: true }));

describe("office 1 — retired documents, and it was never about reports", () => {
  test("every KIND retires, not just a report", () => {
    const r = doc(".systemview/report.pc.a.md", '::report{id="a" as=account retain=24h retired=2026-11-02}');
    const f = doc("RFCs/RFC-100-x.md", '::rfc{id=RFC-100 retired=2026-11-02}');
    const g = doc("gaps/G-9.md", '::gap{id=G-9 retired=2026-11-02}');
    const live = doc(".systemview/report.pc.b.md", '::report{id="b" as=account retain=24h}');
    register([r, f, g, live].map((p) => ({ id: p, kind: "x", path: p, project: "pc" })));

    const res = collect();

    assert.deepStrictEqual(res.deleted.sort(), [r, f, g].sort());
    assert.strictEqual(res.kept, 1);
    assert.strictEqual(fs.existsSync(path.join(root, live)), true);
  });

  // THE FILE SET IS THE REGISTRY, NEVER A GLOB. A document's identity is the leaf it declares; a
  // filename convention is the thing that silently finds nothing when a document moves.
  test("a retired document NOT in the registry is not collected — the registry is the file set", () => {
    const orphan = doc(".systemview/report.pc.unregistered.md", '::report{id="z" as=account retain=24h retired=2026-11-02}');
    register([]);
    assert.deepStrictEqual(collect().deleted, []);
    assert.strictEqual(fs.existsSync(path.join(root, orphan)), true);
  });

  test("another project's rows are left alone", () => {
    const mine = doc(".systemview/report.pc.mine.md", '::report{id="m" as=account retain=24h retired=2026-11-02}');
    const theirs = doc(".systemview/report.other.theirs.md", '::report{id="t" as=account retain=24h retired=2026-11-02}');
    register([
      { id: "m", kind: "report", path: mine, project: "pc" },
      { id: "t", kind: "report", path: theirs, project: "other" },
    ]);

    assert.deepStrictEqual(collect().deleted, [mine]);
    assert.strictEqual(fs.existsSync(path.join(root, theirs)), true);
  });

  // THE WHOLE POINT OF DROPPING THE CLOCK — his ruling: the documents have their life cycle, and an
  // arbitrary age was answering a question the lifecycle already answers.
  test("age decides nothing — an ancient un-retired document survives", () => {
    const old = doc(".systemview/report.pc.ancient.md", '::report{id="c" as=planning retain=24h}');
    const t = new Date(Date.now() - 400 * 24 * 60 * 60 * 1000);
    fs.utimesSync(path.join(root, old), t, t);
    register([{ id: "c", kind: "report", path: old, project: "pc" }]);

    assert.deepStrictEqual(collect().deleted, []);
    assert.strictEqual(fs.existsSync(path.join(root, old)), true);
  });

  // `permanent` means no clock will ever take this document. It does not mean nobody may decide the
  // document is over, and `retired=` is exactly that decision — later, and more specific.
  test("retiring a permanent document still deletes it", () => {
    const rel = doc(".systemview/report.pc.spec.md", '::report{id="d" as=spec retain=permanent retired=2026-11-02}');
    register([{ id: "d", kind: "report", path: rel, project: "pc" }]);
    assert.deepStrictEqual(collect().deleted, [rel]);
  });

  test("the word in prose is not the signal — it has to be on a leaf", () => {
    const rel = doc(".systemview/report.pc.prose.md", "this one talks about retired= documents");
    register([{ id: "p", kind: "report", path: rel, project: "pc" }]);
    assert.deepStrictEqual(collect().deleted, []);
  });

  test("the document's own index row goes with it", () => {
    const gone = doc(".systemview/report.pc.indexed.md", '::report{id="i" as=audit retain=7d retired=2026-11-02}');
    const stays = doc(".systemview/report.pc.kept.md", '::report{id="j" as=audit retain=7d}');
    register([gone, stays].map((p) => ({ id: p, kind: "report", path: p, project: "pc" })));
    const idx = path.join(root, ".systemview", "reports.index.json");
    fs.writeFileSync(idx, JSON.stringify({ pc: [{ path: gone }, { path: stays }] }));

    collect();

    assert.deepStrictEqual(JSON.parse(fs.readFileSync(idx, "utf8")), { pc: [{ path: stays }] });
  });

  // THE REFUSAL, AND IT IS DELIBERATE. `documents.json` is the shell's to write (RFC-073 c40), so a
  // janitor that rewrote it would be cleaning another service's ledger — the exact rule-crossing
  // this module is organised to avoid. It reports the row instead.
  test("it reports the registry rows it orphaned and does not rewrite the registry", () => {
    const rel = doc(".systemview/report.pc.r.md", '::report{id="r" as=account retain=24h retired=2026-11-02}');
    register([{ id: "r", kind: "report", path: rel, project: "pc" }]);
    const before = fs.readFileSync(regFile, "utf8");

    const res = collect();

    assert.deepStrictEqual(res.dangling, [rel]);
    assert.strictEqual(fs.readFileSync(regFile, "utf8"), before, "the registry is not this module's to write");
  });

  test("isRetired fails toward KEEPING when it cannot read the file", () => {
    assert.strictEqual(isRetired(path.join(root, "nothing-here.md")), false);
  });

  test("an unreadable registry is an empty answer, not a throw", () => {
    fs.writeFileSync(regFile, "{not json");
    assert.deepStrictEqual(collect(), { deleted: [], kept: 0, dangling: [] });
  });
});

describe("office 2 — pointers that lead nowhere, on their own rule", () => {
  const sweep = () => sweepDeadPointers({ runsDir, rootOf: () => root });

  test("a pointer naming a missing file is cleared; a live one is not", () => {
    const live = doc(".systemview/report.pc.live.md", '::report{id="l" as=account retain=24h}');
    const dead = runRecord("proactive-development", "r1", { status: "finished", report: { path: ".systemview/report.pc.ghost.md" } });
    const good = runRecord("arc-development", "r2", { report: { path: live } });

    const res = sweep();

    assert.deepStrictEqual(res.cleared, ["proactive-development/r1.json"]);
    assert.strictEqual("report" in readRun(dead), false);
    assert.strictEqual(readRun(dead).status, "finished", "the rest of the record is untouched");
    assert.deepStrictEqual(readRun(good).report, { path: live });
  });

  test("it clears one entry out of reports[] and leaves the rest", () => {
    const live = doc(".systemview/report.pc.keep.md", '::report{id="k" as=account retain=24h}');
    const rec = runRecord("arc-development", "r3", { reports: [{ path: ".systemview/report.pc.ghost.md" }, { path: live }] });
    sweep();
    assert.deepStrictEqual(readRun(rec).reports, [{ path: live }]);
  });

  // IT DOES NOT CARE WHO DELETED ANYTHING. That independence is what makes it a separate office
  // rather than a side-effect of office 1's delete.
  test("it runs and clears with office 1 having deleted nothing at all", () => {
    const rec = runRecord("arc-development", "r4", { report: { path: ".systemview/never-existed.md" } });
    assert.deepStrictEqual(collect().deleted, []);
    assert.deepStrictEqual(sweep().cleared, ["arc-development/r4.json"]);
    assert.strictEqual("report" in readRun(rec), false);
  });

  // UNRESOLVABLE IS NOT DEAD — deleting a reference this sweep cannot judge is worse than leaving it.
  test("a relative path with no root to hang it on is left alone", () => {
    const rec = runRecord("arc-development", "r5", { report: { path: ".systemview/report.pc.x.md" } });
    const before = fs.readFileSync(rec, "utf8");
    assert.deepStrictEqual(sweepDeadPointers({ runsDir, rootOf: () => null }).cleared, []);
    assert.strictEqual(fs.readFileSync(rec, "utf8"), before);
  });

  test("a malformed record is skipped rather than taking the sweep down", () => {
    const dir = path.join(runsDir, "proactive-development", "runs");
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "bad.json"), "{not json");
    assert.deepStrictEqual(sweep().cleared, []);
  });

  test("no jobs folder is an empty answer", () => {
    assert.deepStrictEqual(sweepDeadPointers({ runsDir: path.join(tmp, "nowhere") }).cleared, []);
  });
});
