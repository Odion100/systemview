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
    trace: (req) => ({ svtest_ctx: "u123", svtest_fn: req.fn }),
    redact: ["[0].password"],
    exclude: ["CLI"],
  });
  App.use(SystemViewPlugin);
  App.on("ready", function () {
    // Seed operator-authored manifest headers so the CLI header pass-through tests are
    // self-contained. The plugin no longer writes any headers (probeHeaders is gone), so WE author
    // them here — an `@file` token and a literal `Origin` — indexed by the service URL origin.
    // This models the real world: the operator authors headers; SystemView only forwards them.
    try {
      fs.writeFileSync(path.join(process.cwd(), "test/service/.testtoken"), "SEEKRIT-FILE-TOKEN");
    } catch {}
    setTimeout(() => {
      try {
        const mp = path.join(process.cwd(), "systemview.manifest.json");
        const m = JSON.parse(fs.readFileSync(mp, "utf8"));
        m.headers = {
          ...(m.headers || {}),
          [`http://localhost:${PORT}`]: {
            testtoken: "@./test/service/.testtoken",
            Origin: "http://localhost:3000",
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
