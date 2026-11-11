const test = require("node:test");
const assert = require("node:assert");
const { servesOf, shasIn, recordsIn, sameSha, audit, windowFacts } = require("./commitLinks");

// WHAT THESE PIN. The link between a commit and the work it served has to be readable by a machine
// in BOTH directions or it is decoration — so: the trailer is parsed by git's own rule and not
// approximately, the document's side is read off its `::commit` blocks, and the audit can say
// which of the four ways they disagree.

test("the ids a commit serves come off the trailer block", () => {
  assert.deepStrictEqual(servesOf("feat: a thing\n\nwhy it is good\n\nServes: ARC-004-O2"), ["ARC-004-O2"]);
  assert.deepStrictEqual(
    servesOf("x\n\nServes: RFC-073\nServes: G-12"),
    ["RFC-073", "G-12"],
    "repeated trailers are how one commit serves several",
  );
  // THE VALUE IS THE WHOLE LINE. A report's id is its TITLE — spaces, commas and all — so a
  // parser that split on either would shred the id of the very documents this reaches for.
  assert.deepStrictEqual(
    servesOf('x\n\nServes: Do the skills match, and where do they not?'),
    ["Do the skills match, and where do they not?"],
    "a report id is a title: commas and spaces are part of it, never separators",
  );
  assert.deepStrictEqual(servesOf("x\n\nserves: rfc-073"), ["rfc-073"], "the key is case-insensitive, the id is not");
});

// THE RULE THAT MATTERS, because the lenient version is worse than nothing: a parser that scans
// the whole message would read `Serves: ARC-004-O2` out of a commit QUOTING the convention — which
// this repo's own commits do — and attribute work to a document nobody touched.
test("only the final trailer block counts — Serves in prose is prose", () => {
  assert.deepStrictEqual(servesOf("feat: x\n\nI wrote Serves: ARC-004-O2 in the doc as an example.\n"), []);
  assert.deepStrictEqual(
    servesOf("feat: x\n\nServes: ARC-001\n\nand then more prose after it"),
    [],
    "a block that is not last is not a trailer block",
  );
  assert.deepStrictEqual(
    servesOf("feat: x\n\nsome prose\nServes: ARC-001"),
    [],
    "git needs the blank line — a trailer glued to a paragraph is part of the paragraph",
  );
});

test("a commit that serves nothing answers empty, never throws", () => {
  assert.deepStrictEqual(servesOf(""), []);
  assert.deepStrictEqual(servesOf(null), []);
  assert.deepStrictEqual(servesOf("fix: a typo"), []);
});

test("the document's side is its ::commit blocks", () => {
  assert.deepStrictEqual(shasIn("::commit{sha=921e8c88}"), ["921e8c88"]);
  assert.deepStrictEqual(shasIn('text ::commit{message="x" sha="4ce4444"} more'), ["4ce4444"]);
  assert.deepStrictEqual(shasIn("::commit{message=\"not done yet\"}"), [], "an unpressed offer carries no sha");
  assert.deepStrictEqual(shasIn("::commit{sha=aaa1} and ::commit{sha=aaa1}"), ["aaa1"], "the same sha once");
});

// GIT ABBREVIATES, and the two sides are written by different hands at different lengths — a
// document stamped with a short sha against a full-length log would read as a total mismatch.
test("an abbreviated sha and a full one are the same commit", () => {
  assert.ok(sameSha("921e8c88", "921e8c8812ab34"));
  assert.ok(sameSha("921e8c8812ab34", "921e8c88"));
  assert.ok(!sameSha("921e8c88", "4ce4444"));
  assert.ok(!sameSha("", "921e8c88"));
});

const doc = (id, text, path = `RFCs/${id}.md`) => ({ id, kind: "rfc", path, text });

test("agreement is both directions pointing at each other", () => {
  const r = audit({
    commits: [{ sha: "aaa1111", subject: "feat", message: "feat\n\nServes: RFC-073" }],
    documents: [doc("RFC-073", "body\n\n::commit{sha=aaa1111}")],
  });
  assert.strictEqual(r.agreed, true);
  assert.strictEqual(r.linked, 1);
  assert.deepStrictEqual([r.unlinked, r.dangling, r.oneWay, r.unclaimed], [[], [], [], []]);
});

test("ONE WAY — the commit names the plan and the plan does not carry the commit", () => {
  const r = audit({
    commits: [{ sha: "aaa1111", subject: "feat", message: "feat\n\nServes: RFC-073" }],
    documents: [doc("RFC-073", "body with no commit block")],
  });
  assert.strictEqual(r.agreed, false);
  assert.strictEqual(r.oneWay.length, 1);
  assert.strictEqual(r.oneWay[0].id, "RFC-073");
  assert.strictEqual(r.oneWay[0].path, "RFCs/RFC-073.md", "the finding says where to go and fix it");
});

test("DANGLING — serving an id no registered document has", () => {
  const r = audit({
    commits: [{ sha: "aaa1111", subject: "feat", message: "feat\n\nServes: RFC-999" }],
    documents: [doc("RFC-073", "")],
  });
  assert.strictEqual(r.dangling.length, 1);
  assert.strictEqual(r.dangling[0].id, "RFC-999");
  assert.strictEqual(r.oneWay.length, 0, "a dangling id is not also counted as one-way");
});

test("UNCLAIMED — the document names a sha whose commit points somewhere else, or nowhere", () => {
  const r = audit({
    commits: [{ sha: "aaa1111", subject: "feat", message: "feat\n\nServes: G-12" }],
    documents: [doc("RFC-073", "::commit{sha=aaa1111}"), { id: "G-12", kind: "gap", path: "G-12.md", text: "::commit{sha=aaa1111}" }],
  });
  assert.deepStrictEqual(r.unclaimed.map((u) => u.id), ["RFC-073"], "only the document the commit did not name");
});

// A COMMIT WE WERE NOT HANDED IS NOT A FINDING. The audit runs over a window of history; a sha
// older than the window is absent, and reporting absence as a broken link would make every audit
// noisier the further back a document reaches.
test("a sha outside the window of commits is left alone", () => {
  const r = audit({ commits: [], documents: [doc("RFC-073", "::commit{sha=deadbee}")] });
  assert.deepStrictEqual(r.unclaimed, []);
  assert.strictEqual(r.agreed, true);
});

test("UNLINKED is counted but does not break agreement — a typo fix serves nothing", () => {
  const r = audit({ commits: [{ sha: "aaa1111", subject: "fix a typo", message: "fix a typo" }], documents: [] });
  assert.strictEqual(r.unlinked.length, 1);
  assert.strictEqual(r.linked, 0);
  assert.strictEqual(r.agreed, true);
});

test("one commit serving several documents is checked against each", () => {
  const r = audit({
    commits: [{ sha: "aaa1111", subject: "feat", message: "feat\n\nServes: RFC-073\nServes: ARC-004-O2" }],
    documents: [doc("RFC-073", "::commit{sha=aaa1111}"), { id: "ARC-004-O2", kind: "arc", path: "a.md", text: "" }],
  });
  assert.strictEqual(r.oneWay.length, 1);
  assert.strictEqual(r.oneWay[0].id, "ARC-004-O2");
});

// ── THE CROSS — one mistake that used to be reported as two ─────────────────────────────────────
// Found by USING this door on my own night's work, 2026-11-07: three build commits in a row carried
// `Serves:` naming the PREVIOUS sitting's report. The cause is structural — a trailer is written at
// COMMIT time while a report's id is decided at the END of a sitting, so the title already in hand
// is last sitting's — and the reason it took three repeats to notice is this file: each cross read
// as an unrelated `oneWay` in one section plus an unrelated `unclaimed` in another.
test("a commit serving A whose sha is carried by B is ONE finding, not two", () => {
  const r = audit({
    commits: [{ sha: "aaaa1111", subject: "the menu's gating", message: "x\n\nServes: REPORT-A" }],
    documents: [
      { id: "REPORT-A", path: "a.md", text: "no shas here" },
      { id: "REPORT-B", path: "b.md", text: "::commit{sha=aaaa1111}" },
    ],
  });
  assert.deepEqual(r.crossed, [
    { sha: "aaaa1111", subject: "the menu's gating", says: "REPORT-A", carriedBy: "REPORT-B", path: "b.md" },
  ]);
  // BOTH HALVES ARE WITHDRAWN: the count of findings should be the count of mistakes.
  assert.deepEqual(r.oneWay, []);
  assert.deepEqual(r.unclaimed, []);
  assert.equal(r.agreed, false, "and it still counts as a disagreement");
});

test("a genuine one-way is not swallowed by the cross — nobody carries that sha", () => {
  const r = audit({
    commits: [{ sha: "bbbb2222", subject: "lonely", message: "x\n\nServes: REPORT-A" }],
    documents: [{ id: "REPORT-A", path: "a.md", text: "no shas" }],
  });
  assert.deepEqual(r.crossed, []);
  assert.equal(r.oneWay.length, 1);
  assert.equal(r.oneWay[0].sha, "bbbb2222");
});

test("and a document naming a sha whose commit serves NOTHING stays unclaimed, not crossed", () => {
  const r = audit({
    commits: [{ sha: "cccc3333", subject: "no trailer", message: "just a subject" }],
    documents: [{ id: "REPORT-A", path: "a.md", text: "::commit{sha=cccc3333}" }],
  });
  assert.deepEqual(r.crossed, [], "there is no second document to cross with");
  assert.equal(r.unclaimed.length, 1);
  assert.equal(r.unlinked.length, 1, "the commit itself is the unlinked one");
});

// A MULTI-SERVE IS NOT A CROSS — and the claim above for that case is what caught this while the
// cross was being added. One commit may serve two documents; when only one carries the record, the
// trailer is RIGHT and a record is missing, which is a plain one-way on the other document.
test("a commit serving two documents, one of which carries its sha, is one-way and NOT crossed", () => {
  const r = audit({
    commits: [{ sha: "aaa1111", subject: "feat", message: "feat\n\nServes: RFC-073\nServes: ARC-004-O2" }],
    documents: [
      { id: "RFC-073", kind: "rfc", path: "r.md", text: "::commit{sha=aaa1111}" },
      { id: "ARC-004-O2", kind: "arc", path: "a.md", text: "" },
    ],
  });
  assert.deepEqual(r.crossed, []);
  assert.equal(r.oneWay.length, 1);
  assert.equal(r.oneWay[0].id, "ARC-004-O2");
});

// ── A `Serves:` LINE IN THE WRONG PLACE IS ONE FINDING, NOT TWO FALSE ONES ────────────────────
// MEASURED 2026-11-07. A commit put its trailer on the line after the subject — character 82 of a
// 1343-character message — so `servesOf`, which reads the block at the END and must (a sentence
// mentioning "Serves:" in prose cannot be allowed to become a link), saw nothing at all. The door
// then reported the commit as UNLINKED and the document carrying its sha as UNCLAIMED, with "that
// commit does not serve it" — a sentence the message plainly contradicts. A reader following that
// advice edits a document that was already right.
test("a trailer outside the block is reported as misplaced, and nothing else", () => {
  const message = [
    "fix(proofs): the fixture rests torn down",
    "",
    "Serves: A report id",
    "",
    "A long body explaining the change, which is what pushed the line up here.",
  ].join("\n");

  const out = audit({
    commits: [{ sha: "e5a7760f00", subject: "fix(proofs): the fixture rests torn down", message }],
    documents: [{ id: "A report id", path: "r.md", text: "::commit{sha=e5a7760f}" }],
  });

  assert.deepStrictEqual(out.misplaced, [
    { sha: "e5a7760f00", subject: "fix(proofs): the fixture rests torn down", ids: ["A report id"] },
  ]);
  // BOTH FALSE HALVES WITHDRAWN — the count of findings is the count of mistakes.
  assert.deepStrictEqual(out.unlinked, []);
  assert.deepStrictEqual(out.unclaimed, []);
  assert.deepStrictEqual(out.oneWay, []);
  assert.strictEqual(out.agreed, false);
});

test("a trailer in the block is still the only thing that LINKS — the convention keeps its teeth", () => {
  const proper = ["fix: x", "", "A body.", "", "Serves: A report id"].join("\n");
  const out = audit({
    commits: [{ sha: "aaaa1111", subject: "fix: x", message: proper }],
    documents: [{ id: "A report id", path: "r.md", text: "::commit{sha=aaaa1111}" }],
  });
  assert.deepStrictEqual(out.misplaced, []);
  assert.strictEqual(out.agreed, true);
});

test("the word in prose is not a trailer, misplaced or otherwise", () => {
  const prose = ["fix: x", "", "This commit serves nothing; the Serves: convention is discussed below.", "", "Nothing."].join("\n");
  const out = audit({ commits: [{ sha: "bbbb2222", subject: "fix: x", message: prose }], documents: [] });
  assert.deepStrictEqual(out.misplaced, []);
  assert.deepStrictEqual(out.unlinked, [{ sha: "bbbb2222", subject: "fix: x" }]);
});

test("a misplaced line naming an id nothing registered is still misplaced, not dangling", () => {
  const message = ["fix: x", "", "Serves: nothing registered under this", "", "body"].join("\n");
  const out = audit({ commits: [{ sha: "cccc3333", subject: "fix: x", message }], documents: [] });
  assert.strictEqual(out.misplaced.length, 1);
  assert.deepStrictEqual(out.dangling, []);
});

// THE WINDOW IS PART OF THE ANSWER.
//
// `audit` is honest about what it was handed and cannot be honest about what it was not. The
// commits come from `git log --max-count=N`, so the door's default answer — "the two directions
// agree" — is a statement about however far back one call happened to look. Measured on this repo
// on 2026-11-09: two findings at a window of 200, twenty-four at 300. A completeness check whose
// default is a window is a check that reports clean by not looking.
test("a short log means the window reached the beginning of the repository", () => {
  const commits = [{ sha: "a1", subject: "one" }, { sha: "a2", subject: "two" }];
  const w = windowFacts({ requested: 200, commits });
  assert.strictEqual(w.window, 200);
  assert.strictEqual(w.read, 2);
  assert.strictEqual(w.exhausted, true, "fewer records than asked for is git running out of history");
  assert.deepStrictEqual(w.oldest, { sha: "a2", subject: "two" });
});

test("a full log means there are older commits this run never saw", () => {
  const commits = Array.from({ length: 20 }, (_, i) => ({ sha: `s${i}`, subject: `c${i}` }));
  const w = windowFacts({ requested: 20, commits });
  assert.strictEqual(w.exhausted, false);
  assert.strictEqual(w.atCap, false, "20 is not the cap, so raising it is advice that can be taken");
  assert.deepStrictEqual(w.oldest, { sha: "s19", subject: "c19" }, "the floor a reader can quote");
});

test("the default and the bounds are the hub's, stated once", () => {
  assert.strictEqual(windowFacts({ commits: [] }).window, 200, "no `since` is 200");
  assert.strictEqual(windowFacts({ requested: 0, commits: [] }).window, 200, "0 is not a window");
  assert.strictEqual(windowFacts({ requested: -5, commits: [] }).window, 1, "a negative one clamps to the floor");
  assert.strictEqual(windowFacts({ requested: 99999, commits: [] }).window, 2000, "and the cap holds");
  assert.strictEqual(windowFacts({ requested: "300", commits: [] }).window, 300, "a string from a tool call still counts");
});

// ADVICE THAT CANNOT BE TAKEN IS WORSE THAN NONE. At the cap there is no larger window to ask for,
// so the reader has to be told something else — narrow the question, not widen the window.
test("a full log AT THE CAP says so, because raising it is no longer the answer", () => {
  const commits = Array.from({ length: 2000 }, (_, i) => ({ sha: `s${i}`, subject: "x" }));
  const w = windowFacts({ requested: 5000, commits });
  assert.strictEqual(w.window, 2000);
  assert.strictEqual(w.exhausted, false);
  assert.strictEqual(w.atCap, true);
});

test("an empty log has no floor to quote, and says null rather than inventing one", () => {
  const w = windowFacts({ requested: 10, commits: [] });
  assert.strictEqual(w.read, 0);
  assert.strictEqual(w.exhausted, true);
  assert.strictEqual(w.oldest, null);
});

// AN ACCOUNT ASKED FOR NOTHING, so nothing owes it a trailer.
//
// A `Serves:` line answers "what asked for this work". An arc, an RFC and a gap all asked for
// something. A report is written AFTER the work it accounts for — its id did not exist when those
// commits were made — while report-authoring requires a `::commit{sha=}` record per commit. So
// every honest account used to manufacture `unclaimed` findings: 17 on this repo on 2026-11-11,
// eight of them from a single report, and the number only grew.
const noTrailer = (subject) => [subject, "", "a body with no trailer at all"].join("\n");
const serving = (subject, id) => [subject, "", "body", "", `Serves: ${id}`].join("\n");

test("a record on an account is counted, not accused", () => {
  const out = audit({
    commits: [{ sha: "aaaa1111", subject: "feat: x", message: noTrailer("feat: x") }],
    documents: [{ id: "An account", kind: "report", path: "reports/a.md", text: "::commit{sha=aaaa1111}" }],
  });
  assert.deepStrictEqual(out.unclaimed, [], "an account commissioned nothing, so nothing is owed");
  assert.deepStrictEqual(out.noted, [{ sha: "aaaa1111", id: "An account", path: "reports/a.md", kind: "report" }]);
  assert.strictEqual(out.agreed, true, "and it does not hold the whole answer down");
});

test("a record on a document that DID commission the work is still a finding", () => {
  for (const kind of ["rfc", "arc", "gap"]) {
    const out = audit({
      commits: [{ sha: "bbbb2222", subject: "feat: x", message: noTrailer("feat: x") }],
      documents: [{ id: "RFC-9", kind, path: "RFCs/r.md", text: "::commit{sha=bbbb2222}" }],
    });
    assert.strictEqual(out.unclaimed.length, 1, `${kind} still owes a trailer`);
    assert.deepStrictEqual(out.noted, []);
    assert.strictEqual(out.agreed, false);
  }
});

// THE DEFAULT IS STRICT — noise is visible, silence is not. A kind nobody listed must not lose its
// teeth by not being listed.
test("an unknown or missing kind is still checked", () => {
  for (const kind of ["something-new", "", undefined]) {
    const out = audit({
      commits: [{ sha: "cccc3333", subject: "feat: x", message: noTrailer("feat: x") }],
      documents: [{ id: "X", kind, path: "x.md", text: "::commit{sha=cccc3333}" }],
    });
    assert.strictEqual(out.unclaimed.length, 1, `kind ${JSON.stringify(kind)} must still be checked`);
  }
});

// THE TEETH THAT MUST STAY, in the direction that can actually be wrong: a commit saying it served
// a report while the report does not carry the sha is still a hole, because that trailer was a
// deliberate act and the record is genuinely missing.
test("a commit that really does serve a report, unrecorded, is still one-way", () => {
  const out = audit({
    commits: [{ sha: "dddd4444", subject: "feat: x", message: serving("feat: x", "An account") }],
    documents: [{ id: "An account", kind: "report", path: "reports/a.md", text: "no records here" }],
  });
  assert.strictEqual(out.oneWay.length, 1);
  assert.strictEqual(out.agreed, false);
});

test("a cross is still a cross when the document holding the sha is an account", () => {
  const out = audit({
    commits: [{ sha: "eeee5555", subject: "feat: x", message: serving("feat: x", "RFC-9") }],
    documents: [
      { id: "RFC-9", kind: "rfc", path: "RFCs/r.md", text: "no records here" },
      { id: "An account", kind: "report", path: "reports/a.md", text: "::commit{sha=eeee5555}" },
    ],
  });
  assert.strictEqual(out.crossed.length, 1, "the trailer is the wrong label, whoever carries the sha");
  assert.strictEqual(out.crossed[0].says, "RFC-9");
  assert.strictEqual(out.crossed[0].carriedBy, "An account");
});

test("noted counts only records this run could actually see", () => {
  const out = audit({
    commits: [{ sha: "ffff6666", subject: "feat: x", message: noTrailer("feat: x") }],
    documents: [{ id: "An account", kind: "report", path: "reports/a.md", text: "::commit{sha=ffff6666} ::commit{sha=99990000}" }],
  });
  assert.strictEqual(out.noted.length, 1, "a sha outside the window is not evidence of anything, either way");
});

// A RETIRED DOCUMENT IS NOT A TYPO.
//
// A report's normal end of life — the janitor collects it, its row leaves the registry — used to
// make every trailer that ever named it read "serves an id nothing registered". Measured on this
// repo 2026-11-11: forty-nine of them at a 400-commit window, with ONE structured id hiding among
// them. That is the finding the noise was burying, and the reason this split exists.
//
// The evidence comes from git and is gathered by the caller; what is checked here is the rule.
test("a trailer naming a document this repo once held is expired, not dangling", () => {
  const out = audit({
    commits: [{ sha: "aaaa1111", subject: "feat: x", message: serving("feat: x", "An old account") }],
    documents: [],
    retired: { "An old account": { path: "reports/old.md", sha: "dead0000" } },
  });
  assert.deepStrictEqual(out.dangling, []);
  assert.strictEqual(out.expired.length, 1);
  // THE ADDRESS, NOT AN ACCUSATION: where it lived and the commit that buried it, so the reasoning
  // is one `git show` away rather than lost.
  assert.deepStrictEqual(out.expired[0], {
    sha: "aaaa1111",
    subject: "feat: x",
    id: "An old account",
    path: "reports/old.md",
    deletedIn: "dead0000",
  });
});

test("an id this repo NEVER held is still dangling — that is the finding worth keeping", () => {
  const out = audit({
    commits: [{ sha: "bbbb2222", subject: "feat: x", message: serving("feat: x", "RFC-404") }],
    documents: [],
    retired: { "Something else": { path: "reports/other.md", sha: "dead0000" } },
  });
  assert.strictEqual(out.dangling.length, 1);
  assert.strictEqual(out.dangling[0].id, "RFC-404");
  assert.deepStrictEqual(out.expired, []);
});

// EXPIRY IS NOT A DISAGREEMENT. The trailer was right when it was written and the document ended
// its life as designed — so it must not hold the whole answer down, or the door goes back to never
// being able to say "agreed".
test("expired findings do not make the two directions disagree", () => {
  const out = audit({
    commits: [{ sha: "cccc3333", subject: "feat: x", message: serving("feat: x", "An old account") }],
    documents: [],
    retired: { "An old account": { path: "reports/old.md", sha: "dead0000" } },
  });
  assert.strictEqual(out.agreed, true);
  assert.strictEqual(out.expired.length, 1, "and it is still reported, not swallowed");
});

// A LIVE DOCUMENT WINS OVER A BURIAL RECORD — the same id registered today is not expired, whatever
// git remembers about a file that once carried it.
test("a registered document is never read as expired", () => {
  const out = audit({
    commits: [{ sha: "dddd4444", subject: "feat: x", message: serving("feat: x", "RFC-9") }],
    documents: [{ id: "RFC-9", kind: "rfc", path: "RFCs/r.md", text: "::commit{sha=dddd4444}" }],
    retired: { "RFC-9": { path: "RFCs/old-r.md", sha: "dead0000" } },
  });
  assert.deepStrictEqual(out.expired, []);
  assert.deepStrictEqual(out.dangling, []);
  assert.strictEqual(out.agreed, true);
});

test("with no retired map at all, nothing changes — every unknown id is dangling", () => {
  const out = audit({
    commits: [{ sha: "eeee5555", subject: "feat: x", message: serving("feat: x", "Anything") }],
    documents: [],
  });
  assert.strictEqual(out.dangling.length, 1);
  assert.deepStrictEqual(out.expired, []);
});

// A RECORD THAT POINTS AT NOTHING — the fault that renders "no such commit" in his window.
//
// A `::commit{sha=…}` naming a commit from ANOTHER repo needs `project=`; without it the sha is
// looked for in the document's own project and is not there. Three store notes said the rule and it
// still happened twice in two days, which makes it a missing CHECK rather than a knowledge gap —
// and the check could not exist while "not in the window" and "not real" were the same answer.
// WHERE EACH RECORD'S COMMIT IS, as the caller answers it: true = in the repo it names,
// "<project>" = in that one instead, false = nowhere this hub knows.
const KNOWN = {
  "systemview-test:9999ffff": false,
  "systemview-test:4362de5": "autobot",
  "systemview-test:2222bbbb": true,
  "autobot:4362de5": true,
  "autobot:1111aaaa": "systemview-test",
  "systemview-test:deadbeef": false,
};
const record = (text, over = {}) => ({ id: "R", kind: "report", project: "systemview-test", path: "r.md", text, ...over });

test("a sha that is in no repo at all is unresolvable, and says so", () => {
  const out = audit({ commits: [], documents: [record("::commit{sha=9999ffff}")], resolved: KNOWN });
  assert.strictEqual(out.unresolvable.length, 1);
  assert.strictEqual(out.unresolvable[0].sha, "9999ffff");
  assert.strictEqual(out.unresolvable[0].foundIn, "", "nowhere to point at is an honest empty, not a guess");
  assert.strictEqual(out.agreed, false, "a record rendering as a fault in his window is a disagreement");
});

// THE WHOLE POINT: naming the repo turns "no such commit" into the exact edit.
test("a cross-repo sha names the project it actually belongs to", () => {
  const out = audit({ commits: [], documents: [record("::commit{sha=4362de5}")], resolved: KNOWN });
  assert.strictEqual(out.unresolvable.length, 1);
  assert.strictEqual(out.unresolvable[0].foundIn, "autobot", "the fix is project=autobot, and the finding should say it");
});

test("a sha older than the window but real in its own repo is silence, not a finding", () => {
  const out = audit({ commits: [], documents: [record("::commit{sha=2222bbbb}")], resolved: KNOWN });
  assert.deepStrictEqual(out.unresolvable, []);
  assert.strictEqual(out.agreed, true);
});

// WITHOUT THE LISTS, NOTHING CHANGES. Absence of evidence stays absence: an older caller that sends
// no sha lists must get exactly the answer it got before.
test("with no sha lists, an unknown sha is silence exactly as it always was", () => {
  const out = audit({ commits: [], documents: [record("::commit{sha=9999ffff}")] });
  assert.deepStrictEqual(out.unresolvable, []);
  assert.strictEqual(out.agreed, true);
});

test("a document whose project has no list is skipped, never flooded", () => {
  const out = audit({
    commits: [],
    documents: [record("::commit{sha=9999ffff}", { project: "a-project-with-no-folder" })],
    resolved: KNOWN,
  });
  assert.deepStrictEqual(out.unresolvable, [], "a folder that is gone produces silence, not a page of findings");
});

// A FENCED BLOCK IS AN EXAMPLE, NOT A RECORD — and this check is what makes that distinction
// load-bearing: RFC-033 and the markdown guide carry made-up shas on purpose, and a check that
// cries wolf about documentation is one nobody runs twice.
test("shas inside a fence are teaching examples and are not read as records", () => {
  const text = ["Real: ::commit{sha=1111aaaa}", "", "```markdown", "::commit{sha=deadbeef}", "```", "", "::commit{sha=2222bbbb}"].join("\n");
  assert.deepStrictEqual(shasIn(text), ["1111aaaa", "2222bbbb"]);
  const out = audit({ commits: [], documents: [record(text)], resolved: KNOWN });
  assert.deepStrictEqual(out.unresolvable, [], "the fake sha never became a finding");
});

test("a longer fence can hold a shorter one, which is how the guide shows a fence", () => {
  const text = ["````markdown", "```", "::commit{sha=cafe1234}", "```", "````", "::commit{sha=1111aaaa}"].join("\n");
  assert.deepStrictEqual(shasIn(text), ["1111aaaa"]);
});

test("a tilde fence closes a tilde fence, and does not close a backtick one", () => {
  assert.deepStrictEqual(shasIn(["~~~", "::commit{sha=deadbeef}", "~~~", "::commit{sha=1111aaaa}"].join("\n")), ["1111aaaa"]);
  assert.deepStrictEqual(shasIn(["```", "~~~", "::commit{sha=deadbeef}", "```", "::commit{sha=1111aaaa}"].join("\n")), ["1111aaaa"]);
});

// `project=` IS NOT DECORATION, and this is the assertion that would have saved the check from
// itself: the first time it ran against real documents it reported ten of my OWN correct records
// as broken, because it read the sha and dropped the repo the record names.
test("a record that names its repo is checked against THAT repo", () => {
  const text = "::commit{sha=4362de5 project=autobot}";
  assert.deepStrictEqual(recordsIn(text), [{ sha: "4362de5", project: "autobot" }]);
  const out = audit({ commits: [], documents: [record(text)], resolved: KNOWN });
  assert.deepStrictEqual(out.unresolvable, [], "it resolves in autobot, which is where it says it is");
  assert.strictEqual(out.agreed, true);
});

test("a record naming a repo that does not hold it is still caught", () => {
  const out = audit({ commits: [], documents: [record("::commit{sha=1111aaaa project=autobot}")], resolved: KNOWN });
  assert.strictEqual(out.unresolvable.length, 1);
  assert.strictEqual(out.unresolvable[0].project, "autobot", "the repo it NAMED is the one it failed in");
  assert.strictEqual(out.unresolvable[0].foundIn, "systemview-test", "and the one that actually holds it");
});

// A CROSS-REPO RECORD CANNOT POINT BACK HERE, so it must never be read as unclaimed — that would
// accuse a correct record of being wrong, in the other direction.
test("a record naming another repo is not this log's business", () => {
  const out = audit({
    commits: [{ sha: "1111aaaa1111aaaa", subject: "x", message: "x" }],
    documents: [record("::commit{sha=4362de5 project=autobot}", { kind: "rfc" })],
    resolved: KNOWN,
  });
  assert.deepStrictEqual(out.unclaimed, []);
  assert.deepStrictEqual(out.unresolvable, []);
});

test("quoted and bare project values both read", () => {
  assert.deepStrictEqual(recordsIn('::commit{sha=aaaa1111 project="autobot"}'), [{ sha: "aaaa1111", project: "autobot" }]);
  assert.deepStrictEqual(recordsIn("::commit{sha=aaaa1111}"), [{ sha: "aaaa1111", project: "" }]);
});

// THE FAULT THE CHECK COMMITTED AGAINST ITSELF, pinned so it cannot come back.
//
// The first version asked `git log --format=%H` — commits reachable from HEAD — and reported 45
// records in RFC-078 as pointing nowhere. Every one is a real commit, on a branch HEAD cannot see.
// Reachability is not existence, and a check that confuses them manufactures findings about work
// sitting right there.
test("a commit that exists but is not reachable from HEAD is not a finding", () => {
  const out = audit({
    commits: [],
    documents: [record("::commit{sha=0ffabranch}")],
    // The caller looked and found it — on a branch, in a tag, wherever. That is `true`.
    resolved: { "systemview-test:0ffabranch": true },
  });
  assert.deepStrictEqual(out.unresolvable, []);
  assert.strictEqual(out.agreed, true);
});

test("a sha nobody looked up is silence, not a guess in either direction", () => {
  const out = audit({ commits: [], documents: [record("::commit{sha=0000cafe}")], resolved: {} });
  assert.deepStrictEqual(out.unresolvable, []);
  assert.strictEqual(out.agreed, true);
});
