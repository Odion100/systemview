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
import { Client } from "../../systemClient";
import loadServiceWithHeaders from "../../utils/loadService";
import FullTestController from "./components/FullTestController";
import Title from "../../atoms/Title/Title";
import { CurrentTest } from "../../atoms/StatusIndicator/StatusIndicator";
import ActionsPanel from "../ActionsPanel/ActionsPanel";
import FoldContext from "./FoldContext";

export default function FullTest({ projectCode, serviceId, moduleName, methodName, onCollapse }) {
  return <FullTestInner projectCode={projectCode} serviceId={serviceId} moduleName={moduleName} methodName={methodName} onCollapse={onCollapse} />;
}

const FullTestInner = ({ projectCode, serviceId, moduleName, methodName, onCollapse }) => {
  const namespace = { serviceId, moduleName, methodName };
  const { connectedServices } = useContext(ServiceContext);
  const serviceData = connectedServices.find(
    (service) => service.serviceId === serviceId
  );
  const { Plugin } = serviceData
    ? Client.createService(serviceData.system.connectionData)
    : {};
  const [Before, setTestBefore] = useState([]);
  const [After, setTestAfter] = useState([]);
  const [Main, setTestMain] = useState([new Test({ namespace, shouldValidate: true })]);
  const eventNamespace = { serviceId, moduleName, methodName: "on" };
  const [Events, setEventTest] = useState([]);
  const FullTest = [Before, Main, Events, After];
  const [savedTests, setSavedTests] = useState([]);
  const [saveResponse, setMessage] = useState({ message: "", error: false });
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

  const { runFullTest, saveTests } = new FullTestController({
    FullTest,
    connectedServices,
  });

  const runTest = async () => {
    // Re-render between every step so each section/step shows its running → pass/fail indicator live
    // (the running step's border animates, the section auto-expands, the view scrolls to follow it).
    const tests = await runFullTest(() => setFullTest(FullTest));
    setFullTest(tests);
  };
  const setFullTest = ([Before, Main, Events, After]) => {
    setTestMain([...Main]);
    setTestBefore([...Before]);
    setEventTest([...Events]);
    setTestAfter([...After]);
  };
  // Clear the run results (pass/fail/response) on EVERY step across all sections — back to un-run.
  const clearAll = () => {
    [Before, Main, Events, After].forEach((section) =>
      section.forEach((t) => t.clearResults())
    );
    setFullTest([Before, Main, Events, After]);
  };
  // Editing a saved test (SavedTests → Edit) loads it into the scratchpad COLLAPSED — every section and
  // step folded, so you expand only what you want to change (not a wall of expanded steps).
  const loadTestForEdit = (Tests) => {
    setFullTest(Tests);
    setFoldAll(false);
    if (bodyRef.current) bodyRef.current.scrollTop = 0; // jump the scratchpad back up to the builder
  };
  const clearMessage = () => setMessage({ error: false, message: "" });
  const save = async () => {
    const { error, message } = await saveTests();

    if (!error) {
      clearScratchpad();
      fetchTests(); // refresh the saved list so the just-saved test shows (don't wipe it)
    }

    setMessage({ error, message });
    setTimeout(clearMessage, 4000);
  };

  const fetchTests = async () => {
    try {
      if (Plugin) {
        const results = await Plugin.getTests(namespace);
        setSavedTests(results);
      } else if (projectCode && !serviceId) {
        // Project level (project code clicked, no service): aggregate EVERY service's own tests so the
        // "run all" button runs the whole project — the same way running a service runs all its tests.
        const svcs = connectedServices.filter((s) => s.projectCode === projectCode);
        const all = [];
        for (const s of svcs) {
          try {
            const svc = loadServiceWithHeaders(s.system.connectionData, s.headers, s.credentials);
            const tests = await svc.Plugin.getTests({ serviceId: s.serviceId });
            all.push(...(tests || []));
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
    //get connection for the main test and set state
    const test = new Test({ namespace, shouldValidate: true }).getConnection(
      connectedServices
    );
    setTestMain([test]);
    // A fresh scratchpad (new test / navigation) is EXPANDED — only Edit-loading a saved test collapses.
    setFoldAll(true);
  };
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
            <span className="panel-title panel-title--scratch" title="Collapse the scratchpad" onClick={onCollapse}>
              <Title text="Scratch Pad" />
              <span className="panel-title__arrow">›</span>
            </span>
          ) : (
            <Title text="Scratch Pad" />
          )}
          {typeof Main[0].index === "number" && (
            <CurrentTest
              name={Main[0].title || `Saved Test ${1 + Main[0].index}`}
              onClick={clearScratchpad}
            />
          )}
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
            <span
              className={`test-panel__error-message test-panel__error-message--hide-${!saveResponse.message} test-panel__error-message--error-${
                saveResponse.error
              } `}
            >
              <span>{saveResponse.message}</span>
              <span onClick={clearMessage} className="test-panel__clear-error btn">
                ×
              </span>
            </span>

            <span className="test-panel__run-actions">
              <button
                type="button"
                className="test-panel__icon-btn"
                title={allExpanded ? "Collapse all sections & steps" : "Expand all sections & steps"}
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
              <span className="btn" onClick={save}>
                <SaveIcon />
              </span>
            </span>
          </span>

          <FoldContext.Provider value={fold}>
            <div className="row test-panel__section">
              <BeforeTest TestController={BeforeCtrl} TestSection={Before} />
            </div>
            <div className="row test-panel__section">
              <MainTest TestController={MainCtrl} TestSection={Main} />
            </div>
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

