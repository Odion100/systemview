import React from "react";
import MultiTestSection from "../../MultiTestSection/MultiTestSection";
import "./styles.scss";

const BeforeTest = ({ testData, TestController }) => {
  return (
    <MultiTestSection
      dynamic={true}
      testData={testData}
      TestController={TestController}
      caption="Before Test"
    />
  );
};

export default BeforeTest;
