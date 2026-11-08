import React from "react";
import { projectOf } from "../../../utils/effectiveProject";
import { useHistory, useParams } from "react-router-dom";
import { useMarkdownScope, useInDocument } from "../context";
import { onCodePage, openReportInPanel } from "../openRef";
import { useBlockFailure } from "../blockFailure";

// `:report[.systemview/report.<pc>.<Name>.md]{title="…"}` — a chip that OPENS a report. A report is
// just a file plus an index entry, so off the Code page it opens the way any other file does: in
// the side panel this page owns, leaving you on the page you were reading. It used to push
// `tab=reports&rdoc=<path>` from wherever you stood, which is the defect in his words — *"they
// shouldn't be navigating me back to the code tab"*. That URL is still where the chip lands on the
// Code page, and still the fallback when no panel answers. The rule is in ../openRef.js.
const ReportLink = ({ label, attrs = {} }) => {
  const history = useHistory();
  const inDoc = useInDocument();
  const params = useParams();
  const scope = useMarkdownScope();
  const path = (label || attrs.path || "").trim();

  // The path names its own project (`report.<projectCode>.<slug>.md`) — that beats the reading
  // scope, so a chip can point across projects; an explicit attr beats everything.
  const fromPath = (path.match(/report\.([^.]+)\./) || [])[1];
  // The route segment is the LAST resort and it can be the `@none` sentinel, which resolves to a
  // project that exists nowhere — so the link would open against nothing and report an absence.
  const projectCode =
    attrs.project || fromPath || (scope && scope.projectCode) || projectOf(params.projectCode, typeof window !== "undefined" ? window.location.search : "");

  // Display name: explicit title, else the filename slug de-slugged.
  const slug = (path.split("/").pop() || "").replace(/^report\.[^.]+\./, "").replace(/\.md$/, "");
  const title = attrs.title || slug.replace(/-/g, " ") || path;

  // A DEAD CHIP TELLS THE AGENT THAT WROTE IT — same line ::commit carries, same once-only key.
  const report = useBlockFailure();
  const dead = !path || !projectCode;
  React.useEffect(() => {
    if (dead)
      report({
        kind: "report",
        ref: path || title,
        reason: !path ? "the chip names no report file" : "no project could be resolved for it",
      }).catch(() => {});
  }, [dead, path, title, report]);

  if (dead) {
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
    // BESIDE ONLY INSIDE A DOCUMENT — from the chat this chip shows the report, as it always has.
    if (!onCodePage() && openReportInPanel({ projectCode, path, beside: inDoc })) return;
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
