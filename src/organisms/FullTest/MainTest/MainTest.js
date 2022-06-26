import React from "react";
import Evaluations from "./Evaluations";
import TestContainer from "../../TestContainer/TestContainer";

import "./styles.scss";

const MainTest = ({ TestController, testData }) => {
  return (
    <section className="current-data-section">
      <TestContainer
        title="Main Test:"
        open={true}
        test={testData[0]}
        test_index={0}
        TestController={TestController}
      >
        <Evaluations test={testData[0]} />
      </TestContainer>
    </section>
  );
};

export default MainTest;
