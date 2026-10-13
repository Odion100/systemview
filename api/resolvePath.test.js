// A WRITTEN PATH RESOLVES, whoever wrote it. Every claim here is a shape somebody actually types:
// his own report was a dead link an agent wrote in good faith — `BUApp/…` when the project code is
// something else — and *"those links and files, markdown should work."*
//
// Real git repos in a temp dir, not a mocked fs: shape 5 IS `git ls-files`, so a fake would test
// the mock's idea of a pathspec. `*` matching across `/` and `--others` finding untracked files are
// exactly the two behaviours that would break silently.
const assert = require("node:assert");
const { test, before, after, describe } = require("node:test");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const { resolveAnyPath } = require("./resolvePath");

let tmp, roots;
const write = (p, body = "x") => {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, body);
};

before(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "sv-resolve-"));
  const mk = (dir) => {
    const root = path.join(tmp, dir);
    fs.mkdirSync(root, { recursive: true });
    execFileSync("git", ["init", "-q"], { cwd: root });
    return root;
  };
  // Note the deliberate mismatch between CODE and FOLDER — it is the whole of shape 2, and the
  // real one: `systemview-test` lives in a directory called `systemview`.
  const sv = mk("systemview");
  const bot = mk("autobot");
  const nested = mk("systemview/vendor/inner");
  roots = { "systemview-test": sv, autobot: bot, inner: nested };

  write(path.join(sv, "api/index.js"));
  write(path.join(sv, "src/atoms/CodeView/colorTokens.js"));
  write(path.join(sv, "RFCs/RFC-067-jobs-and-chores.md"));
  write(path.join(sv, "node_modules/left-pad/index.js"));
  // `vendor` only so the nested repo does not make `git add -A` refuse in the parent.
  write(path.join(sv, ".gitignore"), "node_modules\nvendor\n");
  write(path.join(bot, "index.js"));
  write(path.join(bot, "electron/apps/launcher.cjs"));
  write(path.join(nested, "index.js"));
  // Tracked in one repo, untracked in the other — shape 5 must find both.
  execFileSync("git", ["add", "-A"], { cwd: sv });
  execFileSync("git", ["-c", "user.email=t@t", "-c", "user.name=t", "commit", "-qm", "x"], { cwd: sv });
  write(path.join(sv, "src/atoms/CodeView/colorPicker.js")); // left untracked on purpose
});
after(() => fs.rmSync(tmp, { recursive: true, force: true }));

const r = (p, hint = "") => resolveAnyPath(p, hint, roots);

describe("the shapes that already worked keep working", () => {
  test("a relative path inside exactly one project", () => {
    assert.deepStrictEqual(r("api/index.js"), {
      projectCode: "systemview-test", path: "api/index.js", suffix: "", resolved: true,
    });
  });

  test("an absolute path resolves to the INNERMOST project holding it", () => {
    // shortest-root-first would hand every nested file to the parent repo
    const hit = r(path.join(roots.inner, "index.js"));
    assert.strictEqual(hit.projectCode, "inner");
    assert.strictEqual(hit.path, "index.js");
  });

  test("an absolute path outside every root refuses, and says why", () => {
    const miss = r("/etc/hosts");
    assert.strictEqual(miss.resolved, false);
    assert.match(miss.reason, /outside every known project/);
  });

  test("`<projectCode>/rest` — the first segment naming the code", () => {
    assert.strictEqual(r("autobot/electron/apps/launcher.cjs").path, "electron/apps/launcher.cjs");
  });

  test("a line range is addressing, not path — it comes back as a suffix", () => {
    assert.deepStrictEqual(r("api/index.js#L801-846"), {
      projectCode: "systemview-test", path: "api/index.js", suffix: "#L801-846", resolved: true,
    });
    assert.strictEqual(r("api/index.js:12").suffix, ":12");
  });

  test("a trailing paren from a markdown link does not become part of the filename", () => {
    assert.strictEqual(r("api/index.js)").resolved, true);
  });
});

describe("shape 2 — the first segment may be the FOLDER's name, not the project code", () => {
  test("`systemview/RFCs/…` resolves, though the code is systemview-test", () => {
    assert.deepStrictEqual(r("systemview/RFCs/RFC-067-jobs-and-chores.md"), {
      projectCode: "systemview-test", path: "RFCs/RFC-067-jobs-and-chores.md", suffix: "", resolved: true,
    });
  });

  test("a folder name is only believed when the file is really under it", () => {
    // `systemview/electron/...` is a plausible sentence and a wrong one
    assert.strictEqual(r("systemview/electron/apps/launcher.cjs").resolved, false);
  });

  test("a CODE beats a folder name — a code can never be shadowed", () => {
    assert.strictEqual(r("autobot/index.js").projectCode, "autobot");
  });
});

describe("shape 5 — a tail match, for the link an agent writes from memory", () => {
  test("a bare filename resolves when exactly one file ends that way", () => {
    assert.deepStrictEqual(r("colorTokens.js"), {
      projectCode: "systemview-test", path: "src/atoms/CodeView/colorTokens.js", suffix: "", resolved: true,
    });
  });

  test("a partial directory tail resolves too", () => {
    assert.strictEqual(r("CodeView/colorTokens.js").path, "src/atoms/CodeView/colorTokens.js");
  });

  test("an UNTRACKED file is found — it is the likeliest one to be linked", () => {
    assert.strictEqual(r("colorPicker.js").path, "src/atoms/CodeView/colorPicker.js");
  });

  test("an IGNORED file is not — the repo's own .gitignore is the deny-list", () => {
    assert.strictEqual(r("left-pad/index.js").resolved, false);
  });

  test("several files ending the same way REFUSE, and name the candidates", () => {
    const miss = r("launcher.cjs");
    assert.strictEqual(miss.resolved, true); // only one — the control for the next claim
    const amb = r("index.js");
    assert.strictEqual(amb.resolved, false);
    assert.ok(amb.candidates.length > 1, "an ambiguous answer must list what it could not choose");
  });

  test("a real relative path is never beaten by a deeper file ending the same way", () => {
    // autobot/index.js exists at the root; shape 4 must answer before any tail search
    assert.strictEqual(r("electron/apps/launcher.cjs").projectCode, "autobot");
  });

  test("nothing matching says so plainly, rather than guessing", () => {
    const miss = r("nope/does-not-exist.js");
    assert.strictEqual(miss.resolved, false);
    assert.match(miss.reason, /no project holds that path/);
  });
});

describe("the hint — a link written inside a document has a home repo", () => {
  test("the hint wins when it holds the path as written", () => {
    assert.strictEqual(r("index.js", "autobot").projectCode, "autobot");
  });

  test("the hint's single tail match beats a cross-project ambiguity", () => {
    // `index.js` sits at the root of autobot AND inner; written in a systemview doc it means
    // systemview's — and systemview has exactly one
    assert.deepStrictEqual(r("index.js", "systemview-test"), {
      projectCode: "systemview-test", path: "api/index.js", suffix: "", resolved: true,
    });
  });

  test("an unknown hint is ignored, not an error", () => {
    assert.strictEqual(r("api/index.js", "no-such-project").projectCode, "systemview-test");
  });
});

describe("nothing in means nothing out", () => {
  test("empty, whitespace and undefined are null — never a resolve", () => {
    assert.strictEqual(resolveAnyPath("", "", roots), null);
    assert.strictEqual(resolveAnyPath("   ", "", roots), null);
    assert.strictEqual(resolveAnyPath(undefined, "", roots), null);
  });

  test("a glob is refused rather than handed to git as a pathspec", () => {
    assert.strictEqual(r("src/**/*.js").resolved, false);
  });
});
