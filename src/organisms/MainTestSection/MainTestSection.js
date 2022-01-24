import React from "react";
import Evaluations from "./Evaluations";
import QuickTestSection from "../QuickTestSection/QuickTestSection";

import "./styles.scss";

const MainTest = ({ TestController, testData }) => {
  return (
    <section className="current-data-section">
      <QuickTestSection
        title="Main Test:"
        open={true}
        test={testData[0]}
        test_index={0}
        TestController={TestController}
      >
        <Evaluations test={testData[0]} />
      </QuickTestSection>
    </section>
  );
};

export default MainTest;
