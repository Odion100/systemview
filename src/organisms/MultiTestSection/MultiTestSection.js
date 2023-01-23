import React from "react";
import ExpandableSection from "../../molecules/ExpandableSection/ExpandableSection";
import TestCaption from "../../molecules/TestCaption/TestCaption";
import TestContainer from "../TestContainer/TestContainer";
import Argument from "../FullTest/components/Argument.class";
import "./styles.scss";

const MultiTestSection = ({
  caption,
  TestController,
  testData,
  dynamic,
  nsp,
  arg = {},
  staticArguments,
}) => {
  const className = "multi-test-section";
  const addTest = () =>
    TestController.addTest(
      nsp,
      arg.name && [new Argument(arg.name, arg.Tests, arg.input_type)]
    );

  return (
    <section className={className}>
      <ExpandableSection
        open={false}
        title={
          <>
            <TestCaption caption={`${caption}`} />
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
