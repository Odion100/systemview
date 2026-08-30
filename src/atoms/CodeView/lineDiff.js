// RFC-033 follow-on — WHICH LINES MOVED, for the plain file view.
//
// His ask: reading a file should show what changed along the edge, so you don't have to switch to
// the diff to find out. The data was already here — `Plugin.getDiff({path})` returns `{base, head}`
// and DiffView was the only consumer. This turns those two strings into a per-line verdict the
// editor can paint in its gutter.
//
// Returns a Map of 1-based line number in HEAD → "added" | "changed" | "removed", where "removed"
// marks the line AFTER which something was deleted (a deletion has no line of its own to sit on).

// Guard rail: a full LCS table is O(n*m). Trimming the common head and tail first means a normal
// edit — a few lines in a large file — costs almost nothing, and only a genuinely rewritten file
// reaches the cap. Past it we mark the whole differing span rather than pretending to be precise.
const MAX_CELLS = 4_000_000;

export function lineDiff(base = "", head = "") {
  if (base === head) return new Map();
  const A = String(base).split("\n");
  const B = String(head).split("\n");
  // An untracked file has no base at all — every line is new, and splitting "" would otherwise
  // leave a phantom empty line to diff against.
  if (!String(base).length) {
    const all = new Map();
    B.forEach((_l, i) => all.set(i + 1, "added"));
    return all;
  }

  // Common prefix / suffix — the parts that certainly didn't move.
  let pre = 0;
  while (pre < A.length && pre < B.length && A[pre] === B[pre]) pre += 1;
  let suf = 0;
  while (
    suf < A.length - pre &&
    suf < B.length - pre &&
    A[A.length - 1 - suf] === B[B.length - 1 - suf]
  )
    suf += 1;

  const a = A.slice(pre, A.length - suf);
  const b = B.slice(pre, B.length - suf);
  const marks = new Map();
  // A pure insertion or a pure deletion needs no table at all.
  if (!a.length) {
    b.forEach((_l, i) => marks.set(pre + i + 1, "added"));
    return marks;
  }
  if (!b.length) {
    // Everything here was deleted — hang the mark on the line just before the gap.
    marks.set(Math.max(1, pre), "removed");
    return marks;
  }

  // The edit script — "=" keep, "-" delete a line of A, "+" insert a line of B — from the exact
  // LCS table while it fits, and from Myers' O(ND) walk when it does not. The cap used to mean
  // "mark the whole span changed": on a 6,000-line file with edits spread across it (his
  // AgentChat.js) that made ONE hunk out of everything, so no run could be staged on its own and
  // the faded view had nothing to fade. Myers costs O((n+m)·D), D = edits, which is small even
  // when n·m is not.
  const ops = a.length * b.length > MAX_CELLS ? myersOps(a, b) : lcsOps(a, b);

  // Walk it, recording what happened to each line of B. A deletion immediately followed by an
  // insertion reads as a CHANGED line, which is what a human means by "this line changed".
  let j = 0;
  let pendingDelete = false;
  for (const op of ops) {
    if (op === "=") {
      if (pendingDelete) {
        // Deleted lines with nothing put in their place — mark the surviving line above the gap.
        marks.set(pre + j, marks.get(pre + j) || "removed");
        pendingDelete = false;
      }
      j += 1;
    } else if (op === "-") {
      pendingDelete = true;
    } else {
      marks.set(pre + j + 1, pendingDelete ? "changed" : "added");
      pendingDelete = false;
      j += 1;
    }
  }
  if (pendingDelete) marks.set(Math.max(1, pre + j), "removed");
  return marks;
}

// Exact: the LCS length table, then the classic walk.
function lcsOps(a, b) {
  const n = a.length;
  const m = b.length;
  const L = new Uint32Array((n + 1) * (m + 1));
  const at = (i, j) => i * (m + 1) + j;
  for (let i = n - 1; i >= 0; i -= 1)
    for (let j = m - 1; j >= 0; j -= 1)
      L[at(i, j)] = a[i] === b[j] ? L[at(i + 1, j + 1)] + 1 : Math.max(L[at(i + 1, j)], L[at(i, j + 1)]);
  const ops = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) { ops.push("="); i += 1; j += 1; }
    else if (L[at(i + 1, j)] >= L[at(i, j + 1)]) { ops.push("-"); i += 1; }
    else { ops.push("+"); j += 1; }
  }
  while (i < n) { ops.push("-"); i += 1; }
  while (j < m) { ops.push("+"); j += 1; }
  return ops;
}

// Myers (1986), the forward walk with a saved trace per step — memory O(D²) worst case, which for
// a real edit (hundreds of differing lines) is nothing. Same op alphabet as lcsOps.
function myersOps(a, b) {
  const n = a.length;
  const m = b.length;
  const max = n + m;
  const offset = max;
  let v = new Int32Array(2 * max + 2);
  const trace = [];
  let found = false;
  for (let d = 0; d <= max && !found; d += 1) {
    trace.push(v.slice());
    for (let k = -d; k <= d; k += 2) {
      let x;
      if (k === -d || (k !== d && v[offset + k - 1] < v[offset + k + 1])) x = v[offset + k + 1];
      else x = v[offset + k - 1] + 1;
      let y = x - k;
      while (x < n && y < m && a[x] === b[y]) { x += 1; y += 1; }
      v[offset + k] = x;
      if (x >= n && y >= m) { found = true; break; }
    }
  }
  // Backtrack through the saved traces to recover the script, then reverse it.
  const rev = [];
  let x = n;
  let y = m;
  for (let d = trace.length - 1; d >= 0; d -= 1) {
    const vv = trace[d];
    const k = x - y;
    let prevK;
    if (k === -d || (k !== d && vv[offset + k - 1] < vv[offset + k + 1])) prevK = k + 1;
    else prevK = k - 1;
    const prevX = vv[offset + prevK];
    const prevY = prevX - prevK;
    while (x > prevX && y > prevY) { rev.push("="); x -= 1; y -= 1; }
    if (d > 0) {
      if (x === prevX) { rev.push("+"); y -= 1; }
      else { rev.push("-"); x -= 1; }
    }
  }
  while (x > 0 && y > 0) { rev.push("="); x -= 1; y -= 1; }
  while (x > 0) { rev.push("-"); x -= 1; }
  while (y > 0) { rev.push("+"); y -= 1; }
  return rev.reverse();
}

// HUNKS — the same walk, grouped. A stripe you can CLICK needs to know what was there BEFORE, and
// that answer belongs to a run of lines, not to one. Returns, per contiguous marked run:
//   { from, to, base: [lines that were there before] }
// `from`/`to` are 1-based lines in HEAD; a pure deletion has from === to === the line above the gap
// and every removed line in `base`.
export function lineHunks(base = "", head = "") {
  const marks = lineDiff(base, head);
  if (!marks.size) return [];
  // A file with no base replaced nothing — every hunk is pure addition.
  const A = String(base).length ? String(base).split("\n") : [];
  const B = String(head).split("\n");

  // Walk HEAD alongside BASE once, keeping a cursor into BASE so each run of marked lines can claim
  // the base lines it replaced. Anchored on the UNCHANGED lines, which appear in both.
  const unchanged = new Map(); // head line → base line, for lines that didn't move
  {
    let bi = 0;
    for (let hi = 0; hi < B.length; hi += 1) {
      if (marks.has(hi + 1) && marks.get(hi + 1) !== "removed") continue;
      // Find this head line in what remains of base — bounded, so a pathological file can't crawl.
      let found = -1;
      for (let k = bi; k < Math.min(A.length, bi + 400); k += 1)
        if (A[k] === B[hi]) { found = k; break; }
      if (found > -1) {
        unchanged.set(hi + 1, found + 1);
        bi = found + 1;
      }
    }
  }

  const lines = [...marks.keys()].sort((a, b) => a - b);
  const hunks = [];
  let run = [lines[0]];
  for (let i = 1; i < lines.length; i += 1) {
    if (lines[i] === run[run.length - 1] + 1) run.push(lines[i]);
    else {
      hunks.push(run);
      run = [lines[i]];
    }
  }
  hunks.push(run);

  return hunks.map((r) => {
    const from = r[0];
    const to = r[r.length - 1];
    // The base span this run replaced: everything between the last unchanged line before it and
    // the first unchanged line after it. A "removed" mark sits on a line that DIDN'T move — it is
    // only the anchor for the gap underneath — so the span starts after that line's own base twin.
    let baseFrom = 1;
    if (unchanged.has(from)) baseFrom = unchanged.get(from) + 1;
    else
      for (let h = from - 1; h >= 1; h -= 1)
        if (unchanged.has(h)) { baseFrom = unchanged.get(h) + 1; break; }
    let baseTo = A.length;
    for (let h = to + 1; h <= B.length; h += 1)
      if (unchanged.has(h)) { baseTo = unchanged.get(h) - 1; break; }
    const kind = marks.get(from);
    return {
      from,
      to,
      kind,
      base: baseTo >= baseFrom ? A.slice(baseFrom - 1, baseTo) : [],
      // The EXACT edit, in base coordinates: replace baseFrom..baseTo with `head`. That is what
      // makes staging ONE hunk possible — rebuild the staged copy with only this run applied.
      // A deletion replaces its span with nothing; its anchor line never moved.
      baseFrom,
      baseTo,
      head: kind === "removed" ? [] : B.slice(from - 1, to),
    };
  });
}

export default lineDiff;
