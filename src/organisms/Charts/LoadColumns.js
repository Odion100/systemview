import React from "react";
import { MAP_HUES } from "./hues";
import { fmtInt, fmtMs, fmtPct } from "./format";
import "./styles.scss";

// Load concentration as vertical columns — extracted from pages/Reports/Reports.js (RFC-025 §4.3)
// so a document can embed the same thing the Stats page draws.
// Load concentration as VERTICAL columns: height = wall-time share, fill = module hue (grouping),
// the top CAP = health state (amber watch / red bad) — grouping and state share the bar without
// fighting over one color channel.
function LoadColumns({ hotspots, hues = {} }) {
  const max = Math.max(...hotspots.map((m) => m.share), 0.001);
  const BAR_AREA = 210;
  return (
    <div className="load-cols">
      {hotspots.map((m) => {
        const mod = m.moduleMethod.split(".")[0];
        const hue = hues[`${m.serviceId}.${mod}`] || MAP_HUES[0];
        return (
          <div
            className="load-cols__col"
            key={`${m.serviceId}.${m.moduleMethod}`}
            title={`${m.serviceId}.${m.moduleMethod} — ${fmtPct(m.share)} of wall-time · ${fmtInt(m.count)} calls · p99 ${fmtMs(m.p99)}${m.serverErrors ? ` · ${fmtInt(m.serverErrors)} server errors` : ""}`}
          >
            <span className={`load-cols__val${m.status === "bad" ? " load-cols__val--bad" : ""}`}>
              {fmtPct(m.share)}
            </span>
            <div
              className={`load-cols__bar${m.status !== "ok" ? ` load-cols__bar--${m.status}` : ""}`}
              style={{ height: Math.max(4, (m.share / max) * BAR_AREA), background: hue }}
            />
            <span className="load-cols__name">{m.moduleMethod}</span>
            <span className="load-cols__svc">{m.serviceId}</span>
          </div>
        );
      })}
    </div>
  );
}

export default LoadColumns;
