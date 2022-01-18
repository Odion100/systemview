import React, { useState } from "react";
import ExpandableSection from "../../molecules/ExpandableSection/ExpandableSection";
import TestCaption from "../../molecules/TestCaption/TestCaption";
import QuickTestSection from "../QuickTestSection/QuickTestSection";
import "./styles.scss";

const AuxillaryTestSection = ({ caption, TestController, testData }) => {
  const classname = "auxillary-test-section";

  return (
    <section className={classname}>
      <ExpandableSection
        open={true}
        title={
          <>
            <TestCaption caption={`${caption}`} />
            <AddButton onClick={TestController.addTest} />
          </>
        }
        title_color="#0d8065"
      >
        <div className={`${classname}__test-data`}>
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

const AddButton = ({ onClick }) => {
  return (
    <span className="add-btn btn" onClick={onClick}>
      +
    </span>
  );
};
export default AuxillaryTestSection;
