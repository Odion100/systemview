const fs = require("fs");
const path = require("path");

// RFC-018 ground-truth file providers. These run INSIDE the observed service, so they read THAT
// service's real source from its own working directory. Every path is guarded to the repo root —
// a client can browse the project but never escape it (no `../../etc/passwd`). The stage/UI only
// ever carries TARGETS (locators); the real bytes come from here at render time.
//
// RFC-027: the providers are also a LIBRARY — createFileProviders(rootDir) binds the whole set to
// an explicit root, so the hub can serve a HOSTED project's files from that project's directory
// instead of its own cwd. The default export stays bound to process.cwd() (the plugin's own case).

// Extension → CodeMirror language name (the UI picks the highlighter from this).
const LANG_BY_EXT = {
  ".js": "javascript", ".jsx": "javascript", ".mjs": "javascript", ".cjs": "javascript",
  ".ts": "typescript", ".tsx": "typescript",
  ".json": "json", ".md": "markdown", ".markdown": "markdown",
  ".css": "css", ".scss": "sass", ".sass": "sass", ".less": "less",
  ".html": "html", ".htm": "html", ".xml": "xml", ".svg": "xml",
  ".py": "python", ".rb": "ruby", ".php": "php", ".go": "go", ".rs": "rust",
  ".java": "java", ".c": "c", ".h": "c", ".cpp": "cpp", ".cc": "cpp",
  ".sh": "shell", ".bash": "shell", ".zsh": "shell",
  ".yml": "yaml", ".yaml": "yaml", ".sql": "sql", ".txt": "text",
};
const languageOf = (p) => LANG_BY_EXT[path.extname(p).toLowerCase()] || "text";

// Directories never worth walking for a source view — noise or huge. NOTE: `.systemview` is NOT
// here — it's the user's own data (docs, tests, reports, chats) and belongs in the tree.
const IGNORE_DIRS = new Set([
  "node_modules", ".git", "build", "dist", "coverage",
  ".next", ".nuxt", ".cache", "tmp", ".DS_Store",
]);

// Minimal glob → RegExp: `**` = any path, `*` = any non-slash run, `?` = one char. Anchored to the
// full relative path. Enough for `**/*.js`, `src/*.md`, `Users*` without a glob dependency.
function globToRegExp(glob) {
  let re = "";
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === "*") {
      if (glob[i + 1] === "*") { re += ".*"; i++; if (glob[i + 1] === "/") i++; }
      else re += "[^/]*";
    } else if (c === "?") re += "[^/]";
    else if (".+^${}()|[]\\".includes(c)) re += "\\" + c;
    else re += c;
  }
  return new RegExp(`^${re}$`, "i");
}

// Locate a method definition line inside a file's lines. Definition-ish, not a call: `name(...)`,
// `name:`, `name =`, `async name`, `function name`, `this.name =`. First match wins.
function findMethodLine(lines, method) {
  const esc = method.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const defRe = new RegExp(
    `(?:^|[^\\w.])(?:async\\s+)?(?:function\\s+)?${esc}\\s*(?:[:=(]|=>)` +
    `|\\bthis\\.${esc}\\s*=`,
  );
  for (let i = 0; i < lines.length; i++) {
    if (defRe.test(lines[i])) return i;
  }
  return -1;
}

// From a definition line, brace-match to the end of the block for the highlight span. Falls back to a
// bounded window when there's no obvious block (arrow one-liners, object shorthand).
function methodSpan(lines, startIdx) {
  let depth = 0, seen = false;
  for (let i = startIdx; i < lines.length && i < startIdx + 400; i++) {
    for (const ch of lines[i]) {
      if (ch === "{") { depth++; seen = true; }
      else if (ch === "}") depth--;
    }
    // Settle only at END of line — a destructuring/object param on the signature line (`add({ a, b }) {`)
    // opens AND closes braces mid-line, so the body brace is what leaves net depth > 0.
    if (seen && depth <= 0) return i;
  }
  return Math.min(startIdx + 30, lines.length - 1);
}

function createFileProviders(rootDir) {
  const root = () => path.resolve(rootDir || process.cwd());

  // Resolve a client-supplied path against the repo root, rejecting anything that escapes it.
  function safeResolve(userPath) {
    const base = root();
    const resolved = path.resolve(base, userPath || ".");
    if (resolved !== base && !resolved.startsWith(base + path.sep)) {
      throw new Error(`Path "${userPath}" escapes the project root`);
    }
    return resolved;
  }

  const relFromRoot = (abs) => path.relative(root(), abs) || path.basename(abs);

  // Walk the tree from `absDir`, skipping IGNORE_DIRS, collecting files (bounded so a giant repo can't
  // blow up a response). `filterRe` (optional) matches the path relative to repo root.
  // The walk is DETERMINISTIC (alphabetical, depth-first): if the cap is ever hit, what's missing is
  // the alphabetical tail — not arbitrary folders. The old LIFO-stack walk truncated RANDOM folders
  // in big repos, which read as "whole directories silently don't exist".
  const MAX_FILES = 20000;
  function walkFiles(absDir, { filterRe, max = MAX_FILES } = {}) {
    const out = [];
    const walk = (dir) => {
      if (out.length >= max) return;
      let entries;
      try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
      entries.sort((a, b) => a.name.localeCompare(b.name));
      for (const ent of entries) {
        if (out.length >= max) return;
        const abs = path.join(dir, ent.name);
        if (ent.isDirectory()) {
          if (!IGNORE_DIRS.has(ent.name)) walk(abs);
        } else if (ent.isFile()) {
          const rel = relFromRoot(abs);
          if (!filterRe || filterRe.test(rel)) out.push(rel);
        }
      }
    };
    walk(absDir);
    return out.sort();
  }

  // --- The provider methods (each is what a Plugin.<name> call runs) ---

  // readFile({ path }) → the real bytes + language + line count. The `file` pane renderer.
  function readFile({ path: userPath } = {}) {
    if (!userPath) throw new Error("readFile: `path` is required");
    const abs = safeResolve(userPath);
    const content = fs.readFileSync(abs, "utf8");
    return {
      path: relFromRoot(abs),
      content,
      language: languageOf(abs),
      lines: content.length ? content.split("\n").length : 0,
    };
  }

  // The repo's untracked paths (git ls-files --others), for stamping listFiles entries. null = not a
  // git repo / git unavailable — callers use that to know tracked-ness is UNKNOWN, not "all tracked".
  function untrackedSet() {
    try {
      const { execFileSync } = require("child_process");
      const out = execFileSync("git", ["ls-files", "--others", "--exclude-standard"], {
        cwd: root(), encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], maxBuffer: 10 * 1024 * 1024,
      });
      return new Set(out.split("\n").map((l) => l.trim()).filter(Boolean));
    } catch { return null; }
  }

  // listFiles({ dir?, glob? }) → flat, sorted list of project files (ignoring noise dirs), each with
  // its language. Bounded; `truncated` flags when the cap was hit so the UI can say so. In a git repo,
  // untracked files carry `tracked: false` (tracked ones stay unstamped) and the response is marked
  // `gitAware` — the UI only offers a tracked-only filter when that's true.
  function listFiles({ dir = ".", glob } = {}) {
    const absDir = safeResolve(dir);
    const filterRe = glob ? globToRegExp(glob) : null;
    const files = walkFiles(absDir, { filterRe });
    const untracked = untrackedSet();
    return {
      dir: relFromRoot(absDir),
      files: files.map((p) => {
        const f = { path: p, language: languageOf(p) };
        if (untracked && untracked.has(p)) f.tracked = false;
        return f;
      }),
      truncated: files.length >= MAX_FILES,
      gitAware: !!untracked,
    };
  }

  // search({ query, glob?, max? }) → content hits {path, line, text}. Also the fallback engine behind
  // getSource. Case-insensitive substring (not regex — a locator tool, not grep).
  function search({ query, glob, max = 200 } = {}) {
    if (!query) throw new Error("search: `query` is required");
    const needle = String(query).toLowerCase();
    const filterRe = glob ? globToRegExp(glob) : null;
    const files = walkFiles(root(), { filterRe });
    const hits = [];
    for (const rel of files) {
      if (hits.length >= max) break;
      let content;
      try { content = fs.readFileSync(path.join(root(), rel), "utf8"); } catch { continue; }
      const lines = content.split("\n");
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].toLowerCase().includes(needle)) {
          hits.push({ path: rel, line: i + 1, text: lines[i].trim().slice(0, 240) });
          if (hits.length >= max) break;
        }
      }
    }
    return { query, hits, truncated: hits.length >= max };
  }

  // Find the file that most likely defines a systemlynx module by NAMING CONVENTION:
  // `**/Users.js`, `**/Users/index.js`, `**/Users/Users.js`, `**/modules/Users.js`. Convention-first
  // because systemlynx doesn't preserve a module's source path (see RFC-018 getSource note).
  function moduleFileCandidates(moduleName) {
    if (!moduleName) return [];
    const files = walkFiles(root(), {});
    const m = moduleName.toLowerCase();
    const scored = [];
    for (const rel of files) {
      if (!/\.(js|mjs|cjs|ts|jsx|tsx)$/i.test(rel)) continue;
      const base = path.basename(rel).replace(/\.(js|mjs|cjs|ts|jsx|tsx)$/i, "").toLowerCase();
      const parent = path.basename(path.dirname(rel)).toLowerCase();
      let score = 0;
      if (base === m) score = 3;                       // Users.js
      else if (base === "index" && parent === m) score = 2; // Users/index.js
      if (score) scored.push({ rel, score });
    }
    scored.sort((a, b) => b.score - a.score);
    return scored.map((s) => s.rel);
  }

  // getSource({ module, method }) → {path, startLine, endLine, content}. The "show me THIS function"
  // bridge. Convention-resolves the module file, finds the method's span, returns the WHOLE file
  // (scrollable) plus the span so the UI can scroll-to + highlight. Degrades to line 1 when a name is
  // ambiguous or unfound — never throws on a miss, so the pane still shows the best-guess file.
  function getSource({ module, method } = {}) {
    if (!method) throw new Error("getSource: `method` is required");
    const candidates = moduleFileCandidates(module);

    // Prefer the convention-matched module file; else fall back to a content search for the method.
    let target = null;
    for (const rel of candidates) {
      const content = fs.readFileSync(path.join(root(), rel), "utf8");
      const idx = findMethodLine(content.split("\n"), method);
      if (idx > -1) { target = { rel, content, idx }; break; }
      if (!target) target = { rel, content, idx: -1 }; // remember first candidate as a fallback file
    }
    if (!target || target.idx === -1) {
      const found = search({ query: method });
      const hit = found.hits.find((h) => /\.(js|mjs|cjs|ts|jsx|tsx)$/i.test(h.path)) || found.hits[0];
      if (hit) {
        const content = fs.readFileSync(path.join(root(), hit.path), "utf8");
        const idx = findMethodLine(content.split("\n"), method);
        target = { rel: hit.path, content, idx: idx > -1 ? idx : hit.line - 1 };
      }
    }
    if (!target) throw new Error(`getSource: no source found for ${module ? module + "." : ""}${method}`);

    const lines = target.content.split("\n");
    const startIdx = target.idx > -1 ? target.idx : 0;
    const endIdx = target.idx > -1 ? methodSpan(lines, startIdx) : startIdx;
    return {
      path: target.rel,
      language: languageOf(target.rel),
      startLine: startIdx + 1,
      endLine: endIdx + 1,
      content: target.content,
    };
  }

  // getDiff({ path }) → { path, base, head, language }. Before/after a file vs its git base (HEAD).
  // Uses git via child_process; if the file isn't tracked / no git, base is "" (renders as all-added).
  function getDiff({ path: userPath } = {}) {
    if (!userPath) throw new Error("getDiff: `path` is required");
    const abs = safeResolve(userPath);
    const rel = relFromRoot(abs);
    const head = fs.existsSync(abs) ? fs.readFileSync(abs, "utf8") : "";
    let base = "";
    try {
      const { execFileSync } = require("child_process");
      base = execFileSync("git", ["show", `HEAD:${rel}`], {
        cwd: root(), encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], maxBuffer: 10 * 1024 * 1024,
      });
    } catch { base = ""; } // untracked / no git → treat as fully new
    return { path: rel, base, head, language: languageOf(abs) };
  }

  // changedFiles() → { files: [{ path, language }] } — only the files that DIFFER from HEAD (tracked
  // changes + untracked new files), via one git call each. Lets a `diff` picker show ONLY what changed
  // instead of the whole tree. Not a repo / nothing changed → { files: [] } (UI falls back to the full list).
  // `--relative` keeps diff paths relative to THIS service's cwd (matching listFiles); ls-files is already.
  function changedFiles() {
    const { execFileSync } = require("child_process");
    const run = (args) => {
      try {
        return execFileSync("git", args, {
          cwd: root(), encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], maxBuffer: 10 * 1024 * 1024,
        });
      } catch { return ""; }
    };
    // WHAT KIND OF CHANGE, not just "changed". Two queries used to be merged into one flat set of
    // paths, which threw away the only interesting part — modified, added, deleted, untracked and
    // STAGED all arrived looking identical, so the tree could only ever draw one dot. Porcelain
    // gives all of it in a single call: XY where X is the index and Y is the working tree.
    const out = run(["status", "--porcelain", "--untracked-files=all", "--"]);
    const files = [];
    out.split("\n").forEach((line) => {
      if (!line.trim()) return;
      const x = line[0];
      const y = line[1];
      let rel = line.slice(3).trim();
      // A rename reads "R  old -> new" — the new name is the one that exists on disk.
      const arrow = rel.indexOf(" -> ");
      if (arrow !== -1) rel = rel.slice(arrow + 4).trim();
      rel = rel.replace(/^"|"$/g, "");
      // IGNORE_DIRS is a BROWSING rule (don't list build output in the file tree) and applying it
      // here was wrong: git already honours .gitignore, so anything status reports is something the
      // repo genuinely tracks. Filtering `build/` out hid 11 of this repo's 22 changes — and a
      // "stage all" that only ever saw half of them could only ever stage half. Only `.git` and
      // `node_modules` stay out: if either shows up, it is noise no repo means to commit.
      if (!rel || rel.split("/").some((seg) => seg === ".git" || seg === "node_modules")) return;
      const untracked = x === "?" || y === "?";
      const staged = !untracked && x !== " " && x !== "";
      const dirty = !untracked && y !== " " && y !== "";
      files.push({
        path: rel,
        language: languageOf(rel),
        x,
        y,
        staged,
        // `status` is the ONE word a UI needs to pick a symbol; x/y are there for anything finer.
        status: untracked
          ? "untracked"
          : (staged ? x : y) === "D"
            ? "deleted"
            : (staged ? x : y) === "A"
              ? "added"
              : (staged ? x : y) === "R"
                ? "renamed"
                : "modified",
        // Staged AND edited again since — worth its own tell, it's the state people lose work in.
        partial: staged && dirty,
      });
    });
    return { files };
  }

  // stageFiles({ paths, unstage }) → the FRESH changedFiles() result. `git add` / `git restore
  // --staged` on paths inside this root — the same operation the version-control panel offers,
  // done where the repo actually is. Deliberately the only two verbs: nothing here commits,
  // discards, or touches history. Every path is safeResolve'd, so nothing outside the root moves.
  function stageFiles({ paths, unstage = false } = {}) {
    const { execFileSync } = require("child_process");
    const list = (Array.isArray(paths) ? paths : [paths]).filter(Boolean).map(String);
    if (!list.length) throw new Error("stageFiles: at least one path is required");
    const rels = list.map((p) => {
      safeResolve(p); // throws if it escapes the root
      return p.replace(/^\.?\//, "");
    });
    try {
      execFileSync(
        "git",
        // `git add` covers a deletion too (it stages the removal); `restore --staged` is the
        // exact inverse and never touches the working tree.
        unstage ? ["restore", "--staged", "--", ...rels] : ["add", "--", ...rels],
        { cwd: root(), encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
      );
    } catch (e) {
      // A repo with no commits yet has no HEAD to restore against — say so plainly.
      throw new Error(
        `git ${unstage ? "restore --staged" : "add"} failed: ${String((e && e.stderr) || (e && e.message) || e).trim()}`,
      );
    }
    return changedFiles();
  }

  // --- RFC-033 — COMMIT FROM THE DOCUMENT. These serve a CLICK: a human presses a button in the
  // version-control panel or a `::commit` block. Nothing here is reachable from the CLI, and no
  // agent calls them. The verbs stop at commit and push — no amend, no force, no discard, no branch
  // switching. If those ever arrive they arrive named, in their own RFC.
  const git = (args) => {
    const { execFileSync } = require("child_process");
    return execFileSync("git", args, {
      cwd: root(), encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], maxBuffer: 10 * 1024 * 1024,
    });
  };
  const gitQuiet = (args) => {
    try { return git(args).trim(); } catch { return ""; }
  };
  // `git push` narrates on STDERR even when it succeeds ("To github.com… main -> main"), and that
  // narration IS the thing worth showing. execFileSync hands back stdout only, so anything whose
  // output matters runs through spawnSync and keeps both streams.
  const gitBoth = (args) => {
    const { spawnSync } = require("child_process");
    const r = spawnSync("git", args, { cwd: root(), encoding: "utf8", maxBuffer: 10 * 1024 * 1024 });
    const output = [r.stdout || "", r.stderr || ""].join("\n").trim();
    return { ok: r.status === 0, output };
  };

  // gitState() → READ ONLY. Everything the commit UI needs to draw itself honestly: which branch,
  // whether it tracks anything, how far ahead/behind, and whether there is a staged tree at all.
  // A directory that isn.t a repo answers { repo: false } rather than throwing — the panel just
  // doesn.t offer the buttons.
  function gitState() {
    const inside = gitQuiet(["rev-parse", "--is-inside-work-tree"]) === "true";
    if (!inside) return { repo: false };
    const branch = gitQuiet(["rev-parse", "--abbrev-ref", "HEAD"]);
    const upstream = gitQuiet(["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{upstream}"]);
    let ahead = 0;
    let behind = 0;
    if (upstream) {
      // "<behind>\t<ahead>" from git itself — no arithmetic of our own to get backwards.
      const counts = gitQuiet(["rev-list", "--left-right", "--count", `${upstream}...HEAD`]);
      const [b, a] = counts.split(/\s+/).map((n) => Number(n) || 0);
      behind = b || 0;
      ahead = a || 0;
    }
    const all = changedFiles().files;
    const staged = all.filter((f) => f.staged);
    const slim = (f) => ({ path: f.path, status: f.status, partial: f.partial, staged: f.staged });
    const hasCommits = !!gitQuiet(["rev-parse", "--verify", "HEAD"]);
    // The log rides along: he commits, flips to the log to watch it land, and comes back — that
    // only works if the history is already here rather than a second round trip away.
    const log = hasCommits
      ? gitQuiet(["log", "-15", "--pretty=%h%s%ar%an"])
          .split("\n")
          .filter(Boolean)
          .map((l) => {
            const [sha, subject, when, who] = l.split("");
            return { sha, subject, when, who };
          })
      : [];
    return {
      repo: true,
      branch,
      upstream: upstream || null,
      hasRemote: !!gitQuiet(["remote"]),
      ahead,
      behind,
      // No HEAD yet = a repo with no commits. The first commit is still legal; the DIFF isn.t.
      hasCommits,
      staged: staged.map(slim),
      stagedCount: staged.length,
      // Everything else that CHANGED, so a commit box can offer staging instead of sending you
      // somewhere else to do it first.
      unstaged: all.filter((f) => !f.staged || f.partial).map(slim),
      log,
    };
  }

  // commit({ message }) → { sha, subject, state }. Commits WHAT IS ALREADY STAGED — it never stages
  // for you. Staging is its own decision, made one click earlier; a commit that quietly staged
  // would be committing something nobody looked at.
  function commit({ message } = {}) {
    const msg = String(message || "").trim();
    if (!msg) throw new Error("commit: a message is required");
    const state = gitState();
    if (!state.repo) throw new Error("commit: not a git repository");
    if (!state.stagedCount) throw new Error("commit: nothing is staged");
    // A pre-commit hook that ABORTS says why — on stdout as often as stderr. Both come back
    // verbatim: "commit failed" without git's own words is the least useful thing we could say.
    const { ok, output } = gitBoth(["commit", "-m", msg]);
    if (!ok) throw new Error(`git commit failed: ${output || "git said nothing"}`);
    return {
      sha: gitQuiet(["rev-parse", "--short", "HEAD"]),
      subject: gitQuiet(["log", "-1", "--pretty=%s"]),
      // git's own words, kept — the "3 files changed, 40 insertions(+)" line is the receipt.
      output: String(output || "").trim(),
      state: gitState(),
      changed: changedFiles(),
    };
  }

  // push() → { pushed, state }. Current branch to the upstream it already tracks. Refuses when
  // there is no upstream rather than inventing one — guessing a remote is how work lands somewhere
  // nobody meant to send it.
  function push() {
    const state = gitState();
    if (!state.repo) throw new Error("push: not a git repository");
    if (!state.upstream)
      throw new Error(
        `push: ${state.branch || "this branch"} has no upstream — set one with \`git push -u\` once, then this works`,
      );
    if (!state.ahead) return { pushed: false, reason: "nothing to push", state };
    const { ok, output } = gitBoth(["push"]);
    if (!ok) throw new Error(`git push failed: ${output || "git said nothing"}`);
    return {
      pushed: true,
      output: output || `${state.branch} → ${state.upstream}`,
      state: gitState(),
    };
  }

  // --- DOC UNDO: the snapshot ring. Every whole-file write (and delete) files the PREVIOUS
  // version under `.systemview/history/<path-key>/<ts>.snap` before the new bytes land — so
  // "undo" is always one restore away, no matter which tab or agent did the damage. Ring-kept:
  // newest HISTORY_KEEP per file.
  const HISTORY_KEEP = 20;
  const historyRoot = () => path.join(root(), ".systemview", "history");
  const histKey = (rel) => rel.replace(/[/\\]/g, "__");
  function snapshot(abs) {
    let prev;
    try { prev = fs.readFileSync(abs, "utf8"); } catch { return null; } // new file — nothing to keep
    const rel = relFromRoot(abs);
    if (rel.startsWith(path.join(".systemview", "history"))) return null; // never snapshot snapshots
    const dir = path.join(historyRoot(), histKey(rel));
    try {
      fs.mkdirSync(dir, { recursive: true });
      // Two saves in the same millisecond must not share a filename — bump until free so every
      // snapshot keeps its own unique ts (readSnapshot addresses by exact ts).
      let ts = Date.now();
      while (fs.existsSync(path.join(dir, `${ts}.snap`))) ts++;
      fs.writeFileSync(path.join(dir, `${ts}.snap`), prev, "utf8");
      const snaps = fs.readdirSync(dir).filter((f) => f.endsWith(".snap")).sort((a, b) => parseInt(a) - parseInt(b));
      while (snaps.length > HISTORY_KEEP) fs.unlinkSync(path.join(dir, snaps.shift()));
    } catch {}
    return prev;
  }

  // fileHistory({ path }) → { path, snaps: [{ ts, bytes }] } newest first — the History drawer's feed.
  function fileHistory({ path: userPath } = {}) {
    if (!userPath) throw new Error("fileHistory: `path` is required");
    const rel = relFromRoot(safeResolve(userPath));
    const dir = path.join(historyRoot(), histKey(rel));
    let snaps = [];
    try {
      snaps = fs
        .readdirSync(dir)
        .filter((f) => f.endsWith(".snap"))
        .map((f) => ({ ts: parseInt(f), bytes: fs.statSync(path.join(dir, f)).size }))
        .filter((s) => Number.isFinite(s.ts))
        .sort((a, b) => b.ts - a.ts);
    } catch {}
    return { path: rel, snaps };
  }

  // readSnapshot({ path, ts }) → { path, ts, content } — one saved version's bytes. Restoring is a
  // normal writeFile with this content: the current version gets snapshotted first, so undo has undo.
  function readSnapshot({ path: userPath, ts } = {}) {
    if (!userPath || !ts) throw new Error("readSnapshot: `path` and `ts` are required");
    const rel = relFromRoot(safeResolve(userPath));
    const file = path.join(historyRoot(), histKey(rel), `${ts}.snap`);
    return { path: rel, ts, content: fs.readFileSync(file, "utf8") };
  }

  // readFileRaw({ path }) → { base64, mime, bytes } — binary-safe bytes for the hub's /sv-raw
  // route (::image renders repo screenshots straight from the project — locators, not copies).
  const MIME_BY_EXT = {
    ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".gif": "image/gif",
    ".webp": "image/webp", ".svg": "image/svg+xml", ".ico": "image/x-icon",
    ".bmp": "image/bmp", ".avif": "image/avif",
  };
  function readFileRaw({ path: userPath } = {}) {
    if (!userPath) throw new Error("readFileRaw: `path` is required");
    const abs = safeResolve(userPath);
    const stat = fs.statSync(abs);
    if (stat.size > 15 * 1024 * 1024) throw new Error("file too large to serve raw (15MB cap)");
    const buf = fs.readFileSync(abs);
    return {
      path: relFromRoot(abs),
      base64: buf.toString("base64"),
      mime: MIME_BY_EXT[path.extname(abs).toLowerCase()] || "application/octet-stream",
      bytes: stat.size,
    };
  }

  // writeFile({ path, content, base }) → save (the editor's write path, guarded). Phase 4.
  // `base` (optional) = the content this tab LOADED: when the file on disk no longer matches it,
  // someone else saved meanwhile — return { conflict, current } instead of clobbering their work.
  // The caller decides (reload / overwrite by resending without base).
  function writeFile({ path: userPath, content, base } = {}) {
    if (!userPath) throw new Error("writeFile: `path` is required");
    const abs = safeResolve(userPath);
    let onDisk = null;
    try { onDisk = fs.readFileSync(abs, "utf8"); } catch {}
    // Saving what's already on disk is a no-op — no write, no snapshot (history holds real
    // versions, not duplicates from repeated saves).
    if (onDisk !== null && onDisk === String(content == null ? "" : content))
      return { path: relFromRoot(abs), bytes: Buffer.byteLength(onDisk, "utf8"), unchanged: true };
    if (base !== undefined && base !== null) {
      if (onDisk !== null && onDisk !== String(base))
        return { path: relFromRoot(abs), conflict: true, current: onDisk };
    }
    snapshot(abs);
    // Create the parent folder if it's missing — writing to a path whose directory doesn't exist yet
    // (a new specs folder, a sidecar) failed with ENOENT and looked like a silent no-op to the caller.
    try {
      fs.mkdirSync(path.dirname(abs), { recursive: true });
    } catch {}
    fs.writeFileSync(abs, content == null ? "" : String(content), "utf8");
    return { path: relFromRoot(abs), bytes: Buffer.byteLength(content || "", "utf8") };
  }

  return { readFile, readFileRaw, listFiles, changedFiles, stageFiles, gitState, commit, push, search, getSource, getDiff, writeFile, fileHistory, readSnapshot, snapshot, languageOf, safeResolve };
}

// Default set bound (lazily) to process.cwd() — the plugin running inside an observed service.
module.exports = Object.assign(createFileProviders(), { createFileProviders, findMethodLine, languageOf });
