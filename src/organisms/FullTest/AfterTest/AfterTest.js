import React from "react";
import MultiTestSection from "../../MultiTestSection/MultiTestSection";
import "./styles.scss";

const AfterTest = ({ TestSection, TestController }) => {
  return (
    <MultiTestSection
      dynamic={true}
      TestSection={TestSection}
      TestController={TestController}
      caption="After"
    />
  );
};

export default AfterTest;
