import React from "react";
import AuxillaryTestSection from "../../organisms/AuxillaryTestSection/AuxillaryTestSection";
import "./styles.scss";

const TestAfterSection = ({ project_code, testData, TestController }) => {
  return (
    <AuxillaryTestSection
      testData={testData}
      TestController={TestController}
      caption="After Test"
    />
  );
};

export default TestAfterSection;
