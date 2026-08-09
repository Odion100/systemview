const chalk = require("chalk");
const log = require("./logger");
const { createClient } = require("systemlynx");
const { createCookieHttpClient } = require("./cookieClient");
const Client = createClient(createCookieHttpClient());

// RFC-032 — `systemview stats <pc> [service] [--range 15m|1h|4h|24h|all] [--json]`.
// Agents get the SAME eyes the Stats page has: each service plugin's getStats(), windowed with the
// SAME math the page uses (per-minute buckets summed inside the window; percentiles and the status
// mix stay all-time — bounded rollups keep no per-bucket histograms). Default output is the digest
// (top load, error hotspots, deltas); --json is the full structured read for agent parsing.

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

module.exports = async function statsCommand(projectCode, serviceFilter, { uiUrl, range, json } = {}) {
  if (!projectCode) {
    log.warn("Usage: systemview stats <projectCode> [service] [--range 15m|1h|4h|24h|all] [--json]");
    return 1;
  }
  const r = range || "all";
  if (!RANGES.includes(r)) {
    log.error(`no range "${r}" — ranges: ${RANGES.join(", ")}`);
    return 1;
  }
  const rangeMs = RANGE_MS[r];

  let services = [];
  try {
    const { SystemView } = await Client.loadService(`${uiUrl}/systemview/api`);
    const projects = await SystemView.getProjects();
    if (!projects[projectCode]) {
      log.error(`no connected project "${projectCode}" — projects: ${Object.keys(projects).join(", ") || "(none)"}`);
      return 1;
    }
    services = projects[projectCode];
  } catch (err) {
    log.error("Failed to connect to SystemView: " + err.message);
    return 1;
  }
  if (serviceFilter) {
    const hit = services.find((s) => s.serviceId.toLowerCase() === String(serviceFilter).toLowerCase());
    if (!hit) {
      log.error(`no service "${serviceFilter}" in ${projectCode} — services: ${services.map((s) => s.serviceId).join(", ")}`);
      return 1;
    }
    services = [hit];
  }

  const reporting = [];
  const silent = [];
  for (const s of services) {
    try {
      const svc = await Client.loadService(s.connectionData.serviceUrl);
      const snap = await svc.SystemView.getStats();
      if (!snap || !Array.isArray(snap.methods)) throw new Error("no snapshot");
      let cluster = null;
      try {
        const c = await svc.SystemView.getCluster();
        if (c && c.lb) cluster = c;
      } catch {} // plugin predates getCluster — fine
      reporting.push({ serviceId: s.serviceId, snapshot: snap, cluster });
    } catch {
      silent.push(s.serviceId); // old plugin without getStats, or unreachable
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
      { count: 0, errors: 0, serverErrors: 0, clientErrors: 0, wall: 0, p99: 0 },
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

  if (json) {
    console.log(JSON.stringify({ projectCode, range: r, generatedAt: Date.now(), silent, services: perService }, null, 2));
    return 0;
  }

  // ---- the digest ----
  const DOT = { ok: chalk.green("●"), watch: chalk.yellow("●"), bad: chalk.red("●") };
  console.log("");
  console.log(chalk.bold(`  Stats — ${projectCode}`) + chalk.dim(` · ${r === "all" ? "all time" : `last ${r}`} · ${reporting.length}/${services.length} services reporting`));
  if (silent.length) console.log(chalk.dim(`  not reporting: ${silent.join(", ")} (no plugin stats or unreachable)`));

  for (const svc of perService) {
    const t = svc.totals;
    console.log("");
    console.log(`  ${DOT[svc.status]} ${chalk.cyan.bold(svc.serviceId)}  ${fmtInt(t.count)} calls · ${fmtPct(t.serverErrorRate)} server err${t.clientErrors ? chalk.dim(` (+${fmtInt(t.clientErrors)} client 4xx)`) : ""} · avg ${fmtMs(t.avgDuration)} · p99 ${fmtMs(t.p99)}`);
    if (!t.count) {
      console.log(chalk.dim("      no traffic in this window"));
      continue;
    }
    const top = [...svc.methods].sort((a, b) => b.totalDuration - a.totalDuration).slice(0, 5);
    console.log(chalk.dim("      top by wall-time:"));
    top.forEach((m) => {
      const share = t.wall ? m.totalDuration / t.wall : 0;
      console.log(`        ${DOT[health(m)]} ${m.moduleMethod.padEnd(28)} ${fmtInt(m.count).padStart(8)} calls · ${fmtPct(share).padStart(4)} of load · avg ${fmtMs(m.avgDuration)} · p99 ${fmtMs(m.p99)}`);
    });
    const failing = svc.methods.filter((m) => m.errors > 0).sort((a, b) => b.errors - a.errors).slice(0, 5);
    if (failing.length) {
      console.log(chalk.dim("      failing:"));
      failing.forEach((m) => {
        const topStatus = Object.entries(m.statusCounts).sort((a, b) => b[1] - a[1])[0];
        console.log(`        ${chalk.red("✗")} ${m.moduleMethod.padEnd(28)} ${fmtInt(m.errors).padStart(6)} errors (${fmtPct(m.errorRate)})${topStatus ? chalk.dim(` · top ${topStatus[0]} ×${topStatus[1]}`) : ""}`);
      });
    }
    if (svc.change && svc.change.buckets >= 2) {
      const c = svc.change;
      const arrow = c.callsDelta >= 0 ? "▲" : "▼";
      console.log(chalk.dim(`      change (recent half vs previous): calls ${arrow} ${fmtPct(Math.abs(c.callsDelta))}, err ${fmtPct(c.prevErrRate)} → ${fmtPct(c.recentErrRate)}`));
    }
    if (svc.edges.length) {
      const callers = [...new Set(svc.edges.map((e) => String(e.caller || "").split(".")[0]).filter(Boolean))];
      console.log(chalk.dim(`      called by: ${callers.join(", ")} (${svc.edges.length} edge${svc.edges.length !== 1 ? "s" : ""})`));
    }
    if (svc.couplings.length) console.log(chalk.dim(`      internal couplings: ${svc.couplings.length}`));
    if (svc.cluster) {
      const clones = ((svc.cluster.state && svc.cluster.state.services) || []).reduce((a, x) => a + (x.locations || []).length, 0);
      console.log(chalk.dim(`      ⚖ load balancer: policy ${(svc.cluster.state && svc.cluster.state.policy) || "?"}, ${clones} clone${clones !== 1 ? "s" : ""}`));
    }
  }
  if (!perService.length) console.log(chalk.dim("\n      nothing reporting — check the SystemView plugin is loaded and a request has been handled"));
  console.log("");
  return 0;
};
