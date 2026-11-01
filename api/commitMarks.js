// WHAT A COMMIT DID TO ONE FILE, AS GUTTER MARKS — not as a diff.
//
// His standing preference, and the reason this module exists: *"I don't really like seeing the
// diffs. I actually like seeing the files themselves, which has the markers on the side."* A
// unified diff is a third document — not the file before and not the file after, but an encoding
// of the distance between them, which you have to decode in your head to picture either one. The
// file at the commit, with the changed lines marked down the side, is the thing he is actually
// looking for: it reads as code, and the marks say which of it is new.
//
// So the hub answers with CONTENT plus MARKS, and nothing renders a diff at all.
//
// THE MARKS ARE LINE NUMBERS IN THE FILE YOU ARE LOOKING AT — the post-commit file — because that
// is the only file on screen. Two kinds, and they are not symmetrical:
//
//   added    lines that exist in this file and did not exist before. A line number.
//   removed  lines that existed before and do NOT exist in this file. They have no line of their
//            own here, so a deletion is recorded as the gap it left: `{ after, count }`, meaning
//            "`count` lines were taken out between `after` and the next line". `after: 0` is a
//            deletion at the very top.
//
// A modification is an added line and a removed gap at the same place — git says so too, and the
// renderer is free to draw that as one "changed" mark. Collapsing it HERE would throw away the
// fact that the counts differ, which is how "3 lines became 1" turns into a bar that says nothing.

// `--unified=0` so every hunk is exactly the run of changed lines, with no context to subtract.
const HUNK = /^@@+ (?:-(\d+)(?:,(\d+))?) (?:\+(\d+)(?:,(\d+))?) @@/;

/**
 * Parse `git diff --unified=0 <base> <sha> -- <path>` into gutter marks.
 *
 * Takes the raw diff text. Returns `{ added: number[], removed: [{after, count}], binary }`.
 * `added` is ascending and deduplicated. An empty diff is not an error — a commit can touch a
 * file's mode, or the caller can ask about a file the commit never touched — and it answers with
 * empty marks rather than a failure, because "this commit changed nothing here" is a real answer.
 */
function marksFromDiff(diff) {
  const text = String(diff || "");
  // A BINARY FILE HAS NO LINES, so it has no marks and must not read as "changed nothing". The
  // caller needs to tell those apart to render "binary — no preview" instead of an empty file.
  if (/^Binary files .* differ$/m.test(text) || /^GIT binary patch$/m.test(text)) {
    return { added: [], removed: [], binary: true };
  }
  const added = [];
  const removed = [];
  for (const line of text.split("\n")) {
    const m = HUNK.exec(line);
    if (!m) continue;
    // `,n` is omitted when n is 1 — the commonest case, and reading the absent group as 0 is how a
    // one-line change silently stops being marked.
    const delCount = m[2] === undefined ? 1 : +m[2];
    const addStart = +m[3];
    const addCount = m[4] === undefined ? 1 : +m[4];
    for (let i = 0; i < addCount; i += 1) added.push(addStart + i);
    // WITH `--unified=0` GIT REPORTS A PURE DELETION AS `+<n>,0`, where `n` is the line in the new
    // file that the removed run sat AFTER. That is already the anchor we want, so it is kept
    // verbatim rather than adjusted — a +1 here puts every deletion gap one line too low, which
    // looks right until the deletion is at the top of the file.
    if (delCount > 0 && addCount === 0) removed.push({ after: addStart, count: delCount });
    // A REPLACEMENT reports both counts. The added lines carry the mark; the shortfall is recorded
    // as a gap only when MORE went out than came in, because a gap of zero is not a gap.
    else if (delCount > addCount) removed.push({ after: addStart + addCount - 1, count: delCount - addCount });
  }
  return {
    added: [...new Set(added)].sort((a, b) => a - b),
    removed,
    binary: false,
  };
}

/**
 * Fold marks into one lookup the renderer can ask per line, so a 4,000-line file does not run
 * `includes()` 4,000 times over an array.
 *
 * Returns `{ isAdded(n), gapAfter(n) }` — `gapAfter` is the number of lines removed at that
 * boundary, or 0.
 */
function markLookup(marks = {}) {
  const add = new Set(marks.added || []);
  const gaps = new Map();
  for (const r of marks.removed || []) gaps.set(r.after, (gaps.get(r.after) || 0) + r.count);
  return {
    isAdded: (n) => add.has(n),
    gapAfter: (n) => gaps.get(n) || 0,
  };
}

module.exports = { marksFromDiff, markLookup };
