import React from "react";
import MultiTestSection from "../../MultiTestSection/MultiTestSection";
import "./styles.scss";

const BeforeTest = ({ TestSection, TestController }) => {
  return (
    <MultiTestSection
      dynamic={true}
      TestSection={TestSection}
      TestController={TestController}
      caption="Before"
    />
  );
};

export default BeforeTest;
