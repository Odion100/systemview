import React, { useState, useEffect, useContext, useMemo, useCallback, useRef } from "react";
import { useHistory, useParams, useLocation } from "react-router-dom";
import { Client } from "../../systemClient";
import ServiceContext from "../../ServiceContext";
import PageHeader from "../../organisms/PageHeader/PageHeader";
import AgentChat from "../../organisms/AgentChat/AgentChat";
import { isSystemModule } from "../../systemModules";
import LineChart from "../../organisms/Charts/LineChart";
import LoadColumns from "../../organisms/Charts/LoadColumns";
import TopologyGraph from "../../organisms/Charts/TopologyGraph";
import { MAP_HUES, buildHueMap } from "../../organisms/Charts/hues";
import "./styles.scss";

// ---- formatting helpers ----
const fmtInt = (n) => (n == null ? "—" : Math.round(n).toLocaleString());
const fmtMs = (n) => (n == null ? "—" : n >= 1000 ? `${(n / 1000).toFixed(1)}s` : `${Math.round(n)}ms`);
const fmtPct = (n) => (n == null ? "—" : `${(n * 100).toFixed(n >= 0.1 ? 0 : 1)}%`);

// Health verdict for a service/method from error rate + tail latency.
// Health is about the SERVICE being sick, not about it rejecting garbage. A 4xx is the caller's
// fault (bad payload / bad request) — it must NOT ding health. Only 5xx (server faults) and latency do.
function health({ serverErrorRate, errorRate = 0, p99 = 0 }) {
  const rate = serverErrorRate != null ? serverErrorRate : errorRate;
  if (rate >= 0.05 || p99 >= 2500) return "bad";
  if (rate >= 0.01 || p99 >= 1000) return "watch";
  return "ok";
}

// Split an error status-count map into server (5xx) vs client (4xx) faults.
function splitErrors(statusCounts = {}) {
  let server = 0, client = 0;
  Object.entries(statusCounts).forEach(([code, n]) => {
    const c = Number(code);
    if (c >= 500) server += n;
    else if (c >= 400) client += n;
    else server += n; // unclassified/default → treat as server-side
  });
  return { server, client };
}

// ---- tiny self-contained SVG charts (CSP: no external libs) ----
// LineChart + fmtBucketTs now live in organisms/Charts (RFC-025 §4.3) so a `::chart` embed in any
// document renders the exact same chart this page draws.



// RFC-015: explicit "not real yet" marker so mocked/placeholder surfaces are never mistaken for data.
function Mock({ children }) {
  return (
    <span className="report-mock" title="Placeholder — not backed by real data yet">
      MOCK{children ? ` · ${children}` : ""}
    </span>
  );
}

function LoadBar({ label, share, value, sub, status }) {
  return (
    <div className="report-loadbar">
      <div className="report-loadbar__head">
        <span className={`report-loadbar__label report-loadbar__label--${status || "ok"}`}>{label}</span>
        <span className="report-loadbar__value">{value}</span>
      </div>
      <div className="report-loadbar__track">
        <div className={`report-loadbar__fill report-loadbar__fill--${status || "ok"}`} style={{ width: `${Math.max(1, share * 100)}%` }} />
      </div>
      {sub && <div className="report-loadbar__sub">{sub}</div>}
    </div>
  );
}

const STATUS_LABEL = { ok: "healthy", watch: "watch", bad: "critical" };

// ---- Topology graph — the "who calls whom" graphic (tab "topology") ----
// The EDGES are MOCK, but shaped from buAPI's REAL index files (loadService/useService call sites)
// so the picture reads true: Profiles is the hub every service loads on boot; Basketball, Media and
// Networking call into it from the modules listed. Real edges await SystemLynx carrying the caller
// (x-sv-trace / x-sv-caller) — then this same graphic lights up from live data.
const MOCK_TOPO_EDGES = [
  {
    from: "Basketball",
    to: "Profiles",
    couplings: [
      { module: "Games", via: "validateTeamRosters", calls: ["Users.get", "Users.getPage", "Teams.getPage"] },
      { module: "Games", via: "resolveProxyQuery", calls: ["Users.getPage", "Teams.getPage", "Tournaments.getPage", "Events.getPage"] },
      { module: "Stats", via: "attachLinkedProfiles", calls: ["Users.get", "Teams.get", "Groups.get", "Events.get", "Tournaments.get"] },
      { module: "Stats", via: "resolveProxyQuery", calls: ["Users.getPage", "Teams.getPage", "Tournaments.getPage", "Events.getPage"] },
      { module: "Seasons", via: "registerSeasonWithHost", calls: ["Teams.registerSeason", "Tournaments.registerSeason"] },
      { module: "Seasons", via: "resolveProxyQuery", calls: ["Teams.getPage", "Tournaments.getPage", "Events.getPage"] },
    ],
  },
  {
    from: "Media",
    to: "Profiles",
    couplings: [{ module: "Posts", via: "entity_host resolution", calls: ["Aggregator.get"] }],
  },
  {
    from: "Media",
    to: "Basketball",
    couplings: [{ module: "Posts", via: "entity_host resolution", calls: ["Aggregator.get"] }],
  },
  {
    from: "Networking",
    to: "Profiles",
    couplings: [{ module: "Chats", via: "attachChatProfiles", calls: ["Aggregator.get"] }],
  },
];

const TOPO_H = 520;

export default function Reports() {
  const { SystemViewService } = useContext(ServiceContext);
  const history = useHistory();
  const location = useLocation();
  // A report is always about ONE system = one project. The project lives in the URL path
  // (/reports/:projectCode), the within-project selections in the query — so a refresh lands
  // you exactly where you were. There is no cross-project "all" view; that isn't a thing.
  const { projectCode } = useParams();

  const query = new URLSearchParams(location.search);
  const [connectedProjects, setConnectedProjects] = useState({});
  const [statsByService, setStatsByService] = useState([]); // [{ projectCode, serviceId, snapshot }]
  const [clusters, setClusters] = useState([]); // LB-mode services' getCluster payloads
  const [filterService, setFilterService] = useState(query.get("service") || "");
  const [report, setReport] = useState(query.get("report") || "state");
  // Time window over the per-bucket rollups (stats.js keeps per-method counts per minute bucket,
  // 24h retention). "all" = the all-time rollups. Percentiles/status-mix stay all-time either way —
  // bounded rollups don't keep per-bucket histograms.
  const [range, setRange] = useState(query.get("range") || "all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    SystemViewService.SystemView.getProjects()
      .then((result) => {
        if (result && typeof result === "object") setConnectedProjects(result);
      })
      .catch(() => {});
  }, [SystemViewService]);

  const projects = Object.keys(connectedProjects);

  // No project in the URL yet → drop into the first connected one (never a blended view).
  useEffect(() => {
    if (!projectCode && projects.length) history.replace(`/reports/${projects[0]}`);
  }, [projectCode, projects, history]);

  // Keep within-project selections (service, report) in the query so refresh restores them.
  useEffect(() => {
    const params = new URLSearchParams();
    if (filterService) params.set("service", filterService);
    if (report && report !== "state") params.set("report", report);
    if (range && range !== "all") params.set("range", range);
    const qs = params.toString();
    const base = projectCode ? `/reports/${projectCode}` : "/reports";
    window.history.replaceState(null, "", base + (qs ? "?" + qs : ""));
  }, [projectCode, filterService, report, range]);

  const projectServices = (projectCode && connectedProjects[projectCode]) || [];

  const loadStats = useCallback(async () => {
    const targets = projectServices.filter((s) => !filterService || s.serviceId === filterService);
    const collected = [];
    const clusterList = [];
    for (const t of targets) {
      try {
        const { SystemView } = Client.createService(t.connectionData);
        const snap = await SystemView.getStats();
        if (snap && Array.isArray(snap.methods))
          collected.push({ projectCode, serviceId: t.serviceId, snapshot: snap });
        // RFC-015 §5 — a service running in LB mode answers getCluster with the live cluster state.
        try {
          const cluster = await SystemView.getCluster();
          if (cluster && cluster.lb) clusterList.push(cluster);
        } catch {
          /* plugin predates getCluster — fine */
        }
      } catch {
        /* old plugin without getStats, or unreachable — skip */
      }
    }
    setStatsByService(collected);
    setClusters(clusterList);
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectCode, JSON.stringify(projectServices.map((s) => s.serviceId)), filterService]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  // RFC-032 — agent control reaches Stats. `nav <pc> stats …` pushes the URL (covers a fresh
  // mount) AND fires this event (covers already-standing-here — a same-route push never remounts,
  // so the query-string init doesn't re-run). Only explicitly-sent fields apply; a bare
  // `nav stats` walks you over without touching your tab/range/filter.
  useEffect(() => {
    const onNavStats = (e) => {
      const d = e.detail || {};
      if (d.report) setReport(d.report);
      if (d.range) setRange(d.range);
      if (d.service !== undefined) setFilterService(d.service || "");
    };
    const onRefresh = (e) => {
      const scope = (e.detail && e.detail.scope) || "all";
      if (scope === "all" || scope === "stats") loadStats();
    };
    window.addEventListener("sv:navStats", onNavStats);
    window.addEventListener("sv:refresh", onRefresh);
    return () => {
      window.removeEventListener("sv:navStats", onNavStats);
      window.removeEventListener("sv:refresh", onRefresh);
    };
  }, [loadStats]);

  const services = projectServices.map((s) => s.serviceId);

  async function handleClearStats() {
    const scope = filterService || projectCode;
    if (!window.confirm(`Clear collected stats for ${scope}? Aggregation starts fresh from here.`)) return;
    const targets = projectServices.filter((s) => !filterService || s.serviceId === filterService);
    await Promise.all(
      targets.map(async (s) => {
        try {
          const { SystemView } = Client.createService(s.connectionData);
          await SystemView.clearStats();
        } catch {}
      }),
    );
    loadStats();
  }

  // ---- flatten + derive ----
  const RANGE_MS = { "15m": 15 * 60e3, "1h": 3600e3, "4h": 4 * 3600e3, "24h": 24 * 3600e3 };
  const methods = useMemo(() => {
    const win = RANGE_MS[range];
    const cutoff = win ? Date.now() - win : 0;
    return statsByService.flatMap((s) => {
      // Windowed per-method rollup summed from the per-bucket maps (stats.js). Methods silent in
      // the window drop out — "what happened in the last hour" means exactly that.
      let windowed = null;
      if (win) {
        windowed = {};
        (s.snapshot.series || []).forEach((pt) => {
          if (pt.ts < cutoff || !pt.methods) return;
          Object.entries(pt.methods).forEach(([mm, v]) => {
            const w = windowed[mm] || (windowed[mm] = { count: 0, errors: 0, sumDuration: 0 });
            w.count += v.count;
            w.errors += v.errors;
            w.sumDuration += v.sumDuration;
          });
        });
      }
      return s.snapshot.methods
        .map((m) => {
          const w = windowed && (windowed[m.moduleMethod] || { count: 0, errors: 0, sumDuration: 0 });
          const count = w ? w.count : m.count;
          const errors = w ? w.errors : m.errors;
          const wall = w ? w.sumDuration : m.totalDuration;
          const { server, client } = splitErrors(m.statusCounts);
          // statusCounts (and percentiles) are ALL-TIME — per-bucket histograms would break the
          // bounded-memory contract. In a window, split windowed errors by the all-time server/4xx
          // ratio — an approximation, but it keeps health's "4xx isn't sickness" semantics.
          const serverShare = m.errors ? server / m.errors : 1;
          const serverErrors = w ? Math.round(errors * serverShare) : server;
          const clientErrors = w ? errors - serverErrors : client;
          return {
            ...m,
            count,
            errors,
            errorRate: count ? errors / count : 0,
            avgDuration: count ? wall / count : 0,
            totalDuration: wall,
            projectCode: s.projectCode,
            serviceId: s.serviceId,
            serverErrors,
            clientErrors,
            serverErrorRate: count ? serverErrors / count : 0,
          };
        })
        .filter((m) => !win || m.count > 0);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statsByService, range]);

  const totals = useMemo(() => {
    const totalCalls = methods.reduce((a, m) => a + m.count, 0);
    const totalErrors = methods.reduce((a, m) => a + m.errors, 0);
    const serverErrors = methods.reduce((a, m) => a + m.serverErrors, 0);
    const clientErrors = methods.reduce((a, m) => a + m.clientErrors, 0);
    const totalWall = methods.reduce((a, m) => a + m.totalDuration, 0);
    return {
      totalCalls,
      totalErrors,
      serverErrors,
      clientErrors,
      errorRate: totalCalls ? totalErrors / totalCalls : 0,
      serverErrorRate: totalCalls ? serverErrors / totalCalls : 0,
      totalWall,
    };
  }, [methods]);

  // per-service health rollup — health keys off SERVER errors + latency, not 4xx
  const serviceHealth = useMemo(() => {
    const map = {};
    methods.forEach((m) => {
      const key = `${m.projectCode} / ${m.serviceId}`;
      const h = map[key] || (map[key] = { key, projectCode: m.projectCode, serviceId: m.serviceId, count: 0, errors: 0, serverErrors: 0, clientErrors: 0, wall: 0, p99: 0 });
      h.count += m.count;
      h.errors += m.errors;
      h.serverErrors += m.serverErrors;
      h.clientErrors += m.clientErrors;
      h.wall += m.totalDuration;
      h.p99 = Math.max(h.p99, m.p99);
    });
    return Object.values(map)
      .map((h) => ({
        ...h,
        errorRate: h.count ? h.errors / h.count : 0,
        serverErrorRate: h.count ? h.serverErrors / h.count : 0,
        avgDuration: h.count ? h.wall / h.count : 0,
        status: health({ serverErrorRate: h.count ? h.serverErrors / h.count : 0, p99: h.p99 }),
      }))
      .sort((a, b) => b.wall - a.wall);
  }, [methods]);

  // hotspots by total wall-time (load share)
  const hotspots = useMemo(() => {
    const totalWall = totals.totalWall || 1;
    return [...methods]
      .sort((a, b) => b.totalDuration - a.totalDuration)
      .slice(0, 24) // the column chart flexes and scrolls — it can carry more than the bars could
      .map((m) => ({ ...m, share: m.totalDuration / totalWall, status: health(m) }));
  }, [methods, totals.totalWall]);

  const watch = useMemo(
    () => methods.filter((m) => health(m) !== "ok").sort((a, b) => b.errorRate - a.errorRate || b.p99 - a.p99).slice(0, 8),
    [methods],
  );

  // One hue per service.Module, shared by the traffic map and the load columns.
  const hueMap = useMemo(() => buildHueMap(methods), [methods]);

  // merged throughput series across services (by bucket ts), clipped to the active window
  const series = useMemo(() => {
    const merged = new Map();
    statsByService.forEach((s) =>
      (s.snapshot.series || []).forEach((pt) => {
        const cur = merged.get(pt.ts) || { ts: pt.ts, count: 0, errors: 0 };
        cur.count += pt.count;
        cur.errors += pt.errors;
        merged.set(pt.ts, cur);
      }),
    );
    const win = RANGE_MS[range];
    const cutoff = win ? Date.now() - win : 0;
    return [...merged.values()]
      .filter((pt) => !win || pt.ts >= cutoff)
      .sort((a, b) => a.ts - b.ts);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statsByService, range]);

  // REAL topology edges (RFC-015 Tier 2) — aggregated from every service's stats. Each callee's
  // snapshot carries {caller: "Service.Module.method", moduleMethod, count, errors} rows fed by the
  // x-sv-caller header. Grouped service→service; couplings keyed by the calling module.method.
  const realEdges = useMemo(() => {
    const byPair = {};
    statsByService.forEach((s) =>
      (s.snapshot.edges || []).forEach((e) => {
        const parts = String(e.caller || "").split(".");
        const fromService = parts[0];
        if (!fromService) return;
        const fromModule = parts[1] || "";
        const fromMethod = parts.slice(2).join(".");
        const key = `${fromService}→${s.serviceId}`;
        const pair =
          byPair[key] ||
          (byPair[key] = { from: fromService, to: s.serviceId, volume: 0, errors: 0, couplings: [] });
        pair.volume += e.count;
        pair.errors += e.errors;
        const via = fromMethod || "module-level call";
        let c = pair.couplings.find((x) => x.module === (fromModule || fromService) && x.via === via);
        if (!c) pair.couplings.push((c = { module: fromModule || fromService, via, calls: [] }));
        const call = `${e.moduleMethod} ×${fmtInt(e.count)}`;
        if (!c.calls.includes(call)) c.calls.push(call);
      }),
    );
    return Object.values(byPair);
  }, [statsByService]);

  // ---- Surface Coverage: available (catalog) vs used (traffic) vs tested (specs) ----
  const inventory = useMemo(() => {
    const svcs = projectServices.filter((s) => !filterService || s.serviceId === filterService);
    return svcs.map((s) => {
      const available = new Set();
      ((s.connectionData && s.connectionData.modules) || []).forEach(({ name, methods: fns }) => {
        if (isSystemModule(name)) return; // our plumbing is not this project's surface
        (fns || []).forEach(({ fn }) => available.add(`${name}.${fn}`));
      });
      const tested = new Set(((s.specList && s.specList.tests) || []).map((f) => f.replace(/\.json$/, "")));
      return { serviceId: s.serviceId, projectCode, available, tested };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectCode, JSON.stringify(projectServices.map((s) => s.serviceId)), filterService]);

  const coverage = useMemo(() => {
    return inventory
      .map((inv) => {
        const avail = [...inv.available];
        const usedRows = methods.filter((m) => m.serviceId === inv.serviceId && m.count > 0);
        const usedSet = new Set(usedRows.map((m) => m.moduleMethod));
        const testedIn = avail.filter((mm) => inv.tested.has(mm));
        const unused = avail.filter((mm) => !usedSet.has(mm));
        const untestedHot = usedRows
          .filter((m) => !inv.tested.has(m.moduleMethod))
          .sort((a, b) => b.totalDuration - a.totalDuration);
        return {
          serviceId: inv.serviceId,
          total: avail.length,
          testedCount: testedIn.length,
          usedCount: avail.filter((mm) => usedSet.has(mm)).length,
          unused,
          untestedHot,
          coverageRatio: avail.length ? testedIn.length / avail.length : 0,
        };
      })
      .sort((a, b) => a.coverageRatio - b.coverageRatio);
  }, [inventory, methods]);

  // ---- Reliability ----
  const reliability = useMemo(() => {
    const failing = methods
      .filter((m) => m.errors > 0)
      .sort((a, b) => b.errors - a.errors || b.errorRate - a.errorRate);
    const statusDist = {};
    methods.forEach((m) =>
      Object.entries(m.statusCounts || {}).forEach(([code, n]) => {
        statusDist[code] = (statusDist[code] || 0) + n;
      }),
    );
    return { failing, statusDist: Object.entries(statusDist).sort((a, b) => b[1] - a[1]) };
  }, [methods]);

  // ---- Change: recent window vs previous window on the throughput series ----
  const change = useMemo(() => {
    if (series.length < 2) return null;
    const half = Math.floor(series.length / 2);
    const sum = (arr) => arr.reduce((a, p) => ({ count: a.count + p.count, errors: a.errors + p.errors }), { count: 0, errors: 0 });
    const prev = sum(series.slice(0, half));
    const recent = sum(series.slice(half));
    const ratio = (r, p) => (p === 0 ? (r > 0 ? 1 : 0) : (r - p) / p);
    return {
      buckets: series.length,
      splitAt: series[half].ts,
      prev,
      recent,
      callsDelta: ratio(recent.count, prev.count),
      prevErrRate: prev.count ? prev.errors / prev.count : 0,
      recentErrRate: recent.count ? recent.errors / recent.count : 0,
    };
  }, [series]);

  const busiest = serviceHealth[0];
  const worst = watch[0];
  const verdict = (() => {
    if (loading) return "Collecting…";
    if (totals.totalCalls === 0) return "No traffic recorded yet. Exercise a service — traces roll up here automatically.";
    let s = `${fmtInt(totals.totalCalls)} calls, ${fmtPct(totals.serverErrorRate)} server errors`;
    if (totals.clientErrors) s += ` (${fmtInt(totals.clientErrors)} client 4xx, not a health issue)`;
    if (busiest) s += `. Busiest: ${busiest.serviceId}`;
    if (worst) s += `. ⚠ Watch ${worst.moduleMethod} — ${fmtPct(worst.serverErrorRate)} server err, p99 ${fmtMs(worst.p99)}`;
    return s + ".";
  })();

  const overallStatus = totals.totalCalls === 0 ? "ok" : health({ serverErrorRate: totals.serverErrorRate, p99: Math.max(0, ...serviceHealth.map((s) => s.p99)) });

  return (
    <section className="reports-page">
      <PageHeader projectCode={projectCode} current="reports" />

      <div className="reports-toolbar">
        <select
          value={projectCode || ""}
          onChange={(e) => {
            setFilterService("");
            history.push(`/reports/${e.target.value}`);
          }}
        >
          {projects.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
        <select value={filterService} onChange={(e) => setFilterService(e.target.value)}>
          <option value="">all services</option>
          {services.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <label
          className="reports-timerange"
          title="Window the rollups by time (per-minute buckets, 24h retention). Percentiles and the status-code mix stay all-time — bounded rollups keep no per-bucket histograms."
        >
          <select value={range} onChange={(e) => setRange(e.target.value)}>
            <option value="all">all time</option>
            <option value="15m">last 15m</option>
            <option value="1h">last hour</option>
            <option value="4h">last 4h</option>
            <option value="24h">last 24h</option>
          </select>
        </label>
        <span style={{ flex: 1 }} />
        <button className="reports-clear" onClick={handleClearStats}>Clear stats</button>
        <button className="reports-refresh" onClick={loadStats}>Refresh</button>
      </div>

      <div className="reports-tabs">
        {[
          ["state", "State of the System"],
          ["load", "Load & Scaling"],
          ["reliability", "Reliability"],
          ["coverage", "Surface Coverage"],
          ["change", "Change"],
          ["topology", "Topology"],
          ["coupling", "Module Coupling"],
        ].map(([key, label]) => (
          <button
            key={key}
            className={`reports-switch__btn${report === key ? " reports-switch__btn--on" : ""}`}
            onClick={() => setReport(key)}
          >
            {label}
            {key === "topology" && !realEdges.length && <Mock />}
          </button>
        ))}
      </div>

      {/* headline verdict — the story in one line */}
      <div className={`reports-verdict reports-verdict--${overallStatus}`}>
        <span className={`reports-verdict__dot reports-verdict__dot--${overallStatus}`} />
        {verdict}
      </div>

      <div className="reports-body">
        {!loading && filterService && !statsByService.some((s) => s.serviceId === filterService) ? (
          <div className="report-noreport">
            <b>{filterService}</b> isn't reporting stats. It's connected, but nothing came back from
            its plugin — most likely it isn't running the SystemView plugin (or hasn't handled a call yet).
          </div>
        ) : !loading && projectServices.length > 0 && statsByService.length === 0 ? (
          <div className="report-noreport">
            None of <b>{projectCode}</b>'s services are reporting stats yet — check the SystemView plugin is loaded and a request has been handled.
          </div>
        ) : report === "topology" ? (
          <>
            <p className="report-lede">
              Each service is a <b>node</b> — drag them anywhere, the layout is saved. Arrows show who
              CALLS whom; click a line (or its count chip) for the module → method couplings behind it.
              {realEdges.length ? (
                <>
                  {" "}Edges are <b>live</b> — built from actual cross-service calls
                  (<code>x-sv-caller</code>), with real call volumes on the chips.
                </>
              ) : (
                <>
                  {" "}No cross-service calls recorded yet — the <Mock>edges</Mock> shown are shaped
                  from buAPI's real <code>loadService</code> sites; live edges appear as soon as
                  services call each other through the upgraded plugin.
                </>
              )}
            </p>
            {serviceHealth.length === 0 ? (
              <p className="report-empty">No services reporting yet.</p>
            ) : (
              <TopologyGraph
                nodes={serviceHealth}
                edges={realEdges.length ? realEdges : MOCK_TOPO_EDGES}
                mock={!realEdges.length}
                projectCode={projectCode}
              />
            )}
          </>
        ) : report === "coupling" ? (
          <>
            <p className="report-lede">
              The <b>pre-split map</b> — which modules are wired to which <b>inside</b> each service,
              from live RFC-008 signals: <code>useModule</code> calls, <code>useService</code> reaches,
              and <b>event subscriptions</b> (the sneaky channel — a module can look call-independent
              yet be event-coupled). Loosely coupled = safe to extract; a dense cluster = plan for it.
            </p>
            {statsByService.filter((s) => (s.snapshot.couplings || []).length).length === 0 ? (
              <p className="report-empty">
                No local couplings observed yet — they record as modules resolve each other
                (<code>this.useModule</code> / <code>this.useService</code> / <code>.on</code>) on
                services running the upgraded plugin.
              </p>
            ) : (
              statsByService
                .filter((s) => (s.snapshot.couplings || []).length)
                .map((s) => (
                  <div className="report-section" key={s.serviceId}>
                    <div className="report-section__title">{s.serviceId}</div>
                    <table className="report-table">
                      <thead>
                        <tr>
                          <th>from</th>
                          <th>coupling</th>
                          <th>to</th>
                          <th className="report-table__num">seen</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[...s.snapshot.couplings]
                          .sort((a, b) => b.count - a.count)
                          .map((c, i) => (
                            <tr key={i}>
                              <td className="report-table__method">{c.from}</td>
                              <td>
                                <span className={`report-coupling report-coupling--${c.kind}`}>
                                  {c.kind === "use_module"
                                    ? "calls module"
                                    : c.kind === "use_service"
                                    ? "reaches service"
                                    : `⚡ listens: ${c.event}`}
                                </span>
                              </td>
                              <td className="report-table__method">{c.to}</td>
                              <td className="report-table__num">{fmtInt(c.count)}</td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                ))
            )}
          </>
        ) : report === "state" ? (
          <>
            <div className="reports-tiles">
              <div className="report-tile">
                <div className="report-tile__value">{fmtInt(totals.totalCalls)}</div>
                <div className="report-tile__label">calls</div>
              </div>
              <div className="report-tile">
                <div className={`report-tile__value report-tile__value--${totals.serverErrorRate >= 0.01 ? "bad" : "ok"}`}>{fmtPct(totals.serverErrorRate)}</div>
                <div className="report-tile__label">server error rate</div>
                {totals.clientErrors > 0 && <div className="report-tile__sub">{fmtInt(totals.clientErrors)} client 4xx (not health)</div>}
              </div>
              <div className="report-tile">
                <div className="report-tile__value">{fmtMs(totals.totalCalls ? totals.totalWall / totals.totalCalls : 0)}</div>
                <div className="report-tile__label">avg latency</div>
              </div>
              <div className="report-tile">
                <div className="report-tile__value">{serviceHealth.length}</div>
                <div className="report-tile__label">services active</div>
              </div>
            </div>

            <div className="report-section">
              <h3 className="report-section__title">Service health</h3>
              <div className="report-health-grid">
                {serviceHealth.length === 0 ? (
                  <p className="report-empty">No active services.</p>
                ) : (
                  serviceHealth.map((s) => (
                    <div
                      key={s.key}
                      className={`report-health-card report-health-card--${s.status} report-health-card--clickable`}
                      title={`Focus ${s.serviceId}`}
                      onClick={() => setFilterService(filterService === s.serviceId ? "" : s.serviceId)}
                    >
                      <div className="report-health-card__head">
                        <span className={`report-health-card__dot report-health-card__dot--${s.status}`} />
                        <span className="report-health-card__name">{s.serviceId}</span>
                        <span className="report-health-card__badge">{STATUS_LABEL[s.status]}</span>
                      </div>
                      <div className="report-health-card__stats">
                        <span>{fmtInt(s.count)} calls</span>
                        <span>{fmtPct(s.errorRate)} err</span>
                        <span>p99 {fmtMs(s.p99)}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="report-section">
              <h3 className="report-section__title">Throughput</h3>
              <LineChart series={series} help="Calls per minute across the project's services — spikes show where load concentrates over time." />
            </div>

            {watch.length > 0 && (
              <div className="report-section">
                <h3 className="report-section__title">Watch</h3>
                <table className="report-table">
                  <thead>
                    <tr><th>Method</th><th>Service</th><th>Calls</th><th>Errors</th><th>p99</th></tr>
                  </thead>
                  <tbody>
                    {watch.map((m) => (
                      <tr key={`${m.serviceId}.${m.moduleMethod}`}>
                        <td className="report-table__method"><span className={`report-dot report-dot--${health(m)}`} />{m.moduleMethod}</td>
                        <td>{m.serviceId}</td>
                        <td>{fmtInt(m.count)}</td>
                        <td className={m.errorRate >= 0.01 ? "report-cell--bad" : ""}>{fmtPct(m.errorRate)}</td>
                        <td>{fmtMs(m.p99)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        ) : report === "load" ? (
          <>
            <div className="report-section">
              <h3 className="report-section__title">
                Load concentration{" "}
                <span className="report-section__hint">
                  — where wall-time goes (who to scale) · bar color = module, top cap = state
                </span>
              </h3>
              {hotspots.length === 0 ? (
                <p className="report-empty">No traffic yet.</p>
              ) : (
                <LoadColumns hotspots={hotspots} hues={hueMap} />
              )}
            </div>
            {/* RFC-015 §5 — THE LOAD BALANCER WINDOW: live cluster state read in-process by the
                plugin riding the LB (policy, clones + heartbeats, route-assignment fairness,
                join/evict timeline). Renders only when a cluster is actually reporting. */}
            {clusters.map((c) => {
              const totalRoutes = Object.values(c.routeCounts || {}).reduce((a, n) => a + n, 0) || 1;
              const now = c.generatedAt || Date.now();
              return (
                <div className="report-section" key={c.serviceId}>
                  <h3 className="report-section__title">
                    Load balancer — {c.serviceId}
                    <span className="report-section__hint">
                      {" "}— policy <b>{(c.state && c.state.policy) || "?"}</b> · live cluster state
                    </span>
                  </h3>
                  {((c.state && c.state.services) || []).map((svc) => {
                    const loads = (c.state.loads || []).filter((l) =>
                      (svc.locations || []).includes(l.location),
                    );
                    return (
                      <div className="report-lb" key={svc.route}>
                        <div className="report-lb__head">
                          <b>{svc.name}</b>
                          <span className="report-lb__meta">
                            {svc.locations.length} clone{svc.locations.length !== 1 ? "s" : ""} · route{" "}
                            <code>{svc.route}</code>
                          </span>
                        </div>
                        {(svc.locations || []).map((loc) => {
                          const assigned = c.routeCounts
                            ? Object.entries(c.routeCounts)
                                .filter(([k]) => k.endsWith(`|${loc}`))
                                .reduce((a, [, n]) => a + n, 0)
                            : 0;
                          const l = loads.find((x) => x.location === loc) || {};
                          const ago = l.seen ? Math.round((now - l.seen) / 1000) : null;
                          return (
                            <LoadBar
                              key={loc}
                              label={loc}
                              share={assigned / totalRoutes}
                              value={`${fmtInt(assigned)} assigned (${fmtPct(assigned / totalRoutes)})`}
                              sub={`load ${l.load != null ? l.load : "—"} · heartbeat ${ago != null ? `${ago}s ago` : "never"}`}
                              status={ago != null && ago < 60 ? "ok" : "watch"}
                            />
                          );
                        })}
                      </div>
                    );
                  })}
                  {(c.timeline || []).length > 0 && (
                    <div className="report-lb__timeline">
                      {c.timeline.slice(-6).reverse().map((ev, i) => (
                        <div className="report-lb__event" key={i}>
                          <span className={`report-lb__etype report-lb__etype--${ev.type}`}>
                            {ev.type === "new_clone" ? "＋ clone" : ev.type === "new_service" ? "＋ service" : "− evicted"}
                          </span>
                          <code>{ev.url || (ev.service && ev.service.route) || ""}</code>
                          <span className="report-lb__ets">{new Date(ev.ts).toLocaleTimeString()}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
            <div className="report-section">
              <h3 className="report-section__title">Latency <span className="report-section__hint">— the tail is what triggers scaling</span></h3>
              <table className="report-table">
                <thead>
                  <tr><th>Method</th><th>Service</th><th>Calls</th><th>p50</th><th>p95</th><th>p99</th><th>max</th></tr>
                </thead>
                <tbody>
                  {[...methods].sort((a, b) => b.p99 - a.p99).slice(0, 15).map((m) => (
                    <tr key={`${m.serviceId}.${m.moduleMethod}`}>
                      <td className="report-table__method"><span className={`report-dot report-dot--${health(m)}`} />{m.moduleMethod}</td>
                      <td>{m.serviceId}</td>
                      <td>{fmtInt(m.count)}</td>
                      <td>{fmtMs(m.p50)}</td>
                      <td>{fmtMs(m.p95)}</td>
                      <td className={m.p99 >= 1000 ? "report-cell--bad" : ""}>{fmtMs(m.p99)}</td>
                      <td>{fmtMs(m.maxDuration)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="report-section">
              <h3 className="report-section__title">Throughput over time</h3>
              <LineChart series={series} help="Calls per minute across the project's services — spikes show where load concentrates over time." />
            </div>
          </>
        ) : report === "reliability" ? (
          <>
            <div className="report-section">
              <h3 className="report-section__title">Errors over time</h3>
              <LineChart series={series} accessor={(d) => d.errors} color="#c62828" fill="rgba(198,40,40,0.12)" unit="errors/min" help="Errors per minute across the project (4xx + 5xx). A rising line is a real incident; a flat one with a tall total is usually clients sending bad input." />
            </div>

            <div className="report-section">
              <h3 className="report-section__title">Status codes <span className="report-section__hint">— the failure mix</span></h3>
              {reliability.statusDist.length === 0 ? (
                <p className="report-empty">No errors recorded. 🎉</p>
              ) : (
                reliability.statusDist.map(([code, n]) => {
                  const max = reliability.statusDist[0][1] || 1;
                  return <LoadBar key={code} label={`HTTP ${code}`} share={n / max} status={code >= 500 ? "bad" : "watch"} value={`${fmtInt(n)}`} />;
                })
              )}
            </div>

            <div className="report-section">
              <h3 className="report-section__title">Top failing methods</h3>
              {reliability.failing.length === 0 ? (
                <p className="report-empty">Nothing failing.</p>
              ) : (
                <table className="report-table">
                  <thead>
                    <tr><th>Method</th><th>Service</th><th>Calls</th><th>Errors</th><th>Error rate</th><th>Top status</th></tr>
                  </thead>
                  <tbody>
                    {reliability.failing.slice(0, 15).map((m) => {
                      const top = Object.entries(m.statusCounts || {}).sort((a, b) => b[1] - a[1])[0];
                      return (
                        <tr key={`${m.serviceId}.${m.moduleMethod}`}>
                          <td className="report-table__method"><span className={`report-dot report-dot--${health(m)}`} />{m.moduleMethod}</td>
                          <td>{m.serviceId}</td>
                          <td>{fmtInt(m.count)}</td>
                          <td className="report-cell--bad">{fmtInt(m.errors)}</td>
                          <td className={m.errorRate >= 0.01 ? "report-cell--bad" : ""}>{fmtPct(m.errorRate)}</td>
                          <td>{top ? `${top[0]} ×${top[1]}` : "—"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </>
        ) : report === "coverage" ? (
          <>
            <p className="report-lede">Only SystemView holds all three: the <b>declared</b> surface, what's <b>used</b>, and what's <b>tested</b>. The gaps below are what nobody else can see.</p>
            {coverage.length === 0 ? (
              <p className="report-empty">No services connected.</p>
            ) : (
              coverage.map((c) => (
                <div className="report-section" key={c.serviceId}>
                  <h3 className="report-section__title">
                    {c.serviceId} <span className="report-section__hint">— {c.testedCount}/{c.total} methods tested ({fmtPct(c.coverageRatio)}), {c.usedCount} used</span>
                  </h3>
                  <div className="report-cov-bar">
                    <div className="report-cov-bar__fill" style={{ width: `${Math.round(c.coverageRatio * 100)}%` }} />
                  </div>

                  {c.untestedHot.length > 0 && (
                    <div className="report-cov-block report-cov-block--danger">
                      <div className="report-cov-block__title">⚠ Untested hot paths <span>— called in production, no spec</span></div>
                      <table className="report-table">
                        <thead><tr><th>Method</th><th>Calls</th><th>Wall-time</th><th>p99</th></tr></thead>
                        <tbody>
                          {c.untestedHot.slice(0, 8).map((m) => (
                            <tr key={m.moduleMethod}>
                              <td className="report-table__method">{m.moduleMethod}</td>
                              <td>{fmtInt(m.count)}</td>
                              <td>{fmtMs(m.totalDuration)}</td>
                              <td>{fmtMs(m.p99)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {c.unused.length > 0 && (
                    <div className="report-cov-block">
                      <div className="report-cov-block__title">Unused endpoints <span>— declared, never called</span></div>
                      <div className="report-cov-chips">
                        {c.unused.map((mm) => <span key={mm} className="report-chip">{mm}</span>)}
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </>
        ) : (
          <>
            {!change ? (
              <p className="report-empty">Not enough history yet — a change report needs at least two time buckets of activity.</p>
            ) : (
              <>
                <p className="report-lede">Recent activity vs the previous window ({change.buckets} buckets of history).</p>
                <div className="reports-tiles">
                  <div className="report-tile">
                    <div className={`report-tile__value report-tile__value--${change.callsDelta >= 0 ? "ok" : "bad"}`}>
                      {change.callsDelta >= 0 ? "▲" : "▼"} {fmtPct(Math.abs(change.callsDelta))}
                    </div>
                    <div className="report-tile__label">throughput Δ</div>
                  </div>
                  <div className="report-tile">
                    <div className={`report-tile__value report-tile__value--${change.recentErrRate > change.prevErrRate ? "bad" : "ok"}`}>
                      {fmtPct(change.prevErrRate)} → {fmtPct(change.recentErrRate)}
                    </div>
                    <div className="report-tile__label">error rate Δ</div>
                  </div>
                  <div className="report-tile">
                    <div className="report-tile__value">{fmtInt(change.recent.count)}</div>
                    <div className="report-tile__label">calls (recent window)</div>
                  </div>
                </div>
                <div className="report-section">
                  <h3 className="report-section__title">Throughput <span className="report-section__hint">— recent half vs previous half</span></h3>
                  <LineChart series={series} help="Calls per minute across the project's services — spikes show where load concentrates over time." />
                </div>
                <p className="report-note">Per-method deltas (“latency +30% on X since deploy”) need per-method time buckets — a Tier-1 config follow-up; today’s buckets are service-wide.</p>
              </>
            )}
          </>
        )}
      </div>
      {/* RFC-032 — the bots ride the Stats page too: same dock line, same peeks, same TV. */}
      <AgentChat />
    </section>
  );
}
