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
import { resolveTestActions, resetTest } from "../SavedTests/transformTests";
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
  const serviceData = connectedServices.find(
    (service) => service.serviceId === serviceId,
  );
  const { Plugin } = serviceData
    ? Client.createService(serviceData.system.connectionData)
    : {};
  const [Before, setTestBefore] = useState([]);
  const [After, setTestAfter] = useState([]);
  const [Main, setTestMain] = useState([new Test({ namespace, shouldValidate: true })]);
  const eventNamespace = { serviceId, moduleName, methodName: "on" };
  const [Events, setEventTest] = useState([]);
  // RFC-020 — the test's NAMED-ACTION sections: ordered [{ name, tests, pos }] where pos places the
  // section "pre" (between Before and Main) or "post" (between Main and After). They load with a saved
  // test's `sections`/`run`, get added at either insertion point, and removed by ×.
  const [named, setNamed] = useState([]);
  const preNamed = named.filter((e) => e.pos !== "post");
  const postNamed = named.filter((e) => e.pos === "post");
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
  const RUN_ORDER = [
    "before",
    "events",
    ...preNamed.map((e) => e.name),
    "main",
    ...postNamed.map((e) => e.name),
    "after",
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
        t.getConnection(connectedServices);
      }
    });
    setTestMain([...Main]);
  };
  // The scratchpad has two tabs: build a TEST, or create a named ACTION (RFC-020). Same builder machinery.
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
      connectedServices,
    });
  const MainCtrl = testCtrl(Main, setTestMain, 1, FullTest);
  const BeforeCtrl = testCtrl(Before, setTestBefore, 0, FullTest);
  const EventCtrl = testCtrl(Events, setEventTest, 2, FullTest);
  const AfterCtrl = testCtrl(After, setTestAfter, 3, FullTest);
  const removeNamedSection = (name) =>
    setNamed((ns) => ns.filter((e) => e.name !== name));
  const addNamedSection = (action, pos = "pre") => {
    // The SAME action can be added as multiple sections — each gets a UNIQUE instance key (seedSum,
    // seedSum_2, …), a valid identifier so references (test.seedSum_2[0].results) resolve; all still point
    // at the one stored definition. Initialize steps bound to the current sections object + key it there
    // immediately so the action's own internal refs resolve from the moment it lands.
    let key = action.name;
    for (let i = 2; named.some((e) => e.name === key); i++) key = `${action.name}_${i}`;
    const tests = (action.steps || []).map((s) =>
      resetTest(s, FullTest, connectedServices, false),
    );
    FullTest[key] = tests;
    setNamed((ns) => [...ns, { name: key, action: action.name, tests, pos }]);
  };

  const { runFullTest, saveTests } = new FullTestController({
    FullTest: {
      sections: FullTest,
      order: RUN_ORDER,
      namedRefs,
      title: testTitle,
      namespace: saveNs,
    },
    connectedServices,
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
  const loadTestForEdit = (Tests, namedEntries = [], title = "", ns = null) => {
    setFullTest(Tests, namedEntries);
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

  // RFC-020 — build a sync `resolveAction(name)` from a plugin's named actions so `{ use }` steps splice
  // in as the tests are loaded (the CLI expands inside initializeSavedTests; the browser pre-expands here
  // so every downstream render path — SavedTests/TestStory — shows the action's steps and runs them).
  const actionResolver = async (plugin, ns) => {
    try {
      const actions = (plugin.getActions && (await plugin.getActions(ns))) || [];
      const map = {};
      actions.forEach((a) => a && a.name && (map[a.name] = a));
      return (name) => map[name] || null;
    } catch {
      return () => null;
    }
  };

  const fetchTests = async () => {
    try {
      if (Plugin) {
        const results = await Plugin.getTests(namespace);
        const resolve = await actionResolver(Plugin, namespace);
        setSavedTests((results || []).map((ft) => resolveTestActions(ft, resolve)));
      } else if (projectCode && !serviceId) {
        // Project level (project code clicked, no service): aggregate EVERY service's own tests so the
        // "run all" button runs the whole project — the same way running a service runs all its tests.
        const svcs = connectedServices.filter((s) => s.projectCode === projectCode);
        const all = [];
        for (const s of svcs) {
          try {
            const svc = loadServiceWithHeaders(
              s.system.connectionData,
              s.headers,
              s.credentials,
            );
            const tests = await svc.Plugin.getTests({ serviceId: s.serviceId });
            const resolve = await actionResolver(svc.Plugin, { serviceId: s.serviceId });
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
    setNamed([]); // named-action sections clear with the rest of the builder
    setTestTitle("");
    setTestNamespace(null); // back to the page's namespace
    setNsEditing(false);
    //get connection for the main test and set state
    const test = new Test({ namespace, shouldValidate: true }).getConnection(
      connectedServices,
    );
    setTestMain([test]);
    // A fresh scratchpad (new test / navigation) is EXPANDED — only Edit-loading a saved test collapses.
    setFoldAll(true);
  };
  // RFC-020 — the service's saved actions, offered as insertable sections in the builder.
  const [availableActions, setAvailableActions] = useState([]);
  useEffect(() => {
    (async () => {
      try {
        setAvailableActions(
          Plugin && Plugin.getActions ? (await Plugin.getActions({})) || [] : [],
        );
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
              const nsOptions = connectedServices.flatMap((s) =>
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
              <div className="row test-panel__section">
                <BeforeTest TestController={BeforeCtrl} TestSection={Before} />
              </div>
              {/* RFC-020 — the test's named-action sections: real sections, siblings of the built-ins, at
                BOTH insertion points (before Main and after Main), each with its identity + remove (×). */}
              {preNamed.map((entry) => (
                <div className="row test-panel__section" key={entry.name}>
                  <NamedSectionCard
                    entry={entry}
                    onRemove={() => removeNamedSection(entry.name)}
                  />
                </div>
              ))}
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
              <div className="row test-panel__section">
                <MainTest TestController={MainCtrl} TestSection={Main} />
              </div>
              {postNamed.map((entry) => (
                <div className="row test-panel__section" key={entry.name}>
                  <NamedSectionCard
                    entry={entry}
                    onRemove={() => removeNamedSection(entry.name)}
                  />
                </div>
              ))}
              <AddSectionRow
                actions={availableActions}
                onAdd={(a) => addNamedSection(a, "post")}
              />
              <div className="row test-panel__section">
                <EventsTest
                  TestController={EventCtrl}
                  TestSection={Events}
                  namespace={eventNamespace}
                  FullTest={FullTest}
                />
              </div>
              <div className="row test-panel__section">
                <AfterTest TestController={AfterCtrl} TestSection={After} />
              </div>
            </FoldContext.Provider>

            <div className="row test-panel__section">
              <SavedTests
                savedTests={savedTests}
                connectedServices={connectedServices}
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

// RFC-020 — an insertion point for a named-action section. Collapsed: one slim "+ section" button.
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

// RFC-020 — a named-action section INSIDE a test is a REFERENCE, not editable steps. It renders read-only
// (the same step cards a saved test / saved action shows), runnable on its own, and removable (×). To
// change its steps you edit the ACTION itself. `ran` derives from the steps so it reflects BOTH a per-
// section run here and a whole-test "Run all".
const NamedSectionCard = ({ entry, onRemove }) => {
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
