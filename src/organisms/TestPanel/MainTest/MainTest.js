import React from "react";
import TestContainer from "../../TestContainer/TestContainer";

import "./styles.scss";

// RFC-020 — Main can hold MULTIPLE steps (it's an array under the hood; it just used to render step 0).
// They render IDENTICALLY — each titled "Main:", no 1/2/3 distinction — with the same look Main always
// had (not the boxed MultiTestSection wrapper). A + adds another main step; delete shows once there's
// more than one (so the last can't be removed).
const MainTest = ({ TestController, TestSection }) => {
  return (
    <section className="current-data-section">
      {TestSection.map((test, i) => (
        <TestContainer
          key={i}
          title="Main:"
          open={true}
          test={test}
          testIndex={i}
          TestController={TestController}
          multiTest={TestSection.length > 1}
          // Main steps are EDITABLE (namespace picker unlocked) — the test's save-target lives on the
          // chip now, and saving enforces that ≥1 Main step still points at it.
          dynamic={true}
        />
      ))}
    </section>
  );
};

export default MainTest;
