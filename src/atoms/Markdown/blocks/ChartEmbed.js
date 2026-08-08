import React, { useContext, useEffect, useMemo, useState } from "react";
import loadServiceWithHeaders from "../../../utils/loadService";
import ServiceContext from "../../../ServiceContext";
import LineChart from "../../../organisms/Charts/LineChart";
import { useMarkdownScope } from "../context";

// RFC-025 §4.3 — `::chart{report=throughput range=1h service=Profiles}`
//
// The live Stats rollups, inside a document. Same component the Stats page draws, same source
// (`SystemView.getStats()` per service), so prose can point at what actually happened instead of
// describing it. Scope defaults to the document's own project/service.
const REPORTS = {
  throughput: { label: "throughput", unit: "calls/min", accessor: (d) => d.count, color: "#3367d6", fill: "rgba(51,103,214,0.12)" },
  errors: { label: "errors", unit: "errors/min", accessor: (d) => d.errors || 0, color: "#c0392b", fill: "rgba(192,57,43,0.12)" },
  latency: { label: "avg latency", unit: "ms avg", accessor: (d) => (d.count ? Math.round((d.sumDuration || 0) / d.count) : 0), color: "#7a5bb5", fill: "rgba(122,91,181,0.12)" },
};
const RANGE_MS = { "15m": 15 * 60e3, "1h": 3600e3, "4h": 4 * 3600e3, "24h": 24 * 3600e3 };

// Buckets from several services share a minute — sum them so one chart reads as the project's.
function mergeSeries(snapshots, sinceMs) {
  const byTs = new Map();
  snapshots.forEach((snap) => {
    (snap.series || []).forEach((b) => {
      if (sinceMs && b.ts < sinceMs) return;
      const cur = byTs.get(b.ts) || { ts: b.ts, count: 0, errors: 0, sumDuration: 0 };
      cur.count += b.count || 0;
      cur.errors += b.errors || 0;
      cur.sumDuration += b.sumDuration || 0;
      byTs.set(b.ts, cur);
    });
  });
  return [...byTs.values()].sort((a, b) => a.ts - b.ts);
}

const ChartEmbed = ({ attrs = {} }) => {
  const scope = useMarkdownScope();
  const { connectedServices = [] } = useContext(ServiceContext);
  const [snapshots, setSnapshots] = useState(null);
  const [error, setError] = useState(null);

  const spec = REPORTS[attrs.report] || REPORTS.throughput;
  // A document isn't always read inside a project — help topics and the hub have no namespace at
  // all. Rather than rendering dead there (which makes the docs look broken), fall back to the
  // first connected project and SAY which one in the scope label.
  const firstProject = connectedServices.length ? connectedServices[0].projectCode : null;
  const projectCode = attrs.project || scope.projectCode || firstProject;
  const only = attrs.service || null;

  const targets = useMemo(
    () =>
      connectedServices.filter(
        (s) => s.projectCode === projectCode && (!only || s.serviceId === only)
      ),
    [connectedServices, projectCode, only]
  );

  useEffect(() => {
    let dead = false;
    (async () => {
      if (!targets.length) return;
      const collected = [];
      for (const t of targets) {
        try {
          // Header-authed like every other browser-side service call (a credentialed service needs
          // its captured session, see utils/loadService).
          const svc = loadServiceWithHeaders(t.system.connectionData, t.headers, t.credentials);
          const snap = svc && svc.SystemView ? await svc.SystemView.getStats() : null;
          if (snap && Array.isArray(snap.series)) collected.push(snap);
        } catch {
          /* plugin predates getStats, or the service is down — just contributes nothing */
        }
      }
      if (dead) return;
      if (!collected.length) setError("no stats reported");
      setSnapshots(collected);
    })();
    return () => {
      dead = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targets.map((t) => t.serviceId).join(",")]);

  const series = useMemo(() => {
    if (!snapshots) return [];
    const window = RANGE_MS[attrs.range];
    return mergeSeries(snapshots, window ? Date.now() - window : 0);
  }, [snapshots, attrs.range]);

  if (!projectCode)
    return <div className="md-embed md-embed--dead">::chart — no project in scope</div>;

  const scopeLabel = `${only || projectCode}${attrs.range ? ` · last ${attrs.range}` : ""}`;
  return (
    <div className="md-embed md-embed--chart">
      <div className="md-embed__head">
        <span className="md-embed__kind">chart</span>
        <span className="md-embed__title">{spec.label}</span>
        <span className="md-embed__scope">{scopeLabel}</span>
      </div>
      {snapshots == null && !error ? (
        <div className="report-chart-empty">loading…</div>
      ) : (
        <LineChart
          series={series}
          accessor={spec.accessor}
          color={spec.color}
          fill={spec.fill}
          unit={spec.unit}
          height={attrs.height ? parseInt(attrs.height, 10) : 90}
        />
      )}
    </div>
  );
};

export default ChartEmbed;
