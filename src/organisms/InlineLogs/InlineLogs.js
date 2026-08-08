import React, { useState, useContext, useEffect, useCallback } from "react";
import ServiceContext from "../../ServiceContext";
import { Client } from "../../systemClient";
import LogAnalyzer from "../LogAnalyzer/LogAnalyzer";

// The logs viewer for a namespace — the Logs tab's body, and (since it lives here rather than inside
// Documentation.js) the thing a `::logs` block embeds in a document. It was extracted for exactly the
// reason the charts were: a component trapped inside a page can't be embedded without importing the
// page, and Documentation.js imports the markdown renderer, so that would be a cycle.
// Logs render in ONE commit, deliberately. A chunked rollout was tried and reverted: it made the
// table arrive in visible waves and fought the analyzer's own filtering/scrolling for no gain you
// could feel. `limit` is the control that matters — ask for fewer rows, don't dribble out the same
// number slowly.
export default function InlineLogs({ projectCode, serviceId, moduleName, methodName, limit = 1000 }) {
  const { connectedServices } = useContext(ServiceContext);
  const [entries, setEntries] = useState([]);
  const [live, setLive] = useState(false); // auto-refresh (poll) off by default — opt-in monitor
  const [armClear, setArmClear] = useState(false); // two-step confirm for Clear logs (no window.confirm)

  const loadLogs = useCallback(async () => {
    // Which services to pull logs from: a specific service when one is selected, else EVERY service in
    // the project — so the PROJECT level shows all logs (the old code looked a service up by an undefined
    // serviceId, found none, and showed nothing at the top namespace).
    const targets = serviceId
      ? connectedServices.filter((s) => s.projectCode === projectCode && s.serviceId === serviceId)
      : connectedServices.filter((s) => s.projectCode === projectCode);
    if (!targets.length) { setEntries([]); return; }
    try {
      const perService = await Promise.all(
        targets.map(async (s) => {
          try {
            const { SystemView } = Client.createService(s.system.connectionData);
            // Pull enough history to cover a whole test run — each call writes a start AND an end line, so a
            // full run is several hundred lines; the old limit of 100 evicted the earliest tests (you'd run
            // all tests and the FIRST one's log was already gone). getLog returns the newest N.
            const result = await SystemView.getLog({ limit: 2000 });
            if (!Array.isArray(result)) return [];
            return result.map((e) => ({ ...e, serviceId: e.serviceId || s.serviceId }));
          } catch {
            return [];
          }
        })
      );
      // Each service now owns its OWN log file (systemview.<serviceId>.logs), so getLog returns only that
      // service's records — aggregating across services just merges distinct sets, no duplication possible.
      let all = perService.flat();
      if (methodName && moduleName) {
        all = all.filter((e) => e.moduleMethod === `${moduleName}.${methodName}`);
      } else if (moduleName) {
        all = all.filter((e) => e.moduleMethod && e.moduleMethod.startsWith(`${moduleName}.`));
      }
      // Cap to the newest 1000 across services, then present OLDEST→NEWEST (newest at the bottom) so it
      // matches the Logs page and the monitor can auto-scroll down to follow incoming entries.
      all.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)); // newest first…
      // `limit` is the ceiling — the Logs tab keeps its 1000, but a `::logs{limit=50}` block in a
      // document asks for a readable slice instead of a wall.
      all = all.slice(0, Math.max(1, limit)).reverse(); // …then flip so the newest sit at the bottom
      setEntries(all);
    } catch {
      setEntries([]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectCode, serviceId, moduleName, methodName, connectedServices, limit]);


  // Wipe stored logs. Logs are stored PER SERVICE, so this is scope-aware: at the service level it clears
  // THIS service's log; at the project level it clears every service in the project. Guarded by a two-step
  // in-UI confirm (the Clear-logs button arms first) — NO window.confirm dialog.
  const clearLogs = useCallback(async () => {
    const targets = serviceId
      ? connectedServices.filter((s) => s.projectCode === projectCode && s.serviceId === serviceId)
      : connectedServices.filter((s) => s.projectCode === projectCode);
    await Promise.all(
      targets.map(async (s) => {
        try {
          const { SystemView } = Client.createService(s.system.connectionData);
          await SystemView.clearLog();
        } catch {
          /* ignore */
        }
      })
    );
    setEntries([]);
    setArmClear(false);
  }, [connectedServices, projectCode, serviceId]);

  // Clear IMMEDIATELY on a namespace switch so the previous scope's logs never linger while the new set
  // loads (the "logs don't clear when you switch" bug). Also drop out of Monitor and disarm Clear — those
  // are per-scope choices, they should not carry across a navigation.
  useEffect(() => {
    setEntries([]);
    setLive(false);
    setArmClear(false);
  }, [projectCode, serviceId, moduleName, methodName]);

  // Load once on scope change; auto-refresh every 5s only while "live" (the monitor toggle). The follow-
  // scroll + new-entry flash live inside LogAnalyzer (it owns the scrolling table body), driven by `follow`.
  useEffect(() => {
    loadLogs();
    if (!live) return undefined;
    const timer = setInterval(loadLogs, 5000);
    return () => clearInterval(timer);
  }, [loadLogs, live]);

  return (
    <div className="inline-logs">
      {/* The full Logs analyzer (field filter/highlight + frequency dashboard + JSON/table), scoped to the
          current namespace's entries. Refresh + Monitor ride in the analyzer's toolbar. Keyed by the
          namespace so switching location REMOUNTS it — the filters/analyzers reset for the new scope. */}
      <LogAnalyzer
        key={`${projectCode || ""}/${serviceId || ""}/${moduleName || ""}/${methodName || ""}`}
        entries={entries}
        follow={live}
        toolbarExtras={
          <>
            <button className="logs-viewmode__btn" title="Refresh now" onClick={loadLogs}>
              ↻ Refresh
            </button>
            <button
              className={`logs-monitor-btn${live ? " logs-monitor-btn--on" : ""}`}
              title={live ? "Monitoring — auto-refreshing (click to pause)" : "Paused (click to monitor)"}
              onClick={() => setLive((l) => !l)}
            >
              {live ? "● Monitor" : "○ Monitor"}
            </button>
            {/* Clearing wipes logs on the services themselves. Logs are stored PER SERVICE, so it's offered
                at the SERVICE level (clears that service) AND the PROJECT level (clears every service) — but
                not at module/method, where a clear would surprise you by wiping the whole service. Two-step
                confirm (arm, then confirm) instead of a browser dialog, matching the saved-test delete. */}
            {projectCode && !moduleName &&
              (armClear ? (
                <span className="logs-clear-confirm">
                  Clear {serviceId || "all"} logs?
                  <button className="logs-clear-btn logs-clear-btn--yes" onClick={clearLogs}>
                    yes
                  </button>
                  <button className="logs-clear-btn logs-clear-btn--no" onClick={() => setArmClear(false)}>
                    no
                  </button>
                </span>
              ) : (
                <button
                  className="logs-clear-btn"
                  title={serviceId ? `Clear logs for ${serviceId}` : "Clear all logs for this project"}
                  onClick={() => setArmClear(true)}
                >
                  Clear logs
                </button>
              ))}
          </>
        }
      />
    </div>
  );
}
