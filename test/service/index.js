const fs = require("fs");
const path = require("path");
const { App } = require("systemlynx");
const Math = require("./Math");
const String = require("./String");
const Auth = require("./Auth");
const Headers = require("./Headers");
const CLI = require("./CLI");

const PORT = process.env.PORT || 5555;
const SYSTEMVIEW_HOST = process.env.SYSTEMVIEW_HOST || "http://localhost:3000/systemview/api";

App.startService({ route: "test/api", port: PORT })
  .module("Math", Math)
  .module("String", String)
  .module("Auth", Auth)
  .module("Headers", Headers)
  .module("CLI", CLI)
  .before("Auth.signIn", (req, res, next) => {
    res.set("Set-Cookie", "session=test-session-value; HttpOnly; Path=/");
    next();
  })
  .before("Plugin.getManifest", (req, res, next) => {
    // Simulate an auth-gated remote issuing a session cookie on the authenticated manifest pull,
    // so `connect --manifest --save` captures it and persists it into the local manifest.
    res.set("Set-Cookie", "session=test-session-value; HttpOnly; Path=/");
    next();
  })
  .before("Auth.getSession", (req, res, next) => {
    Auth._lastCookie = req.headers.cookie || "";
    next();
  })
  .before("Headers.getOrigin", (req, res, next) => {
    Headers._lastOrigin = req.headers.origin || "";
    next();
  })
  .before("Headers.echo", (req, res, next) => {
    Headers._lastHeaders = req.headers;
    next();
  });

if (SYSTEMVIEW_HOST) {
  const SystemViewPlugin = require("../../systemview-plugin")({
    connection: SYSTEMVIEW_HOST,
    specs: "./test/service/specs",
    projectCode: "systemview-test",
    serviceId: "TestService",
    // Operator-authored plugin-config headers. The plugin does not MINT headers, but it CARRIES
    // these into the manifest `headers` store under this service's origin (as defaults). This is
    // the buAPI dev-session case: the operator declares the Origin once, in config, and the plugin
    // writes it through on every startup — no hand-editing the manifest after each restart. The
    // Headers.getOrigin fixture confirms this Origin actually reaches the service.
    headers: { Origin: "http://localhost:3000" },
    trace: (req) => ({ svtest_ctx: "u123", svtest_fn: req.fn }),
    redact: ["[0].password"],
    exclude: ["CLI"],
  });
  App.use(SystemViewPlugin);
  App.on("ready", function () {
    // Seed the `@file` token header the operator adds directly to the manifest. The `Origin` is NOT
    // seeded here — it comes from the plugin config `headers` (above), which the plugin writes into
    // the manifest under this origin. We spread the existing bucket so we ADD the token on top of the
    // plugin-written Origin instead of clobbering it — modeling operator-authored headers layering
    // over plugin-config defaults. This keeps the CLI header pass-through tests self-contained.
    try {
      fs.writeFileSync(path.join(process.cwd(), "test/service/.testtoken"), "SEEKRIT-FILE-TOKEN");
    } catch {}
    setTimeout(() => {
      try {
        const mp = path.join(process.cwd(), "systemview.manifest.json");
        const m = JSON.parse(fs.readFileSync(mp, "utf8"));
        const origin = `http://localhost:${PORT}`;
        m.headers = {
          ...(m.headers || {}),
          [origin]: {
            ...((m.headers && m.headers[origin]) || {}),
            testtoken: "@./test/service/.testtoken",
          },
        };
        fs.writeFileSync(mp, JSON.stringify(m, null, 2));
      } catch {}
    }, 1500);

    const AuthModule = this.useModule("Auth");
    setTimeout(() => AuthModule.log("service ready - internal check", { port: PORT }), 3000);
    setTimeout(() => AuthModule.warn("internal heartbeat", { uptime: process.uptime() }), 6000);
  });
}
