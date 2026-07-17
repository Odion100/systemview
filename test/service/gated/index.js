const fs = require("fs");
const path = require("path");
const { createApp } = require("systemlynx");
const String = require("../String");
const makeAuth = require("../Auth");
const { credentialedServer, setSessionCookie, captureCookie } = require("./shared");

// GATED service `GatedService` @ :5556 — its OWN process. Carries a declared header + issues a session
// cookie, owns its CORS (credentialedServer). Run standalone: `node test/service/gated/index.js`.
const SYSTEMVIEW_HOST = process.env.SYSTEMVIEW_HOST || "http://localhost:3000/systemview/api";
const PORT = process.env.GATED_PORT || 5556;
const ORIGIN = `http://localhost:${PORT}`;
const auth = makeAuth();
const App = createApp(credentialedServer());

App.startService({ route: "test/api", port: PORT })
  .module("Auth", auth)
  .module("String", String)
  .before("Auth.signIn", setSessionCookie)
  .before("Auth.getSession", captureCookie(auth))
  .before("Auth.echo", (req, res, next) => {
    auth._state._lastHeaders = req.headers;
    next();
  })
  .before("Plugin.getManifest", setSessionCookie); // authed manifest pull issues a cookie (connect --save)

if (SYSTEMVIEW_HOST) {
  App.use(
    require("../../../systemview-plugin")({
      connection: SYSTEMVIEW_HOST,
      specs: "./test/service/gated/specs",
      projectCode: "systemview-test",
      serviceId: "GatedService",
      headers: { Origin: "http://localhost:3000" },
      trace: (req) => ({ svtest_ctx: "gated", svtest_fn: req.fn }),
      redact: ["[0].password"],
    })
  );
  App.on("ready", function () {
    try {
      fs.writeFileSync(path.join(process.cwd(), "test/service/.testtoken"), "SEEKRIT-FILE-TOKEN");
    } catch {}
    setTimeout(() => {
      try {
        const mp = path.join(process.cwd(), "systemview.manifest.json");
        const m = JSON.parse(fs.readFileSync(mp, "utf8"));
        m.headers = {
          ...(m.headers || {}),
          [ORIGIN]: { ...((m.headers && m.headers[ORIGIN]) || {}), testtoken: "@./test/service/.testtoken" },
        };
        fs.writeFileSync(mp, JSON.stringify(m, null, 2));
      } catch {}
    }, 1500);
  });
}
