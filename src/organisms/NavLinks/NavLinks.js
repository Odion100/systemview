import React from "react";
import { Link } from "react-router-dom";

// The one nav, shared by every top-level page (Specs / Stories / Logs / Reports) so they all carry the
// same header and you can hop between them from anywhere — instead of the links living only on Specs.
// `current` dims the page you're already on; `projectCode` scopes the per-project links when known.
const NavLinks = ({ projectCode, current }) => {
  const pc = projectCode ? `/${projectCode}` : "";
  const links = [
    { key: "specs", to: projectCode ? `/specs${pc}` : "/specs", label: "Specs" },
    { key: "logs", to: "/logs", label: "Logs" },
    { key: "reports", to: `/reports${pc}`, label: "Stats" },
  ];
  return (
    <div className="nav-links">
      {links.map((l) => (
        <Link
          key={l.key}
          to={l.to}
          className={`logs-nav-link ${current === l.key ? "logs-nav-link--current" : ""}`}
        >
          {l.label}
        </Link>
      ))}
    </div>
  );
};

export default NavLinks;
