import React from "react";
import AuxillaryTestSection from "../../organisms/AuxillaryTestSection/AuxillaryTestSection";
import "./styles.scss";

const TestAfterSection = ({ project_code, testData, TestController }) => {
  return (
    <AuxillaryTestSection
      project_code={project_code}
      testData={testData}
      TestController={TestController}
      caption="Test After"
    />
  );
};

export default TestAfterSection;
