// RFC-071 — WHAT IS buAPI ON, and how many documents have updates nobody has sent. The claims that
// matter are the two that keep this honest across a folder: a document with no members is not a
// row, and "behind" is computed the SAME way the window computes it or the band's number argues
// with the chip the user is looking at.
const assert = require("node:assert");
const { test } = require("node:test");
const { documentMembersOn, membersOf, hashOf } = require("./documentMembers");

const DOC = (who, sent = "", body = "# a plan\n\nprose\n") =>
  `::members{who=${who}${sent ? ` sent=${sent}` : ""}}\n${body}`;

const fake = (files) => {
  const api = documentMembersOn({
    listFiles: async () => Object.keys(files).map((path) => ({ path })),
    readFile: async (_pc, { path }) => (files[path] == null ? { ok: false } : { content: files[path] }),
  });
  return api;
};

test("a document with no members line is not a row", async () => {
  const api = fake({ "a.md": "# nothing here\n", "b.md": DOC("buapi") });
  const r = await api({ projectCode: "p" });
  assert.deepEqual(r.documents.map((d) => d.path), ["b.md"]);
  assert.equal(r.withMembers, 1);
});

test("a members line with nobody in it is not membership", async () => {
  const api = fake({ "a.md": "::members{who=}\n# x\n" });
  const r = await api({ projectCode: "p" });
  assert.deepEqual(r.documents, []);
});

test("asking for one member answers only their documents — what is buAPI on", async () => {
  const api = fake({
    "a.md": DOC("buapi|systemlynx"),
    "b.md": DOC("systemlynx"),
    "c.md": DOC("buapi"),
  });
  const r = await api({ projectCode: "p", member: "buapi" });
  assert.deepEqual(r.documents.map((d) => d.path), ["a.md", "c.md"]);
  assert.equal(r.member, "buapi");
});

test("behind means not told about THIS version, and never-sent counts as behind", async () => {
  const body = "# a plan\n\nprose\n";
  const stamp = hashOf(DOC("buapi", "", body));
  const api = fake({
    "told.md": DOC("buapi|systemlynx", `buapi:${stamp}`, body),
    "never.md": DOC("buapi", "", body),
  });
  const r = await api({ projectCode: "p" });
  const told = r.documents.find((d) => d.path === "told.md");
  assert.deepEqual(told.behind, ["systemlynx"], "the one who was told is not behind; the other is");
  assert.deepEqual(r.documents.find((d) => d.path === "never.md").behind, ["buapi"]);
  assert.equal(r.withUpdates, 2);
});

// The hash ignores the members line, or recording a send would instantly make the document dirty
// again — the same trap the window's copy is pinned against, and the two must agree.
test("the hash ignores the members line, so a send settles the document", () => {
  const body = "# a plan\n";
  const plain = hashOf(body);
  assert.equal(hashOf(`::members{who=a}\n${body}`), plain);
  assert.equal(hashOf(`::members{who=a sent=a:${plain}}\n${body}`), plain);
  const m = membersOf(`::members{who=a sent=a:${plain}}\n${body}`);
  assert.deepEqual(m.behind, [], "told about this version");
  assert.deepEqual(membersOf(`::members{who=a}\n${body}`).behind, ["a"]);
});

test("a file that cannot be read is skipped rather than failing the whole walk", async () => {
  const api = fake({ "gone.md": null, "good.md": DOC("buapi") });
  const r = await api({ projectCode: "p" });
  assert.deepEqual(r.documents.map((d) => d.path), ["good.md"]);
});

// AUTO IS PER MEMBER — "I should be able to choose exactly who I want to be auto, not just
// everyone" — so the attribute is a list and the hub reports it as one.
test("auto names WHICH members are told automatically, not whether the document is", async () => {
  const api = fake({ "a.md": "::members{who=buapi|systemlynx auto=buapi}\n# x\n" });
  const r = await api({ projectCode: "p" });
  assert.deepEqual(r.documents[0].auto, ["buapi"]);
  const none = fake({ "b.md": "::members{who=buapi}\n# x\n" });
  assert.deepEqual((await none({ projectCode: "p" })).documents[0].auto, []);
});
