import React, { useContext, useEffect, useState, useCallback, useRef } from "react";
import ServiceContext from "../../ServiceContext";
import loadServiceWithHeaders from "../../utils/loadService";
import Markdown from "../../atoms/Markdown/Markdown";
import { SavedTestItem } from "../SavedTests/SavedTests";
import { resolveTestActions, getActionMap } from "../SavedTests/transformTests";

// RFC-018 — the `test` pane: a saved test rendered as a worked example — setup → call → args →
// response → the assertions that pin it — with a Run button and inline pass/fail. It reuses the
// existing SavedTests organism (which already does story-render + run + validation), scoped to the
// one (or few) tests the pane's target names. The test IS the example: how the method is really used.
const TestPane = ({ target = {}, projectCode, ranFile = null }) => {
  const { connectedServices } = useContext(ServiceContext);
  const { serviceId, moduleName, methodName, index, title, note } = target;
  const [tests, setTests] = useState([]);
  const [error, setError] = useState(null);
  // RFC-029 already-ran: a run file (written by an agent from a CLI run) whose recorded results
  // hydrate each matching test below — displayed as ran, without running.
  const [runData, setRunData] = useState(null);
  const [results, setResults] = useState({});
  const [filter, setFilter] = useState(null); // null | "pass" | "fail" — click the summary to filter
  const storyRefs = useRef([]);

  // Tests at ANY namespace level: a specific service when serviceId is given, else EVERY service in the
  // project (a project-wide pane merges each service's own tests). The plugin narrows by module/method
  // and only ever returns its own service's tests, so "all tests under a service / module / method" is
  // just which namespace fields we pass down.
  const projectServices = connectedServices.filter((s) => s.projectCode === projectCode);
  const targetServices = serviceId
    ? projectServices.filter((s) => s.serviceId === serviceId)
    : projectServices;

  const fetchTests = useCallback(async () => {
    if (!targetServices.length) { setError("service not connected"); return; }
    try {
      // RFC-020 — one PROJECT-WIDE action map (every service's actions merged, like the CLI's
      // getActionMap): a `{ use }` in any test resolves no matter which service the action was saved on.
      let resolve = () => null;
      try {
        const map = await getActionMap(projectServices);
        resolve = (name) => map[name] || null;
      } catch {}
      const perService = await Promise.all(
        targetServices.map(async (s) => {
          const svc = loadServiceWithHeaders(s.system.connectionData, s.headers, s.credentials);
          const Plugin = svc && svc.Plugin;
          if (!Plugin) return [];
          try {
            const list = (await Plugin.getTests({ moduleName, methodName })) || [];
            return list.map((t) => resolveTestActions(t, resolve));
          } catch { return []; }
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

  useEffect(() => {
    if (!ranFile || !targetServices.length) return;
    let live = true;
    (async () => {
      try {
        const svc = loadServiceWithHeaders(
          targetServices[0].system.connectionData,
          targetServices[0].headers,
          targetServices[0].credentials,
        );
        const res = await svc.Plugin.readFile({ path: ranFile });
        if (live) setRunData(JSON.parse(res.content));
      } catch {
        if (live) setRunData(null); // a missing/bad run file just means: not pre-ran
      }
    })();
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ranFile, targetServices.length]);

  // The recorded entry per test — matched by namespace (+ title when both sides have one).
  // MEMOIZED as a list: a fresh object identity every render would re-trigger hydration and make
  // a cleared test spring back to recorded.
  const recordedList = React.useMemo(() => {
    if (!runData) return [];
    return tests.map((t) => {
      const ns = t.namespace || {};
      const hit = (runData.tests || []).find(
        (r) =>
          r.serviceId === ns.serviceId &&
          r.moduleName === ns.moduleName &&
          r.methodName === ns.methodName &&
          (!t.title || !r.title || r.title === t.title),
      );
      return hit ? { ...hit, ranAt: runData.ranAt } : null;
    });
  }, [runData, tests]);

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
  // Auto-track (persisted): auto-scroll to whichever test is running during a run-all.
  const [autoTrack, setAutoTrack] = useState(
    () => localStorage.getItem("sv.paneAutoTrack") === "true",
  );
  useEffect(() => {
    localStorage.setItem("sv.paneAutoTrack", String(autoTrack));
  }, [autoTrack]);
  // Expand/collapse EVERY test card in the pane — same affordance the scratchpad toolbar has.
  const [allOpen, setAllOpen] = useState(false);
  const toggleExpandAll = useCallback(() => {
    const next = !allOpen;
    storyRefs.current
      .filter(Boolean)
      .forEach((r) => (next ? r.expand && r.expand() : r.collapse && r.collapse()));
    setAllOpen(next);
  }, [allOpen]);

  // RFC-029 `act` — a doc pane CLAIMS a matching test act synchronously (detail.claimed), so the
  // run happens HERE, in the document the human is looking at; the scratchpad's saved area defers
  // a beat and yields to any claim. "all" runs this pane's whole list in sequence.
  useEffect(() => {
    const onAct = (e) => {
      const d = (e && e.detail) || {};
      if (d.kind !== "test" || !d.target) return;
      // "all" is NOT a pane's to claim — it means the saved-tests area runs the whole project's
      // list; a doc pane only answers for tests it actually shows.
      if (d.target === "all") return;
      const i = tests.findIndex((t) => {
        const ns = t.namespace || {};
        const full = [ns.serviceId, ns.moduleName, ns.methodName].filter(Boolean).join(".");
        return full === d.target || full.endsWith(`.${d.target}`) || t.title === d.target;
      });
      const ref = i > -1 && storyRefs.current[i];
      if (!ref) return;
      d.claimed = true;
      if (ref.expand) ref.expand();
      if (ref.run) ref.run();
    };
    window.addEventListener("sv:act", onAct);
    return () => window.removeEventListener("sv:act", onAct);
  }, [tests, runAllSeq]);

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
      {/* Agent-authored markdown that travels WITH this test block. Only renders when present. */}
      {note ? <div className="test-pane__note"><Markdown children={note} scope={{ projectCode, serviceId: target.serviceId, moduleName: target.moduleName, methodName: target.methodName }} /></div> : null}
      {tests.length > 1 && (
        <div className="test-pane__bar">
          <span className="test-pane__bar-left">
            <label
              className="test-pane__auto"
              title="Auto-track: auto-scroll to the running test. It waits, eases, and gives up the moment you scroll. (It does NOT auto-expand.)"
            >
              <input
                type="checkbox"
                checked={autoTrack}
                onChange={(e) => setAutoTrack(e.target.checked)}
              />
              auto-track
            </label>
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
          </span>
          <button
            type="button"
            className="test-pane__clear"
            title={allOpen ? "Collapse all tests" : "Expand all tests"}
            onClick={toggleExpandAll}
          >
            {allOpen ? "⊟" : "⊞"}
          </button>
          <button type="button" className="test-pane__clear" onClick={clearAllSeq}>
            Clear
          </button>
          <button type="button" className="test-pane__run-all" onClick={runAllSeq}>
            ▶ Run all {tests.length}
          </button>
        </div>
      )}
      {/* The tests render as the SAME white card components the scratchpad's Saved tests use — but here in
          a GRAY flex-wrap grid: each card has a comfortable width and they SPREAD across when the pane is
          wide (wrapping to more rows) and collapse to a single column when the pane is narrow. Edit/Delete
          are omitted (a story shows + runs a test; it isn't the builder). */}
      <div className="test-pane__grid">
        {tests.map((t, i) => (
          <SavedTestItem
            key={i}
            test={t}
            index={typeof index === "number" ? index : i}
            status={results[i]}
            hidden={filter && results[i] !== filter}
            connectedServices={projectServices}
            storyRef={(el) => { storyRefs.current[i] = el; }}
            onResult={(status) => onResult(i, status)}
            autoTrack={autoTrack}
            recorded={recordedList[i] || null}
          />
        ))}
      </div>
    </div>
  );
};

export default TestPane;
