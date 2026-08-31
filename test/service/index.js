const { createApp } = require("systemlynx");
const Math = require("./Math");
const CLI = require("./CLI");
const Files = require("./Files");
const makeAuth = require("./Auth");

// ── PLAIN service `TestService` @ :5555 — its OWN process ──────────────────────────────────────
// The baseline fixture: default SystemLynx server (wildcard CORS), NO plugin headers, NO custom
// server. Its whole job is to prove SystemView works out of the box — browser and CLI, zero config.
// The gated services (gated/index.js, gated/sibling.js) run as their own processes and register under
// the same project (systemview-test). `test/service/start.sh` launches all three together.
// Run standalone: `node test/service/index.js`.
const PORT = process.env.PORT || 5555;
const SYSTEMVIEW_HOST = process.env.SYSTEMVIEW_HOST || "http://localhost:3000/systemview/api";

const App = createApp(); // default server → out-of-the-box wildcard CORS
const auth = makeAuth();

App.startService({ route: "test/api", port: PORT })
  .module("Math", Math)
  .module("Files", Files)
  .module("CLI", CLI)
  .module("Auth", auth)
  .before("Auth.getSession", (req, res, next) => {
    // Report whatever Cookie actually rode to THIS origin — the cross-service cookie test signs in on
    // the gated service (:5556) and then reads here (:5555) to prove the cookie does NOT cross origins.
    auth._state._lastCookie = req.headers.cookie || "";
    next();
  });

if (SYSTEMVIEW_HOST) {
  const SystemViewPlugin = require("../../systemview-plugin")({
    connection: SYSTEMVIEW_HOST,
    specs: "./test/service/specs",
    projectCode: "systemview-test",
    serviceId: "TestService",
    // No `headers` here on purpose — this is the plain baseline. It must connect and run in the
    // browser with zero header/CORS configuration.
    trace: (req) => ({ svtest_ctx: "u123", svtest_fn: req.fn }),
    redact: ["[0].password"],
    exclude: ["CLI"],
  });
  App.use(SystemViewPlugin);
  App.on("ready", function () {
    const AuthModule = this.useModule("Auth");
    setTimeout(() => AuthModule.log("service ready - internal check", { port: PORT }), 3000);
    setTimeout(() => AuthModule.warn("internal heartbeat", { uptime: process.uptime() }), 6000);
  });
}
