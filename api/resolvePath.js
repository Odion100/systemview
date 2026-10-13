// Resolving a written path to (project, relative path) — the whole of it, and nothing about HTTP.
//
// Split out of api/index.js 2026-10-06 so it can be tested: it is pure given a root map, and the
// hub is the only thing that owns the root map. The caller passes `roots` ({ projectCode: absolute
// path }); everything else here is the grammar of what people and agents actually write.

const path_ = require("path");
const fsGit = require("fs");

// ANY PATH, FROM ANYWHERE, OPENS (his ask, 2026-10-05): *"the system needs to be able to find any
// file… right now you got to start with the project. Well, that should be optional. If you put the
// actual file, it should work."* And the reason it matters is not convenience — it is that the
// agents writing these links do not share this app's grammar: *"it can respond to regular links that
// the agents are not necessarily following their system, they're just following what they think the
// link is."* He explicitly refused the alternative — correcting the agents — and he is right: a
// convention every writer has to learn is a convention that breaks for every writer who has not.
//
// THE ROOTS LIVE HERE AND NOWHERE ELSE, which is why the resolver does too. A copy of the root map
// in the window would be a second answer to "where is buAPI" that drifts the first time a project
// moves, and the window cannot even see the shell's folders.
//
// FIVE SHAPES, TRIED IN THE ORDER THAT CANNOT GUESS WRONG:
//   1. an ABSOLUTE path — the longest matching root wins, so a project nested inside another is
//      resolved to the inner one. Shortest-first would hand every nested file to the parent.
//   2. `<projectCode>/rest` OR `<folder-name>/rest` — the first segment names a project we know,
//      BY ITS CODE OR BY THE NAME OF ITS DIRECTORY. Both, because the code is this app's private
//      word for the repo and the folder is what an agent can actually see: `systemview-test` lives
//      in `~/Systemly/systemview`, so `systemview/RFCs/RFC-067.md` is what gets written and it must
//      not be a dead link. The segment is only accepted when the file is really under that root,
//      so a repo that happens to share a name with a top-level source directory costs nothing.
//   3. the HINT project (the document's), when the file is actually there.
//   4. every other root, and ONLY if exactly one holds it. Two matches is ambiguous, and picking the
//      first would silently open the wrong repo's copy of `src/index.js` — the one failure that is
//      worse than not opening at all, because it looks like it worked.
//   5. a TAIL MATCH, last and only if nothing above landed: find files whose path ENDS with what
//      was written. This is the shape agents write most — a bare `colorTokens.js` in prose, or
//      `CodeView/colorTokens.js` from memory — and refusing it is refusing the common case. It is
//      last on purpose: a real relative path must never be beaten by a deep file that merely ends
//      the same way. Searched with `git ls-files --cached --others --exclude-standard` so it is
//      git doing the walking and UNTRACKED files are included (the new file nobody has committed
//      yet is exactly the one being linked), while `node_modules` and `build` stay excluded by the
//      repo's own ignores. Exactly one hit resolves; several refuse BY NAME, so the answer to an
//      ambiguous link is a choice rather than a guess.
function resolveAnyPath(raw, hint = "", roots = {}) {
  let rel = String(raw || "").trim();
  if (!rel) return null;
  // A range is addressing, not path — strip it before touching the filesystem, or every ranged
  // reference reports ENOENT on a filename with "#L40-70" in it.
  const range = rel.match(/#L\d+(?:-L?\d+)?$/i) || rel.match(/:\d+(?:-\d+)?$/);
  if (range) rel = rel.slice(0, range.index);
  rel = rel.replace(/^file:\/\//, "").replace(/[)>\]]+$/, "");
  const suffix = range ? range[0] : "";
  const hit = (pc, p) => ({ projectCode: pc, path: p, suffix, resolved: true });

  if (rel.startsWith("~/")) rel = path_.join(require("os").homedir(), rel.slice(2));

  if (path_.isAbsolute(rel)) {
    const owners = Object.entries(roots)
      .filter(([, root]) => rel === root || rel.startsWith(root.endsWith("/") ? root : root + "/"))
      .sort((a, b) => b[1].length - a[1].length);
    if (owners.length) {
      const [pc, root] = owners[0];
      return hit(pc, path_.relative(root, rel) || path_.basename(rel));
    }
    // Outside every project. Readable by the shell, but there is no project to address it as, and
    // saying so beats pretending.
    return { projectCode: "", path: rel, suffix, resolved: false, reason: "outside every known project root" };
  }

  const seg = rel.split("/")[0];
  if (rel.includes("/")) {
    const after = rel.slice(seg.length + 1);
    // The segment may be the project's CODE or the basename of its FOLDER — an agent writes what it
    // can see. Codes are checked first so a folder name can never shadow a real code.
    const byCode = roots[seg] ? [seg] : [];
    const byDir = Object.keys(roots).filter((pc) => pc !== seg && path_.basename(roots[pc]) === seg);
    for (const pc of [...byCode, ...byDir]) {
      if (fsGit.existsSync(path_.join(roots[pc], after))) return hit(pc, after);
    }
  }

  if (hint && roots[hint] && fsGit.existsSync(path_.join(roots[hint], rel))) return hit(hint, rel);

  const found = Object.keys(roots).filter((pc) => fsGit.existsSync(path_.join(roots[pc], rel)));
  if (found.length === 1) return hit(found[0], rel);
  if (found.length > 1) {
    // Ambiguous across projects — but a link written INSIDE a document has a home repo, and it is
    // not one of the others. `index.js` in a systemview doc means systemview's, so give the hint a
    // tail match before refusing with a list of repos the writer was not talking about.
    const inHint = hint && roots[hint] ? tailMatches({ [hint]: roots[hint] }, rel, hint) : [];
    if (inHint.length === 1) return hit(inHint[0].projectCode, inHint[0].path);
    return { projectCode: "", path: rel, suffix, resolved: false, reason: `that path exists in ${found.length} projects (${found.join(", ")}) — name one`, candidates: found };
  }

  // SHAPE 5 — the tail match. Nothing above held it as written, so ask git for files that END with
  // it. The hint project is searched first and wins outright when it has exactly one, because the
  // document's own repo is the overwhelmingly likely owner of a link written inside it.
  const tails = tailMatches(roots, rel, hint);
  if (tails.length === 1) return hit(tails[0].projectCode, tails[0].path);
  if (tails.length > 1)
    return {
      projectCode: "", path: rel, suffix, resolved: false,
      reason: `that name ends ${tails.length} files — name one`,
      candidates: tails.slice(0, 12).map((t) => `${t.projectCode}/${t.path}`),
    };
  return { projectCode: "", path: rel, suffix, resolved: false, reason: "no project holds that path" };
}

// Files whose path ends with `rel`, at a segment boundary. `git ls-files` does the walking: a
// pathspec `*/<rel>` matches across directories in git (its `*` is not the shell's), `--others
// --exclude-standard` brings in untracked-but-not-ignored files, and the repo's own .gitignore is
// what keeps `node_modules` out — rather than a deny-list here that would drift from it.
//
// SYNC ON PURPOSE. `resolveAnyPath` is called from a request handler that is itself sync, and the
// walk is bounded by git's index; making the resolver async to save a few milliseconds would push
// a promise into every caller that resolves the ordinary shapes without touching the disk twice.
function tailMatches(roots, rel, hint = "") {
  const clean = rel.replace(/^\.\//, "");
  if (!clean || clean.includes("*")) return [];
  const { spawnSync } = require("child_process");
  const ask = (root) => {
    const r = spawnSync("git", ["ls-files", "--cached", "--others", "--exclude-standard", "-z", "--", `*/${clean}`, clean], {
      cwd: root, encoding: "utf8", maxBuffer: 8 * 1024 * 1024, timeout: 4000,
    });
    if (r.status !== 0 || !r.stdout) return [];
    return r.stdout.split("\0").filter(Boolean);
  };
  const order = [...(hint && roots[hint] ? [hint] : []), ...Object.keys(roots).filter((pc) => pc !== hint)];
  const all = [];
  for (const pc of order) {
    const hits = ask(roots[pc]).map((p) => ({ projectCode: pc, path: p }));
    // The hint's single answer ends it — see above.
    if (pc === hint && hits.length === 1) return hits;
    all.push(...hits);
  }
  return all;
}


module.exports = { resolveAnyPath, tailMatches };
