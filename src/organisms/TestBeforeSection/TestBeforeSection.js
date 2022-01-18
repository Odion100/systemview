import React from "react";
import AuxillaryTestSection from "../../organisms/AuxillaryTestSection/AuxillaryTestSection";
import "./styles.scss";

const TestBeforeSection = ({ testData, TestController }) => {
  return (
    <AuxillaryTestSection
      testData={testData}
      TestController={TestController}
      caption="Before Test"
    />
  );
};

export default TestBeforeSection;
