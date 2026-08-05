import React, { useState, useEffect, useContext, useMemo, useCallback, useRef } from "react";
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
// A bucket's moment, for the hover tip — time only when it's today, "Aug 4 3:42 PM" otherwise.
const fmtBucketTs = (ts) => {
  const d = new Date(ts);
  const today = new Date().toDateString() === d.toDateString();
  const time = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  return today ? time : `${d.toLocaleDateString([], { month: "short", day: "numeric" })} ${time}`;
};

function LineChart({ series, height = 90, accessor = (d) => d.count, color = "#3367d6", fill = "rgba(51,103,214,0.12)", unit = "calls/min", help }) {
  const W = 600;
  const H = height;
  // Hover crosshair — snaps to the nearest bucket; the tip is HTML overlaid on the wrapper because
  // the svg stretches non-uniformly (preserveAspectRatio none), which would distort svg text.
  const [hover, setHover] = useState(null);
  const empty = !series || series.length === 0;
  let body;
  if (empty) {
    body = <div className="report-chart-empty">no activity yet</div>;
  } else {
    const vals = series.map(accessor);
    const max = Math.max(1, ...vals);
    const n = series.length;
    const x = (i) => (n === 1 ? W / 2 : (i / (n - 1)) * W);
    const y = (v) => H - 6 - (v / max) * (H - 12);
    const pts = series.map((d, i) => `${x(i).toFixed(1)},${y(accessor(d)).toFixed(1)}`);
    const area = `0,${H} ${pts.join(" ")} ${W},${H}`;
    const onMove = (e) => {
      const r = e.currentTarget.getBoundingClientRect();
      const frac = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
      setHover(n === 1 ? 0 : Math.round(frac * (n - 1)));
    };
    // The overlay positions by PERCENT of the wrapper — same mapping the stretched svg uses.
    const leftPct = hover == null ? 0 : n === 1 ? 50 : (hover / (n - 1)) * 100;
    const topPct = hover == null ? 0 : (y(vals[hover]) / H) * 100;
    body = (
      <div className="report-chart-wrap" onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
        <svg className="report-chart" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
          <polygon points={area} fill={fill} />
          <polyline points={pts.join(" ")} fill="none" stroke={color} strokeWidth="2" vectorEffect="non-scaling-stroke" />
          {hover != null && (
            <line
              x1={x(hover)}
              x2={x(hover)}
              y1="0"
              y2={H}
              style={{ stroke: "var(--sv-text-muted)" }}
              strokeDasharray="3 3"
              vectorEffect="non-scaling-stroke"
            />
          )}
        </svg>
        {hover != null && (
          <>
            <span
              className="report-chart-dot"
              style={{ left: `${leftPct}%`, top: `${topPct}%`, background: color }}
            />
            <div
              className={`report-chart-tip${leftPct > 60 ? " report-chart-tip--left" : ""}`}
              style={{ left: `${leftPct}%` }}
            >
              <b>{fmtInt(vals[hover])}</b> {unit} · {fmtBucketTs(series[hover].ts)}
            </div>
          </>
        )}
      </div>
    );
  }
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
// Half-extents of a node card, used to trim edge lines at the card's border so arrowheads land
// ON the box instead of vanishing under it.
const TOPO_HW = 92;
const TOPO_HH = 36;

function TopologyGraph({ nodes, edges, projectCode }) {
  const canvasRef = useRef(null);
  const storageKey = `sv.topo.${projectCode}`;
  const [pos, setPos] = useState({}); // serviceId → {x,y} CENTER, px within the canvas
  const [drag, setDrag] = useState(null);
  const movedRef = useRef(false);
  const [sel, setSel] = useState(null); // {type:"edge", i} | {type:"node", id}

  // Seed layout: saved arrangement wins; otherwise hub-and-spoke — the most called-INTO service
  // (Profiles in buAPI) sits center, the rest ring around it. Drag anywhere; the layout persists.
  const ids = nodes.map((n) => n.serviceId).join(",");
  useEffect(() => {
    const w = (canvasRef.current && canvasRef.current.clientWidth) || 900;
    let saved = {};
    try { saved = JSON.parse(localStorage.getItem(storageKey)) || {}; } catch { saved = {}; }
    const inbound = {};
    edges.forEach((e) => { inbound[e.to] = (inbound[e.to] || 0) + 1; });
    const order = [...nodes].sort((a, b) => (inbound[b.serviceId] || 0) - (inbound[a.serviceId] || 0));
    const hub = order.length > 2 && (inbound[order[0]?.serviceId] || 0) > 1 ? order[0].serviceId : null;
    const ring = order.filter((n) => n.serviceId !== hub);
    const next = {};
    order.forEach((n) => {
      if (saved[n.serviceId]) { next[n.serviceId] = saved[n.serviceId]; return; }
      if (n.serviceId === hub) { next[n.serviceId] = { x: w / 2, y: TOPO_H / 2 }; return; }
      const i = ring.findIndex((r) => r.serviceId === n.serviceId);
      const a = (i / Math.max(1, ring.length)) * 2 * Math.PI - Math.PI / 2;
      next[n.serviceId] = {
        x: w / 2 + Math.cos(a) * w * 0.32,
        y: TOPO_H / 2 + Math.sin(a) * TOPO_H * 0.34,
      };
    });
    setPos(next);
  }, [ids, projectCode]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!drag) return undefined;
    const move = (e) => {
      movedRef.current = true;
      const rect = canvasRef.current.getBoundingClientRect();
      const x = Math.min(rect.width - 40, Math.max(40, e.clientX - rect.left + drag.dx));
      const y = Math.min(TOPO_H - 28, Math.max(28, e.clientY - rect.top + drag.dy));
      setPos((p) => ({ ...p, [drag.id]: { x, y } }));
    };
    const up = () => {
      setPos((p) => {
        try { localStorage.setItem(storageKey, JSON.stringify(p)); } catch { /* full/blocked — layout just won't persist */ }
        return p;
      });
      setDrag(null);
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
    return () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
    };
  }, [drag, storageKey]);

  const startDrag = (id) => (e) => {
    e.preventDefault();
    movedRef.current = false;
    const rect = canvasRef.current.getBoundingClientRect();
    const p = pos[id];
    if (!p) return;
    setDrag({ id, dx: p.x - (e.clientX - rect.left), dy: p.y - (e.clientY - rect.top) });
  };

  // Point on the border of the card centered at `c`, along the direction toward `toward`.
  const borderPoint = (c, toward, pad = 0) => {
    const dx = toward.x - c.x, dy = toward.y - c.y;
    const len = Math.max(1, Math.hypot(dx, dy));
    const ux = dx / len, uy = dy / len;
    const k = 1 / Math.max(Math.abs(ux) / TOPO_HW, Math.abs(uy) / TOPO_HH, 1e-6);
    const d = Math.min(k + pad, len / 2);
    return { x: c.x + ux * d, y: c.y + uy * d };
  };

  const live = edges
    .map((e, i) => ({ ...e, i }))
    .filter((e) => pos[e.from] && pos[e.to]);

  const nodeById = {};
  nodes.forEach((n) => { nodeById[n.serviceId] = n; });
  const selEdge = sel?.type === "edge" ? edges[sel.i] : null;

  return (
    <>
      <div
        className="topo-canvas"
        ref={canvasRef}
        onMouseDown={(e) => { if (e.target === canvasRef.current) setSel(null); }}
      >
        <svg className="topo-svg">
          <defs>
            <marker id="topoArrow" markerWidth="9" markerHeight="9" refX="7.5" refY="4.5" orient="auto" markerUnits="userSpaceOnUse">
              <path d="M0,0 L9,4.5 L0,9 Z" className="topo-arrowhead" />
            </marker>
            <marker id="topoArrowSel" markerWidth="9" markerHeight="9" refX="7.5" refY="4.5" orient="auto" markerUnits="userSpaceOnUse">
              <path d="M0,0 L9,4.5 L0,9 Z" className="topo-arrowhead topo-arrowhead--sel" />
            </marker>
          </defs>
          {live.map((e) => {
            const a = pos[e.from], b = pos[e.to];
            const p1 = borderPoint(a, b);
            const p2 = borderPoint(b, a, 4);
            const mx = (p1.x + p2.x) / 2, my = (p1.y + p2.y) / 2;
            const len = Math.max(1, Math.hypot(p2.x - p1.x, p2.y - p1.y));
            const px = -(p2.y - p1.y) / len, py = (p2.x - p1.x) / len; // perpendicular — bows the line
            const c = { x: mx + px * 22, y: my + py * 22 };
            const d = `M${p1.x},${p1.y} Q${c.x},${c.y} ${p2.x},${p2.y}`;
            const isSel = sel?.type === "edge" && sel.i === e.i;
            return (
              <g key={`${e.from}->${e.to}`}>
                <path className="topo-edge-hit" d={d} onClick={() => setSel({ type: "edge", i: e.i })} />
                <path
                  className={`topo-edge${isSel ? " is-sel" : ""}`}
                  d={d}
                  markerEnd={`url(#${isSel ? "topoArrowSel" : "topoArrow"})`}
                />
              </g>
            );
          })}
        </svg>
        {live.map((e) => {
          const a = pos[e.from], b = pos[e.to];
          const p1 = borderPoint(a, b), p2 = borderPoint(b, a, 4);
          const mx = (p1.x + p2.x) / 2, my = (p1.y + p2.y) / 2;
          const len = Math.max(1, Math.hypot(p2.x - p1.x, p2.y - p1.y));
          const px = -(p2.y - p1.y) / len, py = (p2.x - p1.x) / len;
          // The chip rides the bezier's actual midpoint (t=0.5): ¼·p1 + ½·control + ¼·p2.
          const cx = mx + px * 22, cy = my + py * 22;
          const chipX = 0.25 * p1.x + 0.5 * cx + 0.25 * p2.x;
          const chipY = 0.25 * p1.y + 0.5 * cy + 0.25 * p2.y;
          const n = e.couplings.reduce((s, cpl) => s + cpl.calls.length, 0);
          const isSel = sel?.type === "edge" && sel.i === e.i;
          return (
            <span
              key={`chip-${e.from}->${e.to}`}
              className={`topo-chip${isSel ? " is-sel" : ""}`}
              style={{ left: chipX, top: chipY }}
              onClick={() => setSel({ type: "edge", i: e.i })}
              title={`${e.from} calls ${e.to} — ${n} couplings`}
            >
              {n}
            </span>
          );
        })}
        {nodes.map((n) => {
          const p = pos[n.serviceId];
          if (!p) return null;
          const isSel = sel?.type === "node" && sel.id === n.serviceId;
          return (
            <div
              key={n.serviceId}
              className={`topo-gnode topo-gnode--${n.status || "ok"}${isSel ? " is-sel" : ""}`}
              style={{ left: p.x, top: p.y }}
              onMouseDown={startDrag(n.serviceId)}
              onClick={() => { if (!movedRef.current) setSel({ type: "node", id: n.serviceId }); }}
            >
              <div className="topo-gnode__name">
                <span className={`report-dot report-dot--${n.status || "ok"}`} />
                {n.serviceId}
              </div>
              <div className="topo-gnode__sub">
                {fmtInt(n.count)} calls · p99 {fmtMs(n.p99)}
              </div>
            </div>
          );
        })}
        {live.length === 0 && (
          <div className="topo-canvas__empty">
            no coupling map for this project yet — the mock edge set covers buAPI
          </div>
        )}
      </div>
      <div className="topo-detail">
        {selEdge ? (
          <>
            <div className="topo-detail__title">
              {selEdge.from} → {selEdge.to} <Mock>couplings</Mock>
            </div>
            {selEdge.couplings.map((c, i) => (
              <div className="topo-detail__row" key={i}>
                <b>{selEdge.from}.{c.module}</b>
                {" → "}
                {c.calls.map((call, j) => (
                  <span key={call}>
                    {j > 0 && " · "}
                    <code>{selEdge.to}.{call}</code>
                  </span>
                ))}
                <span className="topo-detail__via">via {c.via}</span>
              </div>
            ))}
          </>
        ) : sel?.type === "node" ? (
          (() => {
            const out = edges.filter((e) => e.from === sel.id);
            const inn = edges.filter((e) => e.to === sel.id);
            return (
              <>
                <div className="topo-detail__title">
                  {sel.id} <Mock>couplings</Mock>
                </div>
                {out.length === 0 && inn.length === 0 && (
                  <div className="topo-detail__hint">no cross-service calls on record for this service</div>
                )}
                {out.map((e) => (
                  <div className="topo-detail__row" key={`o-${e.to}`}>
                    calls <b>{e.to}</b> from{" "}
                    {[...new Set(e.couplings.map((c) => c.module))].map((m, j) => (
                      <span key={m}>{j > 0 && ", "}<code>{sel.id}.{m}</code></span>
                    ))}
                  </div>
                ))}
                {inn.map((e) => (
                  <div className="topo-detail__row" key={`i-${e.from}`}>
                    called by <b>{e.from}</b>{" "}
                    {[...new Set(e.couplings.map((c) => c.module))].map((m, j) => (
                      <span key={m}>{j > 0 && ", "}<code>{e.from}.{m}</code></span>
                    ))}
                  </div>
                ))}
              </>
            );
          })()
        ) : (
          <div className="topo-detail__hint">
            drag nodes to arrange (the layout is saved) — click a line or its count chip for the
            module → method couplings behind it, or a node for its connections
          </div>
        )}
      </div>
    </>
  );
}

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
              Each service is a <b>node</b> — drag them anywhere, the layout is saved. Arrows show who
              CALLS whom; click a line (or its count chip) for the module → method couplings behind it.
              The <Mock>edges</Mock> are shaped from buAPI's real <code>loadService</code> sites — live
              edges arrive once SystemLynx carries the caller (<code>x-sv-trace</code>/<code>x-sv-caller</code>).
            </p>
            {serviceHealth.length === 0 ? (
              <p className="report-empty">No services reporting yet.</p>
            ) : (
              <TopologyGraph nodes={serviceHealth} edges={MOCK_TOPO_EDGES} projectCode={projectCode} />
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
    </section>
  );
}
