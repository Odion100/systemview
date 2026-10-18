// THE MACHINE DOOR'S CLAIMS (RFC-069). These four verbs answer for any absolute path on the
// machine, so their bounds were the review's whole argument — and until this suite, every one of
// them was held on faith: absolute-only (the relative grammar belongs to projects), `~` expanded,
// `file://` stripped, writes refusing to cascade directories into existence, and delete being `rm`,
// never `rm -rf` — a FILE or an EMPTY folder, with a tree refused by name.
//
// Real fs in a temp dir, not a mock: the tree-refusal claim IS statSync + readdirSync behaviour,
// so a fake would test the mock's idea of a directory.
const assert = require("node:assert");
const { test, before, after, describe } = require("node:test");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { machinePath, readPath, writePath, deletePath, listPath } = require("./machineDoors");

let tmp;
before(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "sv-doors-"));
});
after(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

describe("machinePath — the address grammar", () => {
  test("a relative path is refused — that grammar belongs to projects", () => {
    assert.strictEqual(machinePath("src/index.js"), null);
    assert.strictEqual(machinePath(""), null);
    assert.strictEqual(machinePath(null), null);
  });
  test("~/ expands to the home directory", () => {
    assert.strictEqual(machinePath("~/notes.md"), path.join(os.homedir(), "notes.md"));
  });
  test("a file:// prefix is stripped and the rest resolves", () => {
    assert.strictEqual(machinePath("file:///tmp/x.txt"), path.normalize("/tmp/x.txt"));
  });
  test("the address is normalized — dot segments collapse", () => {
    assert.strictEqual(machinePath("/a/b/../c.txt"), path.normalize("/a/c.txt"));
  });
});

describe("the verbs refuse a relative address, each by name", () => {
  for (const [name, verb] of [
    ["readPath", readPath],
    ["writePath", writePath],
    ["deletePath", deletePath],
    ["listPath", listPath],
  ]) {
    test(`${name} refuses and says where relative paths belong`, async () => {
      const res = await verb({ path: "relative/thing" });
      assert.strictEqual(res.ok, false);
      assert.match(res.error, /absolute path.*relative paths belong to a project/);
    });
  }
});

describe("readPath", () => {
  test("reads an absolute file and marks the answer as the machine's", async () => {
    const p = path.join(tmp, "read-me.txt");
    fs.writeFileSync(p, "hello from the machine");
    const res = await readPath({ path: p });
    assert.deepStrictEqual(res, { ok: true, path: p, machine: true, content: "hello from the machine" });
  });
  test("a missing file is an honest refusal, not a throw", async () => {
    const res = await readPath({ path: path.join(tmp, "never-written.txt") });
    assert.strictEqual(res.ok, false);
    assert.ok(res.error);
  });
});

describe("writePath", () => {
  test("writes a file whose parent exists", async () => {
    const p = path.join(tmp, "written.txt");
    const res = await writePath({ path: p, content: "placed" });
    assert.strictEqual(res.ok, true);
    assert.strictEqual(fs.readFileSync(p, "utf8"), "placed");
  });
  test("a missing parent is refused by name — files, never directory cascades", async () => {
    const p = path.join(tmp, "no-such-dir", "x.txt");
    const res = await writePath({ path: p, content: "y" });
    assert.strictEqual(res.ok, false);
    assert.match(res.error, /does not exist.*never directory cascades/);
    assert.strictEqual(fs.existsSync(path.dirname(p)), false);
  });
  test("null content writes an empty file rather than the string 'null'", async () => {
    const p = path.join(tmp, "empty.txt");
    await writePath({ path: p, content: null });
    assert.strictEqual(fs.readFileSync(p, "utf8"), "");
  });
});

describe("deletePath — rm, never rm -rf", () => {
  test("deletes a file", async () => {
    const p = path.join(tmp, "doomed.txt");
    fs.writeFileSync(p, "x");
    const res = await deletePath({ path: p });
    assert.strictEqual(res.ok, true);
    assert.strictEqual(fs.existsSync(p), false);
  });
  test("deletes an EMPTY directory", async () => {
    const d = path.join(tmp, "empty-dir");
    fs.mkdirSync(d);
    const res = await deletePath({ path: d });
    assert.strictEqual(res.ok, true);
    assert.strictEqual(fs.existsSync(d), false);
  });
  test("REFUSES a directory with contents — the tree survives, refusal names the bound", async () => {
    const d = path.join(tmp, "full-dir");
    fs.mkdirSync(d);
    fs.writeFileSync(path.join(d, "kept.txt"), "still here");
    const res = await deletePath({ path: d });
    assert.strictEqual(res.ok, false);
    assert.match(res.error, /directory with contents.*never a tree/);
    assert.strictEqual(fs.readFileSync(path.join(d, "kept.txt"), "utf8"), "still here");
  });
  test("a missing path is an honest refusal, not a throw", async () => {
    const res = await deletePath({ path: path.join(tmp, "ghost") });
    assert.strictEqual(res.ok, false);
  });
});

describe("listPath", () => {
  test("lists entries with their directory flag", async () => {
    const d = path.join(tmp, "listing");
    fs.mkdirSync(path.join(d, "sub"), { recursive: true });
    fs.writeFileSync(path.join(d, "a.txt"), "x");
    const res = await listPath({ path: d });
    assert.strictEqual(res.ok, true);
    const byName = Object.fromEntries(res.entries.map((e) => [e.name, e.dir]));
    assert.deepStrictEqual(byName, { sub: true, "a.txt": false });
  });
});
