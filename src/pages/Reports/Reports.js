import React, { useState, useEffect, useContext, useMemo, useCallback } from "react";
import { useHistory, useParams, useLocation } from "react-router-dom";
import { Client } from "../../systemClient";
import ServiceContext from "../../ServiceContext";
import PageHeader from "../../organisms/PageHeader/PageHeader";
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
function LineChart({ series, height = 90, accessor = (d) => d.count, color = "#3367d6", fill = "rgba(51,103,214,0.12)", help }) {
  const W = 600;
  const H = height;
  const body =
    !series || series.length === 0 ? (
      <div className="report-chart-empty">no activity yet</div>
    ) : (
      (() => {
        const vals = series.map(accessor);
        const max = Math.max(1, ...vals);
        const n = series.length;
        const x = (i) => (n === 1 ? W / 2 : (i / (n - 1)) * W);
        const y = (v) => H - 6 - (v / max) * (H - 12);
        const pts = series.map((d, i) => `${x(i).toFixed(1)},${y(accessor(d)).toFixed(1)}`);
        const area = `0,${H} ${pts.join(" ")} ${W},${H}`;
        return (
          <svg className="report-chart" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
            <polygon points={area} fill={fill} />
            <polyline points={pts.join(" ")} fill="none" stroke={color} strokeWidth="2" vectorEffect="non-scaling-stroke" />
          </svg>
        );
      })()
    );
  return (
    <>
      {body}
      {help && <div className="report-chart-help">{help}</div>}
    </>
  );
}

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
  const [filterService, setFilterService] = useState(query.get("service") || "");
  const [report, setReport] = useState(query.get("report") || "state");
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
    const qs = params.toString();
    const base = projectCode ? `/reports/${projectCode}` : "/reports";
    window.history.replaceState(null, "", base + (qs ? "?" + qs : ""));
  }, [projectCode, filterService, report]);

  const projectServices = (projectCode && connectedProjects[projectCode]) || [];

  const loadStats = useCallback(async () => {
    const targets = projectServices.filter((s) => !filterService || s.serviceId === filterService);
    const collected = [];
    for (const t of targets) {
      try {
        const { SystemView } = Client.createService(t.connectionData);
        const snap = await SystemView.getStats();
        if (snap && Array.isArray(snap.methods))
          collected.push({ projectCode, serviceId: t.serviceId, snapshot: snap });
      } catch {
        /* old plugin without getStats, or unreachable — skip */
      }
    }
    setStatsByService(collected);
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectCode, JSON.stringify(projectServices.map((s) => s.serviceId)), filterService]);

  useEffect(() => {
    loadStats();
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
  const methods = useMemo(
    () =>
      statsByService.flatMap((s) =>
        s.snapshot.methods.map((m) => {
          const { server, client } = splitErrors(m.statusCounts);
          return {
            ...m,
            projectCode: s.projectCode,
            serviceId: s.serviceId,
            serverErrors: server,
            clientErrors: client,
            serverErrorRate: m.count ? server / m.count : 0,
          };
        }),
      ),
    [statsByService],
  );

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
      .slice(0, 12)
      .map((m) => ({ ...m, share: m.totalDuration / totalWall, status: health(m) }));
  }, [methods, totals.totalWall]);

  const watch = useMemo(
    () => methods.filter((m) => health(m) !== "ok").sort((a, b) => b.errorRate - a.errorRate || b.p99 - a.p99).slice(0, 8),
    [methods],
  );

  // merged throughput series across services (by bucket ts)
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
    return [...merged.values()].sort((a, b) => a.ts - b.ts);
  }, [statsByService]);

  // ---- Surface Coverage: available (catalog) vs used (traffic) vs tested (specs) ----
  const inventory = useMemo(() => {
    const svcs = projectServices.filter((s) => !filterService || s.serviceId === filterService);
    return svcs.map((s) => {
      const available = new Set();
      ((s.connectionData && s.connectionData.modules) || []).forEach(({ name, methods: fns }) => {
        if (name === "Plugin" || name === "SystemView") return;
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
        <label className="reports-timerange" title="Time-window filtering isn't wired to the per-method rollups yet — they're all-time. Marked so it's not mistaken for real.">
          <select disabled defaultValue="all">
            <option value="all">all time</option>
            <option value="1h">last hour</option>
            <option value="24h">last 24h</option>
          </select>
          <Mock />
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
        ].map(([key, label]) => (
          <button
            key={key}
            className={`reports-switch__btn${report === key ? " reports-switch__btn--on" : ""}`}
            onClick={() => setReport(key)}
          >
            {label}
            {key === "topology" && <Mock />}
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
              Each service is a <b>node</b> — health-colored border, its methods sized by how often they're
              called (the bar = call volume). The <Mock>connecting lines</Mock> between services — who calls
              whom — light up once SystemLynx carries the caller (<code>x-sv-trace</code>/<code>x-sv-caller</code>).
            </p>
            {serviceHealth.length === 0 ? (
              <p className="report-empty">No services reporting yet.</p>
            ) : (
              <div className="topo-grid">
                {serviceHealth.map((svc) => {
                  const svcMethods = methods
                    .filter((m) => m.serviceId === svc.serviceId)
                    .sort((a, b) => b.count - a.count);
                  const maxCount = Math.max(1, ...svcMethods.map((m) => m.count));
                  return (
                    <div key={svc.serviceId} className={`topo-node topo-node--${svc.status}`}>
                      <div className="topo-node__head">
                        <span className={`report-dot report-dot--${svc.status}`} />
                        <span className="topo-node__name">{svc.serviceId}</span>
                        <span className="topo-node__badge">{STATUS_LABEL[svc.status]}</span>
                      </div>
                      <div className="topo-node__meta">
                        {fmtInt(svc.count)} calls · {fmtPct(svc.serverErrorRate)} err · avg {fmtMs(svc.avgDuration)} · p99 {fmtMs(svc.p99)}
                      </div>
                      <div className="topo-node__methods">
                        {svcMethods.length === 0 ? (
                          <div className="topo-method__empty">no calls yet</div>
                        ) : (
                          svcMethods.slice(0, 10).map((m) => (
                            <div className="topo-method" key={m.moduleMethod} title={`${m.moduleMethod} — ${fmtInt(m.count)} calls, p99 ${fmtMs(m.p99)}`}>
                              <span className="topo-method__name">{m.moduleMethod}</span>
                              <div className="topo-method__track">
                                <div
                                  className={`topo-method__bar topo-method__bar--${health(m)}`}
                                  style={{ width: `${Math.max(5, (m.count / maxCount) * 100)}%` }}
                                />
                              </div>
                              <span className="topo-method__count">{fmtInt(m.count)}</span>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
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
              <h3 className="report-section__title">Load concentration <span className="report-section__hint">— where wall-time goes (who to scale)</span></h3>
              {hotspots.length === 0 ? (
                <p className="report-empty">No traffic yet.</p>
              ) : (
                hotspots.map((m) => (
                  <LoadBar
                    key={`${m.serviceId}.${m.moduleMethod}`}
                    label={`${m.moduleMethod}`}
                    share={m.share}
                    status={m.status}
                    value={`${fmtPct(m.share)} · ${fmtMs(m.totalDuration)}`}
                    sub={`${m.serviceId} · ${fmtInt(m.count)} calls · avg ${fmtMs(m.avgDuration)}`}
                  />
                ))
              )}
            </div>

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
              <LineChart series={series} accessor={(d) => d.errors} color="#c62828" fill="rgba(198,40,40,0.12)" help="Errors per minute across the project (4xx + 5xx). A rising line is a real incident; a flat one with a tall total is usually clients sending bad input." />
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
    </section>
  );
}
