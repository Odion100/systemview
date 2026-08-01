const { createApp } = require("systemlynx");
const Math = require("../service/Math");
const CLI = require("../service/CLI");
const String = require("../service/String");
const makeAuth = require("../service/Auth");

// ── LOG-SUITE service `LogSuite` @ :5558 — its OWN top-level service folder, its OWN project code ────────
// A dedicated sandbox for the tests that CLEAR logs (SystemView.getLog, CLI.logs). Those tests need a
// clean log slate to assert exact contents, so they call SystemView.clearLog — which would wipe a real
// service's logs mid-run (that's why Auth.divideByZero kept vanishing from a full run: a later clear-log
// test truncated TestService's log). Isolating it under its OWN project code (`systemview-logtest`) keeps
// the main `systemview-test` run's logs intact and surfaces a SECOND project in the window.
//
// NAMING matters: the service is `LogSuite` (NOT "LogTestService" — that contained "TestService" as a
// substring, so the fuzzy namespace resolver confused `TestService.*` with it). It composes TestService's
// module implementations, but the `String` impl is registered under a UNIQUE module name `LogString` so it
// does NOT collide with the systemview-test fuzzy probe test that needs `String.concat` to resolve to
// GatedService alone. Mirrors TestService's plugin config (trace/redact/exclude) so the trace-ctx +
// redaction assertions in SystemView.getLog still hold.
// Run standalone: `node test/LogSuite/index.js`.
const PORT = process.env.LOGSUITE_PORT || 5558;
const SYSTEMVIEW_HOST = process.env.SYSTEMVIEW_HOST || "http://localhost:3000/systemview/api";

const App = createApp(); // default server → out-of-the-box wildcard CORS (plain, like TestService)
const auth = makeAuth();

App.startService({ route: "test/api", port: PORT })
  .module("Math", Math)
  .module("CLI", CLI)
  .module("LogText", String) // unique name with NO "String" substring — avoids fuzzy-probe collision with GatedService's `String`
  .module("Auth", auth);

if (SYSTEMVIEW_HOST) {
  App.use(
    require("../../systemview-plugin")({
      connection: SYSTEMVIEW_HOST,
      specs: "./test/LogSuite/specs",
      projectCode: "systemview-logtest",
      serviceId: "LogSuite",
      trace: (req) => ({ svtest_ctx: "u123", svtest_fn: req.fn }),
      redact: ["[0].password"],
      exclude: ["CLI"],
    })
  );
}
