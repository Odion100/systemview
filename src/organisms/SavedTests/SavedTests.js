import React, { useEffect, useState } from "react";
import { Client } from "systemlynx";
import Count from "../../atoms/Count";
import ExpandIcon from "../../atoms/ExpandableIcon/ExpandableIcon";
import RunTestIcon, { EditIcon, XButton } from "../../atoms/RunTestIcon";
import ExpandableSection from "../../molecules/ExpandableSection/ExpandableSection";
import TestCaption from "../../molecules/TestCaption/TestCaption";
import TestSummary from "../../molecules/TestSummary";
import FullTestController from "../TestPanel/components/FullTestController";
import { initializeSavedTests, resetFullTest } from "./transformTests";
import "./styles.scss";
import { ClearButton } from "../../atoms/Button/Button";

window.Client = Client;
const CLASSNAME = "test-saved-section";

const SavedTests = ({
  savedTests = [],
  connectedServices,
  setFullTest,
  Plugin,
  fetchTests,
}) => {
  const [open, setOpen] = useState(false);
  const toggleExpansion = () => setOpen((state) => !state);
  const [openAll, setOpenAll] = useState(false);
  const [closeAll, setCloseAll] = useState(false);
  const [savedTestList, setTests] = useState(
    initializeSavedTests(savedTests, connectedServices)
  );
  window.savedTestList = savedTestList;
  window.savedTests = savedTests;

  const updateTests = (i, FullTest) => {
    savedTestList[i] = { ...FullTest };
    setTests([...savedTestList]);
  };
  const clearTests = () => {
    setTests(initializeSavedTests(savedTests, connectedServices));
    setCloseAll((state) => !state);
  };

  const runAllTests = async () => {
    setOpen(true);
    setOpenAll((state) => !state);
    // await Promise.all(savedTestList.map((FullTest, i) => runTest(i, FullTest)));
    await new Promise((resolve) => {
      function recursiveRunTest(tests, i = 0) {
        if (i === tests.length) resolve();
        else runTest(i, tests[i]).then(() => recursiveRunTest(tests, i + 1));
      }
      recursiveRunTest(savedTestList);
    });
  };

  const runTest = async (index, { Before, Main, Events, After }) => {
    const { runFullTest } = new FullTestController({
      FullTest: [Before, Main, Events, After],
      connectedServices,
    });

    const [B, M, E, A] = await runFullTest();
    const { title, namespace } = Main[0];
    updateTests(index, { Before: B, Main: M, Events: E, After: A, title, namespace });
  };
  useEffect(() => {
    setTests(initializeSavedTests(savedTests, connectedServices));
  }, [savedTests]);
  return (
    <section className={`${CLASSNAME}`}>
      <ExpandableSection
        toggleExpansion={toggleExpansion}
        open={open}
        title={
          <>
            <TestCaption
              caption={
                <span>
                  {"Saved"}{" "}
                  {savedTestList.length > 0 && <Count count={savedTestList.length} />}
                </span>
              }
            />
            <div className={`${CLASSNAME}__buttons ${CLASSNAME}__top-buttons`}>
              <ClearButton onClick={clearTests} />
              <RunTestIcon onClick={runAllTests} />
            </div>
          </>
        }
      >
        {savedTestList.length ? (
          <div className="test-saved-section__test-container">
            {savedTestList.map((FullTest, i) => (
              <TestDetails
                key={i}
                {...FullTest}
                index={i}
                isOpen={open}
                openAll={openAll}
                closeAll={closeAll}
                runTest={runTest.bind({}, i, FullTest)}
                setFullTest={setFullTest}
                connectedServices={connectedServices}
                Plugin={Plugin}
                fetchTests={fetchTests}
              />
            ))}
          </div>
        ) : (
          <div className="test-saved-section__test-data">
            <span>no saved tests</span>
          </div>
        )}
      </ExpandableSection>
    </section>
  );
};

function TestDetails({
  title,
  index,
  Before,
  Main,
  Events,
  After,
  namespace,
  runTest,
  openAll,
  closeAll,
  setFullTest,
  connectedServices,
  Plugin,
  fetchTests,
}) {
  const [open, setOpen] = useState(true);
  const [showDeleteMsg, setDeleteMsg] = useState(false);
  const toggleExpansion = () => {
    setOpen((state) => !state);
  };
  const editTest = () => {
    Main[0].index = index;
    const Tests = resetFullTest([Before, Main, Events, After], connectedServices);
    setFullTest(Tests);
  };
  const hideDelete = () => setDeleteMsg(false);
  const showDelete = () => setDeleteMsg(true);
  const deleteTest = async () => {
    if (Plugin) {
      await Plugin.deleteTest(namespace, index);
      hideDelete();
      fetchTests();
    }
  };
  const runTestHandler = () => {
    setOpen(true);
    runTest();
  };
  useEffect(() => {
    setOpen(true);
  }, [openAll]);
  useEffect(() => {
    setOpen(false);
  }, [closeAll]);
  useEffect(() => {
    setOpen(false);
  }, [namespace.serviceId, namespace.moduleName, namespace.methodName]);
  return (
    <div className={`${CLASSNAME}__test-container`}>
      <div className={`${CLASSNAME}__test-row`}>
        <ExpandIcon color="#4caf50" onClick={toggleExpansion} isOpen={open} />
        <span className={`${CLASSNAME}__test-index`}>Test {index + 1}:</span>
        {showDeleteMsg ? (
          <span className={`${CLASSNAME}__delete-prompt ${CLASSNAME}__test-title`}>
            Delete test?{"  "}
            <span
              onClick={deleteTest}
              className={`${CLASSNAME}__delete-btn ${CLASSNAME}__delete-btn--yes btn`}
            >
              Yes
            </span>
            <span
              onClick={hideDelete}
              className={`${CLASSNAME}__delete-btn ${CLASSNAME}__delete-btn--no btn`}
            >
              No
            </span>
          </span>
        ) : (
          <span className={`${CLASSNAME}__test-title`}>{title}</span>
        )}

        <span className={`${CLASSNAME}__buttons`}>
          <RunTestIcon onClick={runTestHandler} />
          <EditIcon onClick={editTest} />
          <XButton onClick={showDelete} />
        </span>
      </div>
      {open && (
        <>
          {!!Before.length && <TestSummary testSection={Before} section="Before" />}
          {!!Main.length && <TestSummary testSection={Main} section="Main" />}
          {!!Events.length && <TestSummary testSection={Events} section="Events" />}
          {!!After.length && <TestSummary testSection={After} section="After" />}
        </>
      )}
    </div>
  );
}
export default SavedTests;
