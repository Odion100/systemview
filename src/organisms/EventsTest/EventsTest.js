import React from "react";
import Evaluations from "./Evaluations";
import TestContainer from "../TestContainer/TestContainer";

import "./styles.scss";

const EventsTestSection = ({ TestController, testData, test_index }) => {
  return (
    <section className="current-data-section">
      <TestContainer
        title="Events Test:"
        open={true}
        test={testData[0]}
        test_index={test_index}
        TestController={TestController}
      >
        <Evaluations test={testData[0]} />
      </TestContainer>
    </section>
  );
};

export default EventsTestSection;
