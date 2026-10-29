import React from "react";
import LifecycleTrail from "./lifecycle";

// RFC-073 §1.2 — `::report{id=subscribe-and-registration}` at the top of a document.
//
// IT MAKES THE DOCUMENT A REPORT, wherever it lives. Reports were a kind only because they sat in
// `.systemview/` and matched `report.*.md` — `bandTabs.js` says so itself: *"only because it lives in
// `.systemview`, not because the word 'report' means anything to the band."* With the leaf, the
// word means something: this document says it is one.
//
// `show()` writes this leaf when it files a report, so no skill has to remember to — that is
// registration path 2 of the five in RFC-073 §4. Identity only; nothing to press.
// THE LEAF IS THE TRAIL (2026-10-28) — identity at the periphery, the lifecycle as the body.
const Report = ({ attrs = {}, line }) => (
  <div className="md-arc md-report">
    <span className="md-arc__who">
      <span className="md-arc__kind">report</span>
      <span className="md-arc__id">{attrs.id || "report"}</span>
      {attrs.title ? <span className="md-arc__title">{attrs.title}</span> : null}
      {attrs.as ? <span className="md-arc__relation">{attrs.as}</span> : null}
    </span>
    {/* A report is never done; it is filed or retired. */}
    <LifecycleTrail kind="report" id={attrs.id} line={line} attrs={attrs} />
  </div>
);

export default Report;
