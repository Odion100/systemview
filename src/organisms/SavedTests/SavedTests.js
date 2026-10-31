import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Client } from "../../systemClient";
import Count from "../../atoms/Count";
import { EditIcon, XButton } from "../../atoms/RunTestIcon";
import { resetScratchpad } from "./transformTests";
import TestStory from "../Stage/TestStory";
import Help from "../../atoms/Help/Help";
import "./styles.scss";

window.Client = Client;
const CLASSNAME = "test-saved-section";

// The scratchpad's saved tests now render through the SAME story presentation the Stories panes use
// (TestStory: fold test → phases → actions, per-action pass/fail, JSON args/returns, sentence-form
// evaluations, self-contained Run/Clear). The scratchpad adds the two things a story pane doesn't need —
// Edit (load back into the builder) and Delete — as a hover toolbar in a reserved right gutter.
// `label` / `helpTopic` / `editable` / `emptyNote` exist so this section can be the PROOFS list too,
// rather than the proofs growing a second list that does the same job slightly differently. His
// question, asked twice and right both times: "why isn't the proof area very similar with the
// components, with the behavior?" It should not be similar — it should be this.
//
// `editable: false` simply withholds the edit and delete handlers, and SavedTestItem already draws
// those controls only when it is given them. A collected spec lives in a DOCUMENT, so there is no
// saved slot to edit and no file to delete; offering either would be a button that lies.
const SavedTests = ({
  savedTests = [],
  connectedServices,
  setFullTest,
  Plugin,
  fetchTests,
  label = "Saved tests",
  helpTopic = "saved-tests",
  editable = true,
  emptyNote = null,
  // WHAT THE REUSE MUST NOT ERASE. His note, and it is the right caution about sharing a component:
  // "it still has to have its unique information." A saved test is identified by the namespace it
  // saves under; a PROOF saves nowhere and belongs to a DOCUMENT, so its address — the document and
  // the line its block starts on — is its identity, and dropping it to fit the shared card would
  // leave a list of specs nobody could trace back to what they defend.
  kindLabel = "test",
  kindTone = "test",
  nsLabelOf = null,
  // THE RUN, TOLD TO WHOEVER ELSE IS SHOWING IT. These cards run WINDOW-SIDE — ▶ Run all drives
  // each TestStory in sequence and each reports running → pass/fail — and until now that was the
  // only place in the whole window a spec could be watched running, with nothing outside this
  // list ever hearing about it. As the proofs list, these cards are the same specs a document's
  // plan ledger is drawing dots for, so the caller gets a door to pass each result on.
  //
  // `statusOf` is the other direction: a status this card has not produced itself, from whatever
  // DID run the spec (a hub-side run started from a document). The card's own result wins — it is
  // the live one, happening in front of you — and this fills in when there is none.
  onCardResult = null,
  statusOf = null,
  // SOMEBODY ELSE PRESSED RUN ALL. A document's ▶ is not a second runner — it is this list's own
  // ▶ Run all, asked for from somewhere the button is not. Change this token and the list runs
  // itself, card by card, exactly as a press here would. `onAutoRun` reports back when the
  // sequence is over, because the asker has a surface of its own that has to stop saying "running".
  autoRunKey = null,
  onAutoRun = null,
  // CLEAR IS NOT ONLY THIS LIST'S. These cards' results are mirrored by whatever asked for the
  // run — a document's ledger reading the same marks — so wiping them here has to say so, or the
  // other surface keeps showing a result the board no longer holds.
  onClearAll = null,
  // CLEARED FROM SOMEWHERE ELSE. The same shape as `autoRunKey`: change the token and this list
  // drops its results, so a clear pressed in a document reaches the cards the document is
  // watching rather than only the map it reads.
  clearKey = null,
}) => {
  const [results, setResults] = useState({});
  const [filter, setFilter] = useState(null); // null | "pass" | "fail" — click the summary to filter
  // "Auto-track" (default OFF) = auto-SCROLL to the running test only. It does NOT auto-expand — expansion
  // is manual (Expand all / click) or automatic only on a FAILURE. Persisted so the choice sticks.
  const [autoTrack, setAutoTrack] = useState(() => localStorage.getItem("sv.savedAutoTrack") === "true");
  useEffect(() => { localStorage.setItem("sv.savedAutoTrack", String(autoTrack)); }, [autoTrack]);
  const storyRefs = useRef([]);

  // A FRESH SET OF TESTS RESETS RUN STATE — and "fresh" means DIFFERENT TESTS, not a new array
  // holding the same ones. Keying this on the array's identity made every re-list a reset: the
  // proofs tab re-lists immediately BEFORE it runs (so the scope shown matches what is about to
  // run), which handed this effect a new array and wiped every card's pass/fail a moment before
  // the results arrived. Pressing run in the arc diagram therefore cleared the panel and never
  // refilled it — the run happened, and the surface showed an unrun list beside the word
  // "running…". So the signature is the content: who is in the list, in what order.
  const testsKey = useMemo(
    () =>
      (savedTests || [])
        .map((t) => {
          const ns = t.namespace || {};
          return `${t.__at || ""}|${[ns.serviceId, ns.moduleName, ns.methodName].filter(Boolean).join(".")}|${t.title || ""}`;
        })
        .join("\n"),
    [savedTests]
  );
  // IT DOES NOT CLEAR THE REFS, and that line was the whole of "pressing run in a document does
  // nothing". Ref callbacks fire during COMMIT, before effects — so a render that brought a new
  // list attached every card's ref and then this effect, running immediately after, threw them
  // all away. `runAllSeq` walks `storyRefs.current`; with it emptied there was nothing to drive,
  // the specs sat queued forever, and nothing anywhere said so. React nulls a ref on unmount by
  // itself and `runAllSeq` already filters, so the wipe was never needed.
  useEffect(() => {
    setResults({});
    setFilter(null);
  }, [testsKey]);

  const onResult = useCallback(
    (i, status) => {
      setResults((r) => ({ ...r, [i]: status }));
      if (onCardResult) onCardResult(savedTests[i], status);
    },
    [onCardResult, savedTests]
  );

  // Run-all / Clear-all drive each TestStory via its ref, in SEQUENCE (awaiting each) — the same
  // discipline the Stories panel uses, so shared session/cookies never race across concurrent runs.
  const runAllSeq = useCallback(async () => {
    const refs = storyRefs.current.filter(Boolean);
    for (let i = 0; i < refs.length; i++) {
      if (refs[i] && refs[i].run) await refs[i].run();
    }
  }, []);
  // THE ASK, HONOURED ONCE. Refs attach on render, so the list may be on screen a frame before it
  // can be driven — hence the wait for cards rather than for the token alone. A token already
  // served is never served twice: a re-render with the same one must not re-run the list.
  // NO TIMER AND NO CLEANUP, deliberately. The first version deferred the kick by 60ms to let the
  // card refs attach — and `onAutoRun` is an inline arrow, so every re-render gave this effect a
  // new identity, ran the previous cleanup, and cleared that timer before it ever fired. The run
  // never started, nothing ever reported "done", and the asking surface sat on "running…" for the
  // rest of the session. Refs are attached by the time an effect runs; the wait bought nothing and
  // cost the whole feature.
  const served = useRef(null);
  useEffect(() => {
    if (!autoRunKey || served.current === autoRunKey || !savedTests.length) return;
    served.current = autoRunKey;
    (async () => {
      if (onAutoRun) onAutoRun("started");
      await runAllSeq();
      if (onAutoRun) onAutoRun("done");
    })();
  }, [autoRunKey, savedTests.length, runAllSeq, onAutoRun]);

  const clearCards = useCallback(() => {
    storyRefs.current.filter(Boolean).forEach((r) => r.clear && r.clear());
    setResults({});
    setFilter(null);
  }, []);
  // The press HERE also tells whoever else is showing these results; a clear arriving from there
  // only clears the cards, so the two can never bounce off each other.
  const clearAllSeq = useCallback(() => {
    clearCards();
    if (onClearAll) onClearAll();
  }, [clearCards, onClearAll]);

  const clearedAt = useRef(null);
  useEffect(() => {
    if (!clearKey || clearedAt.current === clearKey) return;
    clearedAt.current = clearKey;
    clearCards();
  }, [clearKey, clearCards]);

  // RFC-029 `act` — the agent presses the same play you would, HERE where tests live: one test
  // (matched by namespace or title) or `all`, results landing in the rows in front of you. The
  // sessionStorage pending survives a navigation the command itself caused — consumed the moment
  // this list can actually see the target.
  const actOn = useCallback(
    async (target) => {
      if (target === "all") {
        runAllSeq();
        return true;
      }
      const i = savedTests.findIndex((t) => {
        const ns = t.namespace || {};
        const full = [ns.serviceId, ns.moduleName, ns.methodName].filter(Boolean).join(".");
        return full === target || full.endsWith(`.${target}`) || t.title === target;
      });
      const ref = i > -1 && storyRefs.current[i];
      if (!ref) return false;
      if (ref.expand) ref.expand();
      if (ref.run) await ref.run();
      return true;
    },
    [savedTests, runAllSeq],
  );
  useEffect(() => {
    let pending = null;
    try { pending = JSON.parse(sessionStorage.getItem("sv.pendingAct")); } catch {}
    if (pending && pending.target && Date.now() - (pending.ts || 0) < 60000 && savedTests.length) {
      // Refs attach on render — give them a beat, then consume only if the target is here.
      setTimeout(async () => {
        if (await actOn(pending.target)) sessionStorage.removeItem("sv.pendingAct");
      }, 150);
    }
    const onAct = (e) => {
      const d = (e && e.detail) || {};
      if (d.kind !== "test" || !d.target) return;
      sessionStorage.removeItem("sv.pendingAct");
      // Defer a beat: a DOC pane showing this test claims the act synchronously during dispatch —
      // the run belongs where the human is looking; this area is the fallback home.
      setTimeout(() => {
        if (!d.claimed) actOn(d.target);
      }, 0);
    };
    window.addEventListener("sv:act", onAct);
    return () => window.removeEventListener("sv:act", onAct);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedTests, actOn]);
  const [allExpanded, setAllExpanded] = useState(false);
  const toggleExpandAll = useCallback(() => {
    const next = !allExpanded;
    storyRefs.current.filter(Boolean).forEach((r) => (next ? r.expand && r.expand() : r.collapse && r.collapse()));
    setAllExpanded(next);
  }, [allExpanded]);

  // A test's save/delete SLOT is its index WITHIN ITS OWN FILE (module.method.json). Aggregated views
  // (module/service/project level) concatenate many files, so the list position is NOT the slot — using
  // it saved copies into (or deleted from) the wrong place. Prefer the plugin-stamped `slot`; fall back
  // to occurrence-order per file key (accurate: aggregation concatenates file-by-file) for services
  // still running an older plugin.
  const fileKey = (t) => {
    const ns = t.namespace || {};
    return `${ns.serviceId}|${ns.moduleName}.${ns.methodName}`;
  };
  const slotOf = (test, i) => {
    if (typeof test.slot === "number") return test.slot;
    let n = 0;
    for (let x = 0; x < i; x++) if (fileKey(savedTests[x]) === fileKey(test)) n++;
    return n;
  };

  const editTest = (rawTest, index) => {
    // RFC-020 — load built-ins AND the test's named-action sections into the scratchpad (one shared
    // sections object so cross-section refs resolve while editing).
    const { Tests, named, order } = resetScratchpad(rawTest, connectedServices);
    if (Tests[1] && Tests[1][0]) {
      Tests[1][0].index = index; // mark which saved slot we're editing…
      Tests[1][0].savedNamespace = rawTest.namespace; // …and which FILE that slot belongs to
    }
    // top-level title → the title input; top-level namespace → the save-target chip; the test's own
    // RUN ORDER → the builder renders exactly that arrangement (RFC-023).
    setFullTest(Tests, named, rawTest.title, rawTest.namespace, order);
  };
  const deleteTest = async (index, namespace) => {
    if (Plugin) {
      await Plugin.deleteTest(namespace, index);
      fetchTests();
    }
  };

  // WHAT EACH CARD IS SHOWING — its own result if it has one, otherwise whatever ran it elsewhere.
  // The local one wins because it is the run happening in front of you; a stale external pass
  // painted over a card you are watching fail is the one way this could lie.
  const statusAt = (i) => results[i] || (statusOf ? statusOf(savedTests[i]) : undefined) || undefined;
  const statuses = savedTests.map((_, i) => statusAt(i)).filter(Boolean);
  const passed = statuses.filter((s) => s === "pass").length;
  const failed = statuses.filter((s) => s === "fail").length;
  const running = statuses.some((s) => s === "running");

  // Nothing saved on this namespace ⇒ show nothing at all (no empty "Saved" shell / empty second row).
  // An empty PROOFS list is a real state worth saying out loud (no run blocks in this document);
  // an empty saved-tests list is just nothing, as before.
  if (!savedTests.length) return emptyNote ? <section className={`${CLASSNAME}`}>{emptyNote}</section> : null;

  return (
    <section className={`${CLASSNAME}`}>
      {/* No collapsible "Saved (N)" anymore — the tests always show. Just a small always-visible toolbar. */}
      <div className={`${CLASSNAME}__header2`}>
        {/* Row 1: the section buttons. */}
        <div className={`${CLASSNAME}__hrow`}>
          <span className={`${CLASSNAME}__label`}>
            {label} <Count count={savedTests.length} />
            <Help topic={helpTopic} />
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
              className={`${CLASSNAME}__ctrl`}
              title="Clear all results"
              onClick={clearAllSeq}
            >
              Clear
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
            status={statusAt(i)}
            hidden={filter && statusAt(i) !== filter}
            connectedServices={connectedServices}
            storyRef={(el) => { storyRefs.current[i] = el; }}
            onResult={(status) => onResult(i, status)}
            onEdit={editable ? () => editTest(test, slotOf(test, i)) : undefined}
            onDelete={editable ? () => deleteTest(slotOf(test, i), test.namespace) : undefined}
            kindLabel={kindLabel}
            kindTone={kindTone}
            nsLabel={nsLabelOf ? nsLabelOf(test) : undefined}
            autoTrack={autoTrack}
            // Only ONE saved test here? Keep its steps expanded on run — collapsing-on-run is only useful
            // when there are MULTIPLE tests (so the list stays scrollable). With one, don't fold it up.
            autoExpand={savedTests.length === 1}
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
// Reused by the Stories `test` pane (TestPane) — there it's rendered WITHOUT onEdit/onDelete (a story just
// shows + runs the test; it isn't the builder), so those controls only appear when the handlers are given.
export function SavedTestItem({ test, index, status, hidden, connectedServices, storyRef, onResult, onEdit, onDelete, autoTrack, autoExpand, kindLabel = "test", kindTone = "test", nsLabel, showTitle = true, recorded = null }) {
  const nodeRef = useRef(null);
  const localRef = useRef(null);
  // Collapsed by default — just the header — EXCEPT when the caller asks for it open: a run block
  // of one step, or one that arrives already ran, has nothing to hide (his catch: "why is the
  // action minimized? nothing else minimizes like that").
  const [expanded, setExpanded] = useState(!!autoExpand);
  const running = status === "running";
  // QUEUED — in scope of a run that has started and whose turn has not come. It only ever arrives
  // from outside (the bus, when a run was started somewhere else), and it has to be visible or a
  // card sitting in a live run is indistinguishable from one nobody asked for.
  const ran = status === "pass" || status === "fail";
  const failed = status === "fail";
  const ns = test.namespace || {};

  // The handle the parent gets wraps expand/collapse so the CARD's caret state stays in sync when a
  // pane-level "expand all" drives the story open/closed (run/clear pass straight through).
  const setRefs = (el) => {
    localRef.current = el;
    if (storyRef)
      storyRef(
        el && {
          ...el,
          expand: () => { setExpanded(true); el.expand(); },
          collapse: () => { setExpanded(false); el.collapse(); },
        },
      );
  };

  // A failed test does NOT force its whole card open — you see it failed from the badge + red edge and
  // open it yourself. When you DO open it, the failed step(s) inside are already expanded (TestStory's
  // actions auto-expand the ones that broke), so you land right on what failed without expanding all.

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
          {/* A saved test is "test <the namespace it saves under>". An AD-HOC RUN is neither — it
              saves nowhere and belongs to no method, so a caller passes its own words (`kindLabel`)
              and `nsLabel={null}` to drop the namespace entirely. Showing the first step's method
              there read as "this run is filed under Math.multiply", which is not a thing. */}
          <span className={`test-saved-section__kind test-saved-section__kind--${kindTone}`}>{kindLabel}</span>
          {nsLabel === null ? null : nsLabel ? (
            <span className="test-saved-section__ns">{nsLabel}</span>
          ) : (
            <span className="test-saved-section__ns">
              {ns.serviceId ? `${ns.serviceId}.` : ""}{ns.moduleName}.<b>{ns.methodName}</b>
            </span>
          )}
          {running ? (
            <span className="test-saved-section__badge is-running"><span className="test-story__spinner" />running</span>
          ) : ran ? (
            <span className={`test-saved-section__badge ${failed ? "is-fail" : "is-pass"}`}>{failed ? "failed" : "passed"}</span>
          ) : null}
        </button>
        <span className="test-saved-section__phead-actions">
          {onEdit && <EditIcon onClick={onEdit} />}
          {onDelete && <DeleteControl onConfirm={onDelete} />}
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
      {/* A run block already carries its title in its own header — repeating it here read as two
          different things stacked on each other. `showTitle={false}` drops the duplicate. */}
      {showTitle && test.title && (
        <button type="button" className="test-saved-section__title-row" onClick={toggleFold}>
          {test.title}
        </button>
      )}
      <TestStory
        ref={setRefs}
        chromeless
        test={test}
        connectedServices={connectedServices}
        recorded={recorded}
        index={index}
        onResult={onResult}
        autoExpand={autoExpand}
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
