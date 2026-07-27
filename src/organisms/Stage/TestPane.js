import React, { useContext, useEffect, useState, useCallback, useRef } from "react";
import ServiceContext from "../../ServiceContext";
import loadServiceWithHeaders from "../../utils/loadService";
import Markdown from "../../atoms/Markdown/Markdown";
import TestStory from "./TestStory";

// RFC-018 — the `test` pane: a saved test rendered as a worked example — setup → call → args →
// response → the assertions that pin it — with a Run button and inline pass/fail. It reuses the
// existing SavedTests organism (which already does story-render + run + validation), scoped to the
// one (or few) tests the pane's target names. The test IS the example: how the method is really used.
const TestPane = ({ target = {}, projectCode }) => {
  const { connectedServices } = useContext(ServiceContext);
  const { serviceId, moduleName, methodName, index, title, note } = target;
  const [tests, setTests] = useState([]);
  const [error, setError] = useState(null);
  const [results, setResults] = useState({});
  const [filter, setFilter] = useState(null); // null | "pass" | "fail" — click the summary to filter
  const storyRefs = useRef([]);

  // Tests at ANY namespace level: a specific service when serviceId is given, else EVERY service in the
  // project (a project-wide pane merges each service's own tests). The plugin narrows by module/method
  // and only ever returns its own service's tests, so "all tests under a service / module / method" is
  // just which namespace fields we pass down.
  const targetServices = serviceId
    ? connectedServices.filter((s) => s.projectCode === projectCode && s.serviceId === serviceId)
    : connectedServices.filter((s) => s.projectCode === projectCode);

  const fetchTests = useCallback(async () => {
    if (!targetServices.length) { setError("service not connected"); return; }
    try {
      const perService = await Promise.all(
        targetServices.map(async (s) => {
          const svc = loadServiceWithHeaders(s.system.connectionData, s.headers, s.credentials);
          const Plugin = svc && svc.Plugin;
          if (!Plugin) return [];
          try { return (await Plugin.getTests({ moduleName, methodName })) || []; }
          catch { return []; }
        }),
      );
      let list = perService.flat();
      // Narrow to the pane's target: an explicit index, else a title match, else the whole namespace.
      if (typeof index === "number") list = list.filter((_, i) => i === index);
      else if (title) list = list.filter((t) => t.title === title);
      setError(null);
      setResults({});
      setFilter(null);
      storyRefs.current = [];
      setTests(list);
    } catch (e) {
      setError(e.message);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectCode, serviceId, moduleName, methodName, index, title, connectedServices]);

  useEffect(() => { fetchTests(); }, [fetchTests]);

  // Each test reports its status up so the Run-all bar can show the aggregate — what passed, what failed.
  const onResult = useCallback((i, status) => setResults((r) => ({ ...r, [i]: status })), []);

  // Run-all runs each test in SEQUENCE (awaiting each) — the exact same discipline as the scratchpad's
  // runAllTests, so there's no drift: shared session/cookies never race across concurrently-run tests.
  const runAllSeq = useCallback(async () => {
    const refs = storyRefs.current.filter(Boolean);
    for (let i = 0; i < refs.length; i++) {
      if (refs[i] && refs[i].run) await refs[i].run();
    }
  }, []);
  const clearAllSeq = useCallback(() => {
    storyRefs.current.filter(Boolean).forEach((r) => r.clear && r.clear());
    setFilter(null);
  }, []);

  const statuses = Object.values(results);
  const passed = statuses.filter((s) => s === "pass").length;
  const failed = statuses.filter((s) => s === "fail").length;
  const running = statuses.some((s) => s === "running");

  if (error) return <div className="pane__status pane__status--error">Couldn’t load test: {error}</div>;
  if (!tests.length) return <div className="pane__status">No matching saved test.</div>;

  // If the pane pinned a specific index, that test IS at position 0 of the filtered list — label it
  // with the real index so the story header shows "#N".
  return (
    <div className="test-pane">
      {/* Agent-authored markdown that travels WITH this test block — the agent's narrative for it.
          Only renders when present, so an ordinary test looks exactly as it did (no note, no diff). */}
      {note ? <div className="test-pane__note"><Markdown children={note} /></div> : null}
      {tests.length > 1 && (
        <div className="test-pane__bar">
          {/* Aggregate of a run-all — what passed / failed across the whole set, right on the bar. */}
          {(running || passed + failed > 0) && (
            <span className="test-pane__summary">
              {running && <span className="test-pane__summary-run">running…</span>}
              {/* Click a count to filter the list to just those; click again to clear. */}
              {passed > 0 && (
                <button
                  type="button"
                  className={`test-pane__summary-pass ${filter === "pass" ? "is-active" : ""}`}
                  onClick={() => setFilter((f) => (f === "pass" ? null : "pass"))}
                >
                  ✓ {passed} passed
                </button>
              )}
              {failed > 0 && (
                <button
                  type="button"
                  className={`test-pane__summary-fail ${filter === "fail" ? "is-active" : ""}`}
                  onClick={() => setFilter((f) => (f === "fail" ? null : "fail"))}
                >
                  ✗ {failed} failed
                </button>
              )}
            </span>
          )}
          <button type="button" className="test-pane__clear" onClick={clearAllSeq}>
            Clear
          </button>
          <button type="button" className="test-pane__run-all" onClick={runAllSeq}>
            ▶ Run all {tests.length}
          </button>
        </div>
      )}
      {tests.map((t, i) => {
        // Filter by result — hide (don't unmount, so run state survives) the tests that don't match.
        const hidden = filter && results[i] !== filter;
        return (
          <div key={i} style={hidden ? { display: "none" } : undefined}>
            <TestStory
              ref={(el) => { storyRefs.current[i] = el; }}
              test={t}
              connectedServices={connectedServices}
              index={typeof index === "number" ? index : i}
              onResult={(status) => onResult(i, status)}
            />
          </div>
        );
      })}
    </div>
  );
};

export default TestPane;
