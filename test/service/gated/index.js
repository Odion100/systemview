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
  // RFC-015 Tier-2 fixture: GatedService loads TestService (already listening — this process boots
  // second) and Bridge.callPeer calls it over the wire, exercising the plugin's outbound
  // x-sv-trace / x-sv-caller stamping. The edge to expect in TestService's stats:
  // GatedService.Bridge.callPeer → Math.add.
  .loadService("TestSvc", "http://localhost:5555/test/api")
  .module("Bridge", {
    async callPeer({ a, b }) {
      const TestSvc = this.useService("TestSvc");
      const result = await TestSvc.Math.add({ a, b });
      return { viaPeer: true, ...result };
    },
  })
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
        // RFC-017: operator-authored headers live in the CLI's session store, `.systemview/session.json`.
        const dir = path.join(process.cwd(), ".systemview");
        fs.mkdirSync(dir, { recursive: true });
        const mp = path.join(dir, "session.json");
        let m = {};
        try { m = JSON.parse(fs.readFileSync(mp, "utf8")); } catch {}
        m.headers = {
          ...(m.headers || {}),
          [ORIGIN]: { ...((m.headers && m.headers[ORIGIN]) || {}), testtoken: "@./test/service/.testtoken" },
        };
        fs.writeFileSync(mp, JSON.stringify(m, null, 2));
      } catch {}
    }, 1500);
  });
}
