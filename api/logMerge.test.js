// THE MERGE'S CLAIMS. The first two are the bugs that were live: the CLI never sorted, and the hub
// sorted with a comparator that cannot work on the strings the plugin actually writes — so the
// agent-facing door returned the tail of a concatenation and silently dropped the newest entries.
const assert = require("node:assert");
const { test } = require("node:test");
const { mergeLog, timeOf } = require("./logMerge");

// Shaped exactly like what the plugin writes: `timestamp: new Date().toISOString()`.
const at = (iso, m) => ({ timestamp: iso, message: m, level: "info" });
const A = [at("2026-10-19T01:00:00.000Z", "A-old"), at("2026-10-19T05:00:00.000Z", "A-newest")];
const B = [at("2026-10-19T03:00:00.000Z", "B-mid"), at("2026-10-19T04:00:00.000Z", "B-late")];
const msgs = (rows) => rows.map((r) => r.message);

test("two services interleave by time, oldest first — not block after block", () => {
  assert.deepStrictEqual(msgs(mergeLog([A, B])), ["A-old", "B-mid", "B-late", "A-newest"]);
});

// THE ONE THAT WAS WRONG IN PRODUCTION. With the old comparator this answered ["B-mid", "B-late"]:
// the newest thing that happened in the project was not in the answer at all.
test("a limit takes the NEWEST entries across services, not the tail of the last fetch", () => {
  assert.deepStrictEqual(msgs(mergeLog([A, B], { limit: 2 })), ["B-late", "A-newest"]);
});

test("ISO strings are parsed, not subtracted — the field the plugin writes places correctly", () => {
  assert.strictEqual(timeOf(at("2026-10-19T05:00:00.000Z")), Date.parse("2026-10-19T05:00:00.000Z"));
  // and the proof that subtraction could never have worked
  assert.ok(Number.isNaN("2026-10-19T05:00:00.000Z" - "2026-10-19T03:00:00.000Z"));
});

test("numeric milliseconds still place, and mix with ISO in one timeline", () => {
  const legacy = [{ timestamp: Date.parse("2026-10-19T02:00:00.000Z"), message: "legacy-ms" }];
  assert.deepStrictEqual(msgs(mergeLog([A, legacy])), ["A-old", "legacy-ms", "A-newest"]);
});

test("an entry with no usable timestamp is KEPT, at the end — a log that omits is a log that lies", () => {
  const broken = [{ message: "no-stamp" }, { timestamp: "", message: "empty-stamp" }, { timestamp: "whenever", message: "junk-stamp" }];
  const out = msgs(mergeLog([A, broken]));
  assert.deepStrictEqual(out, ["A-old", "A-newest", "no-stamp", "empty-stamp", "junk-stamp"]);
  // …and never silently treated as the oldest thing that ever happened, which is what `|| 0` did
  assert.strictEqual(timeOf({ message: "no-stamp" }), null);
});

test("equal timestamps keep arrival order — two services in the same millisecond have no better answer", () => {
  const same = "2026-10-19T06:00:00.000Z";
  const out = msgs(mergeLog([[at(same, "first-fetched")], [at(same, "second-fetched")]]));
  assert.deepStrictEqual(out, ["first-fetched", "second-fetched"]);
});

test("no batches, empty batches and a non-array all answer an empty timeline rather than throwing", () => {
  assert.deepStrictEqual(mergeLog(), []);
  assert.deepStrictEqual(mergeLog([[], []]), []);
  assert.deepStrictEqual(mergeLog("nonsense"), []);
  assert.deepStrictEqual(mergeLog([null, undefined, A]).length, 2);
});

test("limit 0 or absent means everything, and a limit larger than the set is not padding", () => {
  assert.strictEqual(mergeLog([A, B], { limit: 0 }).length, 4);
  assert.strictEqual(mergeLog([A, B]).length, 4);
  assert.strictEqual(mergeLog([A, B], { limit: 99 }).length, 4);
});
