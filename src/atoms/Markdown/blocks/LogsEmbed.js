import React, { Suspense, useContext, useMemo } from "react";
import ServiceContext from "../../../ServiceContext";
import { useMarkdownScope } from "../context";
import { parseTarget, resolveNamespace } from "../nsResolve";

// `::logs` — the Logs tab, inside a document. Same component the Logs tab renders (extracted to
// organisms/InlineLogs for this), so the filters, the frequency dashboard, Monitor and Clear all
// behave identically and the page and the embed can't drift.
//
//   ::logs                          ← this document's namespace
//   ::logs[Math.chainUse]           ← a specific module/method, resolved against the live tree
//   ::logs[GatedService.Auth]       ← name the service
//   ::logs{service=TestService}     ← or say it as an attribute
//
// Lazily loaded: LogAnalyzer pulls in the whole log table + dashboard, and a document that doesn't
// mention logs shouldn't pay for it.
const InlineLogs = React.lazy(() => import("../../../organisms/InlineLogs/InlineLogs"));

const LogsEmbed = ({ label, attrs = {} }) => {
  const scope = useMarkdownScope();
  const { connectedServices = [] } = useContext(ServiceContext);

  const target = useMemo(() => {
    const named = (label || attrs.of || "").trim();
    if (named) {
      const parsed = parseTarget(named, scope);
      const found = resolveNamespace(parsed, connectedServices);
      if (found) return found;
      return parsed || {};
    }
    return {
      projectCode: attrs.project || scope.projectCode,
      serviceId: attrs.service || scope.serviceId,
      moduleName: attrs.module || scope.moduleName,
      methodName: attrs.method || scope.methodName,
    };
  }, [label, attrs.of, attrs.project, attrs.service, attrs.module, attrs.method, scope, connectedServices]);

  // Same fallback the other embeds use: a document with no project of its own (the hub, a help topic)
  // shows the first connected project rather than nothing.
  const projectCode = target.projectCode || (connectedServices.length ? connectedServices[0].projectCode : null);
  if (!projectCode) return <div className="md-embed md-embed--dead">::logs — no project in scope</div>;

  const where = [target.serviceId, target.moduleName, target.methodName].filter(Boolean).join(".");
  return (
    <div className="md-embed md-embed--logs">
      <div className="md-embed__head">
        <span className="md-embed__kind">logs</span>
        <span className="md-embed__title">{where || projectCode}</span>
        <span className="md-embed__scope">{projectCode}</span>
      </div>
      <div className="md-embed__logs-body">
        <Suspense fallback={<div className="report-chart-empty">loading logs…</div>}>
          <InlineLogs
            projectCode={projectCode}
            serviceId={target.serviceId}
            moduleName={target.moduleName}
            methodName={target.methodName}
            // `::logs{limit=50}` — a document usually wants a readable tail, not the whole ring
            // buffer. Default lower than the Logs tab's 1000 for the same reason.
            limit={Number(attrs.limit) > 0 ? Number(attrs.limit) : 200}
          />
        </Suspense>
      </div>
    </div>
  );
};

export default LogsEmbed;
