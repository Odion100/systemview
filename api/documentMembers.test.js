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

// BOTH LEVELS, OR THE VERB LIES ABOUT A SUBSCRIPTION.
//
// Found by use, 2026-10-20: `documents` read only the `::members` line, so a project brought into
// ONE THREAD was invisible to the only verb that answers "what am I on?" — while the document
// itself said they were on it. The delivery message sends members here to check, which is what
// turned a quiet asymmetry into a verb that contradicts the file it is reading.
const { threadsOf } = require("./documentMembers");

const WITH_THREAD = [
  "::members{who=systemview-test}",
  "# a plan",
  "::::thread{id=t1 members=buapi}",
  "the argument",
  "::::",
].join("\n");

test("a thread-only member is visible — the case that was invisible", () => {
  const m = membersOf(WITH_THREAD);
  assert.deepEqual(m.everyone, ["systemview-test", "buapi"]);
  assert.deepEqual(m.threads.map((t) => t.id), ["t1"]);
  assert.deepEqual(m.threads[0].who, ["buapi"]);
  assert.deepEqual(m.threads[0].behind, ["buapi"]);
});

test("a document whose membership lives only on its threads is still a document", () => {
  const only = ["# no members line", "::::thread{id=t1 members=buapi}", "x", "::::"].join("\n");
  const m = membersOf(only);
  assert.ok(m, "it used to answer null and vanish from the list entirely");
  assert.deepEqual(m.who, []);
  assert.deepEqual(m.everyone, ["buapi"]);
});

test("a file with no membership anywhere is still not a document", () => {
  assert.equal(membersOf("# just prose\n\nnothing here\n"), null);
  assert.equal(membersOf(""), null);
});

// HIS RULE: document membership means all threads. The document's hash is the whole source, so
// being current on it covers every thread by construction.
test("a member current on the document is behind on no thread", () => {
  // Built the way the window builds it: stamp the hash of the finished document. `hashOf` ignores
  // the ::members line, so writing the stamp cannot change the value being stamped.
  const shape = ["::members{who=sv sent=sv:HASH}", "# a", "::::thread{id=t1 members=sv}", "x", "::::"].join("\n");
  const doc = shape.replace("HASH", hashOf(shape));
  assert.deepEqual(membersOf(doc).behind, [], "the stamp did not take — check hashOf ignores ::members");
  assert.deepEqual(membersOf(doc).threads[0].behind, []);
});

// TELLING SOMEBODY IS NOT A CHANGE TO THE DOCUMENT. Stamping `sent=` on a thread opener used to
// move the document's hash, so telling ONE thread member made EVERY document member behind again —
// every time, forever, on any document whose threads were actually in use.
test("a thread's sent= stamp does not re-dirty the document's own members", () => {
  const before = ["::members{who=sv}", "# a", "::::thread{id=t1 members=buapi}", "x", "::::"].join("\n");
  const after = before.replace("members=buapi}", "members=buapi sent=buapi:abc}");
  assert.equal(hashOf(before), hashOf(after));
});

test("neither does adding a member to a thread", () => {
  const before = ["::members{who=sv}", "# a", "::::thread{id=t1 members=buapi}", "x", "::::"].join("\n");
  const after = before.replace("members=buapi}", "members=buapi|systemlynx}");
  assert.equal(hashOf(before), hashOf(after));
});

// BUT A NEW THREAD IS A REAL CHANGE, which is why the opener is normalised to its id rather than
// dropped — dropping it would make adding a whole conversation invisible to everyone watching.
test("a NEW thread does dirty the document", () => {
  const before = ["::members{who=sv}", "# a", "::::thread{id=t1 members=buapi}", "x", "::::"].join("\n");
  const after = [before, "::::thread{id=t2 members=sv}", "y", "::::"].join("\n");
  assert.notEqual(hashOf(before), hashOf(after));
});

test("and so does editing what a thread says", () => {
  const before = ["::members{who=sv}", "# a", "::::thread{id=t1 members=buapi}", "x", "::::"].join("\n");
  assert.notEqual(hashOf(before), hashOf(before.replace("\nx\n", "\nx CHANGED\n")));
});

// HIS OLDER RULE SURVIVES: behind on the document, still reachable thread by thread.
test("a member behind on the document still appears under each thread", () => {
  const m = membersOf(["::members{who=sv}", "# a", "::::thread{id=t1 members=sv}", "x", "::::"].join("\n"));
  assert.deepEqual(m.behind, ["sv"]);
  assert.deepEqual(m.threads[0].behind, ["sv"]);
});

// THE FENCE AND THE ID — the two rules the window learned the hard way, copied deliberately.
test("finds a thread at a deeper fence and reads the id as the FIRST attribute", () => {
  const deep = [":::::thread{id=t2 members=a|b sent=a:zz}", "body", ":::::"].join("\n");
  const [t] = threadsOf(deep);
  assert.equal(t.id, "t2");
  assert.deepEqual(t.who, ["a", "b"]);
  assert.equal(t.sent.a, "zz");
});

test("the thread's opening line is not part of its body, so a stamp is not its own change", () => {
  const [t] = threadsOf("::::thread{id=t1 members=a}\nbody\n::::");
  assert.equal(t.body, "body");
});

test("a thread naming nobody is not carried as a subscription", () => {
  assert.deepEqual(threadsOf("::::thread{id=t1}\nbody\n::::"), []);
});

// THE FOLDER-LEVEL CLAIMS — the gate and the count, both of which decided the answer silently.
test("the member filter matches a thread-only membership", async () => {
  const api = fake({ "a.md": WITH_THREAD });
  const mine = await api({ projectCode: "p", member: "buapi" });
  assert.equal(mine.documents.length, 1, "buapi is on a thread and was filtered out entirely");
  const theirs = await api({ projectCode: "p", member: "nobody" });
  assert.equal(theirs.documents.length, 0);
});

test("withUpdates counts somebody waiting on a THREAD, not only on the document", async () => {
  const src = ["::members{who=sv sent=sv:H}", "# a", "::::thread{id=t1 members=buapi}", "x", "::::"].join("\n");
  const api = fake({ "a.md": src.replace("H", hashOf(src.replace("H", hashOf(src)))) });
  const r = await api({ projectCode: "p" });
  assert.equal(r.documents.length, 1);
  assert.ok(r.documents[0].threads[0].behind.includes("buapi"));
  assert.equal(r.withUpdates, 1, "a thread with somebody waiting read as nothing waiting");
});

// ── PARITY WITH THE WINDOW ──────────────────────────────────────────────────────────────────
//
// TWO IMPLEMENTATIONS OF ONE RULE IS THE FAILURE MODE THIS WHOLE FILE KEEPS HITTING. The hub
// cannot import from `src/` — different build, no shared module — so membership parsing exists
// twice, and BOTH of the bugs fixed in this lane were drift between the copies:
//
//   · the id captured as `([^}]+)` swallowed `members=`/`sent=` the moment RFC-071 added them;
//   · `bodyOf` hashed thread openers on one side while the other deliberately excluded them.
//
// Neither showed up as a failure anywhere, because each copy's own tests agreed with itself. So
// this reads the WINDOW'S SOURCE and checks the rules it encodes, the same way api/board.test.js
// reads the hub's destructuring against the capability's signature — a claim about the pair, not
// about either half. The precedent is deliberate: a parameter that landed in board.js and stopped
// at the hub answered a successful-looking call with nothing done.
const fs = require("node:fs");
const path = require("node:path");
const THREAD_SRC = fs.readFileSync(path.join(__dirname, "documentMembers.js"), "utf8");
const WINDOW = fs.readFileSync(path.join(__dirname, "..", "src", "atoms", "Markdown", "docMembers.js"), "utf8");

test("PARITY: both sides match a thread opener at THREE-or-more colons, never exactly four", () => {
  // A container nests by GAINING colons. Matching a fixed depth missed precisely the threads on
  // well-built documents, where the content worth discussing is code beside its explanation.
  // Asserted against the exact source fragments, not a loose substring: a claim that passes on
  // almost anything is worse than no claim, because it reads as cover.
  assert.ok(WINDOW.includes("(:{3,})\\s*thread"), "the window's thread opener is no longer an open-ended fence");
  assert.ok(THREAD_SRC.includes("/^(:{3,})\\s*thread\\{id="), "the hub's thread opener is no longer an open-ended fence");
});

test("PARITY: neither side treats a thread's opening line as part of its body", () => {
  // Stamping `sent=` rewrites that line; hashing it would make the act of telling somebody its own
  // change. The window excludes it with `lines.slice(i + 1, end)`; the hub does the same.
  assert.match(WINDOW, /slice\(i \+ 1, end\)/, "the window stopped excluding the opener from a thread body");
  assert.ok(
    fs.readFileSync(path.join(__dirname, "documentMembers.js"), "utf8").includes("lines.slice(i + 1, end)"),
    "the hub stopped excluding the opener from a thread body"
  );
});

test("PARITY: both sides strip the ::members line out of the hash", () => {
  // Adding somebody, or recording that somebody was told, must not make everyone ELSE behind.
  const rule = /!\/\^\\s\*::members\\b\/\.test\(l\)/;
  assert.match(WINDOW, rule, "the window stopped excluding ::members from its body hash");
  assert.match(fs.readFileSync(path.join(__dirname, "documentMembers.js"), "utf8"), rule, "the hub did");
});

// THE ONE PLACE THEY DO NOT MATCH YET, pinned deliberately so nobody mistakes it for parity.
// The hub normalises a thread opener to its id before hashing; the window does not, so in the
// window a thread's `sent=` stamp still re-dirties every document member. It is not fixed here
// because `src/atoms/Markdown/docMembers.js` is uncommitted in his tree and a lane cut from HEAD
// would collide with the commit he is about to make. When that lands and the window is fixed, this
// claim FAILS — and that failure is the reminder to delete it and widen the parity above.
test("KNOWN DIVERGENCE: the window has not got the thread-opener normalisation yet", () => {
  assert.ok(
    !WINDOW.includes("thread\\{id=[^}\\s]+"),
    "the window now normalises thread openers — delete this claim and add it to the parity set above"
  );
});

// ── stampDocSent — a reply makes its author current on the DOCUMENT too ──────────────────────────
//
// His, 2026-10-20: "a reply now makes its author current on the THREAD, but not on the document.
// So after I write a reply the document's ::members line still has me behind, and in a document
// where I am the only member that is where your '1 update owed' keeps coming from."

const { stampDocSent } = require("./documentMembers");

const doc = (sent = "") =>
  [
    "# A document with people on it",
    "",
    `::members{who=odion|autobot${sent ? ` sent=${sent}` : ""}}`,
    "",
    "::::thread{id=a}",
    "something said",
    "::::",
    "",
  ].join("\n");

test("the author is recorded against the version they just wrote", () => {
  const out = stampDocSent(doc(), "odion");
  assert.equal(out.error, undefined);
  const after = membersOf(out.content);
  assert.equal(after.sent.odion, hashOf(out.content));
});

test("stamping the members line does not re-dirty the document it just settled", () => {
  // bodyOf strips ::members, so the write cannot move the hash — which is the whole reason this
  // can be stamped last.
  const before = hashOf(doc());
  const out = stampDocSent(doc(), "odion");
  assert.equal(hashOf(out.content), before);
});

test("everyone else stays behind — a stamp is one person's state, never a broadcast", () => {
  const out = stampDocSent(doc(), "odion");
  const after = membersOf(out.content);
  assert.equal(after.sent.autobot, undefined);
  assert.ok(after.behind.includes("autobot"));
});

test("another member's existing stamp survives — merge, never replace", () => {
  const out = stampDocSent(doc("autobot:deadbeef"), "odion");
  const after = membersOf(out.content);
  assert.equal(after.sent.autobot, "deadbeef");
  assert.ok(after.sent.odion);
});

test("a second reply re-stamps in place rather than duplicating the entry", () => {
  const once = stampDocSent(doc(), "odion").content;
  const twice = stampDocSent(once, "odion").content;
  const line = twice.split("\n").find((l) => l.includes("::members"));
  assert.equal((line.match(/odion:/g) || []).length, 1);
});

test("a replier who is not on the document is REFUSED, not quietly added", () => {
  const out = stampDocSent(doc(), "stranger");
  assert.match(out.error, /not a member/);
  assert.equal(out.content, undefined);
});

test("a document with no ::members line refuses — there is nothing to be current on", () => {
  const out = stampDocSent("# just a report\n", "odion");
  assert.match(out.error, /no ::members line/);
});

test("it refuses with no member named rather than stamping an empty name", () => {
  assert.match(stampDocSent(doc(), "").error, /needs the member/);
});

// THE PHANTOM, END TO END. One member, one document: after their own reply they should owe nothing.
test("a solo-member document owes zero updates after its own author replies", () => {
  const solo = ["::members{who=odion}", "", "::::thread{id=a}", "hi", "::::", ""].join("\n");
  const replied = solo.replace("hi", "hi\n:::reply{author=odion ts=1}\nmore\n:::");
  assert.ok(membersOf(replied).behind.includes("odion"), "behind before the stamp");
  const out = stampDocSent(replied, "odion");
  assert.deepEqual(membersOf(out.content).behind, []);
});

test("the members line match stops at the end of its own line", () => {
  // `\s*$` under /m ran past the newline and ate the blank line below, which made a stamp change
  // the body it had just hashed.
  const before = ["::members{who=odion}", "", "prose", ""].join("\n");
  const out = stampDocSent(before, "odion");
  assert.equal(out.content.split("\n")[1], "", "the blank line below survives the stamp");
});
