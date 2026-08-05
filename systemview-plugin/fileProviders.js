const fs = require("fs");
const path = require("path");

// RFC-018 ground-truth file providers. These run INSIDE the observed service, so they read THAT
// service's real source from its own working directory. Every path is guarded to the repo root
// (process.cwd()) — a client can browse the project but never escape it (no `../../etc/passwd`).
// The stage/UI only ever carries TARGETS (locators); the real bytes come from here at render time.

const root = () => path.resolve(process.cwd());

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

// Directories never worth walking for a source view — noise, huge, or SystemView's own runtime.
const IGNORE_DIRS = new Set([
  "node_modules", ".git", ".systemview", "build", "dist", "coverage",
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

// Walk the tree from `absDir`, skipping IGNORE_DIRS, collecting files (bounded so a giant repo can't
// blow up a response). `filterRe` (optional) matches the path relative to repo root.
function walkFiles(absDir, { filterRe, max = 4000 } = {}) {
  const out = [];
  const stack = [absDir];
  while (stack.length && out.length < max) {
    const dir = stack.pop();
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { continue; }
    for (const ent of entries) {
      const abs = path.join(dir, ent.name);
      if (ent.isDirectory()) {
        if (!IGNORE_DIRS.has(ent.name)) stack.push(abs);
      } else if (ent.isFile()) {
        const rel = relFromRoot(abs);
        if (!filterRe || filterRe.test(rel)) out.push(rel);
        if (out.length >= max) break;
      }
    }
  }
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
    truncated: files.length >= 4000,
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
  const set = new Set();
  run(["diff", "--name-only", "--relative", "HEAD"]).split("\n").forEach((l) => { if (l.trim()) set.add(l.trim()); });
  run(["ls-files", "--others", "--exclude-standard"]).split("\n").forEach((l) => { if (l.trim()) set.add(l.trim()); });
  const files = [...set]
    .filter((rel) => !rel.split("/").some((seg) => IGNORE_DIRS.has(seg)))
    .map((rel) => ({ path: rel, language: languageOf(rel) }));
  return { files };
}

// writeFile({ path, content }) → save (the editor's write path, guarded). Phase 4.
function writeFile({ path: userPath, content } = {}) {
  if (!userPath) throw new Error("writeFile: `path` is required");
  const abs = safeResolve(userPath);
  fs.writeFileSync(abs, content == null ? "" : String(content), "utf8");
  return { path: relFromRoot(abs), bytes: Buffer.byteLength(content || "", "utf8") };
}

module.exports = { readFile, listFiles, changedFiles, search, getSource, getDiff, writeFile, languageOf, safeResolve };
