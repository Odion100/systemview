import React from "react";
import MultiTestSection from "../../MultiTestSection/MultiTestSection";
import "./styles.scss";

const AfterTest = ({ testData, TestController }) => {
  return (
    <MultiTestSection
      dynamic={true}
      testData={testData}
      TestController={TestController}
      caption="After"
    />
  );
};

export default AfterTest;
