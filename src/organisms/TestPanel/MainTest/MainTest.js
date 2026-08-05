import React from "react";
import TestContainer from "../../TestContainer/TestContainer";
import { StepShell } from "../../MultiTestSection/MultiTestSection";

import "./styles.scss";

// RFC-020 — Main can hold MULTIPLE steps (it's an array under the hood; it just used to render step 0).
// They render IDENTICALLY — each titled "Main:", no 1/2/3 distinction — with the same look Main always
// had (not the boxed MultiTestSection wrapper). A + adds another main step; delete shows once there's
// more than one (so the last can't be removed).
// RFC-023 — Main's steps wear the same StepShell as every editable section: drag to reorder / move
// across sections, ⧉ to duplicate. Main itself stays anchored — only its steps move.
const MainTest = ({ TestController, TestSection, sectionKey, onStepMove, onStepDuplicate }) => {
  return (
    <section className="current-data-section">
      {TestSection.map((test, i) => (
        <StepShell
          key={i}
          sectionKey={sectionKey}
          index={i}
          onStepMove={sectionKey ? onStepMove : undefined}
          onStepDuplicate={sectionKey ? onStepDuplicate : undefined}
          // Main's LAST step can't be deleted — the test always keeps one main step.
          onDelete={
            sectionKey && TestSection.length > 1
              ? () => TestController.deleteTest(i)
              : undefined
          }
        >
          <TestContainer
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
        </StepShell>
      ))}
    </section>
  );
};

export default MainTest;
