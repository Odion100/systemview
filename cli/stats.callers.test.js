// ONE ARITHMETIC, TWO FACES — and the day it was two arithmetics nobody could have noticed.
//
// `api/stats.js` opens with the promise this file now holds up: *"it moves here and `cli/stats.js`
// becomes a caller — the whole point of the exercise being that the answer never forks."* It did
// not become a caller. Eighty-six lines of windowing, the error split, the health thresholds and
// the formatters sat in the CLI as a byte-identical copy, under a comment in the other file
// swearing the answer could not fork.
//
// Nothing had drifted. That is exactly the state a drift starts from: the next person to fix a
// windowing bug fixes it in ONE of the two places, and the hub's report and the CLI's start
// disagreeing about the same snapshot — silently, because both are "right" against their own copy.
//
// So the assertions below are not about the numbers being correct. They are about there being only
// one place for them to be correct IN. They run against a fixture snapshot rather than a live
// service: the point is identity of implementation, and a live service would make the test about
// whatever happened to be erroring today.
const assert = require("node:assert");
const { test } = require("node:test");
const fs = require("node:fs");
const path = require("node:path");

const api = require("../api/stats");

// A snapshot shaped exactly like a plugin's getStats(): per-method rollups, per-minute buckets.
// The numbers are chosen so every branch of the split has something in it — a 5xx, a 4xx, and an
// unclassified code that the rule sends to the server side.
const NOW = 1794000000000;
const SNAPSHOT = {
  bucketMs: 60000,
  methods: [
    { moduleMethod: "Math.add", count: 100, errors: 2, avgDuration: 3, p99: 9, statusCounts: { 500: 2 } },
    { moduleMethod: "Math.divide", count: 40, errors: 20, avgDuration: 1, p99: 2, statusCounts: { 400: 20 } },
    { moduleMethod: "Auth.throwError", count: 10, errors: 10, avgDuration: 0, p99: 1, statusCounts: { 0: 10 } },
  ],
  series: [
    { ts: NOW - 5 * 60000, count: 60, errors: 6, avgDuration: 2, methods: { "Math.add": { count: 40, errors: 1, sumDuration: 80 }, "Math.divide": { count: 20, errors: 5, sumDuration: 20 } } },
    { ts: NOW - 2 * 60000, count: 90, errors: 26, avgDuration: 2, methods: { "Math.add": { count: 60, errors: 1, sumDuration: 120 }, "Auth.throwError": { count: 10, errors: 10, sumDuration: 0 } } },
  ],
};

test("the CLI does not carry its own copy of the stats arithmetic", () => {
  const src = fs.readFileSync(path.join(__dirname, "stats.js"), "utf8");
  // A LOCAL DEFINITION is the fault; a mention in a comment is the opposite of it. Strip comments
  // before looking, so the paragraph explaining why these are imported cannot fail its own rule.
  const code = src.replace(/\/\/[^\n]*/g, "").replace(/\/\*[\s\S]*?\*\//g, "");
  for (const name of ["splitErrors", "health", "windowMethods", "changeDelta", "fmtInt", "fmtMs", "fmtPct"]) {
    assert.ok(
      !new RegExp(`function\\s+${name}\\s*\\(|const\\s+${name}\\s*=\\s*\\(`).test(code),
      `cli/stats.js defines its own ${name} — the hub's copy is the only one there should be`,
    );
  }
  assert.match(code, /require\(["']\.\.\/api\/stats["']\)/, "cli/stats.js must require the hub's arithmetic");
});

test("the hub exports everything the CLI needs, so there is nothing left to re-implement", () => {
  for (const name of ["splitErrors", "health", "windowMethods", "changeDelta", "fmtInt", "fmtMs", "fmtPct", "RANGES", "RANGE_MS"]) {
    assert.ok(api[name] !== undefined, `api/stats.js must export ${name}`);
  }
});

test("the error split sends 5xx and unclassified to the server, 4xx to the caller", () => {
  assert.deepStrictEqual(api.splitErrors({ 500: 2, 503: 1, 404: 7, 0: 3 }), { server: 6, client: 7 });
  assert.deepStrictEqual(api.splitErrors({}), { server: 0, client: 0 });
  assert.deepStrictEqual(api.splitErrors(), { server: 0, client: 0 });
});

test("health reads off the thresholds, not off a feeling", () => {
  assert.strictEqual(api.health({ serverErrorRate: 0.06, p99: 10 }), "bad");
  assert.strictEqual(api.health({ serverErrorRate: 0, p99: 3000 }), "bad");
  assert.strictEqual(api.health({ serverErrorRate: 0.02, p99: 10 }), "watch");
  assert.strictEqual(api.health({ serverErrorRate: 0, p99: 1200 }), "watch");
  assert.strictEqual(api.health({ serverErrorRate: 0.001, p99: 10 }), "ok");
  assert.strictEqual(api.health({}), "ok");
});

test("windowing sums the buckets inside the window and drops what was silent in it", () => {
  const all = api.windowMethods(SNAPSHOT, null);
  assert.strictEqual(all.length, 3, "no window means every method the snapshot holds");
  const add = all.find((m) => m.moduleMethod === "Math.add");
  assert.strictEqual(add.count, 100);
  // The error split rides the all-time status mix, which is what the page does — percentiles and
  // the status map have no per-bucket histograms to window.
  assert.strictEqual(add.serverErrors, 2);
  const divide = all.find((m) => m.moduleMethod === "Math.divide");
  assert.strictEqual(divide.clientErrors, 20);
  assert.strictEqual(divide.serverErrors, 0, "a 4xx is the caller's fault, not sickness");
  const thrown = all.find((m) => m.moduleMethod === "Auth.throwError");
  assert.strictEqual(thrown.serverErrors, 10, "an unclassified status counts as server-side");
});

test("changeDelta halves the buckets it has and says nothing when it cannot compare", () => {
  // ONE BUCKET IS NOT A TREND. Fewer than two and there is no earlier half to be a change FROM,
  // so the answer is null rather than a delta against nothing.
  assert.strictEqual(api.changeDelta([], 3600e3), null);
  assert.strictEqual(api.changeDelta(undefined, 3600e3), null);
  assert.strictEqual(api.changeDelta([SNAPSHOT.series[0]], null), null);

  // With two, the earlier half is the comparison and the later half is "now" — true for a window
  // and for all-time alike, which is the part that reads surprising until you see it: all-time
  // still has an earlier half.
  const d = api.changeDelta(SNAPSHOT.series, null);
  assert.strictEqual(d.buckets, 2);
  assert.deepStrictEqual(d.prev, { count: 60, errors: 6 });
  assert.deepStrictEqual(d.recent, { count: 90, errors: 26 });
  assert.strictEqual(d.callsDelta, 0.5);
  assert.strictEqual(d.prevErrRate, 0.1);
  assert.ok(Math.abs(d.recentErrRate - 26 / 90) < 1e-12);
});

test("a window with no calls before it reads as all-new, not as an infinite rise", () => {
  const series = [
    { ts: NOW - 60000, count: 0, errors: 0 },
    { ts: NOW, count: 25, errors: 0 },
  ];
  assert.strictEqual(api.changeDelta(series, null).callsDelta, 1, "from nothing to something is +100%, never a divide by zero");
  const quiet = [
    { ts: NOW - 60000, count: 0, errors: 0 },
    { ts: NOW, count: 0, errors: 0 },
  ];
  assert.strictEqual(api.changeDelta(quiet, null).callsDelta, 0, "nothing to nothing has not changed");
});

test("the formatters are the ones both faces print with", () => {
  assert.strictEqual(api.fmtInt(19312), (19312).toLocaleString());
  assert.strictEqual(api.fmtInt(null), "—");
  assert.strictEqual(api.fmtMs(340), "340ms");
  assert.strictEqual(api.fmtMs(5000), "5.0s", "past a second it reads in seconds, in both faces");
  // THE DECIMAL RULE IS ABOUT THE FRACTION, NOT THE PERCENTAGE, and it reads backwards until you
  // see it: the threshold is 0.1 as a FRACTION — ten percent — so 3.8% keeps its decimal and 38%
  // loses it. Pinned because both faces print this and a change here would move the hub's report
  // and the CLI's digest apart one rounding at a time.
  assert.strictEqual(api.fmtPct(0.038), "3.8%");
  assert.strictEqual(api.fmtPct(0.38), "38%");
  assert.strictEqual(api.fmtPct(0.003), "0.3%");
  assert.strictEqual(api.fmtPct(null), "—");
});
