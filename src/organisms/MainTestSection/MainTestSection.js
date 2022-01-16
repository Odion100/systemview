import React, { useState } from "react";
import Evaluations from "./Evaluations";
import QuickTestSection from "../QuickTestSection/QuickTestSection";

import "./styles.scss";

const MainTest = ({ TestController, testData }) => {
  return (
    <section className="current-data-section">
      <QuickTestSection
        title="Test:"
        open={true}
        testData={testData}
        TestController={TestController}
      >
        <Evaluations test={testData[0]} />
      </QuickTestSection>
    </section>
  );
};

export default MainTest;
