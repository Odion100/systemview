// RFC-071 — WHAT IS buAPI ON. The claims that keep this honest across a folder: a document with no
// members is not a row, membership is read at BOTH levels, and — since his 2026-11-06 ruling killed
// the edit channel ("general text in the document should send no updates, period point blank") —
// the answer carries NO edit-channel fields: no `behind`, no `sent`, no `withUpdates`. Who is owed
// a fire is the shell's fires engine's question, and the hub answering it off prose hashes was a
// second copy of a rule retired where the first copy lived.
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

// THE CUT ITSELF (his ruling, 2026-11-06). A document wearing the old channel's stamps answers with
// membership only — no field in the row or the summary speaks the hash language. The stamps in the
// file are not an error; they are receipts of a channel that no longer exists, read by nothing.
test("the answer carries no edit-channel fields, even when the document carries stamps", async () => {
  const body = "# a plan\n\nprose\n";
  const api = fake({
    "stamped.md": DOC("buapi|systemlynx", "buapi:deadbeef", body),
    "never.md": DOC("buapi", "", body),
  });
  const r = await api({ projectCode: "p" });
  assert.equal(r.documents.length, 2);
  for (const d of r.documents) {
    assert.equal("behind" in d, false, `${d.path} answers in the dead channel's language`);
    assert.equal("sent" in d, false, `${d.path} hands the stamps back`);
    for (const t of d.threads) assert.equal("behind" in t, false, `${d.path}'s thread does`);
  }
  assert.equal("withUpdates" in r, false, "the folder summary still counts unsent updates");
  assert.equal(r.withMembers, 2);
});

// The hash ignores the members line, or recording a send would instantly make the document dirty
// again — still pinned, because stampDocSent hashes with it and a stamp must not move the value it
// just recorded.
test("the hash ignores the members line, so a stamp settles rather than re-dirties", () => {
  const body = "# a plan\n";
  const plain = hashOf(body);
  assert.equal(hashOf(`::members{who=a}\n${body}`), plain);
  assert.equal(hashOf(`::members{who=a sent=a:${plain}}\n${body}`), plain);
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

test("a thread row is its audience and its id — nothing else travels", async () => {
  const src = ["::members{who=sv sent=sv:deadbeef}", "# a", "::::thread{id=t1 members=buapi}", "x", "::::"].join("\n");
  const api = fake({ "a.md": src });
  const r = await api({ projectCode: "p" });
  assert.equal(r.documents.length, 1);
  assert.deepEqual(r.documents[0].threads, [{ id: "t1", who: ["buapi"] }]);
});

// ── PARITY WITH THE WINDOW ──────────────────────────────────────────────────────────────────
//
// TWO IMPLEMENTATIONS OF ONE RULE IS THE FAILURE MODE THIS WHOLE FILE KEEPS HITTING, and three
// separate bugs came out of it: the id captured as `([^}]+)` swallowed `members=` the moment
// RFC-071 added it; `bodyOf` hashed thread openers on one side and not the other, so removing
// somebody from a thread made every DOCUMENT member behind; and `subscribe=` was read by the window
// and not here, so a migrated thread simply was not a thread. None showed up as a failure anywhere,
// because each copy's own tests agreed with itself.
//
// THE VOCABULARY IS NOW ONE MODULE — src/shared/docHash.js, CommonJS so both builds reach it — so
// the parity worth asserting is STRUCTURAL: that each side reads it rather than rewriting it. What
// remains genuinely twice is the SCANNER: the window finds threads in a parsed tree and the hub
// walks lines, which cannot be one function, so the two fence rules below are still claims about a
// pair. The same shape as api/board.test.js reading the hub's destructuring against a capability's
// signature — a claim about the pair, not about either half.
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

test("ONE definition of what counts as a change — and the window carries NONE", () => {
  // The gate ruling (2026-11-06): general text in the document sends no updates — blocks are the
  // only senders, the ENGINE delivers their fires, and the window's whole edit channel is gone. So
  // the parity this test used to claim is now asymmetric on purpose: the HUB still reads the one
  // shared hash for its folder-level scan, and the WINDOW carries no hash at all — not the shared
  // import, and not a private copy grown back.
  assert.equal(/docHash/.test(WINDOW), false, "the window rejoined the edit channel");
  assert.match(THREAD_SRC, /require\("\.\.\/src\/shared\/docHash"\)/, "the hub stopped requiring the shared module");
  assert.equal(/0x811c9dc5/.test(WINDOW), false, "the window has grown its own hash again");
  assert.equal(/0x811c9dc5/.test(THREAD_SRC), false, "the hub has grown its own hash again");
});

test("THE RULE ITSELF, behaviourally: no edit to any part of the document owes anybody an update here", () => {
  // The 2026-11-06 ruling, one layer down from where it was first enforced: the window stopped
  // deriving "behind" from prose, and now the hub cannot, because the field does not exist to
  // derive. Re-address a thread, edit the prose — the membership answer is the same answer.
  const docOf = (audience, prose) =>
    [
      "# a meeting",
      "",
      "::members{who=odion sent=odion:deadbeef}",
      "",
      prose,
      "",
      `::::thread{id=t1 subscribe=${audience}}`,
      "what is being argued",
      "::::",
    ].join("\n");
  const before = membersOf(docOf("odion|autobot", "the argument so far"));
  const narrowed = membersOf(docOf("odion", "the argument so far"));
  const edited = membersOf(docOf("odion", "the argument, moved on"));
  assert.equal("behind" in before, false, "the field grew back");
  assert.deepEqual(narrowed.who, before.who);
  assert.deepEqual(edited.who, before.who);
  assert.deepEqual(edited.threads, narrowed.threads);
});

test("a thread that names NOBODY is about the document's people", () => {
  // Absent is not empty. The window has inherited since 2026-10-20; the hub skipped the thread
  // entirely, so a bare thread had no audience, no row and no count anywhere.
  const bare = ["::members{who=odion|autobot}", "", ":::thread{id=t1}", "said nothing yet", ":::"].join("\n");
  assert.deepEqual(membersOf(bare).threads[0].who, ["odion", "autobot"]);
  // `subscribe=""` is present and names nobody ON PURPOSE — the one way to say "not theirs"
  const nobody = bare.replace(":::thread{id=t1}", ':::thread{id=t1 subscribe=""}');
  assert.deepEqual(membersOf(nobody).threads, []);
});

// ── stampDocSent — a reply makes its author current on the DOCUMENT too ──────────────────────────
//
// His, 2026-10-20: "a reply now makes its author current on the THREAD, but not on the document.
// So after I write a reply the document's ::members line still has me behind, and in a document
// where I am the only member that is where your '1 update owed' keeps coming from."

const { stampDocSent } = require("./documentMembers");

// membersOf no longer hands the stamps back — nothing reads them — so these tests read the receipt
// off the written line itself, which is where a receipt lives.
const sentMapOf = (content) => {
  const line = String(content).split("\n").find((l) => l.includes("::members")) || "";
  const m = /\bsent=("[^"]*"|[^\s}]*)/.exec(line);
  return (m ? m[1].replace(/^"|"$/g, "") : "")
    .split("|")
    .filter(Boolean)
    .reduce((acc, p) => {
      const i = p.lastIndexOf(":");
      if (i > 0) acc[p.slice(0, i)] = p.slice(i + 1);
      return acc;
    }, {});
};

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
  assert.equal(sentMapOf(out.content).odion, hashOf(out.content));
});

test("stamping the members line does not re-dirty the document it just settled", () => {
  // bodyOf strips ::members, so the write cannot move the hash — which is the whole reason this
  // can be stamped last.
  const before = hashOf(doc());
  const out = stampDocSent(doc(), "odion");
  assert.equal(hashOf(out.content), before);
});

test("a stamp is one person's state, never a broadcast", () => {
  const out = stampDocSent(doc(), "odion");
  const after = sentMapOf(out.content);
  assert.equal(after.autobot, undefined);
  assert.ok(after.odion);
});

test("another member's existing stamp survives — merge, never replace", () => {
  const out = stampDocSent(doc("autobot:deadbeef"), "odion");
  const after = sentMapOf(out.content);
  assert.equal(after.autobot, "deadbeef");
  assert.ok(after.odion);
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

// THE PHANTOM CANNOT GROW BACK. "In a document where I am the only member that is where your
// '1 update owed' keeps coming from" — the old end-to-end case. The stamp still writes (it is the
// reply route's bookkeeping), and the answer still cannot owe anybody anything, because the field
// that carried the debt is gone.
test("a solo-member document cannot owe its own author an update", () => {
  const solo = ["::members{who=odion}", "", "::::thread{id=a}", "hi", "::::", ""].join("\n");
  const replied = solo.replace("hi", "hi\n:::reply{author=odion ts=1}\nmore\n:::");
  assert.equal("behind" in membersOf(replied), false);
  const out = stampDocSent(replied, "odion");
  assert.equal(sentMapOf(out.content).odion, hashOf(out.content));
});

test("the members line match stops at the end of its own line", () => {
  // `\s*$` under /m ran past the newline and ate the blank line below, which made a stamp change
  // the body it had just hashed.
  const before = ["::members{who=odion}", "", "prose", ""].join("\n");
  const out = stampDocSent(before, "odion");
  assert.equal(out.content.split("\n")[1], "", "the blank line below survives the stamp");
});
