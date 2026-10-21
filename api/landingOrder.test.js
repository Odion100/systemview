// WHICH LANES COLLIDE — claimed against a fixture conflict map rather than a repo full of
// branches, because the thing that can be wrong here is the clustering and the ordering, not
// git's merge.
const assert = require("node:assert");
const { test, describe } = require("node:test");
const { conflictMapFrom, clustersOf, landingOrder, mergeCheck, surveyLanes, partitionStale } = require("./landingOrder");

const pairs = (...rows) => rows.map(([a, b, conflicts]) => ({ a, b, conflicts }));

describe("clusters", () => {
  test("lanes that conflict with nothing are each their own cluster — the best possible news", () => {
    const map = conflictMapFrom(pairs(["a", "b", false], ["a", "c", false], ["b", "c", false]));
    assert.deepStrictEqual(clustersOf(map), [["a"], ["b"], ["c"]]);
  });

  test("a colliding pair is one cluster", () => {
    const map = conflictMapFrom(pairs(["a", "b", true], ["a", "c", false], ["b", "c", false]));
    assert.deepStrictEqual(clustersOf(map), [["a", "b"], ["c"]]);
  });

  // Transitivity is the whole reason this is a graph walk: a conflicts with b, b with c, and c has
  // to be thought about alongside a even though they merge cleanly with each other.
  test("a chain is ONE knot, not two pairs", () => {
    const map = conflictMapFrom(pairs(["a", "b", true], ["b", "c", true], ["a", "c", false]));
    assert.deepStrictEqual(clustersOf(map), [["a", "b", "c"]]);
  });

  test("the biggest knot is reported first, so it is not buried under singletons", () => {
    const map = conflictMapFrom(pairs(["a", "b", true], ["b", "c", true], ["a", "c", false], ["d", "e", false]));
    assert.deepStrictEqual(clustersOf(map)[0], ["a", "b", "c"]);
  });

  test("nothing at all is an empty list, not a throw", () => {
    assert.deepStrictEqual(clustersOf(conflictMapFrom([])), []);
  });
});

describe("the order", () => {
  test("independent lanes go first — they cost nothing and shrink the pile", () => {
    const map = conflictMapFrom(pairs(["a", "b", true], ["a", "c", false], ["b", "c", false]));
    const { independent, order } = landingOrder(map);
    assert.deepStrictEqual(independent, ["c"]);
    assert.strictEqual(order[0], "c");
  });

  test("the largest knot goes last, when the tree is otherwise quiet", () => {
    const map = conflictMapFrom(
      pairs(["a", "b", true], ["b", "c", true], ["a", "c", false], ["d", "e", true], ["a", "d", false], ["a", "e", false], ["b", "d", false], ["b", "e", false], ["c", "d", false], ["c", "e", false]),
    );
    const { knots } = landingOrder(map);
    assert.deepStrictEqual(knots.map((k) => k.length), [2, 3]);
  });

  test("every branch appears exactly once in the order", () => {
    const map = conflictMapFrom(pairs(["a", "b", true], ["a", "c", false], ["b", "c", false]));
    const { order } = landingOrder(map);
    assert.deepStrictEqual([...order].sort(), ["a", "b", "c"]);
  });
});

describe("asking git", () => {
  const fake = (code, out) => () => ({ code, out });

  test("a clean merge is not a conflict", () => {
    assert.deepStrictEqual(mergeCheck(fake(0, "abc123\n"), "x", "y"), { conflicts: false, files: [] });
  });

  test("a real conflict names the files, which is the actionable part", () => {
    const out = "abc123\nsrc/organisms/AgentChat/AgentChat.js\nsrc/utils/voice.js\n";
    const r = mergeCheck(fake(1, out), "x", "y");
    assert.strictEqual(r.conflicts, true);
    assert.deepStrictEqual(r.files, ["src/organisms/AgentChat/AgentChat.js", "src/utils/voice.js"]);
  });

  // A REFUSAL IS NOT A CONFLICT. Reporting a deleted branch as a collision sends somebody to
  // untangle a merge that does not exist.
  test("a branch git cannot read is unknown, never a collision", () => {
    const r = mergeCheck(fake(1, "merge-tree: lane/gone - not something we can merge"), "x", "gone");
    assert.strictEqual(r.conflicts, false);
    assert.strictEqual(r.unknown, true);
  });

  test("a runner that answers nothing is unknown rather than clean", () => {
    assert.strictEqual(mergeCheck(() => null, "x", "y").unknown, true);
  });
});

describe("the survey", () => {
  test("checks every pair once and separates collisions from the rest", () => {
    const seen = [];
    const run = (args) => {
      seen.push(args.slice(-2).join("+"));
      return args.includes("b") && args.includes("c") ? { code: 1, out: "sha\nsrc/x.js" } : { code: 0, out: "sha" };
    };
    const { pairs: all, collisions } = surveyLanes(run, ["a", "b", "c"]);
    assert.deepStrictEqual(seen, ["a+b", "a+c", "b+c"]);
    assert.strictEqual(all.length, 3);
    assert.deepStrictEqual(collisions.map((c) => `${c.a}+${c.b}`), ["b+c"]);
  });

  // A branch that only ever appeared in unknown pairs would otherwise vanish from the clusters,
  // which reads as "already landed".
  test("a branch git could never answer about still appears", () => {
    const run = (args) => (args.includes("ghost") ? { code: 1, out: "not something we can merge" } : { code: 0, out: "sha" });
    const { map, unknown } = surveyLanes(run, ["a", "b", "ghost"]);
    assert.ok(map.has("ghost"));
    assert.strictEqual(unknown.length, 2);
    assert.deepStrictEqual(clustersOf(map).flat().sort(), ["a", "b", "ghost"]);
  });

  test("one branch on its own surveys to one cluster and no pairs", () => {
    const { pairs: all, map } = surveyLanes(() => ({ code: 0, out: "" }), ["only"]);
    assert.strictEqual(all.length, 0);
    assert.deepStrictEqual(clustersOf(map), [["only"]]);
  });
});

describe("stale lanes are separated BEFORE any pair is measured", () => {
  // THIS IS THE CLAIM THAT EXISTS BECAUSE THE NUMBER WAS PUBLISHED WRONG. Six lanes that no longer
  // applied to HEAD conflicted with every pair they appeared in, which read as one knot of 33 and
  // produced the advice "land these four first" when the right advice was "rebase them".
  const runWhere = (conflicting) => (args) => {
    const [a, b] = args.slice(-2);
    const hit = conflicting.some(([x, y]) => (x === a && y === b) || (x === b && y === a));
    return hit ? { code: 1, out: "sha\nsrc/x.js" } : { code: 0, out: "sha" };
  };

  test("a branch that conflicts with the base is stale, not a collision", () => {
    const { stale, applies } = partitionStale(runWhere([["HEAD", "old"]]), ["old", "fresh"]);
    assert.deepStrictEqual(stale.map((s) => s.branch), ["old"]);
    assert.deepStrictEqual(applies, ["fresh"]);
  });

  test("a stale branch names the files it is stale on, which is what a rebase has to resolve", () => {
    const { stale } = partitionStale(runWhere([["HEAD", "old"]]), ["old"]);
    assert.deepStrictEqual(stale[0].files, ["src/x.js"]);
  });

  test("a branch git cannot read is unknown — neither stale nor applying", () => {
    const run = (args) => (args.includes("ghost") ? { code: 1, out: "not something we can merge" } : { code: 0, out: "sha" });
    const { stale, applies, unknown } = partitionStale(run, ["ghost", "fine"]);
    assert.deepStrictEqual(applies, ["fine"]);
    assert.strictEqual(stale.length, 0);
    assert.strictEqual(unknown.length, 1);
  });

  test("nothing stale means every branch survives to be paired", () => {
    const { stale, applies } = partitionStale(() => ({ code: 0, out: "sha" }), ["a", "b", "c"]);
    assert.strictEqual(stale.length, 0);
    assert.deepStrictEqual(applies, ["a", "b", "c"]);
  });

  // The second error, recorded so nobody "fixes" the base back: pinning every pair to the base
  // makes a lane conflict with the lane it was cut from, because both diffs carry the parent's
  // work. surveyLanes must therefore NOT pass a merge-base and let git use the true ancestor.
  test("surveyLanes asks git for the pair's own ancestor, never a pinned base", () => {
    const seen = [];
    surveyLanes((args) => { seen.push(args.join(" ")); return { code: 0, out: "sha" }; }, ["a", "b"]);
    assert.ok(seen.length > 0);
    assert.ok(!seen.some((a) => a.includes("--merge-base")), "a pinned base conflates a lane with its descendant");
  });
});
