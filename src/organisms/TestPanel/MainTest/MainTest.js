import React from "react";
import Evaluations from "../Evaluations";
import TestContainer from "../../TestContainer/TestContainer";

import "./styles.scss";

const MainTest = ({ TestController, TestSection }) => {
  return (
    <section className="current-data-section">
      <TestContainer
        title="Main:"
        open={true}
        test={TestSection[0]}
        testIndex={0}
        TestController={TestController}
      >
        <Evaluations
          updateEvaluations={TestController.updateEvaluations.bind({}, 0)}
          test={TestSection[0]}
        />
      </TestContainer>
    </section>
  );
};

export default MainTest;
