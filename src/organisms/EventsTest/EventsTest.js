import React from "react";
import Evaluations from "./Evaluations";
import QuickTestSection from "../QuickTestSection/QuickTestSection";

import "./styles.scss";

const EventsTestSection = ({ TestController, testData, test_index }) => {
  return (
    <section className="current-data-section">
      <QuickTestSection
        title="Events Test:"
        open={true}
        test={testData[0]}
        test_index={test_index}
        TestController={TestController}
      >
        <Evaluations test={testData[0]} />
      </QuickTestSection>
    </section>
  );
};

export default EventsTestSection;
