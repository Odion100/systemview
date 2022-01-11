import React from "react";
import AuxillaryTestSection from "../../organisms/AuxillaryTestSection/AuxillaryTestSection";
import "./styles.scss";

const TestBeforeSection = ({ project_code, testData, TestController }) => {
  return (
    <AuxillaryTestSection
      project_code={project_code}
      testData={testData}
      TestController={TestController}
      caption="Test Before"
    />
  );
};

export default TestBeforeSection;
