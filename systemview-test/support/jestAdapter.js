// systemview-test/support/jestAdapter.js — ONE DEFINITION OF "RUN A JEST SUITE AND READ ITS NAMED
// CASES", for every claim whose subject is window render-and-wiring behaviour.
//
// NOT in methods/: hostProject serves every file there as a callable module, and this is a helper,
// not a surface under test. Same reason support/fixtures.js sits here.
//
// WHY A DOOR AROUND A SUITE AT ALL. A `::test` chip addresses a SAVED spec at a namespace; a jest
// suite has no namespace. So the adapter methods/Window.js established is: run the real suite over
// the narrowest pattern, and assert its NAMED CASES — never a count, because a count goes green
// when somebody deletes the case that mattered and leaves four that did not.
//
// THIS FILE EXISTS BECAUSE THERE WERE TWO COPIES AND A THIRD WAS ABOUT TO BE WRITTEN. Window.js and
// Corpora.js each carried their own `jest()` and `passed()`, already drifted — one had learned that
// a suite which never LOADED must not read as silence, and the other had not. A third copy for the
// band panel would have been the moment the drift stopped being noticeable.
const path = require("path");
const { spawnSync } = require("child_process");

const REPO = path.resolve(__dirname, "..", "..");

/** Run one jest suite by path pattern and return its named cases with their statuses. */
function jest(pattern) {
  const res = spawnSync(
    path.join(REPO, "node_modules/.bin/react-scripts"),
    ["test", "--watchAll=false", "--json", "--testPathPattern", pattern],
    { cwd: REPO, env: { ...process.env, CI: "true" }, encoding: "utf8", maxBuffer: 64 * 1024 * 1024, timeout: 300000 },
  );
  let report = null;
  try {
    report = JSON.parse(res.stdout);
  } catch {
    // A SUITE THAT NEVER LOADED MUST NOT READ AS SILENCE. react-scripts answers with no JSON at all
    // when the pattern matches nothing or the transform throws, and an empty report would make
    // every `passed()` below false for the right reason by accident — so say what happened.
    return {
      ok: false,
      why: (res.stderr || (res.error && res.error.message) || "no JSON from the runner").slice(-400),
      cases: {},
    };
  }
  const cases = {};
  for (const suite of report.testResults || [])
    for (const a of suite.assertionResults || []) cases[a.fullName] = a.status;
  return {
    ok: report.numFailedTests === 0 && (report.numTotalTests || 0) > 0,
    suites: report.numTotalTestSuites,
    tests: report.numTotalTests,
    failed: report.numFailedTests,
    cases,
  };
}

// A case passes when a case whose name CONTAINS this fragment passed. `pending` (an `it.skip`) is
// not `passed`, so skipping a case is caught rather than counted.
const passed = (run, fragment) =>
  Object.entries(run.cases).some(([name, status]) => name.includes(fragment) && status === "passed");

module.exports = { jest, passed, REPO };
