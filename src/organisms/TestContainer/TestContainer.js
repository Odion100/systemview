import React, { useEffect, useState } from "react";
import ExpandableSection from "../../molecules/ExpandableSection/ExpandableSection";
import TestCaption from "../../molecules/TestCaption/TestCaption";
import ScratchPad from "../ScratchPad/ScratchPad";

import "./styles.scss";

const TestContainer = ({
  open: _open,
  title,
  children,
  dynamic,
  TestController,
  test,
  testIndex,
  title_color,
  staticArguments,
  multiTest,
}) => {
  const className = "test-container";
  const [open, setOpen] = useState(_open);

  const toggleExpansion = () => {
    setOpen((state) => !state);
  };
  const deleteTest = () => {
    TestController.deleteTest(testIndex);
  };

  const updateTitle = (text) => {
    TestController.updateTitle(testIndex, text);
  };
  useEffect(() => {}, [test.title]);
  return (
    <section className={className}>
      <ExpandableSection
        toggleExpansion={toggleExpansion}
        open={open}
        title_color={title_color || "#0d8065"}
        title={
          <>
            <TestCaption
              onChange={updateTitle}
              caption={<b>{title}</b>}
              useInput={true}
              title={test.title || ""}
            />
            {multiTest && (
              <span
                className={`${className}__delete-btn btn delete-btn`}
                onClick={deleteTest}
              >
                x
              </span>
            )}
          </>
        }
      >
        <ScratchPad
          TestController={TestController}
          test={test}
          testIndex={testIndex}
          dynamic={dynamic}
          staticArguments={staticArguments}
        />
        {children}
      </ExpandableSection>
    </section>
  );
};

export default TestContainer;
