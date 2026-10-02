import React from "react";
import { useHistory, useParams } from "react-router-dom";
import { useMarkdownScope } from "../context";
import { onCodePage, openReportInPanel } from "../openRef";

// `:report[.systemview/report.<pc>.<Name>.md]{title="…"}` — a chip that OPENS a report. A report is
// just a file plus an index entry, so off the Code page it opens the way any other file does: in
// the side panel this page owns, leaving you on the page you were reading. It used to push
// `tab=reports&rdoc=<path>` from wherever you stood, which is the defect in his words — *"they
// shouldn't be navigating me back to the code tab"*. That URL is still where the chip lands on the
// Code page, and still the fallback when no panel answers. The rule is in ../openRef.js.
const ReportLink = ({ label, attrs = {} }) => {
  const history = useHistory();
  const params = useParams();
  const scope = useMarkdownScope();
  const path = (label || attrs.path || "").trim();

  // The path names its own project (`report.<projectCode>.<slug>.md`) — that beats the reading
  // scope, so a chip can point across projects; an explicit attr beats everything.
  const fromPath = (path.match(/report\.([^.]+)\./) || [])[1];
  const projectCode =
    attrs.project || fromPath || (scope && scope.projectCode) || params.projectCode;

  // Display name: explicit title, else the filename slug de-slugged.
  const slug = (path.split("/").pop() || "").replace(/^report\.[^.]+\./, "").replace(/\.md$/, "");
  const title = attrs.title || slug.replace(/-/g, " ") || path;

  if (!path || !projectCode) {
    return (
      <span className="md-chip md-chip--report md-chip--dead" title="A :report chip needs the report file's path">
        <span className="md-chip__kind">report</span>
        {title || "report"}
      </span>
    );
  }

  const search = new URLSearchParams({ tab: "reports", rdoc: path });
  const to = { pathname: `/specs/${projectCode}`, search: `?${search.toString()}` };
  const go = (e) => {
    e.preventDefault();
    e.stopPropagation();
    // The side panel first, everywhere but Code — and only a panel that actually answered counts.
    if (!onCodePage() && openReportInPanel({ projectCode, path })) return;
    history.push(to);
  };

  return (
    <a
      className="md-chip md-chip--report"
      href={`/specs/${projectCode}?${search.toString()}`}
      onClick={go}
      title={`Open the report "${title}"`}
    >
      <span className="md-chip__kind">report</span>
      {title}
    </a>
  );
};

export default ReportLink;
