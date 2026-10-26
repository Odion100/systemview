const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const os = require("os");
const path = require("path");

// RFC-073 §1.1/§1.4 — the hub's read-only door onto the shell's document registry. What these pin:
// the hub never throws where no shell has lived, the filter is the query, staleness is VISIBLE
// (file newer than the parse stamp), and a row whose pointer leads nowhere says `missing` instead
// of lying with old state.
const { documentsRegistryOn } = require("./documentsRegistry");

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "sv-registry-"));
process.env.AUTOBOT_DOCUMENTS = path.join(tmp, "documents.json");
const root = path.join(tmp, "systemview");
fs.mkdirSync(path.join(root, "RFCs"), { recursive: true });

const write = (rows) => fs.writeFileSync(process.env.AUTOBOT_DOCUMENTS, JSON.stringify(rows));
const door = documentsRegistryOn({ rootOf: () => root });

test("no registry file is an empty answer, never a thrown one", () => {
  fs.rmSync(process.env.AUTOBOT_DOCUMENTS, { force: true });
  assert.deepStrictEqual(door({ projectCode: "systemview" }), []);
});

test("the filter is the query — project, kind, arc", () => {
  write([
    { id: "RFC-073", kind: "rfc", path: "RFCs/RFC-073.md", project: "systemview", arc: "ARC-004", at: 1 },
    { id: "ARC-004", kind: "arc", path: "RFCs/arcs/ARC-004.md", project: "systemview", at: 1 },
    { id: "G-1", kind: "gap", path: "GAPS/G-1.md", project: "buapi", at: 1 },
  ]);
  assert.strictEqual(door({ projectCode: "systemview" }).length, 2);
  assert.strictEqual(door({ kind: "gap" })[0].project, "buapi");
  assert.deepStrictEqual(door({ arc: "ARC-004" }).map((r) => r.id), ["RFC-073"]);
});

test("staleness is visible — a file newer than the parse stamp says so (§1.4)", () => {
  const file = path.join(root, "RFCs", "RFC-073.md");
  fs.writeFileSync(file, "::rfc{id=RFC-073}\n");
  const mtime = fs.statSync(file).mtimeMs;
  write([
    { id: "RFC-073", kind: "rfc", path: "RFCs/RFC-073.md", project: "systemview", at: 1, state: { parsed: mtime + 60000 } },
    { id: "RFC-074", kind: "rfc", path: "RFCs/RFC-073.md", project: "systemview", at: 1, state: { parsed: mtime - 60000 } },
    { id: "RFC-075", kind: "rfc", path: "RFCs/RFC-073.md", project: "systemview", at: 1, state: null },
  ]);
  const [fresh, stale, wiped] = door({ projectCode: "systemview" });
  assert.strictEqual(fresh.stale, false);
  assert.strictEqual(stale.stale, true);
  assert.strictEqual(wiped.stale, true, "a wiped state is stale by definition — the next parse rebuilds it");
});

test("a pointer leading nowhere answers missing, not stale state read as truth", () => {
  write([{ id: "RFC-099", kind: "rfc", path: "RFCs/deleted.md", project: "systemview", at: 1, state: { parsed: 5 } }]);
  const [row] = door({ projectCode: "systemview" });
  assert.strictEqual(row.missing, true);
});
