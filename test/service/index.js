const { App } = require("systemlynx");
const Math = require("./Math");
const String = require("./String");
const Auth = require("./Auth");
const Headers = require("./Headers");

const PORT = process.env.PORT || 5555;
const SYSTEMVIEW_HOST = process.env.SYSTEMVIEW_HOST || "http://localhost:3000/systemview/api";

App.startService({ route: "test/api", port: PORT })
  .module("Math", Math)
  .module("String", String)
  .module("Auth", Auth)
  .module("Headers", Headers)
  .before("Auth.signIn", (req, res, next) => {
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
  });

if (SYSTEMVIEW_HOST) {
  const SystemViewPlugin = require("../../systemview-plugin")({
    connection: SYSTEMVIEW_HOST,
    specs: "./test/service/specs",
    projectCode: "systemview-test",
    serviceId: "TestService",
  });
  App.use(SystemViewPlugin);
}
