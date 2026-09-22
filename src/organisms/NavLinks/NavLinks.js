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

  // STATS FOLLOWED LOGS OFF THE TOP NAV, and for the same reason plus a better one. Logs left
  // because they belong to a namespace, not to a section of the app. Stats left because this stopped
  // being a viewer for SystemLynx services: it is an IDE, the top nav says WHERE YOU ARE — Code,
  // Agents — and stats is a thing ABOUT A PROJECT, which makes it the codebase card's business. It
  // is reached from the `services` row now, beside `logs`, and opens as a center tab.
  //
  // THE ROUTE STAYS. /reports/:projectCode still works: saved links, RFC-032's agent `nav`, and the
  // page itself are untouched. Taking a link off a nav is not the same as retiring a destination.
  const links = [
    // "Code", not "Specs" (his call). The page stopped being a spec browser a long time ago — it is
    // where the codebase, the file, the diff and the terminal live. The ROUTE stays /specs: renaming
    // a label is a word, renaming a route breaks every link anyone ever saved.
    { key: "specs", to: remember("specs", projectCode ? `/specs${pc}` : "/specs"), label: "Code" },
    { key: "context", to: remember("context", projectCode ? `/context${pc}` : "/context"), label: "Agents" },
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
