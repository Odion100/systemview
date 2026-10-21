// THE HUB'S REPORT LIST IS A LIST OF THINGS THAT ANSWER. `list()` is what every teaching error
// hands over — "nothing on the TV, here is what exists" — so a name in it is a promise that the
// document is readable. It used to answer straight out of `reports.index.json`, which keeps an
// entry long after the file is gone (deleted by hand, by git, by a lane's cleanup).
//
// The door is INJECTED here, exactly as api/index.js injects it, so these claims are about the
// rule and not about a filesystem.
// THE SUITE LEAVES HIS STORE ALONE. reports.write() registers the filed document in the registry
// (RFC-073); without this override the suite writes rows into the REAL ~/.autobot/documents.json —
// measured 2026-10-25: three junk report rows and RFC-073's row overwritten by a fixture.
process.env.AUTOBOT_DOCUMENTS = require("path").join(require("os").tmpdir(), `sv-reports-test-${process.pid}.json`);

const assert = require("node:assert");
const { test, describe } = require("node:test");
const { reportsOn, REPORT_INDEX } = require("./reports");

// A door over a fake disk: `files` maps path → content; anything else answers `{ok: false}`, which
// is how the real readFile reports a miss. `thrower` is the other case entirely — a door that
// cannot answer at all.
const doorOver = (files, { thrower = null } = {}) => {
  const readFile = async (_pc, { path: p }) => {
    if (thrower && p === thrower) throw new Error("the door itself fell over");
    return Object.prototype.hasOwnProperty.call(files, p)
      ? { ok: true, content: files[p] }
      : { ok: false, error: "not found" };
  };
  return reportsOn({ readFile, writeFile: async () => ({ ok: true }) });
};

const indexOf = (rows) => JSON.stringify({ sv: rows });

describe("Reports.list — a name is offered only while its file answers", () => {
  test("drops an indexed report whose file is gone", async () => {
    const R = doorOver({
      [REPORT_INDEX]: indexOf([
        { name: "alive", path: ".systemview/report.sv.alive.md", ts: 2 },
        { name: "deleted", path: ".systemview/report.sv.deleted.md", ts: 1 },
      ]),
      ".systemview/report.sv.alive.md": "# alive",
    });
    assert.deepStrictEqual(await R.list("sv"), ["alive"]);
  });

  test("keeps every indexed report whose file is there", async () => {
    const R = doorOver({
      [REPORT_INDEX]: indexOf([
        { name: "one", path: ".systemview/report.sv.one.md", ts: 2 },
        { name: "two", path: ".systemview/report.sv.two.md", ts: 1 },
      ]),
      ".systemview/report.sv.one.md": "# one",
      ".systemview/report.sv.two.md": "# two",
    });
    assert.deepStrictEqual(await R.list("sv"), ["one", "two"]);
  });

  // A REFUSAL IS ABSENCE; A THROW IS NOT. This is the claim that keeps the check from being
  // dangerous — one unreadable file must not read as "this project has no reports".
  test("keeps a report whose file read THREW, because that is not evidence of absence", async () => {
    const R = doorOver(
      {
        [REPORT_INDEX]: indexOf([{ name: "unreadable", path: ".systemview/report.sv.unreadable.md", ts: 1 }]),
      },
      { thrower: ".systemview/report.sv.unreadable.md" },
    );
    assert.deepStrictEqual(await R.list("sv"), ["unreadable"]);
  });

  test("keeps an old entry that carries no path — there is nothing to check", async () => {
    const R = doorOver({ [REPORT_INDEX]: indexOf([{ name: "pathless", ts: 1 }]) });
    assert.deepStrictEqual(await R.list("sv"), ["pathless"]);
  });

  test("an unreadable index is an empty list, not a crash", async () => {
    const R = doorOver({});
    assert.deepStrictEqual(await R.list("sv"), []);
  });

  test("a project with no rows of its own answers empty", async () => {
    const R = doorOver({ [REPORT_INDEX]: JSON.stringify({ other: [{ name: "theirs", path: "x.md" }] }) });
    assert.deepStrictEqual(await R.list("sv"), []);
  });
});

// REPLYING INTO A THREAD THAT CARRIES MEMBERS — the shape RFC-071 introduced and no test data had.
//
// Measured live 2026-10-20: autobot was delivered a `document.updated` for the meeting's `bugs`
// thread, read the file as instructed, and then could not answer in it. Four addressings, four
// refusals. The cause was not addressing at all — `id=([^}]+)` captured every attribute up to the
// brace, so the id compared was `bugs members=systemview-test|autobot sent=...`. The first real
// meeting was a document no agent could speak in.
//
// The reason it survived: every thread in `.systemview/` is a bare `::::thread{id=x}`, and only a
// meeting carries members. The old shape kept passing, so the suite kept agreeing.
const { replyInto } = require("./reports");

const MEETING = [
  "# Meeting 001",
  "",
  "::members{who=systemview-test|autobot}",
  "",
  "::::thread{id=bugs members=systemview-test|autobot sent=systemview-test:1jqt6sb|autobot:1jqt6sb}",
  "Anything that did not work, the moment it did not work.",
  "::::",
  "",
  "::::thread{id=procedure members=systemview-test|autobot}",
  "A move that worked and should happen again.",
  "::::",
].join("\n");

describe("replyInto — the id is the first attribute, not the whole brace", () => {
  test("answers in a thread that carries members, sent and auto", () => {
    const r = replyInto(MEETING, "bugs", "the reply verb could not reach me", "autobot");
    assert.equal(r.error, undefined);
    assert.match(r.content, /:::reply\{author=autobot ts=\d+\}/);
    assert.match(r.content, /the reply verb could not reach me/);
  });

  test("splices BEFORE the thread's close, not after it", () => {
    const lines = replyInto(MEETING, "bugs", "inside", "autobot").content.split("\n");
    const reply = lines.findIndex((l) => l.startsWith(":::reply{"));
    const close = lines.findIndex((l, i) => i > reply && l.trim() === "::::");
    const nextOpen = lines.findIndex((l) => l.includes("id=procedure"));
    assert.ok(reply > 0 && close > reply && close < nextOpen, `reply ${reply}, close ${close}, next ${nextOpen}`);
  });

  // STILL TRUE OF `replyInto` ITSELF, and deliberately so: splicing a reply is one decision and
  // stamping its author is another. The stamp is `stampSent`, claimed below — api/index.js composes
  // the two and writes once.
  test("leaves the opener's own attributes untouched — sent= is state, not ours to rewrite", () => {
    const r = replyInto(MEETING, "bugs", "x", "autobot");
    assert.match(r.content, /::::thread\{id=bugs members=systemview-test\|autobot sent=systemview-test:1jqt6sb\|autobot:1jqt6sb\}/);
  });

  // THE BARE FORM IS THE ONE THAT NEVER BROKE, and it is the one every existing report uses.
  test("still answers a bare thread, the shape every report has", () => {
    const bare = ["::::thread{id=t1}", "body", "::::"].join("\n");
    assert.match(replyInto(bare, "t1", "hi", "sv").content, /:::reply\{author=sv/);
  });

  // A CONTAINER NESTS BY GAINING COLONS, and members ride on the deeper fence too.
  test("answers at a deeper fence with members on it", () => {
    const deep = [":::::thread{id=t2 members=a|b}", "body", ":::::"].join("\n");
    const r = replyInto(deep, "t2", "hi", "a");
    assert.equal(r.error, undefined);
    assert.match(r.content, /:::reply\{author=a/);
  });

  // THE TEACHING ERROR IS THE OTHER HALF. Listing `bugs members=...|autobot sent=...` as an
  // available id hands the caller a string it can never successfully pass back — which is worse
  // than listing nothing, because it reads like an answer.
  test("an unknown id is refused with the REAL ids, not the swollen ones", () => {
    const r = replyInto(MEETING, "nope", "x", "sv");
    assert.match(r.error, /no thread "nope"/);
    assert.deepEqual(r.threads, ["bugs", "procedure"]);
  });

  test("a document with no threads says so rather than listing nothing", () => {
    const r = replyInto("# just prose\n", "t1", "x", "sv");
    assert.match(r.hint, /no threads/);
  });

  test("an unclosed thread is named rather than spliced into", () => {
    const r = replyInto("::::thread{id=t1 members=a}\nbody\n", "t1", "x", "a");
    assert.match(r.error, /never closed/);
  });
});

// ── WRITING IS BEING TOLD ─────────────────────────────────────────────────────────────────────
// His, 2026-10-20: *"if there's only me and you in the document, there's no one to update."* A
// reply left its own AUTHOR behind on the thread they had just written, so a document whose only
// member is the agent writing it showed "1 update owed" forever and the only person who could
// clear it was him — pressing a button to tell an agent about words that agent wrote. He pressed
// it, and because a thread's summary is its LAST reply, the send quoted the agent's own reply back
// at the agent.
//
// THE STAMP IS ONLY WORTH ANYTHING IF THE WINDOW AGREES WITH IT. `sent=<member>:<hash>` is read by
// src/atoms/Markdown/docMembers.js to decide who is behind; a hash the window would not have
// computed is not a record of anything, it is a value that can never match and a member who is
// permanently dirty. So the window's own hash is TRANSCRIBED below and the two are asserted equal
// on the same body — the one claim that cannot be replaced by reading the hub's code.
const fs = require("node:fs");
const path = require("node:path");
const { stampSent, threadBodyOf } = require("./reports");

// ── THE WINDOW'S IMPLEMENTATION, COPIED ───────────────────────────────────────────────────────
// Transcribed from src/atoms/Markdown/docMembers.js, which is ESM and cannot be required from a
// node:test. Copied ON PURPOSE: the point is to compare two independent implementations, and a
// shared import would make the comparison vacuous. `WINDOW_SOURCE_UNCHANGED` below is what keeps
// the copy honest.
const winBodyOf = (src) =>
  String(src || "")
    .split("\n")
    .filter((l) => !/^\s*::members\b/.test(l))
    .join("\n");

const winHashOf = (src) => {
  const s = winBodyOf(src);
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(36);
};

// `threadBlocksOf`, reduced to the one thing this is about: WHICH LINES ARE THE BODY. The slice is
// `lines.slice(i + 1, end)` — the opening line excluded, because that is where `sent=` is stamped.
const winThreadBodyOf = (src, id) => {
  const lines = String(src || "").split("\n");
  for (let i = 0; i < lines.length; i += 1) {
    const open = /^(:{3,})\s*thread\b/.exec(lines[i]);
    if (!open) continue;
    const n = open[1].length;
    const opener = new RegExp(`^:{${n},}\\s*\\w`);
    const closer = new RegExp(`^:{${n}}\\s*$`);
    let depth = 1;
    let end = lines.length;
    for (let j = i + 1; j < lines.length; j += 1) {
      if (opener.test(lines[j])) depth += 1;
      else if (closer.test(lines[j])) {
        depth -= 1;
        if (!depth) {
          end = j;
          break;
        }
      }
    }
    const on = (lines[i].match(/\bid=("[^"]*"|[^\s}]*)/) || [])[1];
    if (on && on.replace(/^"|"$/g, "") === id) return lines.slice(i + 1, end).join("\n");
  }
  return null;
};

// The attribute as the window reads it, so these claims assert against the string the surface will
// actually parse rather than against a regex of their own.
const attrOn = (src, id, key) => {
  const row = String(src)
    .split("\n")
    .find((l) => l.includes(`thread{id=${id}`));
  const m = row && row.match(new RegExp(`\\b${key}=("[^"]*"|[^\\s}]*)`));
  return m ? m[1].replace(/^"|"$/g, "") : null;
};

// HOW THE HUB WIRES IT (api/index.js, the `reply:` verb): reply, then stamp the author with the new
// body's hash, then ONE write. Mirrored here so the claims are about the composition that ships.
const replyAndStamp = (src, id, text, author) => {
  const r = replyInto(src, id, text, author);
  assert.equal(r.error, undefined);
  const s = stampSent(r.content, id, author);
  assert.equal(s.error, undefined);
  return s.content;
};

describe("stampSent — a reply tells its own author", () => {
  test("the author carries the hash of the version they just wrote", () => {
    const out = replyAndStamp(MEETING, "bugs", "the reply verb could not reach me", "autobot");
    assert.equal(attrOn(out, "bugs", "sent").includes("autobot:"), true, attrOn(out, "bugs", "sent"));
    const sent = Object.fromEntries(attrOn(out, "bugs", "sent").split("|").map((p) => p.split(":")));
    assert.equal(sent.autobot, winHashOf(winThreadBodyOf(out, "bugs")));
  });

  // THE WHOLE POINT, AS A NUMBER: the author is not behind on their own reply. `dirtyMembers` is
  // `sentMap[m] !== hashOf(body)`, so this is that comparison with nothing in between.
  test("the author is NOT behind on the thread afterwards — the case he hit", () => {
    const out = replyAndStamp(MEETING, "bugs", "written by me, about me", "autobot");
    const sent = Object.fromEntries(attrOn(out, "bugs", "sent").split("|").map((p) => p.split(":")));
    const now = winHashOf(winThreadBodyOf(out, "bugs"));
    assert.deepEqual(
      ["systemview-test", "autobot"].filter((m) => sent[m] !== now),
      ["systemview-test"],
      "only the member who did NOT write it is owed an update",
    );
  });

  // SENT= IS THE RECORD OF WHO HEARD WHICH VERSION. Clobbering the map would tell the document
  // somebody was told who was not — the one failure mode of this write that is worse than no write.
  test("another member's stamp survives untouched", () => {
    const out = replyAndStamp(MEETING, "bugs", "x", "autobot");
    assert.equal(attrOn(out, "bugs", "sent").includes("systemview-test:1jqt6sb"), true, attrOn(out, "bugs", "sent"));
  });

  test("a second reply by the same author re-stamps rather than duplicating", () => {
    const once = replyAndStamp(MEETING, "bugs", "first", "autobot");
    const twice = replyAndStamp(once, "bugs", "second", "autobot");
    const sent = attrOn(twice, "bugs", "sent");
    assert.equal(sent.split("|").filter((p) => p.startsWith("autobot:")).length, 1, sent);
    assert.notEqual(
      sent.split("|").find((p) => p.startsWith("autobot:")),
      attrOn(once, "bugs", "sent").split("|").find((p) => p.startsWith("autobot:")),
      "a new reply is a new version — the stamp has to move",
    );
    assert.equal(sent.includes("systemview-test:1jqt6sb"), true, sent);
  });

  // A BARE THREAD IS LEGAL AND NORMAL — it INHERITS the document's people. Writing a `members=`
  // while stamping would narrow the conversation to whoever happened to reply, silently dropping
  // everybody who was in it a moment ago.
  test("a bare thread gets a stamp and does NOT gain members=", () => {
    const bare = ["::members{who=sv}", "", "::::thread{id=t1}", "body", "::::"].join("\n");
    const out = replyAndStamp(bare, "t1", "hi", "sv");
    assert.match(out, /::::thread\{id=t1 sent=sv:[0-9a-z]+\}/);
    assert.equal(/thread\{[^}]*\bmembers=/.test(out), false, out);
  });

  test("the opener's other attributes ride untouched — id, members and auto are not ours", () => {
    const src = ["::::thread{id=t1 members=a|b auto=a}", "body", "::::"].join("\n");
    const out = stampSent(src, "t1", "a").content;
    assert.equal(attrOn(out, "t1", "members"), "a|b");
    assert.equal(attrOn(out, "t1", "auto"), "a");
    assert.match(out, /^::::thread\{id=t1 members=a\|b auto=a sent=a:[0-9a-z]+\}$/m);
  });

  // STAMPING MUST NOT BE ITS OWN CHANGE. The body excludes the opening line precisely so that
  // writing `sent=` on that line cannot make the thread dirty again — hash it after the stamp and
  // the answer has to be the same string that was stamped. This is the bug the window's comment
  // warns about, claimed from the hub's side.
  test("the hash does not move when the stamp is written, because the opener is not in the body", () => {
    const out = replyAndStamp(MEETING, "bugs", "x", "autobot");
    const sent = Object.fromEntries(attrOn(out, "bugs", "sent").split("|").map((p) => p.split(":")));
    assert.equal(sent.autobot, winHashOf(winThreadBodyOf(out, "bugs")));
    const again = stampSent(out, "bugs", "autobot").content;
    assert.equal(again, out, "a second stamp of the same body is a no-op");
  });

  // THE HUB AND THE WINDOW HASH THE SAME BODY, proved on the shapes that differ: a thread with
  // members, a bare one, a deeper fence, and one holding a nested block whose closer is shallower.
  test("the hub's body and the window's body are the same string, at every fence", () => {
    const deep = [
      ":::::thread{id=t2 members=a|b}",
      "lead",
      "::::columns",
      "left",
      "::::",
      ":::reply{author=a ts=1}",
      "said",
      ":::",
      ":::::",
      "after",
    ].join("\n");
    assert.equal(threadBodyOf(deep, "t2"), winThreadBodyOf(deep, "t2"));
    assert.equal(threadBodyOf(MEETING, "bugs"), winThreadBodyOf(MEETING, "bugs"));
    assert.equal(threadBodyOf(MEETING, "procedure"), winThreadBodyOf(MEETING, "procedure"));
    const stamp = stampSent(deep, "t2", "a").content;
    assert.equal(attrOn(stamp, "t2", "sent"), `a:${winHashOf(winThreadBodyOf(deep, "t2"))}`);
  });

  // THE COPY ABOVE IS A LIABILITY THE MOMENT THE WINDOW MOVES. This is the cheapest honest guard:
  // the three things the hash depends on, read off the real file. If one of them is gone, the
  // transcription is stale and the equality claims are agreeing with a ghost.
  test("the window still hashes the way this file says it does", () => {
    const src = fs.readFileSync(path.join(__dirname, "..", "src", "atoms", "Markdown", "docMembers.js"), "utf8");
    assert.equal(src.includes("lines.slice(i + 1, end).join"), true, "the body no longer excludes the opening line");
    assert.equal(src.includes("0x811c9dc5") && src.includes("0x01000193"), true, "FNV-1a constants moved");
    assert.equal(src.includes('!/^\\s*::members\\b/.test(l)'), true, "bodyOf no longer drops the members line");
    assert.equal(src.includes("h.toString(36)"), true, "the hash is no longer base 36");
  });

  // A HASH THE WINDOW ITSELF WROTE, PINNED. The transcription above and the drift guard below both
  // argue from the window's SOURCE; this argues from its OUTPUT. `sent=systemview-test:1jqt6sb` is
  // the stamp the surface put on the `bugs` thread of meetings/2026-10-19-goals-in-parallel.md, and
  // the line below is that thread's body, verbatim, as it stood when the send happened. The hub has
  // to say `1jqt6sb` about it or every stamp it writes is a value the window can never match — a
  // member marked permanently behind, which is the exact symptom this whole change removes.
  test("the hub reproduces a stamp the WINDOW wrote, on the body it wrote it about", () => {
    const body = "Anything that did not work, the moment it did not work. One line, by whoever hit it.";
    const src = [`::::thread{id=bugs members=systemview-test|autobot}`, body, "::::"].join("\n");
    assert.equal(threadBodyOf(src, "bugs"), body);
    assert.equal(attrOn(stampSent(src, "bugs", "autobot").content, "bugs", "sent"), "autobot:1jqt6sb");
  });

  test("a thread that is not there is refused, not stamped onto something else", () => {
    assert.match(stampSent(MEETING, "nope", "a").error, /no thread "nope"/);
  });

  test("an unstamped member is refused rather than written as an empty name", () => {
    assert.match(stampSent(MEETING, "bugs", "").error, /needs the member/);
  });
});

// RFC-073 §4, REGISTRATION PATH 2 — `show()` registers what it files. A report is a report because it
// says so at the top, and `.systemview/` is a folder the session watcher ignores on purpose, so the
// write door is the only place the leaf can come from.
describe("Reports.write registers the report", () => {
  const capturing = () => {
    const wrote = [];
    const R = reportsOn({
      readFile: async () => ({ ok: false, error: "not found" }),
      writeFile: async (_pc, { path: p, content }) => {
        wrote.push({ path: p, content });
        return { ok: true };
      },
    });
    return { R, wrote };
  };

  test("a plain document gets `::report{id=<name>}` at the top — the name is the id", async () => {
    const { R, wrote } = capturing();
    await R.write("sv", "alive", "# alive\n\nbody\n");
    const doc = wrote.find((w) => w.path.endsWith(".md"));
    assert.ok(doc.content.startsWith("::report{id=alive}\n\n# alive"), doc.content.slice(0, 60));
  });

  test("a document that already says what it is — an RFC shown as a report — is left alone", async () => {
    const { R, wrote } = capturing();
    const rfc = "# A design\n\n::rfc{id=RFC-073 arc=ARC-004}\n\nbody\n";
    await R.write("sv", "a design", rfc);
    const doc = wrote.find((w) => w.path.endsWith(".md"));
    assert.strictEqual(doc.content, rfc);
  });

  test("a `::report` quoted in a code fence lower down is an example, not an identity — the leaf is still added", async () => {
    const { R, wrote } = capturing();
    const body = "# notes\n\n" + "x\n".repeat(2500) + "```md\n::report{id=example}\n```\n";
    await R.write("sv", "notes", body);
    const doc = wrote.find((w) => w.path.endsWith(".md"));
    assert.ok(doc.content.startsWith("::report{id=notes}"), doc.content.slice(0, 60));
  });

  test("a name with a space is quoted, so the attribute survives the parse", async () => {
    const { R, wrote } = capturing();
    await R.write("sv", "two words", "# t\n");
    const doc = wrote.find((w) => w.path.endsWith(".md"));
    assert.ok(doc.content.startsWith('::report{id="two words"}'), doc.content.slice(0, 60));
  });
});

// ── a report on disk is never invisible ─────────────────────────────────────────────────────────
//
// FOUND BY USE, 2026-10-21: 32 report files in .systemview/, 30 index rows, SEVEN files the panel
// could never show. `list` read the index and nothing else, and the index write is wrapped in a
// catch that swallows its own failure precisely so a report is not lost — which is how they were
// lost. The file's own comment said it: "a report that skips it exists on disk and nowhere a human
// looks."
const REPORTS = {
  ".systemview/reports.index.json": JSON.stringify({
    p: [{ name: "Indexed and present", path: ".systemview/report.p.Indexed-and-present.md", ts: 2 },
        { name: "Indexed but deleted", path: ".systemview/report.p.Indexed-but-deleted.md", ts: 1 }],
  }),
  ".systemview/report.p.Indexed-and-present.md": "# Indexed and present\n\nbody\n",
  ".systemview/report.p.Never-indexed.md": "# Never indexed\n\nits index write failed\n",
  ".systemview/report.p.Also-never-indexed.md": "# Also never indexed\n\nsame\n",
};

const doors = (files, { noListFiles = false, listThrows = false } = {}) => ({
  readFile: async (_p, { path }) =>
    files[path] === undefined ? { ok: false, error: "no such file" } : { ok: true, content: files[path] },
  writeFile: async () => ({ ok: true }),
  ...(noListFiles
    ? {}
    : {
        listFiles: async () => {
          if (listThrows) throw new Error("folder unreadable");
          return { files: Object.keys(files).map((path) => ({ path })) };
        },
      }),
});

test("a report whose index write failed is still listed", async () => {
  const { list } = reportsOn(doors(REPORTS));
  const names = await list("p");
  assert.ok(names.includes("Never indexed"));
  assert.ok(names.includes("Also never indexed"));
});

test("it is known by its own heading, not by a slugged filename", async () => {
  const { list } = reportsOn(doors(REPORTS));
  assert.ok((await list("p")).includes("Never indexed"));
});

test("the index still leads — indexed reports come first, in index order", async () => {
  const { list } = reportsOn(doors(REPORTS));
  assert.equal((await list("p"))[0], "Indexed and present");
});

// The other direction was already right and must stay right: an indexed name is a CLAIM, and a
// name handed to an agent that cannot be opened teaches it a report that is not there.
test("an index row whose file is gone still disappears", async () => {
  const { list } = reportsOn(doors(REPORTS));
  assert.ok(!(await list("p")).includes("Indexed but deleted"));
});

test("a report is never listed twice when it is both indexed and on disk", async () => {
  const { list } = reportsOn(doors(REPORTS));
  const names = await list("p");
  assert.equal(names.filter((n) => n === "Indexed and present").length, 1);
});

test("a folder that cannot be walked leaves the index's answer standing", async () => {
  const { list } = reportsOn(doors(REPORTS, { listThrows: true }));
  assert.deepEqual(await list("p"), ["Indexed and present"]);
});

test("a caller wired without the folder door still works exactly as before", async () => {
  const { list } = reportsOn(doors(REPORTS, { noListFiles: true }));
  assert.deepEqual(await list("p"), ["Indexed and present"]);
});

test("a project with nothing at all answers empty rather than throwing", async () => {
  const { list } = reportsOn(doors({}));
  assert.deepEqual(await list("p"), []);
});
