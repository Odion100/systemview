import React, { useState } from "react";
import ExpandableSection from "../../molecules/ExpandableSection/ExpandableSection";
import TestCaption from "../../molecules/TestCaption/TestCaption";
import QuickTestSection from "../QuickTestSection/QuickTestSection";
import "./styles.scss";

const AuxillaryTestSection = ({ project_code, caption, TestController, testData }) => {
  const classname = "auxillary-test-section";
  const onSubmit = (index, results) => console.log(index, results);

  return (
    <section className={classname}>
      <ExpandableSection
        open={true}
        title={
          <>
            <TestCaption caption={`${caption}:`} />
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
                project_code={test.project_code}
                service_id={test.service_id}
                module_name={test.module_name}
                method_name={test.method_name}
                test={test}
                test_index={i}
                title={`Action${i + 1}:`}
                onSubmit={onSubmit}
                dynamic={true}
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
