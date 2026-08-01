import React, { useEffect } from "react";
import { Link, useLocation } from "react-router-dom";

// The one nav, shared by every top-level page (Specs / Logs / Stats). `current` dims the page you're on;
// `projectCode` scopes the default per-project links when known.
//
// It also REMEMBERS where you were in each section: as you move around, the current section's full URL
// (path + query, so the Specs tab is included) is stored, and each nav link points at that section's
// last-visited URL. So hopping Specs → Logs → Specs drops you back exactly where you were — same
// namespace, same tab — instead of resetting to the top of the section.
const KEY = (section) => `sv.lastPath.${section}`;
const remember = (section, fallback) => {
  try {
    return localStorage.getItem(KEY(section)) || fallback;
  } catch {
    return fallback;
  }
};

const NavLinks = ({ projectCode, current }) => {
  const location = useLocation();
  const pc = projectCode ? `/${projectCode}` : "";

  useEffect(() => {
    try {
      localStorage.setItem(KEY(current), location.pathname + location.search);
    } catch {
      /* ignore */
    }
  }, [current, location.pathname, location.search]);

  // Logs are no longer a standalone page — they live in the Specs page's per-namespace Logs tab, so the
  // top nav is just Specs + Stats now.
  const links = [
    { key: "specs", to: remember("specs", projectCode ? `/specs${pc}` : "/specs"), label: "Specs" },
    { key: "reports", to: remember("reports", `/reports${pc}`), label: "Stats" },
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
