const test = require("node:test");
const assert = require("node:assert");
const { armed, inGroup } = require("./armed");

// WHAT THESE PIN. The question is "is the code I committed the code that is running", and the only
// way this answer can be worse than no answer is by being confidently wrong about the baseline —
// so most of these are about `since` and about saying what was compared.

test("no baseline is a refusal, never a zero", () => {
  // `since = 0` would make every commit in history newer and report a catastrophe in a confident
  // voice. That is the exact failure this module exists in reaction to, so it refuses by name.
  for (const bad of [undefined, null, 0, -1, "", "soon", NaN]) {
    const r = armed({ since: bad, commits: [{ sha: "a", at: 5, files: ["api/x.js"] }] });
    assert.strictEqual(r.ok, false, `since=${JSON.stringify(bad)} must refuse`);
    assert.match(r.error, /baseline/, "and the refusal says what is missing");
  }
});

test("only commits NEWER than the baseline count, and the boundary is exclusive", () => {
  const commits = [
    { sha: "old", subject: "before", at: 900, files: ["api/a.js"] },
    { sha: "same", subject: "exactly at the start", at: 1000, files: ["api/b.js"] },
    { sha: "new", subject: "after", at: 1001, files: ["api/c.js"] },
  ];
  const r = armed({ since: 1000, groups: ["api"], commits });
  assert.strictEqual(r.groups[0].newer, 1, "a commit stamped at the start moment was already loaded");
  assert.deepStrictEqual(r.groups[0].commits.map((c) => c.sha), ["new"]);
});

test("a group is a DIRECTORY prefix, never a substring", () => {
  // `api` matching `apiary/x.js` is how this count would go quietly wrong instead of visibly wrong.
  assert.strictEqual(inGroup("api/index.js", "api"), true);
  assert.strictEqual(inGroup("api", "api"), true, "the path itself, for a single-file group");
  assert.strictEqual(inGroup("apiary/x.js", "api"), false);
  assert.strictEqual(inGroup("src/api/x.js", "api"), false, "a prefix, not a search");
  assert.strictEqual(inGroup("anything", ""), true, "the empty group is the whole repo");
  assert.strictEqual(inGroup("api/index.js", "api/"), true, "a trailing slash is not a second rule");
});

test("no groups asked for means one answer about the whole repo", () => {
  const r = armed({ since: 1, commits: [{ sha: "a", at: 2, files: ["anywhere/at/all.js"] }] });
  assert.strictEqual(r.groups.length, 1);
  assert.strictEqual(r.groups[0].path, "");
  assert.strictEqual(r.groups[0].newer, 1);
});

test("one commit touching two groups is counted in both, and the total is distinct shas", () => {
  const commits = [{ sha: "both", subject: "x", at: 2, files: ["api/x.js", "src/y.js"] }];
  const r = armed({ since: 1, groups: ["api", "src"], commits });
  assert.strictEqual(r.groups[0].newer, 1);
  assert.strictEqual(r.groups[1].newer, 1);
  assert.strictEqual(r.newer, 1, "the per-group numbers add to two and the repo is one commit behind");
});

test("the baseline travels with the answer", () => {
  // A count of "3 newer" means nothing without the moment it is newer THAN. A door that reports the
  // count alone is the same fault as one that reports clean without saying how far back it looked.
  const r = armed({ since: 1762000000000, commits: [] });
  assert.strictEqual(r.since, 1762000000000);
});

test("uncommitted work is reported per group, because it is the other way work is not live", () => {
  const r = armed({
    since: 1,
    groups: ["api", "src"],
    commits: [],
    uncommitted: ["api/index.js", "src/App.js", "src/atoms/X.js", "README.md"],
  });
  assert.deepStrictEqual(r.groups[0].uncommitted, ["api/index.js"]);
  assert.deepStrictEqual(r.groups[1].uncommitted, ["src/App.js", "src/atoms/X.js"]);
  // THE TOTAL IS WHAT WAS ASKED ABOUT, AND THE README DOES NOT VANISH. A reader who named two
  // directories is told about those two; the file in neither is counted under `outside`, so the
  // number narrows without anything leaving in silence — which is the whole rule of this door.
  assert.strictEqual(r.uncommitted, 3, "three of the four are in a named group");
  assert.strictEqual(r.outside.uncommitted, 1, "and the README nobody asked about is still counted");
});

test("`live` means nothing committed OR on disk is newer — both halves", () => {
  assert.strictEqual(armed({ since: 10, commits: [], uncommitted: [] }).live, true);
  assert.strictEqual(
    armed({ since: 10, commits: [{ sha: "a", at: 11, files: ["api/x.js"] }] }).live,
    false,
    "committed and not loaded",
  );
  assert.strictEqual(
    armed({ since: 10, commits: [], uncommitted: ["api/x.js"] }).live,
    false,
    "on disk and never committed is not live either",
  );
});

test("a commit with no files cannot be placed, and an unknown never reads as a no", () => {
  // An empty merge, or a commit whose name-only output the caller could not read. It must not
  // silently become zero: the group lines would then disagree with the total, and the reader would
  // trust the group line. "This did not touch api/" is a claim an absent file list cannot support,
  // so it is reported as UNPLACEABLE and it blocks `live` — the one thing it must not do is let a
  // process be called current on the strength of a commit nobody could read.
  const r = armed({ since: 1, groups: ["api"], commits: [{ sha: "merge", at: 2, files: [] }] });
  assert.strictEqual(r.groups[0].newer, 0, "it is not IN api/ — that much is honest");
  assert.strictEqual(r.newer, 0, "and it is not counted as api/ work either");
  assert.strictEqual(r.outside.unknown, 1, "but it is counted, by name, as one nobody could place");
  assert.strictEqual(r.live, false, "so the verdict is still no");
});

test("an UNSCOPED call is untouched — one group, the whole repo, every commit in it", () => {
  // The fix must cost the plain question nothing: with no paths named there is one group, `""`,
  // which every file is in — including a commit with no file list at all.
  const r = armed({
    since: 1,
    commits: [{ sha: "a", at: 2, files: ["api/x.js"] }, { sha: "merge", at: 3, files: [] }],
    uncommitted: ["README.md"],
  });
  assert.strictEqual(r.newer, 2, "both commits count against the repo");
  assert.strictEqual(r.uncommitted, 1);
  assert.strictEqual(r.live, false);
  assert.strictEqual(r.outside, undefined, "there is no outside when nothing was named");
  assert.strictEqual(r.groups.length, 1);
  assert.strictEqual(r.groups[0].newer, 2, "the group line and the total agree");
});

test("the scoped verdict is the fault this door was built with, and it is the point of the fix", () => {
  // Measured on the live hub: three docs(report) commits landed, the caller asked about api, cli
  // and testing-utilities, every group said zero, and the headline said live:false. A reader is
  // sent to restart a process for nothing, or stops believing the door.
  const docs = [
    { sha: "d1", at: 2, files: ["reports/a.md"] },
    { sha: "d2", at: 3, files: ["reports/b.md"] },
    { sha: "d3", at: 4, files: ["reports/c.md"] },
  ];
  const r = armed({ since: 1, groups: ["api", "cli", "testing-utilities"], commits: docs });
  assert.strictEqual(r.newer, 0, "nothing newer in anything that was asked about");
  assert.strictEqual(r.live, true, "so the api/ fix IS live, which is what was asked");
  assert.strictEqual(r.outside.commits, 3, "and the three that landed are still named");
});
