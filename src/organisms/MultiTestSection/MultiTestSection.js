import React from "react";
import ExpandableSection from "../../molecules/ExpandableSection/ExpandableSection";
import TestCaption from "../../molecules/TestCaption/TestCaption";
import TestContainer from "../TestContainer/TestContainer";
import "./styles.scss";

const MultiTestSection = ({ caption, TestController, testData }) => {
  const className = "multi-test-section";

  return (
    <section className={className}>
      <ExpandableSection
        open={true}
        title={
          <>
            <TestCaption caption={`${caption}`} />
            <AddButton onClick={TestController.addTest} className={className} />
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
                title={`Action${i + 1}:`}
                title_color={"#4b53b3"}
                dynamic={true}
                open={true}
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
