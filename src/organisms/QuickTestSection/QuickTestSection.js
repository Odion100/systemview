import React from "react";
import ExpandableSection from "../../molecules/ExpandableSection/ExpandableSection";
import TestCaption from "../../molecules/TestCaption/TestCaption";
import ScratchPad from "../ScratchPad/ScratchPad";

import "./styles.scss";

const QuickTestSection = ({ open, title, children, dynamic, TestController, testData }) => {
  const classname = "quick-test";
  return (
    <section className={classname}>
      <ExpandableSection
        open={open}
        title_color="#0d8065"
        title={<TestCaption caption={<b>{title}</b>} useInput={true} />}
      >
        <ScratchPad
          TestController={TestController}
          test={testData[0]}
          test_index={0}
          dynamic={dynamic}
        />
        {children}
      </ExpandableSection>
    </section>
  );
};

export default QuickTestSection;
