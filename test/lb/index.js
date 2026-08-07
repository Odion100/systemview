// ── LOAD BALANCER dogfood rig (RFC-015 §5) — one process, three apps ─────────────────────────────
// A real LoadBalancer @ :5560 running the SystemView plugin IN LB MODE (it detects the Tentacle and
// records cluster behavior instead of only method traces), plus TWO clones of an Echo service
// (:5561/:5562) joining the cluster via the clone plugin. Drive traffic through the LB
// (Client.loadService("http://localhost:5560/lb")) and watch route_assigned tallies + the
// join/evict timeline flow into the Stats page's Load Balancer window.
// Run: `node test/lb/index.js`
const { createLoadBalancer, createApp } = require("systemlynx");

const SYSTEMVIEW_HOST = process.env.SYSTEMVIEW_HOST || "http://localhost:3000/systemview/api";
const LB_PORT = process.env.LB_PORT || 5560;
const LB_URL = `http://localhost:${LB_PORT}/lb`;

const LB = createLoadBalancer();
LB.startService({ route: "lb", port: LB_PORT });

// The shipped LoadBalancer (Service()-based) has no plugin system yet — so a sibling OBSERVER app
// in the SAME process carries the SystemView plugin and gets the live Tentacle handle explicitly.
// Same in-process observation the gap doc prescribes; only the attachment point differs.
const Observer = createApp();
Observer.startService({ route: "lb-observer/api", port: Number(LB_PORT) + 9 });
Observer.use(
  require("../../systemview-plugin")({
    connection: SYSTEMVIEW_HOST,
    specs: "./test/lb/specs",
    projectCode: "systemview-test",
    serviceId: "LoadBalancer",
    tentacle: LB.Tentacle,
    useSystemViewUI: !!SYSTEMVIEW_HOST,
  }),
);

// Two clones of the same Echo service — the cluster the LB balances.
[5561, 5562].forEach((port) => {
  const App = createApp();
  App.startService({ route: "echo/api", port })
    .module("Echo", {
      say({ msg }) {
        return { msg, servedBy: port };
      },
    })
    .use(LB.clone({ url: LB_URL, serviceId: "Echo" }));
});
