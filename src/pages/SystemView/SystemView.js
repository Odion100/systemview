import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import SystemNavigator from "../../organisms/SystemNavigator/SystemNavigator";
import Documentation from "../../organisms/Documentation/Documentation";
import TestPanel from "../../organisms/TestPanel/TestPanel";
import PageHeader from "../../organisms/PageHeader/PageHeader";
import "./styles.scss";

const SystemViewPage = () => {
  const { projectCode, serviceId, moduleName, methodName } = useParams();
  // Both side panels de-expand into their corners so the middle (Stories/Docs) gets the space.
  // The open/collapsed state PERSISTS across refresh (localStorage) — you get the layout back exactly.
  const [navOpen, setNavOpen] = useState(
    () => localStorage.getItem("sv.navOpen") !== "false",
  );
  const [scratchOpen, setScratchOpen] = useState(
    () => localStorage.getItem("sv.scratchOpen") !== "false",
  );
  useEffect(() => {
    localStorage.setItem("sv.navOpen", String(navOpen));
  }, [navOpen]);
  useEffect(() => {
    localStorage.setItem("sv.scratchOpen", String(scratchOpen));
  }, [scratchOpen]);
  return (
    <section className="system-viewer">
      <PageHeader projectCode={projectCode} current="specs" />
      <div className="row">
        {/* Left navigator — collapses into the LEFT corner (its handle sits by "Load Service"). */}
        <div
          className={`nav-panel ${navOpen ? "col-3 nav-panel--open" : "nav-panel--collapsed"}`}
        >
          {!navOpen && (
            <button
              type="button"
              className="nav-panel__toggle"
              title="Expand the navigator"
              onClick={() => setNavOpen(true)}
            >
              Navigator ›
            </button>
          )}
          <div
            className="nav-panel__body"
            style={{ display: navOpen ? "block" : "none" }}
          >
            <SystemNavigator
              projectCode={projectCode}
              serviceId={serviceId}
              moduleName={moduleName}
              methodName={methodName}
              onCollapse={() => setNavOpen(false)}
            />
          </div>
        </div>

        {/* Middle fills whatever the two side panels give back. Margin only when a side is collapsed,
            so its corner tab doesn't hover over the center. */}
        <div
          className={`center-panel col-${12 - (navOpen ? 3 : 0) - (scratchOpen ? 3 : 0)} ${!navOpen ? "center-panel--nav-collapsed" : ""} ${!scratchOpen ? "center-panel--scratch-collapsed" : ""}`}
        >
          <Documentation
            projectCode={projectCode}
            serviceId={serviceId}
            moduleName={moduleName}
            methodName={methodName}
          />
        </div>

        {/* Right scratchpad — collapses into the RIGHT corner (its handle sits by "Scratch Pad"). */}
        <div
          className={`scratchpad ${scratchOpen ? "col-3 scratchpad--open" : "scratchpad--collapsed"}`}
        >
          {!scratchOpen && (
            <button
              type="button"
              className="scratchpad__toggle"
              title="Expand the scratchpad"
              onClick={() => setScratchOpen(true)}
            >
              ‹ Scratchpad
            </button>
          )}
          <div
            className="scratchpad__body"
            style={{ display: scratchOpen ? "block" : "none" }}
          >
            <TestPanel
              projectCode={projectCode}
              serviceId={serviceId}
              moduleName={moduleName}
              methodName={methodName}
              onCollapse={() => setScratchOpen(false)}
            />
          </div>
        </div>
      </div>
    </section>
  );
};

export default SystemViewPage;
