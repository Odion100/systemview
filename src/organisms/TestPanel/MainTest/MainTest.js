import React from "react";
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
      />
    </section>
  );
};

export default MainTest;
