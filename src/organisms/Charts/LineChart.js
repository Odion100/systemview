import React, { useState } from "react";
import "./styles.scss";

// RFC-025 §4.3 — extracted OUT of pages/Reports/Reports.js so it isn't trapped on one page.
// The Stats page and a `::chart` embed inside any document now render the exact same component
// (self-contained SVG — no external chart lib, which also keeps the artifact CSP story simple).

export const fmtInt = (n) => (n == null ? "—" : Math.round(n).toLocaleString());

// A bucket's moment, for the hover tip — time only when it's today, "Aug 4 3:42 PM" otherwise.
export const fmtBucketTs = (ts) => {
  const d = new Date(ts);
  const today = new Date().toDateString() === d.toDateString();
  const time = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  return today ? time : `${d.toLocaleDateString([], { month: "short", day: "numeric" })} ${time}`;
};

export default function LineChart({
  series,
  height = 90,
  accessor = (d) => d.count,
  color = "#3367d6",
  fill = "rgba(51,103,214,0.12)",
  unit = "calls/min",
  help,
}) {
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
        <svg className="report-chart" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ height }}>
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
