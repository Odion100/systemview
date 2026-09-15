// CALL STATISTICS — the shared core, in a neutral home.
//
// RFC-032: agents get the SAME eyes the Stats page has — each plugin's getStats(), windowed with the
// SAME math the page uses (per-minute buckets summed inside the window; percentiles and the status
// mix stay all-time, because bounded rollups keep no per-bucket histograms).
//
// This is the one of the six that was NOT a terminal program wearing a library coat. Under the
// printing it is arithmetic both faces want to agree on, so it moves here and `cli/stats.js` becomes
// a caller — the whole point of the exercise being that the answer never forks. The hub does not
// need `getProjects()` over HTTP to find the services: it is holding them.
const RANGE_MS = { "15m": 15 * 60e3, "1h": 3600e3, "4h": 4 * 3600e3, "24h": 24 * 3600e3 };
const RANGES = ["15m", "1h", "4h", "24h", "all"];

const fmtInt = (n) => (n == null ? "—" : Math.round(n).toLocaleString());
const fmtMs = (n) => (n == null ? "—" : n >= 1000 ? `${(n / 1000).toFixed(1)}s` : `${Math.round(n)}ms`);
const fmtPct = (n) => (n == null ? "—" : `${(n * 100).toFixed(n >= 0.1 ? 0 : 1)}%`);

// Same split the page draws: 4xx is the caller's fault, only 5xx (and unclassified) is sickness.
function splitErrors(statusCounts = {}) {
  let server = 0, client = 0;
  Object.entries(statusCounts).forEach(([code, n]) => {
    const c = Number(code);
    if (c >= 500) server += n;
    else if (c >= 400) client += n;
    else server += n;
  });
  return { server, client };
}

function health({ serverErrorRate = 0, p99 = 0 }) {
  if (serverErrorRate >= 0.05 || p99 >= 2500) return "bad";
  if (serverErrorRate >= 0.01 || p99 >= 1000) return "watch";
  return "ok";
}

// The page's windowing, verbatim in spirit: sum the per-bucket per-method maps inside the cutoff;
// methods silent in the window drop out; windowed errors split server/client by the all-time ratio.
function windowMethods(snapshot, rangeMs) {
  const cutoff = rangeMs ? Date.now() - rangeMs : 0;
  let windowed = null;
  if (rangeMs) {
    windowed = {};
    (snapshot.series || []).forEach((pt) => {
      if (pt.ts < cutoff || !pt.methods) return;
      Object.entries(pt.methods).forEach(([mm, v]) => {
        const w = windowed[mm] || (windowed[mm] = { count: 0, errors: 0, sumDuration: 0 });
        w.count += v.count;
        w.errors += v.errors;
        w.sumDuration += v.sumDuration;
      });
    });
  }
  return (snapshot.methods || [])
    .map((m) => {
      const w = windowed && (windowed[m.moduleMethod] || { count: 0, errors: 0, sumDuration: 0 });
      const count = w ? w.count : m.count;
      const errors = w ? w.errors : m.errors;
      const wall = w ? w.sumDuration : m.totalDuration;
      const { server, client } = splitErrors(m.statusCounts);
      const serverShare = m.errors ? server / m.errors : 1;
      const serverErrors = w ? Math.round(errors * serverShare) : server;
      return {
        moduleMethod: m.moduleMethod,
        count,
        errors,
        serverErrors,
        clientErrors: w ? errors - serverErrors : client,
        errorRate: count ? errors / count : 0,
        serverErrorRate: count ? serverErrors / count : 0,
        avgDuration: count ? wall / count : 0,
        totalDuration: wall,
        p50: m.p50,
        p95: m.p95,
        p99: m.p99,
        maxDuration: m.maxDuration,
        statusCounts: m.statusCounts || {},
      };
    })
    .filter((m) => !rangeMs || m.count > 0);
}

// Change: recent half vs previous half of the (windowed) series — the page's Change tab in two lines.
function changeDelta(series, rangeMs) {
  const cutoff = rangeMs ? Date.now() - rangeMs : 0;
  const pts = (series || []).filter((pt) => !rangeMs || pt.ts >= cutoff).sort((a, b) => a.ts - b.ts);
  if (pts.length < 2) return null;
  const half = Math.floor(pts.length / 2);
  const sum = (arr) => arr.reduce((a, p) => ({ count: a.count + p.count, errors: a.errors + p.errors }), { count: 0, errors: 0 });
  const prev = sum(pts.slice(0, half));
  const recent = sum(pts.slice(half));
  return {
    buckets: pts.length,
    prev,
    recent,
    callsDelta: prev.count === 0 ? (recent.count > 0 ? 1 : 0) : (recent.count - prev.count) / prev.count,
    prevErrRate: prev.count ? prev.errors / prev.count : 0,
    recentErrRate: recent.count ? recent.errors / recent.count : 0,
  };
}
// THE CAPABILITY. Connections in, the report out — no HTTP to itself, no exit code, no colour.
async function stats({ projectCode, service, range } = {}, connections = [], Client) {
  if (!projectCode) return { error: "projectCode required" };
  const r = range || "all";
  if (!RANGES.includes(r)) return { error: `no range "${r}" — ranges: ${RANGES.join(", ")}` };
  const rangeMs = RANGE_MS[r];

  let services = (connections || []).filter((c) => String(c.projectCode).toLowerCase() === String(projectCode).toLowerCase());
  if (!services.length) return { projectCode, error: `no connected project "${projectCode}"` };
  if (service) {
    const hit = services.find((s) => s.serviceId.toLowerCase() === String(service).toLowerCase());
    if (!hit)
      return { projectCode, error: `no service "${service}" in ${projectCode}`, services: services.map((s) => s.serviceId) };
    services = [hit];
  }

  const reporting = [];
  const silent = [];
  for (const s of services) {
    try {
      const svc = Client.createService(s.system.connectionData);
      const snap = await svc.SystemView.getStats();
      if (!snap || !Array.isArray(snap.methods)) throw new Error("no snapshot");
      let cluster = null;
      try {
        const c = await svc.SystemView.getCluster();
        if (c && c.lb) cluster = c;
      } catch {
        /* a plugin that predates getCluster is not a failure */
      }
      reporting.push({ serviceId: s.serviceId, snapshot: snap, cluster });
    } catch {
      // NAMED, not dropped: "no stats" and "half your services never answered" are different
      // answers, and only one of them means the numbers can be trusted.
      silent.push(s.serviceId);
    }
  }

  const perService = reporting.map(({ serviceId, snapshot, cluster }) => {
    const methods = windowMethods(snapshot, rangeMs);
    const totals = methods.reduce(
      (a, m) => ({
        count: a.count + m.count,
        errors: a.errors + m.errors,
        serverErrors: a.serverErrors + m.serverErrors,
        clientErrors: a.clientErrors + m.clientErrors,
        wall: a.wall + m.totalDuration,
        p99: Math.max(a.p99, m.p99 || 0),
      }),
      { count: 0, errors: 0, serverErrors: 0, clientErrors: 0, wall: 0, p99: 0 }
    );
    totals.serverErrorRate = totals.count ? totals.serverErrors / totals.count : 0;
    totals.avgDuration = totals.count ? totals.wall / totals.count : 0;
    return {
      serviceId,
      status: health({ serverErrorRate: totals.serverErrorRate, p99: totals.p99 }),
      totals,
      methods,
      change: changeDelta(snapshot.series, rangeMs),
      edges: snapshot.edges || [],
      couplings: snapshot.couplings || [],
      cluster,
    };
  });

  return { projectCode, range: r, generatedAt: Date.now(), silent, services: perService };
}

module.exports = { stats, windowMethods, changeDelta, splitErrors, health, RANGES, RANGE_MS };
