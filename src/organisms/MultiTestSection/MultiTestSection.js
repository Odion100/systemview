import React, { useState } from "react";
import ExpandableSection from "../../molecules/ExpandableSection/ExpandableSection";
import TestCaption from "../../molecules/TestCaption/TestCaption";
import TestContainer from "../TestContainer/TestContainer";
import Argument from "../FullTest/components/Argument.class";

import "./styles.scss";
import Count from "../../atoms/Count";

const MultiTestSection = ({
  caption,
  TestController,
  testData,
  dynamic,
  namespace,
  arg = {},
  staticArguments,
}) => {
  const className = "multi-test-section";
  const [open, setOpen] = useState(false);

  const toggleExpansion = () => {
    setOpen((state) => !state);
  };

  const addTest = () => {
    TestController.addTest(
      namespace,
      arg.name && [new Argument(arg.name, arg.Tests, arg.input_type)]
    );
    testData.length === 1 && setOpen(true);
    console.log("Arguments", testData);
  };
  return (
    <section className={className}>
      <ExpandableSection
        toggleExpansion={toggleExpansion}
        open={open}
        title={
          <>
            <TestCaption
              caption={
                <span>
                  {caption} {testData.length > 0 && <Count count={testData.length} />}
                </span>
              }
            />
            <AddButton onClick={addTest} className={className} />
          </>
        }
        title_color="#0d8065"
      >
        <div className={`${className}__test-data`}>
          {testData.length > 0 ? (
            testData.map((test, i) => (
              <TestContainer
                key={i}
                TestController={TestController}
                test={test}
                test_index={i}
                title={`${i + 1}:`}
                title_color={"#4b53b3"}
                dynamic={dynamic}
                open={true}
                staticArguments={staticArguments}
                multiTest
              />
            ))
          ) : (
            <span>no actions</span>
          )}
        </div>
      </ExpandableSection>
    </section>
  );
};

const AddButton = ({ onClick, className }) => {
  return (
    <span className={`${className}__add-btn btn`} onClick={onClick}>
      +
    </span>
  );
};
export default MultiTestSection;
