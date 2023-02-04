import React, { useContext, useEffect, useState } from "react";
import { Client } from "systemlynx";
import Count from "../../atoms/Count";
import ExpandIcon from "../../atoms/ExpandableIcon/ExpandableIcon";
import RunTestIcon, { EditIcon, XButton } from "../../atoms/RunTestIcon";
import ExpandableSection from "../../molecules/ExpandableSection/ExpandableSection";
import TestCaption from "../../molecules/TestCaption/TestCaption";
import TestSummary from "../../molecules/TestSummary";
import FullTestController from "../FullTest/components/FullTestController";
import "./styles.scss";
import transformTest from "./transformTests";
window.Client = Client;
const SavedTests = ({ savedTests = [], connectedServices }) => {
  const [open, setOpen] = useState(false);
  const toggleExpansion = () => setOpen((state) => !state);
  const [openAll, setOpenAll] = useState(false);
  const [savedTestList, setTests] = useState(
    transformTest(savedTests, connectedServices)
  );

  window.savedTestList = savedTestList;
  const updateTests = (i, FullTest) => {
    savedTestList[i] = { ...FullTest };
    setTests([...savedTestList]);
  };

  const runAllTests = async () => {
    setOpen(true);
    setOpenAll(true);
    await Promise.all(savedTestList.map((FullTest, i) => runTest(i, FullTest)));
    setOpenAll(false);
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
    setTests(transformTest(savedTests, connectedServices));
  }, [savedTests]);
  return (
    <section className="test-saved-section">
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
            />{" "}
            <RunTestIcon onClick={runAllTests} />
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
                runTest={runTest.bind({}, i, FullTest)}
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
}) {
  const [open, setOpen] = useState(true);
  const toggleExpansion = () => setOpen((state) => !state);

  const testHandler = () => {
    setOpen(true);
    runTest();
  };
  useEffect(() => {
    setOpen(true);
  }, [openAll]);
  useEffect(() => {
    setOpen(false);
  }, [namespace.serviceId, namespace.moduleName, namespace.methodName]);
  return (
    <div className="test-saved-section__test-container">
      <div className="test-saved-section__test-row">
        <ExpandIcon color="#4caf50" onClick={toggleExpansion} isOpen={open} />
        <span className="test-saved-section__test-index ">Test {index + 1}:</span>
        <span className="test-saved-section__test-title">{title}</span>
        <span className="test-saved-section__buttons">
          <RunTestIcon onClick={testHandler} />
          <EditIcon />
          <XButton />
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
