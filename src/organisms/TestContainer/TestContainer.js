import React from "react";
import ExpandableSection from "../../molecules/ExpandableSection/ExpandableSection";
import TestCaption from "../../molecules/TestCaption/TestCaption";
import ScratchPad from "../ScratchPad/ScratchPad";

import "./styles.scss";

const TestContainer = ({
  open,
  title,
  children,
  dynamic,
  TestController,
  test,
  test_index,
  title_color,
  staticArguments,
}) => {
  const className = "test-container";
  const deleteTest = () => {
    TestController.deleteTest(test_index);
  };
  return (
    <section className={className}>
      <ExpandableSection
        open={open}
        title_color={title_color || "#0d8065"}
        title={
          <>
            <TestCaption caption={<b>{title}</b>} useInput={true} />
            {
              <span className={`${className}__delete-btn btn delete-btn`} onClick={deleteTest}>
                x
              </span>
            }
          </>
        }
      >
        <ScratchPad
          TestController={TestController}
          test={test}
          test_index={test_index}
          dynamic={dynamic}
          staticArguments={staticArguments}
        />
        {children}
      </ExpandableSection>
    </section>
  );
};

export default TestContainer;
