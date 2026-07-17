const { createApp } = require("systemlynx");
const makeAuth = require("../Auth");
const { credentialedServer, captureCookie } = require("./shared");

// GATED SIBLING `GatedSibling` @ :5557 — its OWN process. A second credentialed service under the same
// project, so the cross-service cookie test can prove the session RIDES from GatedService to a sibling.
// Both must be credentialed (the browser can't send credentials to a wildcard-CORS service).
// Run standalone: `node test/service/gated/sibling.js`.
const SYSTEMVIEW_HOST = process.env.SYSTEMVIEW_HOST || "http://localhost:3000/systemview/api";
const PORT = process.env.GATED_SIBLING_PORT || 5557;
const sibAuth = makeAuth();
const SibApp = createApp(credentialedServer());

SibApp.startService({ route: "test/api", port: PORT })
  .module("Auth", sibAuth)
  .before("Auth.getSession", captureCookie(sibAuth));

if (SYSTEMVIEW_HOST) {
  SibApp.use(
    require("../../../systemview-plugin")({
      connection: SYSTEMVIEW_HOST,
      specs: "./test/service/gated/sibling-specs",
      projectCode: "systemview-test",
      serviceId: "GatedSibling",
      // A declared header marks the sibling credentialed (browser sends withCredentials to it).
      headers: { Origin: "http://localhost:3000" },
      trace: (req) => ({ svtest_ctx: "sibling", svtest_fn: req.fn }),
    })
  );
}
