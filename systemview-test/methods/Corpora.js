// systemview-test/methods/Corpora.js — THE LIVING SPEC FOR THE CORPORA PANEL'S RFC-078 CLAIMS
// (c22 the machine-fed row reads apart, c38 the treatment edit rides the real save path). The
// claims are window render-and-wiring behaviour pinned by a jest suite, which `::test` cannot
// address directly — so the suite becomes a door, the adapter methods/Window.js established:
// run the real suite over the narrowest pattern, assert the NAMED cases, never a count.
//
// The `jest`/`passed` helpers mirror methods/Window.js deliberately — the adapter contract is
// that file's (its header carries the argument, including the substring trade); this module only
// adds the CorporaPanel wiring. Window.js is other claims' standing defence, so it is extended
// beside rather than edited under them.
const path = require("path");
const { spawnSync } = require("child_process");

const REPO = path.resolve(__dirname, "..", "..");

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
    return { ok: false, why: (res.stderr || (res.error && res.error.message) || "no JSON from the runner").slice(-400), cases: {} };
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

const passed = (run, fragment) =>
  Object.entries(run.cases).some(([name, status]) => name.includes(fragment) && status === "passed");

module.exports = {
  // The panel's own suite, the named cases that pin each half of the two claims.
  async panel() {
    const run = jest("CorporaPanel/CorporaPanel\\.test");
    return {
      suiteProducedResults: (run.tests || 0) > 0,
      failed: run.failed || 0,
      whyNot: run.why || "",
      // c22 — one fact, no second flag: the row keys off `registry:` alone, and the treatment he
      // wrote shows on the row that carries one.
      machineFedRowRendersDistinctly: passed(run, "renders the registry row distinctly, off the registry flag alone"),
      treatmentShownOnTheRow: passed(run, "shows his treatment on the row that carries one"),
      // c38 — the edit lands in the file because it rides the one save door, a registry corpus is
      // editable without inventing a glob, and an emptied field takes the statement back.
      typedTreatmentRidesTheSavePayload: passed(run, "sends the typed treatment in the saveCorpus payload"),
      registryEditNeedsNoRootAndSendsNoGlob: passed(run, "edits a registry corpus without demanding a root, and never sends the feed a glob"),
      emptiedFieldSendsEmptyString: passed(run, "an emptied field is sent as an empty string"),
      cases: run.tests || 0,
    };
  },
};
