import React from "react";
import { useHistory, useParams } from "react-router-dom";
import { useMarkdownScope } from "../context";

// `:report[.systemview/report.<pc>.<Name>.md]{title="…"}` — a link straight to a report on the
// Stage tab. A report is just a file plus an index entry; this chip is its URL. Clicking NAVIGATES
// (tab=reports&rdoc=<path>) — unlike :ns/:file there is no reveal-first step, because a report
// link's whole point is "go read this".
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
    history.push(to);
  };

  return (
    <a
      className="md-chip md-chip--report"
      href={`/specs/${projectCode}?${search.toString()}`}
      onClick={go}
      title={`Open the report "${title}" on ${projectCode}'s Stage tab`}
    >
      <span className="md-chip__kind">report</span>
      {title}
    </a>
  );
};

export default ReportLink;
