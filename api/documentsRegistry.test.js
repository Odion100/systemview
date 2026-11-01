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

// RFC-076 §4.6 — the reader's first open: the hub's own ledger, first write wins, joined onto the
// row at read time. Its own file because the shell regenerates documents.json on every parse — a
// fact written between parses would die in the rewrite.
test("first open stamps once — the second open keeps the first clock", () => {
  process.env.AUTOBOT_DOCUMENTS_OPENED = path.join(tmp, "documents-opened.json");
  const { stampOpened } = require("./documentsRegistry");
  const a = stampOpened("rep-1");
  assert.strictEqual(a.ok, true);
  const b = stampOpened("rep-1");
  assert.strictEqual(b.already, true);
  assert.strictEqual(b.openedAt, a.openedAt, "the clock is attention, not renders");
  assert.strictEqual(stampOpened("").ok, false, "no id, no stamp");
});

test("the registry read joins openedAt onto the row — absent when never opened", () => {
  process.env.AUTOBOT_DOCUMENTS_OPENED = path.join(tmp, "documents-opened.json");
  write([
    { id: "rep-1", kind: "report", path: "RFCs/rep-1.md", project: "systemview", at: 1 },
    { id: "rep-2", kind: "report", path: "RFCs/rep-2.md", project: "systemview", at: 1 },
  ]);
  const rows = door({ projectCode: "systemview" });
  assert.strictEqual(typeof rows.find((r) => r.id === "rep-1").openedAt, "number");
  assert.strictEqual(rows.find((r) => r.id === "rep-2").openedAt, undefined, "unread stays unstamped");
});

test("divert restarts the clock — the one caller allowed to move an existing stamp", async () => {
  process.env.AUTOBOT_DOCUMENTS_OPENED = path.join(tmp, "documents-opened.json");
  const { stampOpened } = require("./documentsRegistry");
  const first = stampOpened("rep-divert");
  await new Promise((r) => setTimeout(r, 5));
  const diverted = stampOpened("rep-divert", { restart: true });
  assert.strictEqual(diverted.ok, true);
  assert.ok(diverted.openedAt > first.openedAt, "the clock re-measures attention from the divert");
});

// WHICH ARCS AM I ON — the question the registry could not answer, and the reason it could not:
// `projectCode` was effectively required, so an agent had to already know where to look. An arc
// routinely lives in a project the agent working it does not live in.
test("member asks across EVERY project — the arc's own project is not the agent's", () => {
  write([
    { id: "ARC-004", kind: "arc", path: "a.md", project: "autobot", members: ["systemview-test", "bu"], at: 1 },
    { id: "ARC-009", kind: "arc", path: "b.md", project: "buapi", members: ["bu"], at: 1 },
    { id: "ARC-011", kind: "arc", path: "c.md", project: "systemview", members: ["systemview-test"], at: 1 },
  ]);
  const mine = door({ kind: "arc", member: "systemview-test" }).map((r) => r.id);
  assert.deepStrictEqual(mine, ["ARC-004", "ARC-011"]);
  assert.deepStrictEqual(door({ kind: "arc", member: "bu" }).map((r) => r.id), ["ARC-004", "ARC-009"]);
});

// OWNING AN OBJECTIVE IS BEING ON IT. The commonest way to be working an arc is to have been
// handed one objective; an agent told it is on nothing while holding O3 is the failure here.
test("an objective's owner is on the arc even when the members line does not name them", () => {
  write([{ id: "ARC-004", kind: "arc", path: "a.md", project: "autobot", members: ["bu"], owners: ["agentci"], at: 1 }]);
  assert.deepStrictEqual(door({ member: "agentci" }).map((r) => r.id), ["ARC-004"]);
  assert.deepStrictEqual(door({ member: "bu" }).map((r) => r.id), ["ARC-004"]);
  assert.deepStrictEqual(door({ member: "nobody" }), []);
});

// AN EXACT NAME, NEVER A PREFIX — the pipe-wrapping lesson from `document.updated` hooks, where a
// bare `contains: "bu"` woke an agent for `buapi`'s documents.
test("a member match is exact — bu is not buapi", () => {
  write([{ id: "ARC-004", kind: "arc", path: "a.md", project: "x", members: ["buapi"], at: 1 }]);
  assert.deepStrictEqual(door({ member: "bu" }), []);
  assert.deepStrictEqual(door({ member: "buapi" }).map((r) => r.id), ["ARC-004"]);
});

test("no member named is every row — the filter stays optional", () => {
  write([
    { id: "ARC-004", kind: "arc", path: "a.md", project: "x", members: ["bu"], at: 1 },
    { id: "RFC-1", kind: "rfc", path: "b.md", project: "x", at: 1 },
  ]);
  assert.strictEqual(door({}).length, 2);
  assert.strictEqual(door({ member: "" }).length, 2);
});

// A ROW FROM BEFORE THIS LANDED carries no members at all, and must not answer a membership
// question with a false yes — the registry re-parses lazily, so both shapes coexist for a while.
test("a row with no members or owners matches nobody", () => {
  write([{ id: "ARC-004", kind: "arc", path: "a.md", project: "x", at: 1 }]);
  assert.deepStrictEqual(door({ member: "systemview-test" }), []);
  assert.strictEqual(door({}).length, 1);
});
