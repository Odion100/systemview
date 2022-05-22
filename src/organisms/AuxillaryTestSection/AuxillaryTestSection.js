import React from "react";
import ExpandableSection from "../../molecules/ExpandableSection/ExpandableSection";
import TestCaption from "../../molecules/TestCaption/TestCaption";
import QuickTestSection from "../QuickTestSection/QuickTestSection";
import "./styles.scss";

const AuxillaryTestSection = ({ caption, TestController, testData }) => {
  const className = "auxillary-test-section";

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
              <QuickTestSection
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
export default AuxillaryTestSection;
