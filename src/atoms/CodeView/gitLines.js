import { lineDiff, lineHunks } from "./lineDiff";

// The three-version arithmetic behind the change stripes — HEAD, the index, and what's on screen.
// It lived inside CodePane until a file EMBEDDED in a document needed the same stripes and the same
// per-run staging; one copy, two callers, so the two surfaces can't drift apart.
//
//   base    the HEAD version   (git show HEAD:path)   — answers WHAT changed
//   index   the staged version (git show :path), or null when there is no index entry
//   content what's on screen   — an unsaved edit marks itself without saving first

// Which lines differ from HEAD. TWO QUESTIONS PER LINE, not one: `base` answers what changed
// (added / changed / a deletion below), `index` answers whether it's staged — a line that still
// differs from the index is work you haven't staged yet.
export function changeMarksOf(base, index, content) {
  if (base == null || content == null) return null;
  const kinds = lineDiff(base, content);
  // No index entry (untracked) → nothing about this file is staged.
  const vsIndex = index == null ? kinds : lineDiff(index, content);
  const out = new Map();
  kinds.forEach((kind, line) => out.set(line, { kind, staged: !vsIndex.has(line) }));
  return out;
}

// The same runs, grouped, each carrying what it replaced — so clicking a stripe can show it. Each
// also knows whether it's ALREADY STAGED: a run with nothing left between the index and the working
// copy is in. That is what lets one hunk be staged on its own.
export function hunksOf(base, index, content) {
  if (base == null || content == null) return null;
  const all = lineHunks(base, content);
  const pending = index == null ? all : lineHunks(index, content);
  return all.map((h) => ({
    ...h,
    staged: !pending.some((p) => p.to >= h.from && p.from <= h.to),
  }));
}

// STAGE JUST THIS RUN, not the whole file: the staged copy rebuilt with only this hunk's edits
// applied (right to left, so earlier line numbers stay valid). Returns the bytes to hand git —
// the WORKING TREE IS NEVER TOUCHED, only the index moves. `{ error }` when there is nothing to do,
// because a silent no-op looks exactly like a broken button.
//
//   stage   : index ← the working lines for this run   (hunks are index→working, working coords,
//             the same coordinates `h` is in, so the overlap test is exact)
//   unstage : index ← HEAD's lines for this run        (hunks are HEAD→index, INDEX coords, which
//             don't line up with `h` — so the run is found by its CONTENT instead of its number)
export function stagedContentFor(h, { base, index, content, unstage }) {
  if (content == null) return { error: "nothing on screen to stage" };
  const idx = index == null ? "" : index;
  let out = idx;
  let edits;
  if (unstage) {
    const want = h.head.join("\n");
    edits = lineHunks(base, idx).filter((p) => p.head.join("\n") === want);
    if (!edits.length) return { error: "those lines aren't staged" };
    [...edits]
      .sort((a, b) => b.from - a.from)
      .forEach((p) => {
        const A = out.split("\n");
        out = [...A.slice(0, p.from - 1), ...p.base, ...A.slice(p.to)].join("\n");
      });
  } else {
    edits = lineHunks(idx, content).filter((p) => p.to >= h.from && p.from <= h.to);
    if (!edits.length) return { error: "those lines are already staged" };
    [...edits]
      .sort((a, b) => b.baseFrom - a.baseFrom)
      .forEach((p) => {
        const A = out.split("\n");
        out = [...A.slice(0, p.baseFrom - 1), ...p.head, ...A.slice(p.baseTo)].join("\n");
      });
  }
  return { content: out };
}

// What git would say about this file, read off the three versions we already hold — so a surface
// that has a diff doesn't need a second round trip to changedFiles() to build a right-click menu.
export function fileGitState(base, index, content) {
  if (base == null || content == null) return null;
  const untracked = index == null && !base;
  return {
    untracked,
    // `staged` here means "there is something in the index that HEAD doesn't have".
    staged: !untracked && index != null && index !== base,
    unstaged: index == null ? !!content || untracked : index !== content,
    label: untracked
      ? " · untracked"
      : index != null && index !== base
        ? index !== content
          ? " · staged, edited since"
          : " · staged"
        : base !== content
          ? " · not staged"
          : "",
  };
}
