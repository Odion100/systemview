import React, { useContext, useEffect, useMemo, useState } from "react";
import loadServiceWithHeaders from "../../../utils/loadService";
import ServiceContext from "../../../ServiceContext";
import LoadColumns from "../../../organisms/Charts/LoadColumns";
import TopologyGraph from "../../../organisms/Charts/TopologyGraph";
import { buildHueMap } from "../../../organisms/Charts/hues";
import { flattenMethods, hotspotsFrom, edgesFrom, nodesFrom } from "../../../organisms/Charts/derive";
import { useMarkdownScope } from "../context";

// RFC-025 §4.3 — the rest of the Stats page, embeddable. `::topology` and `::load` draw the SAME
// components from the SAME snapshots the page uses (extracted to organisms/Charts), so a document
// and the page can't drift.

// Shared: pull every reporting service's stats snapshot for a project.
function useProjectStats(attrs) {
  const scope = useMarkdownScope();
  const { connectedServices = [] } = useContext(ServiceContext);
  const firstProject = connectedServices.length ? connectedServices[0].projectCode : null;
  const projectCode = attrs.project || scope.projectCode || firstProject;
  const only = attrs.service || null;
  const [stats, setStats] = useState(null);

  const targets = useMemo(
    () => connectedServices.filter((s) => s.projectCode === projectCode && (!only || s.serviceId === only)),
    [connectedServices, projectCode, only]
  );

  useEffect(() => {
    let dead = false;
    (async () => {
      if (!targets.length) return;
      const collected = [];
      for (const t of targets) {
        try {
          const svc = loadServiceWithHeaders(t.system.connectionData, t.headers, t.credentials);
          const snap = svc && svc.SystemView ? await svc.SystemView.getStats() : null;
          if (snap && Array.isArray(snap.methods)) collected.push({ serviceId: t.serviceId, snapshot: snap });
        } catch {
          /* no plugin / unreachable — contributes nothing */
        }
      }
      if (!dead) setStats(collected);
    })();
    return () => {
      dead = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targets.map((t) => t.serviceId).join(",")]);

  return { projectCode, stats };
}

const Frame = ({ kind, title, scope, children }) => (
  <div className={`md-embed md-embed--${kind}`}>
    <div className="md-embed__head">
      <span className="md-embed__kind">{kind}</span>
      <span className="md-embed__title">{title}</span>
      <span className="md-embed__scope">{scope}</span>
    </div>
    {children}
  </div>
);

//   ::load{limit=12}  — load concentration, the vertical columns from the Load & Scaling report
export const LoadEmbed = ({ attrs = {} }) => {
  const { projectCode, stats } = useProjectStats(attrs);
  const methods = useMemo(() => (stats ? flattenMethods(stats) : []), [stats]);
  const hotspots = useMemo(
    () => hotspotsFrom(methods, attrs.limit ? parseInt(attrs.limit, 10) : 12),
    [methods, attrs.limit]
  );
  const hues = useMemo(() => buildHueMap(methods), [methods]);

  if (!projectCode) return <div className="md-embed md-embed--dead">::load — no project in scope</div>;
  return (
    <Frame kind="load" title="load concentration" scope={attrs.service || projectCode}>
      {stats == null ? (
        <div className="report-chart-empty">loading…</div>
      ) : hotspots.length ? (
        <LoadColumns hotspots={hotspots} hues={hues} />
      ) : (
        <div className="report-chart-empty">no traffic recorded yet</div>
      )}
    </Frame>
  );
};

//   ::topology  — the who-calls-whom graph, draggable and expandable exactly as on the Stats page
export const TopologyEmbed = ({ attrs = {} }) => {
  const { projectCode, stats } = useProjectStats(attrs);
  const edges = useMemo(() => (stats ? edgesFrom(stats) : []), [stats]);
  const nodes = useMemo(() => (stats ? nodesFrom(stats) : []), [stats]);

  if (!projectCode) return <div className="md-embed md-embed--dead">::topology — no project in scope</div>;
  return (
    <Frame kind="topology" title="service topology" scope={projectCode}>
      {stats == null ? (
        <div className="report-chart-empty">loading…</div>
      ) : edges.length ? (
        <TopologyGraph nodes={nodes} edges={edges} projectCode={projectCode} variant="embed" />
      ) : (
        <div className="report-chart-empty">
          no cross-service calls recorded yet — run something that calls another service
        </div>
      )}
    </Frame>
  );
};
