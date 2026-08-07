import React, { useState, useContext, useEffect, useRef } from "react";
import BeforeTest from "./BeforeTest/BeforeTest";
import AfterTest from "./AfterTest/AfterTest";
import MainTest from "./MainTest/MainTest";
import EventsTest from "./EventsTest/EventsTest";
import ServiceContext from "../../ServiceContext";
import Test from "./components/Test.class";
import TestController from "./components/TestController.class";
import "./styles.scss";
import RunTestIcon from "../../atoms/RunTestIcon";
import SaveIcon from "../../atoms/SaveIcon/SaveIcon";
import SavedTests from "../SavedTests/SavedTests";
import { resolveTestActions, resetTest, getActionMap } from "../SavedTests/transformTests";
import { remapReferences } from "./components/test-helpers";
import { Client } from "../../systemClient";
import loadServiceWithHeaders from "../../utils/loadService";
import FullTestController from "./components/FullTestController";
import Title from "../../atoms/Title/Title";
import { CurrentTest } from "../../atoms/StatusIndicator/StatusIndicator";
import ActionsPanel from "../ActionsPanel/ActionsPanel";
import AutoCompleteBox from "../../molecules/AutoCompleteBox/AutoCompleteBox";
import MultiTestSection from "../MultiTestSection/MultiTestSection";
import { TestAction } from "../Stage/TestStory";
import Count from "../../atoms/Count";
import FoldContext from "./FoldContext";
import Help from "../../atoms/Help/Help";

export default function FullTest({
  projectCode,
  serviceId,
  moduleName,
  methodName,
  onCollapse,
}) {
  return (
    <FullTestInner
      projectCode={projectCode}
      serviceId={serviceId}
      moduleName={moduleName}
      methodName={methodName}
      onCollapse={onCollapse}
    />
  );
}

const FullTestInner = ({
  projectCode,
  serviceId,
  moduleName,
  methodName,
  onCollapse,
}) => {
  const namespace = { serviceId, moduleName, methodName };
  const { connectedServices } = useContext(ServiceContext);
  // EVERYTHING in the scratchpad is scoped to the CURRENT PROJECT — pickers, step connections, the
  // save path, saved lists. Two projects can share a serviceId; an unscoped lookup grabs whichever
  // comes first. (The CLI runner is already project-scoped — resolveServices(project_code) — parity.)
  const projectServices = connectedServices.filter(
    (s) => s.projectCode === projectCode,
  );
  const serviceData = projectServices.find(
    (service) => service.serviceId === serviceId,
  );
  const { Plugin } = serviceData
    ? Client.createService(serviceData.system.connectionData)
    : {};
  const [Before, setTestBefore] = useState([]);
  const [After, setTestAfter] = useState([]);
  const [Main, setTestMain] = useState([new Test({ namespace, shouldValidate: true })]);
  // A new EVENT listener defaults to wherever MAIN is pointed — the page props are only the seed,
  // and on higher-level pages (no method in the URL) they're empty, which used to surface as
  // "undefined.undefined.on". Main's first targeted step is the live source of truth.
  const mainNs = Main.find((t) => t.namespace.serviceId)?.namespace || namespace;
  const eventNamespace = {
    serviceId: mainNs.serviceId,
    moduleName: mainNs.moduleName,
    methodName: "on",
  };
  const [Events, setEventTest] = useState([]);
  // RFC-020 — the test's NAMED-ACTION sections: ordered [{ name, tests, pos }] where pos places the
  // section "pre" (between Before and Main) or "post" (between Main and After). They load with a saved
  // test's `sections`/`run`, get added at either insertion point, and removed by ×.
  const [named, setNamed] = useState([]);
  // RFC-020 — references walk a **sections object** keyed by name (test.before[0] / test.seedSum[0]). The
  // scratchpad builds the four built-ins plus every named section; each key points at its live state array
  // so results land where refs read them. RUN_ORDER is the run-procedure the engine loops — named sections
  // sit around main per their pos (events keep their historical slot).
  const FullTest = { before: Before, main: Main, events: Events, after: After };
  named.forEach(({ name, tests }) => {
    FullTest[name] = tests;
  });
  // instance-key → underlying action name, so save writes `{ use: <action> }` even when the section key
  // is a de-duped instance (seedSum_2 → use: seedSum).
  const namedRefs = {};
  named.forEach(({ name, action }) => {
    namedRefs[name] = action || name;
  });
  // RFC-023 — the section ORDER is state, not a skeleton. It loads from the saved test's `run` (tests
  // aren't always built in the UI — any arrangement is possible), renders in that order, and section
  // drag rearranges it. Main is the anchor: it's in the order but never drags.
  const DEFAULT_SECTION_ORDER = ["before", "events", "main", "after"];
  const [sectionOrder, setSectionOrder] = useState(DEFAULT_SECTION_ORDER);
  // The run-procedure = the visible order, guarded to sections that actually exist (plus any section
  // the order somehow missed — appended above main as a safety net).
  const RUN_ORDER = [
    ...sectionOrder.filter((k) => FullTest[k]),
    ...Object.keys(FullTest).filter((k) => !sectionOrder.includes(k)),
  ];
  const [savedTests, setSavedTests] = useState([]);
  const [saveResponse, setMessage] = useState({ message: "", error: false });
  // The TEST-LEVEL title — the saved test's own name, which has always existed in the stored shape but
  // silently anchored to Main[0].title. This input lets it diverge; empty still falls back to Main's.
  const [testTitle, setTestTitle] = useState("");
  // The TEST-LEVEL namespace — where the test SAVES (its `module.method.json` file). Defaults to the
  // page's namespace; the chip is click-to-edit for when you're on a higher namespace (no method) or
  // want to retarget. Main steps are free to point elsewhere — the save rule only needs ONE that matches.
  const [testNamespace, setTestNamespace] = useState(null);
  const [nsEditing, setNsEditing] = useState(false);
  const saveNs = testNamespace || namespace;
  const commitNs = (value) => {
    setNsEditing(false);
    const parts = (value || "").trim().split(".").filter(Boolean);
    if (parts.length < 3) return; // needs service.module.method — anything less keeps the old target
    const methodName = parts.pop();
    const moduleName = parts.pop();
    const ns = { serviceId: parts.join("."), moduleName, methodName };
    setTestNamespace(ns);
    // Main steps that haven't been pointed anywhere yet (no method — e.g. built from a higher
    // namespace) follow the new target so the test is immediately runnable + saveable.
    Main.forEach((t) => {
      if (!t.namespace.methodName) {
        t.namespace = { ...ns };
        t.getConnection(projectServices);
      }
    });
    setTestMain([...Main]);
  };
  // The scratchpad has two tabs: build a TEST, or create a shared ACTION (RFC-020). Same builder machinery.
  const [tab, setTab] = useState("test");
  // Expand/collapse EVERY section + step from the top toolbar (bump `signal` so a repeat still fires).
  const [fold, setFold] = useState({ signal: 0, open: true });
  const [allExpanded, setAllExpanded] = useState(true);
  const setFoldAll = (open) => {
    setFold((f) => ({ signal: f.signal + 1, open }));
    setAllExpanded(open);
  };
  const toggleFoldAll = () => setFoldAll(!allExpanded);
  // The scrolling scratchpad body — edit-loading a saved test scrolls it back to the top (you may have been
  // scrolled far down in the saved list when you clicked Edit, but the builder lives up top).
  const bodyRef = useRef(null);
  window.Tests = FullTest;
  const testCtrl = (TestSection, setState, section, FullTest) =>
    new TestController({
      TestSection,
      setState,
      section,
      FullTest,
      connectedServices: projectServices,
    });
  const MainCtrl = testCtrl(Main, setTestMain, 1, FullTest);
  const BeforeCtrl = testCtrl(Before, setTestBefore, 0, FullTest);
  const EventCtrl = testCtrl(Events, setEventTest, 2, FullTest);
  const AfterCtrl = testCtrl(After, setTestAfter, 3, FullTest);
  // RFC-023 — the editable DEFAULT sections' state setters, keyed like FullTest. (Named/action
  // sections are SEALED blocks — steps never drag in or out of them.)
  const SECTION_SETTERS = {
    before: setTestBefore,
    main: setTestMain,
    events: setEventTest,
    after: setTestAfter,
  };
  // Move a step (drag-and-drop) within or across the editable sections. References FOLLOW the step:
  // simulate the move over position tokens to get an exact old→new position map, mutate, then rewrite
  // every displaced reference in one pass (targetValues + visible input text + evaluation tv()s).
  const moveStep = (fromKey, fromIdx, toKey, rawToIdx) => {
    if (!SECTION_SETTERS[fromKey] || !SECTION_SETTERS[toKey]) return;
    const src = FullTest[fromKey];
    const dst = FullTest[toKey];
    if (!src || !dst || !src[fromIdx]) return;
    let toIdx = rawToIdx;
    if (fromKey === toKey && fromIdx < rawToIdx) toIdx = rawToIdx - 1; // removal shifts the target
    if (fromKey === toKey && toIdx === fromIdx) return;
    if (fromKey === "main" && fromKey !== toKey && src.length === 1) return; // Main never empties
    // Simulate over {key, i} tokens — the map covers all three shift cases at once.
    const sim = {};
    Object.keys(SECTION_SETTERS).forEach((k) => {
      sim[k] = (FullTest[k] || []).map((_, i) => ({ key: k, i }));
    });
    const [movedTok] = sim[fromKey].splice(fromIdx, 1);
    sim[toKey].splice(toIdx, 0, movedTok);
    const newPos = new Map();
    Object.keys(sim).forEach((k) =>
      sim[k].forEach((tok, ni) => newPos.set(`${tok.key}:${tok.i}`, { key: k, index: ni })),
    );
    const mapFn = (key, i) => {
      const to = newPos.get(`${key}:${i}`);
      return !to || (to.key === key && to.index === i) ? null : to;
    };
    const [moved] = src.splice(fromIdx, 1);
    dst.splice(toIdx, 0, moved);
    remapReferences(FullTest, mapFn);
    SECTION_SETTERS[fromKey]([...FullTest[fromKey]]);
    if (toKey !== fromKey) SECTION_SETTERS[toKey]([...FullTest[toKey]]);
  };
  // Duplicate a step in place — a fresh clone (args/evaluations, no results) lands right below the
  // original; references below the insertion point shift down one and get rewritten to follow.
  const duplicateStep = (key, idx) => {
    const arr = FullTest[key];
    if (!SECTION_SETTERS[key] || !arr || !arr[idx]) return;
    const t = arr[idx];
    const clone = resetTest(
      {
        namespace: { ...t.namespace },
        title: t.title,
        args: (t.args || []).map((a) => ({
          name: a.name,
          input: JSON.parse(JSON.stringify(a.input === undefined ? "" : a.input)),
          input_type: a.input_type,
          data_type: a.data_type,
          targetValues: JSON.parse(JSON.stringify(a.targetValues || [])),
        })),
        savedEvaluations: (t.evaluations || [])
          .filter((e) => e.save)
          .map(({ namespace: ns, expected_type, validations, save, indexed }) => ({
            namespace: ns,
            expected_type,
            validations: JSON.parse(JSON.stringify(validations || [])),
            save,
            indexed,
          })),
      },
      FullTest,
      projectServices,
      true,
    );
    const at = idx + 1;
    remapReferences(FullTest, (k, i) => (k === key && i >= at ? { key: k, index: i + 1 } : null));
    arr.splice(at, 0, clone);
    SECTION_SETTERS[key]([...arr]);
  };
  // Rearrange sections (drag) — pure order change: keys and step indices don't move, so references
  // need NO rewriting; only the run procedure changes. Main never moves.
  const moveSection = (fromKey, toKey, side) => {
    // Main AND Events are anchored — they stay where they've always been; everything else drags.
    if (fromKey === "main" || fromKey === "events" || fromKey === toKey) return;
    setSectionOrder((order) => {
      if (!order.includes(fromKey) || !order.includes(toKey)) return order;
      const next = order.filter((k) => k !== fromKey);
      const at = next.indexOf(toKey) + (side === "after" ? 1 : 0);
      next.splice(at, 0, fromKey);
      return next;
    });
  };
  const removeNamedSection = (name) => {
    setNamed((ns) => ns.filter((e) => e.name !== name));
    setSectionOrder((order) => order.filter((k) => k !== name));
  };
  const addNamedSection = (action, pos = "pre") => {
    // The SAME action can be added as multiple sections — each gets a UNIQUE instance key (seedSum,
    // seedSum_2, …), a valid identifier so references (test.seedSum_2[0].results) resolve; all still point
    // at the one stored definition. Initialize steps bound to the current sections object + key it there
    // immediately so the action's own internal refs resolve from the moment it lands.
    let key = action.name;
    for (let i = 2; named.some((e) => e.name === key); i++) key = `${action.name}_${i}`;
    const tests = (action.steps || []).map((s) =>
      resetTest(s, FullTest, projectServices, false),
    );
    FullTest[key] = tests;
    setNamed((ns) => [...ns, { name: key, action: action.name, tests, pos }]);
    // Land in the ORDER at the chosen insertion point: just above / just below Main.
    setSectionOrder((order) => {
      const next = [...order];
      next.splice(next.indexOf("main") + (pos === "post" ? 1 : 0), 0, key);
      return next;
    });
  };

  const { runFullTest, saveTests } = new FullTestController({
    FullTest: {
      sections: FullTest,
      order: RUN_ORDER,
      namedRefs,
      title: testTitle,
      namespace: saveNs,
    },
    connectedServices: projectServices,
  });

  const runTest = async () => {
    // Re-render between every step so each section/step shows its running → pass/fail indicator live
    // (the running step's border animates, the section auto-expands, the view scrolls to follow it).
    await runFullTest(() => setFullTest([Before, Main, Events, After], named));
    setFullTest([Before, Main, Events, After], named);
  };
  const setFullTest = ([Before, Main, Events, After], namedEntries) => {
    setTestMain([...Main]);
    setTestBefore([...Before]);
    setEventTest([...Events]);
    setTestAfter([...After]);
    if (namedEntries) setNamed(namedEntries.map((e) => ({ ...e, tests: [...e.tests] })));
  };
  // Clear the run results (pass/fail/response) on EVERY step across all sections — back to un-run.
  const clearAll = () => {
    [Before, Main, Events, After, ...named.map((e) => e.tests)].forEach((section) =>
      section.forEach((t) => t.clearResults()),
    );
    setFullTest([Before, Main, Events, After], named);
  };
  // Editing a saved test (SavedTests → Edit) loads it into the scratchpad COLLAPSED — every section and
  // step folded, so you expand only what you want to change (not a wall of expanded steps). Its named
  // sections load with it.
  const loadTestForEdit = (Tests, namedEntries = [], title = "", ns = null, order = null) => {
    setFullTest(Tests, namedEntries);
    setSectionOrder(order && order.length ? order : DEFAULT_SECTION_ORDER);
    setTestTitle(title || ""); // the saved test's own top-level title (may equal Main's, may diverge)
    setTestNamespace(ns || null); // the file/namespace the test was saved under
    setFoldAll(false);
    if (bodyRef.current) bodyRef.current.scrollTop = 0; // jump the scratchpad back up to the builder
  };
  const clearMessage = () => setMessage({ error: false, message: "" });
  const save = async () => {
    // NOTHING fails silently — an unexpected throw surfaces in the save note like any validation error.
    try {
      const { error, message } = await saveTests();

      if (!error) {
        clearScratchpad();
        fetchTests(); // refresh the saved list so the just-saved test shows (don't wipe it)
      }

      setMessage({ error, message });
    } catch (e) {
      setMessage({ error: true, message: (e && e.message) || "Save failed." });
    }
    setTimeout(clearMessage, 4000);
  };

  // RFC-020 — build a sync `resolveAction(name)` from the WHOLE PROJECT's shared actions (every
  // service's, merged — getActionMap, same as the CLI) so `{ use }` steps splice in as the tests are
  // loaded. Actions store under the service they were saved on, but a test calls across namespaces —
  // an action saved on one service must resolve in any other's tests.
  const projectActionResolver = async () => {
    try {
      const map = await getActionMap(projectServices);
      return (name) => map[name] || null;
    } catch {
      return () => null;
    }
  };

  const fetchTests = async () => {
    try {
      if (Plugin) {
        const results = await Plugin.getTests(namespace);
        const resolve = await projectActionResolver();
        setSavedTests((results || []).map((ft) => resolveTestActions(ft, resolve)));
      } else if (projectCode && !serviceId) {
        // Project level (project code clicked, no service): aggregate EVERY service's own tests so the
        // "run all" button runs the whole project — the same way running a service runs all its tests.
        const svcs = projectServices;
        const resolve = await projectActionResolver();
        const all = [];
        for (const s of svcs) {
          try {
            const svc = loadServiceWithHeaders(
              s.system.connectionData,
              s.headers,
              s.credentials,
            );
            const tests = await svc.Plugin.getTests({ serviceId: s.serviceId });
            all.push(...(tests || []).map((ft) => resolveTestActions(ft, resolve)));
          } catch {}
        }
        setSavedTests(all);
      }
    } catch (error) {
      return [];
    }
  };
  // Clear ONLY the scratchpad builder (Before/Main/Events/After) back to a fresh test. Does NOT touch the
  // saved-tests list — clearing the scratchpad (the "Saved Test N" ×, or after a save) must never make the
  // saved tests disappear (that was the bug: resetTests wiped savedTests with no refetch, so they only
  // came back on a page refresh).
  const clearScratchpad = () => {
    setTestBefore([]);
    setTestAfter([]);
    setEventTest([]);
    setNamed([]); // shared-action sections clear with the rest of the builder
    setSectionOrder(DEFAULT_SECTION_ORDER); // back to the default run order
    setTestTitle("");
    setTestNamespace(null); // back to the page's namespace
    setNsEditing(false);
    //get connection for the main test and set state
    const test = new Test({ namespace, shouldValidate: true }).getConnection(
      projectServices,
    );
    setTestMain([test]);
    // A fresh scratchpad (new test / navigation) is EXPANDED — only Edit-loading a saved test collapses.
    setFoldAll(true);
  };
  // RFC-020 — the PROJECT's saved actions (every service's, merged), offered as insertable sections
  // in the builder. A signIn action saved on one service is usable in any test — tests already call
  // across namespaces, and actions are just named steps.
  const [availableActions, setAvailableActions] = useState([]);
  useEffect(() => {
    (async () => {
      try {
        const map = await getActionMap(projectServices);
        setAvailableActions(Object.values(map));
      } catch {
        setAvailableActions([]);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serviceId, connectedServices, tab]);
  // Navigation reset: clear the builder AND drop the previous namespace's saved list (fetchTests, called
  // right after in the navigation effect, repopulates it for the new namespace).
  const resetTests = () => {
    clearScratchpad();
    setSavedTests([]);
  };

  useEffect(() => {
    resetTests();
    fetchTests();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectCode, serviceId, moduleName, methodName, connectedServices]);

  return (
    <section className="test-panel">
      {/* Title + tabs are a FIXED header region — they don't scroll. The builder + saved tests below are
            the ONLY scroll area (the .container is the scroll body, so bootstrap row gutters are absorbed
            and there's no horizontal scroll / edge clipping). */}
      <div className="test-panel__header">
        <div className="row test-panel__head">
          {onCollapse ? (
            <span
              className="panel-title panel-title--scratch"
              title="Collapse the scratchpad"
              onClick={onCollapse}
            >
              <Title text="Scratch Pad" />
              <span className="panel-title__arrow">›</span>
            </span>
          ) : (
            <Title text="Scratch Pad" />
          )}
          <Help topic={tab === "actions" ? "actions" : "scratchpad"} />
          {/* Always-on save-target chip: the namespace this test SAVES under (its own field — Main
              steps may point elsewhere). Click it to change the target — essential on a higher
              namespace where nothing points at a method yet. A loaded SAVED test adds its slot (#N)
              + the × to step off it; a NEW test shows in neutral gray. */}
          {(() => {
            const saved = typeof Main[0].index === "number";
            const label =
              [saveNs.serviceId, saveNs.moduleName, saveNs.methodName]
                .filter(Boolean)
                .join(".") || "set namespace";
            if (nsEditing) {
              // The app's own picker (same one every step uses) — filtered dropdown, arrow keys,
              // Enter/click selects. Commit only via selection; clicking away cancels.
              const nsOptions = projectServices.flatMap((s) =>
                (((s.system || {}).connectionData || {}).modules || []).flatMap((m) =>
                  (m.methods || []).map((fn) => `${s.serviceId}.${m.name}.${fn.fn}`),
                ),
              );
              return (
                <span className="test-panel__ns-picker">
                  <AutoCompleteBox
                    className="test-panel__ns-input"
                    suggestions={nsOptions}
                    value=""
                    // Opens EMPTY so typing filters immediately; the current target stays visible
                    // as the placeholder.
                    placeholder={label === "set namespace" ? "service.module.method" : label}
                    autoFocus
                    onSubmit={commitNs}
                    onBlur={() => setTimeout(() => setNsEditing(false), 200)}
                  />
                </span>
              );
            }
            return (
              <CurrentTest
                name={label}
                suffix={saved ? `#${1 + Main[0].index}` : undefined}
                neutral={!saved}
                onNameClick={() => setNsEditing(true)}
                onClick={saved ? clearScratchpad : undefined}
              />
            );
          })()}
        </div>

        <div className="row test-panel__tabs">
          <button
            type="button"
            className={`test-panel__tab ${tab === "test" ? "test-panel__tab--active" : ""}`}
            onClick={() => setTab("test")}
          >
            Test
          </button>
          <button
            type="button"
            className={`test-panel__tab ${tab === "actions" ? "test-panel__tab--active" : ""}`}
            onClick={() => setTab("actions")}
          >
            Actions
          </button>
          {/* The builder toolbar lives IN the tabs row (right-aligned) — same shape as the navigator's
              tab bar. Frees the row below for the test title + save. */}
          {tab === "test" && (
            <span className="test-panel__run-actions test-panel__run-actions--tabs">
              <button
                type="button"
                className="test-panel__icon-btn"
                title={
                  allExpanded
                    ? "Collapse all sections & steps"
                    : "Expand all sections & steps"
                }
                onClick={toggleFoldAll}
              >
                {allExpanded ? "⊟" : "⊞"}
              </button>
              <button
                type="button"
                className="test-panel__icon-btn"
                title="Clear all results"
                onClick={clearAll}
              >
                Clear
              </button>
              <button type="button" className="test-panel__run-all" onClick={runTest}>
                ▶ Run all
              </button>
            </span>
          )}
        </div>
      </div>

      <div className="container test-panel__body" ref={bodyRef}>
        {tab === "actions" ? (
          <ActionsPanel
            projectCode={projectCode}
            serviceId={serviceId}
            moduleName={moduleName}
            methodName={methodName}
          />
        ) : (
          <div>
            <span className="row test__buttons">
              {/* The test's own NAME (top-level title) + save. Empty falls back to Main's title on
                  save. The save/validation message REPLACES the input in place for the few seconds
                  it's up (same box, zero layout shift), then the input returns. */}
              <span className="test-panel__title-group">
                {saveResponse.message ? (
                  <span
                    className={`test-panel__save-note test-panel__save-note--error-${saveResponse.error}`}
                  >
                    <span className="test-panel__save-note-text">
                      {saveResponse.message}
                    </span>
                    <span onClick={clearMessage} className="test-panel__clear-error btn">
                      ×
                    </span>
                  </span>
                ) : (
                  <input
                    type="text"
                    className="test-panel__title-input"
                    value={testTitle}
                    onChange={(e) => setTestTitle(e.target.value)}
                    placeholder={Main[0].title || "Test name (defaults to Main's title)"}
                  />
                )}
                <span className="btn" onClick={save}>
                  <SaveIcon />
                </span>
              </span>
            </span>

            <FoldContext.Provider value={fold}>
              {/* RFC-023 — sections render IN THE ORDER (the test's run procedure), not a skeleton:
                  a hand-authored test with an action before Before shows exactly that. Every section
                  but Main drags (grip in its header); the two + section rows stay pinned to Main. */}
              {(() => {
                // Events RUNS in its historical slot (RUN_ORDER keeps it) but always DISPLAYS right
                // after Main's zone — it never moves around visually, exactly like the old layout.
                const display = sectionOrder.filter((k) => k !== "events");
                display.splice(display.indexOf("main") + 1, 0, "events");
                return display;
              })()
                .filter((k) => k === "main" || FullTest[k])
                .map((key) => {
                  const entry = named.find((e) => e.name === key);
                  const section =
                    key === "main" ? (
                      <MainTest TestController={MainCtrl} TestSection={Main} sectionKey="main" onStepMove={moveStep} onStepDuplicate={duplicateStep} />
                    ) : key === "before" ? (
                      <BeforeTest TestController={BeforeCtrl} TestSection={Before} sectionKey="before" onStepMove={moveStep} onStepDuplicate={duplicateStep} sectionDragKey="before" />
                    ) : key === "events" ? (
                      <EventsTest
                        TestController={EventCtrl}
                        TestSection={Events}
                        namespace={eventNamespace}
                        FullTest={FullTest}
                        sectionKey="events"
                        onStepMove={moveStep}
                        onStepDuplicate={duplicateStep}
                      />
                    ) : key === "after" ? (
                      <AfterTest TestController={AfterCtrl} TestSection={After} sectionKey="after" onStepMove={moveStep} onStepDuplicate={duplicateStep} sectionDragKey="after" />
                    ) : entry ? (
                      <NamedSectionCard
                        entry={entry}
                        onRemove={() => removeNamedSection(entry.name)}
                        dragKey={entry.name}
                      />
                    ) : null;
                  if (!section) return null;
                  return (
                    <React.Fragment key={key}>
                      {key === "main" && (
                        <AddSectionRow
                          actions={availableActions}
                          onAdd={(a) => addNamedSection(a, "pre")}
                          rightSlot={
                            <span
                              className="current-data-section__add btn"
                              title="Add another main step"
                              onClick={() => MainCtrl.addTest()}
                            >
                              + main
                            </span>
                          }
                        />
                      )}
                      <SectionRow sectionKey={key} onSectionMove={moveSection}>
                        {section}
                      </SectionRow>
                      {key === "main" && (
                        <AddSectionRow
                          actions={availableActions}
                          onAdd={(a) => addNamedSection(a, "post")}
                        />
                      )}
                    </React.Fragment>
                  );
                })}
            </FoldContext.Provider>

            <div className="row test-panel__section">
              <SavedTests
                savedTests={savedTests}
                connectedServices={projectServices}
                setFullTest={loadTestForEdit}
                Plugin={Plugin}
                fetchTests={fetchTests}
              />
            </div>
          </div>
        )}
        <div className="scroll-buffer"></div>
      </div>
    </section>
  );
};

// RFC-020 — an insertion point for a shared-action section. Collapsed: one slim "+ section" button.
// Open: a horizontally scrollable strip of the service's saved actions (there can be many) — click one
// and it lands as a section right at this spot.
// `+ section` on the LEFT, an optional `rightSlot` (e.g. `+ main`) on the RIGHT — one shared row so the
// add controls sit together above the section instead of eating separate empty rows.
const AddSectionRow = ({ actions, onAdd, rightSlot }) => {
  const [open, setOpen] = useState(false);
  if (!actions.length && !rightSlot) return null;
  return (
    <div className="row test-panel__add-section">
      {actions.length > 0 &&
        (open ? (
          <>
            <div className="test-panel__add-section-strip">
              {actions.map((a) => (
                <button
                  key={a.name}
                  type="button"
                  className="test-panel__add-section-chip"
                  title={`Insert the "${a.name}" action as a section here`}
                  onClick={() => {
                    onAdd(a);
                    setOpen(false);
                  }}
                >
                  {a.name}
                </button>
              ))}
            </div>
            <button
              type="button"
              className="test-panel__add-section-close"
              onClick={() => setOpen(false)}
            >
              ×
            </button>
          </>
        ) : (
          <button
            type="button"
            className="test-panel__add-section-toggle"
            onClick={() => setOpen(true)}
          >
            + actions
          </button>
        ))}
      {rightSlot && <span className="test-panel__add-section-right">{rightSlot}</span>}
    </div>
  );
};

// RFC-020 — a shared-action section INSIDE a test is a REFERENCE, not editable steps. It renders read-only
// (the same step cards a saved test / saved action shows), runnable on its own, and removable (×). To
// change its steps you edit the ACTION itself. `ran` derives from the steps so it reflects BOTH a per-
// section run here and a whole-test "Run all".
// RFC-023 — one section's row: the drop target for SECTION drag (top half = land above, bottom half
// = below). Pure order change — references don't move, so no remap here.
const SECTION_MIME = "application/x-sv-section";
const SectionRow = ({ sectionKey, onSectionMove, children }) => {
  const [over, setOver] = React.useState(null);
  const sideAt = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    return e.clientY > r.top + r.height / 2 ? "after" : "before";
  };
  return (
    <div
      className={`row test-panel__section${over ? ` test-panel__section--over-${over}` : ""}`}
      onDragOver={(e) => {
        if ([...e.dataTransfer.types].includes(SECTION_MIME)) {
          e.preventDefault();
          setOver(sideAt(e));
        }
      }}
      onDragLeave={() => setOver(null)}
      onDrop={(e) => {
        setOver(null);
        let d;
        try {
          d = JSON.parse(e.dataTransfer.getData(SECTION_MIME));
        } catch {
          return;
        }
        if (!d || !d.key) return;
        e.preventDefault();
        onSectionMove(d.key, sectionKey, sideAt(e));
      }}
    >
      {children}
    </div>
  );
};

const NamedSectionCard = ({ entry, onRemove, dragKey }) => {
  // Collapsed by default — a referenced action is reused everywhere, so adding one shouldn't dump all its
  // steps into the builder; expand it only when you want to recall what it does.
  const [open, setOpen] = React.useState(false);
  const [running, setRunning] = React.useState(false);
  const [, bump] = React.useState(0);
  const steps = entry.tests || [];
  const ran = steps.some((s) => !!s.test_end);
  const failed = ran && steps.some((s) => (s.errors || []).length);
  const run = async () => {
    setRunning(true);
    for (const t of steps) {
      t.running = true;
      bump((n) => n + 1);
      await t.runTest();
      t.running = false;
      bump((n) => n + 1);
    }
    setRunning(false);
  };
  return (
    <div
      className={`named-section ${
        running
          ? "named-section--running"
          : ran
            ? failed
              ? "named-section--fail"
              : "named-section--pass"
            : ""
      }`}
    >
      <div className="named-section__head">
        <button
          type="button"
          className="named-section__fold"
          onClick={() => setOpen((o) => !o)}
        >
          <span className="named-section__caret">{open ? "▾" : "▸"}</span>
          <span className="named-section__tag">actions</span>
          <span className="named-section__name">{entry.name}</span>
          <Count count={steps.length} />
          <span
            className="named-section__remove"
            title="Remove this section from the test"
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
          >
            ×
          </span>
        </button>
        <button
          type="button"
          className="named-section__run"
          onClick={run}
          disabled={running}
        >
          {running ? "…" : "▶ Run"}
        </button>
        {dragKey && (
          <span
            className="named-section__grip"
            title="Drag to rearrange this section"
            draggable
            onDragStart={(e) => {
              e.dataTransfer.effectAllowed = "move";
              e.dataTransfer.setData(SECTION_MIME, JSON.stringify({ key: dragKey }));
            }}
            onClick={(e) => e.stopPropagation()}
          >
            ⠿
          </span>
        )}
      </div>
      {open && (
        <div className="named-section__steps">
          {steps.map((s, i) => (
            <TestAction
              key={i}
              action={s}
              ran={ran}
              phaseSig={0}
              phaseCollapsed={false}
              autoExpand={false}
            />
          ))}
        </div>
      )}
    </div>
  );
};
