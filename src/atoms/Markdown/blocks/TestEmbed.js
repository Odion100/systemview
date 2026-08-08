import React, { Suspense, useContext } from "react";
import ServiceContext from "../../../ServiceContext";
import { useMarkdownScope } from "../context";

// RFC-025 §4.2 — `::test{Math.chainUse}` · `::test{GatedService.Auth.getSession}` · `::test{Math.add:1}`
//
// A SAVED TEST, runnable in place, inside a document. This is not a new runner: it renders the exact
// component the story test panes render, so a story test pane is literally this block with a frame
// around it. Two consequences worth stating — the test stays the single source of truth (edit it in
// the Test Panel and every document that embeds it follows), and a doc example is either green right
// now or visibly broken.
//
// Lazily imported to break a real cycle: TestPane renders agent notes through Markdown, and Markdown
// dispatches to this block.
const TestPane = React.lazy(() => import("../../../organisms/Stage/TestPane"));

// `Service.Module.method`, `Module.method`, or a bare `Module` (all its tests). A trailing `:N` pins
// one test by index — same grammar the story `--test` flag uses.
function parseTarget(label, scope) {
  const raw = String(label || "").trim();
  const m = raw.match(/^(.*?):(\d+)$/);
  const spec = m ? m[1] : raw;
  const index = m ? parseInt(m[2], 10) : undefined;
  const segs = spec.split(".").filter(Boolean);
  const base = { index };
  if (segs.length >= 3) return { ...base, serviceId: segs[0], moduleName: segs[1], methodName: segs[2] };
  if (segs.length === 2) return { ...base, serviceId: scope.serviceId, moduleName: segs[0], methodName: segs[1] };
  if (segs.length === 1) return { ...base, serviceId: scope.serviceId, moduleName: segs[0] };
  return null;
}

const TestEmbed = ({ label, attrs = {} }) => {
  const scope = useMarkdownScope();
  const { connectedServices = [] } = useContext(ServiceContext);
  // Same fallback as ::chart — a help topic has no project in scope, but the test it names is still
  // perfectly resolvable against whatever is connected.
  const firstProject = connectedServices.length ? connectedServices[0].projectCode : null;
  const projectCode = attrs.project || scope.projectCode || firstProject;
  const target = parseTarget(label || attrs.of || "", scope);

  if (!target || !projectCode)
    return <div className="md-embed md-embed--dead">::test — no test named</div>;

  // Resolve the service the same way a `:ns[…]` chip does: an unqualified module can live on any
  // service in the project.
  let serviceId = target.serviceId;
  if (!serviceId) {
    const owner = connectedServices.find(
      (s) =>
        s.projectCode === projectCode &&
        ((s.system && s.system.connectionData && s.system.connectionData.modules) || []).some(
          (m) => m.name === target.moduleName
        )
    );
    serviceId = owner && owner.serviceId;
  }

  const nsLabel = [serviceId, target.moduleName, target.methodName].filter(Boolean).join(".");
  return (
    <div className="md-embed md-embed--test">
      <div className="md-embed__head">
        {/* The CONTAINER, not the artifact — the card below already carries the `test` badge, and
            the two saying the same word was the same mistake the run block had. */}
        <span className="md-embed__kind">saved test</span>
        <span className="md-embed__title">{nsLabel}</span>
        <span className="md-embed__scope">{projectCode}</span>
      </div>
      <Suspense fallback={<div className="report-chart-empty">loading test…</div>}>
        <TestPane target={{ ...target, serviceId }} projectCode={projectCode} />
      </Suspense>
    </div>
  );
};

export default TestEmbed;
