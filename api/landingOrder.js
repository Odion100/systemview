// WHICH LANES COLLIDE, AND WHAT ORDER IS SAFE TO LAND.
//
// WHY THIS EXISTS. Thirty lanes stand in this project and twenty-six are proven to exist nowhere
// but their own branch. Every one is tested and reported; none has landed. The thing in the way
// stopped being "is the work done" a while ago — it is that nobody can say which of thirty
// branches collide, so a landing session looks like thirty risks instead of a few independent
// groups that can go in any order.
//
// FILE OVERLAP IS NOT A CONFLICT, and guessing from it is why people avoid landing. Measured on
// this repo: `lane/a-thread-is-born-replyable` and `lane/an-objective-is-a-block` BOTH modify
// `src/atoms/Markdown/Markdown.js` and merge cleanly — they touch different parts of it. A tool
// that warned on overlap would have called those a collision and been wrong, which teaches people
// to ignore it. So the answer comes from `git merge-tree --write-tree`, which performs the real
// merge in memory and exits non-zero only when it actually conflicts. Nothing is checked out and
// no worktree is touched, so this is safe to run against a tree somebody is working in.
//
// `api/` IS COMMONJS and `src/` is ESM — this file is the hub's half, so it exports the hub's way.
//
// GIT IS INJECTED — `run(args) -> { code, out }` — so the clustering and the ordering can be
// proven against a fixture conflict map instead of needing a repo full of branches to test.

/** Pairwise conflicts, as a map of branch -> Set(branches it conflicts with). */
function conflictMapFrom(pairs = []) {
  const map = new Map();
  const touch = (b) => {
    if (!map.has(b)) map.set(b, new Set());
    return map.get(b);
  };
  pairs.forEach(({ a, b, conflicts }) => {
    touch(a);
    touch(b);
    if (conflicts) {
      map.get(a).add(b);
      map.get(b).add(a);
    }
  });
  return map;
}

/**
 * CLUSTERS — groups that have to be landed together and thought about together, and which are
 * independent of each other. A lane that conflicts with nothing is a cluster of one, which is the
 * best possible news and is why they are reported rather than filtered out: those can land today,
 * in any order, with no thinking at all.
 */
function clustersOf(conflictMap) {
  const seen = new Set();
  const out = [];
  for (const branch of conflictMap.keys()) {
    if (seen.has(branch)) continue;
    const group = [];
    const queue = [branch];
    seen.add(branch);
    while (queue.length) {
      const b = queue.shift();
      group.push(b);
      for (const n of conflictMap.get(b) || []) {
        if (seen.has(n)) continue;
        seen.add(n);
        queue.push(n);
      }
    }
    out.push(group.sort());
  }
  // Biggest knot first — it is the one that decides how long a landing session takes, and burying
  // it under twenty singletons is how a report gets skimmed to the wrong conclusion.
  return out.sort((x, y) => y.length - x.length || String(x[0]).localeCompare(String(y[0])));
}

/**
 * A LANDING ORDER. Independent lanes first (they cost nothing and shrink the pile), then each
 * knot, largest last — because the big knot is where a rebase is likely and it should be attempted
 * when the tree is otherwise quiet rather than in the middle of a run of easy ones.
 *
 * This is ADVICE, not a guarantee: landing changes the base, so the second branch of a conflicting
 * pair may need a rebase whatever order it goes in. The honest value is knowing WHICH pairs will
 * ask for that, before starting.
 */
function landingOrder(conflictMap) {
  const groups = clustersOf(conflictMap);
  const singles = groups.filter((g) => g.length === 1).flat().sort();
  const knots = groups.filter((g) => g.length > 1).sort((a, b) => a.length - b.length);
  return { independent: singles, knots, order: [...singles, ...knots.flatMap((k) => k)] };
}

/**
 * Ask git whether two branches really merge. `{ conflicts, files }` — `files` is what git named,
 * which is the part worth printing: "these two both rewrote AgentChat.js's band" is actionable in
 * a way that "these conflict" is not.
 */
function mergeCheck(run, a, b) {
  const res = run(["merge-tree", "--write-tree", "--name-only", a, b]);
  if (!res || typeof res.code !== "number") return { conflicts: false, files: [], unknown: true };
  if (res.code === 0) return { conflicts: false, files: [] };
  const lines = String(res.out || "").split("\n").map((l) => l.trim()).filter(Boolean);
  // A REFUSAL IS NOT A CONFLICT. "not something we can merge" means git could not read a ref —
  // a deleted branch, a typo — and reporting that as a collision would send somebody to untangle
  // a merge that does not exist.
  if (lines.some((l) => /not something we can merge|unknown revision|bad object/i.test(l)))
    return { conflicts: false, files: [], unknown: true, why: lines[0] };
  // The first line is the tree sha; the named files follow, then a conflict summary.
  const files = lines.slice(1).filter((l) => !/^(CONFLICT|Auto-merging|warning:)/i.test(l) && l.includes("/"));
  return { conflicts: true, files: [...new Set(files)] };
}


/**
 * STALE FIRST, AND IT IS NOT OPTIONAL — this was got wrong once and the wrong number was published.
 *
 * A lane that no longer applies to `base` conflicts with EVERY pair it appears in, because the
 * merge between it and any newer lane includes all the work that landed in between. Reported
 * without this partition, six stale branches turned thirty-six lanes into one knot of thirty-three
 * and produced a confident recommendation to "land these four first" — when the four were simply
 * the stale ones, and the right advice was "rebase them".
 *
 * The obvious correction is also wrong, which is worth recording: forcing every pair's base to
 * `base` manufactures conflicts between a lane and its own DESCENDANT, because both diffs then
 * contain the parent's work and git sees the same lines added twice. Measured the same day — it
 * reported 263 collisions including a lane against the lane it was cut from.
 *
 * So: partition against `base`, then let each surviving pair use its own true ancestor.
 */
function partitionStale(run, branches = [], base = "HEAD") {
  const stale = [];
  const applies = [];
  const unknown = [];
  branches.forEach((b) => {
    const r = mergeCheck(run, base, b);
    if (r.unknown) unknown.push({ branch: b, why: r.why || "git could not answer" });
    else if (r.conflicts) stale.push({ branch: b, files: r.files });
    else applies.push(b);
  });
  return { stale, applies, unknown };
}

/** Every pair, checked. O(n²) merges — fine for tens of branches, and each one is in-memory. */
function surveyLanes(run, branches = []) {
  const pairs = [];
  const unknown = [];
  for (let i = 0; i < branches.length; i += 1) {
    for (let j = i + 1; j < branches.length; j += 1) {
      const r = mergeCheck(run, branches[i], branches[j]);
      if (r.unknown) {
        unknown.push({ a: branches[i], b: branches[j], why: r.why || "git could not answer" });
        continue;
      }
      pairs.push({ a: branches[i], b: branches[j], conflicts: r.conflicts, files: r.files });
    }
  }
  // A branch that was only ever in unknown pairs still has to appear, or it reads as landed.
  const map = conflictMapFrom(pairs);
  branches.forEach((b) => {
    if (!map.has(b)) map.set(b, new Set());
  });
  return { map, pairs, unknown, collisions: pairs.filter((p) => p.conflicts) };
}

module.exports = { conflictMapFrom, clustersOf, landingOrder, mergeCheck, surveyLanes, partitionStale };
