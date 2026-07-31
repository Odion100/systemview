import React, { useCallback, useEffect, useRef, useState } from "react";
import { Client } from "../../systemClient";
import Count from "../../atoms/Count";
import { EditIcon, XButton } from "../../atoms/RunTestIcon";
import { resetFullTest } from "./transformTests";
import TestStory from "../Stage/TestStory";
import CLEAR_ICON from "../../assets/clear.png";
import "./styles.scss";

window.Client = Client;
const CLASSNAME = "test-saved-section";

// The scratchpad's saved tests now render through the SAME story presentation the Stories panes use
// (TestStory: fold test → phases → actions, per-action pass/fail, JSON args/returns, sentence-form
// evaluations, self-contained Run/Clear). The scratchpad adds the two things a story pane doesn't need —
// Edit (load back into the builder) and Delete — as a hover toolbar in a reserved right gutter.
const SavedTests = ({
  savedTests = [],
  connectedServices,
  setFullTest,
  Plugin,
  fetchTests,
}) => {
  const [results, setResults] = useState({});
  const [filter, setFilter] = useState(null); // null | "pass" | "fail" — click the summary to filter
  // "Auto-track" (default OFF) = auto-SCROLL to the running test only. It does NOT auto-expand — expansion
  // is manual (Expand all / click) or automatic only on a FAILURE. Persisted so the choice sticks.
  const [autoTrack, setAutoTrack] = useState(() => localStorage.getItem("sv.savedAutoTrack") === "true");
  useEffect(() => { localStorage.setItem("sv.savedAutoTrack", String(autoTrack)); }, [autoTrack]);
  const storyRefs = useRef([]);

  // A fresh set of tests resets run state + refs.
  useEffect(() => {
    storyRefs.current = [];
    setResults({});
    setFilter(null);
  }, [savedTests]);

  const onResult = useCallback((i, status) => setResults((r) => ({ ...r, [i]: status })), []);

  // Run-all / Clear-all drive each TestStory via its ref, in SEQUENCE (awaiting each) — the same
  // discipline the Stories panel uses, so shared session/cookies never race across concurrent runs.
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
  const [allExpanded, setAllExpanded] = useState(false);
  const toggleExpandAll = useCallback(() => {
    const next = !allExpanded;
    storyRefs.current.filter(Boolean).forEach((r) => (next ? r.expand && r.expand() : r.collapse && r.collapse()));
    setAllExpanded(next);
  }, [allExpanded]);

  const editTest = (rawTest, index) => {
    const Tests = resetFullTest(
      [rawTest.Before, rawTest.Main, rawTest.Events, rawTest.After],
      connectedServices
    );
    if (Tests[1] && Tests[1][0]) Tests[1][0].index = index; // mark which saved slot we're editing
    setFullTest(Tests);
  };
  const deleteTest = async (index, namespace) => {
    if (Plugin) {
      await Plugin.deleteTest(namespace, index);
      fetchTests();
    }
  };

  const statuses = Object.values(results);
  const passed = statuses.filter((s) => s === "pass").length;
  const failed = statuses.filter((s) => s === "fail").length;
  const running = statuses.some((s) => s === "running");

  // Nothing saved on this namespace ⇒ show nothing at all (no empty "Saved" shell / empty second row).
  if (!savedTests.length) return null;

  return (
    <section className={`${CLASSNAME}`}>
      {/* No collapsible "Saved (N)" anymore — the tests always show. Just a small always-visible toolbar. */}
      <div className={`${CLASSNAME}__header2`}>
        {/* Row 1: the section buttons. */}
        <div className={`${CLASSNAME}__hrow`}>
          <span className={`${CLASSNAME}__label`}>
            Saved tests <Count count={savedTests.length} />
          </span>
          <div className={`${CLASSNAME}__controls`}>
            <button
              type="button"
              className={`${CLASSNAME}__icon-btn`}
              title={allExpanded ? "Collapse all" : "Expand all"}
              onClick={toggleExpandAll}
            >
              {allExpanded ? "⊟" : "⊞"}
            </button>
            <button
              type="button"
              className={`${CLASSNAME}__icon-btn`}
              title="Clear all results"
              onClick={clearAllSeq}
            >
              <img className={`${CLASSNAME}__clear-img`} src={CLEAR_ICON} alt="clear" />
            </button>
            <button
              type="button"
              className={`${CLASSNAME}__run-all`}
              onClick={runAllSeq}
            >
              ▶ Run all
            </button>
          </div>
        </div>
        {/* Row 2: the auto-track toggle + the pass/fail summary / running indicator. */}
        <div className={`${CLASSNAME}__hrow ${CLASSNAME}__hrow--sub`}>
          <label
            className={`${CLASSNAME}__auto`}
            title="Auto-track: auto-scroll to the running test. It waits, eases, and gives up the moment you scroll. (It does NOT auto-expand.)"
          >
            <input type="checkbox" checked={autoTrack} onChange={(e) => setAutoTrack(e.target.checked)} />
            auto-track
          </label>
          {(running || passed + failed > 0) && (
            <span className={`${CLASSNAME}__summary`}>
              {running && <span className={`${CLASSNAME}__summary-run`}>running…</span>}
              {passed > 0 && (
                <button
                  type="button"
                  className={`${CLASSNAME}__summary-pass ${filter === "pass" ? "is-active" : ""}`}
                  onClick={() => setFilter((f) => (f === "pass" ? null : "pass"))}
                >
                  ✓ {passed} pass
                </button>
              )}
              {failed > 0 && (
                <button
                  type="button"
                  className={`${CLASSNAME}__summary-fail ${filter === "fail" ? "is-active" : ""}`}
                  onClick={() => setFilter((f) => (f === "fail" ? null : "fail"))}
                >
                  ✗ {failed} fail
                </button>
              )}
            </span>
          )}
        </div>
      </div>

      <div className="test-saved-section__test-container">
        {savedTests.map((test, i) => (
          <SavedTestItem
            key={i}
            test={test}
            index={i}
            status={results[i]}
            hidden={filter && results[i] !== filter}
            connectedServices={connectedServices}
            storyRef={(el) => { storyRefs.current[i] = el; }}
            onResult={(status) => onResult(i, status)}
            onEdit={() => editTest(test, i)}
            onDelete={() => deleteTest(i, test.namespace)}
            autoTrack={autoTrack}
          />
        ))}
      </div>
    </section>
  );
};

// Each saved test is its OWN white card with a PANE-STYLE HEADER (like a story pane): a TEST badge + the
// namespace + status, and the Run / Edit / × buttons moved into that header's right slot. The test body
// renders chromeless below. `autoTrack` = auto-SCROLL only (NOT expand): when on it politely WAITS, EASES,
// and GIVES UP the instant you scroll. Expansion is manual / on-fail only.
function SavedTestItem({ test, index, status, hidden, connectedServices, storyRef, onResult, onEdit, onDelete, autoTrack }) {
  const nodeRef = useRef(null);
  const localRef = useRef(null);
  const [expanded, setExpanded] = useState(false); // collapsed by default — just the header
  const running = status === "running";
  const ran = status === "pass" || status === "fail";
  const failed = status === "fail";
  const ns = test.namespace || {};

  const setRefs = (el) => { localRef.current = el; if (storyRef) storyRef(el); };

  // A FAILED test auto-expands so you can see what broke (a passing one stays collapsed).
  useEffect(() => {
    if (failed) { setExpanded(true); if (localRef.current && localRef.current.expand) localRef.current.expand(); }
  }, [failed]);

  // Auto-track (auto-scroll to the running test). The scroll is scheduled the moment a run STARTS and is
  // NOT tied to the running state — a fast test finishes in <700ms, and if the timer were cleaned up on
  // running→done it would never fire (the "auto-scroll stopped working" bug). So we own the timer here and
  // only cancel it if YOU scroll (wheel/touch/key) or another run supersedes it.
  const wasRunning = useRef(false);
  const pending = useRef(null);
  const clearPending = () => {
    if (pending.current) {
      clearTimeout(pending.current.timer);
      pending.current.off();
      pending.current = null;
    }
  };
  useEffect(() => {
    const started = running && !wasRunning.current;
    wasRunning.current = running;
    if (!started || !autoTrack || !nodeRef.current) return;
    clearPending();
    let cancelled = false;
    const giveUp = () => { cancelled = true; };
    window.addEventListener("wheel", giveUp, { passive: true });
    window.addEventListener("touchmove", giveUp, { passive: true });
    window.addEventListener("keydown", giveUp);
    const off = () => {
      window.removeEventListener("wheel", giveUp);
      window.removeEventListener("touchmove", giveUp);
      window.removeEventListener("keydown", giveUp);
    };
    const timer = setTimeout(() => {
      if (!cancelled && nodeRef.current) {
        // Center it in view (toward eye level), eased — not pinned at the bottom edge.
        nodeRef.current.scrollIntoView({ block: "center", behavior: "smooth" });
      }
      off();
      pending.current = null;
    }, 120); // short — so a run-all KEEPS UP, tracking each test as it becomes the running one
    pending.current = { timer, off };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, autoTrack]);
  useEffect(() => clearPending, []); // clear any pending scroll on unmount

  const toggleFold = () => {
    const next = !expanded;
    setExpanded(next);
    const r = localRef.current;
    if (r) (next ? r.expand : r.collapse)();
  };

  return (
    <div
      ref={nodeRef}
      className={`test-saved-section__item ${status ? `test-saved-section__item--${status}` : ""}`}
      style={hidden ? { display: "none" } : undefined}
    >
      <div className="test-saved-section__phead">
        <button type="button" className="test-saved-section__fold" onClick={toggleFold}>
          <span className="test-saved-section__caret">{expanded ? "▾" : "▸"}</span>
          <span className="test-saved-section__kind">test</span>
          <span className="test-saved-section__ns">
            {ns.serviceId ? `${ns.serviceId}.` : ""}{ns.moduleName}.<b>{ns.methodName}</b>
          </span>
          {running ? (
            <span className="test-saved-section__badge is-running"><span className="test-story__spinner" />running</span>
          ) : ran ? (
            <span className={`test-saved-section__badge ${failed ? "is-fail" : "is-pass"}`}>{failed ? "failed" : "passed"}</span>
          ) : null}
        </button>
        <span className="test-saved-section__phead-actions">
          <EditIcon onClick={onEdit} />
          <DeleteControl onConfirm={onDelete} />
          {ran && (
            <button type="button" className="test-saved-section__hclear" onClick={() => localRef.current && localRef.current.clear()} disabled={running}>
              Clear
            </button>
          )}
          <button type="button" className="test-saved-section__hrun" onClick={() => localRef.current && localRef.current.run()} disabled={running}>
            {running ? "…" : "▶ Run"}
          </button>
        </span>
      </div>
      {test.title && (
        <button type="button" className="test-saved-section__title-row" onClick={toggleFold}>
          {test.title}
        </button>
      )}
      <TestStory
        ref={setRefs}
        chromeless
        test={test}
        connectedServices={connectedServices}
        index={index}
        onResult={onResult}
      />
    </div>
  );
}

// Delete is a two-step confirm so a stray click never nukes a saved test.
function DeleteControl({ onConfirm }) {
  const [confirm, setConfirm] = useState(false);
  if (!confirm) return <XButton onClick={() => setConfirm(true)} />;
  return (
    <span className="test-saved-section__confirm">
      delete?
      <span className="btn test-saved-section__confirm-yes" onClick={() => { onConfirm(); setConfirm(false); }}>yes</span>
      <span className="btn test-saved-section__confirm-no" onClick={() => setConfirm(false)}>no</span>
    </span>
  );
}

export default SavedTests;
