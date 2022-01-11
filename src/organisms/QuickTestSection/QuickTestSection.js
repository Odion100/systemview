import React from "react";
import ExpandableSection from "../../molecules/ExpandableSection/ExpandableSection";
import TestCaption from "../../molecules/TestCaption/TestCaption";
import ScratchPad from "../ScratchPad/ScratchPad";

import "./styles.scss";

const QuickTestSection = ({
  project_code,
  service_id,
  module_name,
  method_name,
  open,
  title,
  onSubmit,
  children,
  dynamic,
  onReset,
  TestController,
  testData,
}) => {
  const classname = "quick-test";
  return (
    <section className={classname}>
      <ExpandableSection
        open={open}
        title_color="#0d8065"
        title={<TestCaption caption={<b>{title}</b>} useInput={true} />}
      >
        <ScratchPad
          project_code={project_code}
          service_id={service_id}
          module_name={module_name}
          method_name={method_name}
          TestController={TestController}
          test={testData[0]}
          test_index={0}
          onSubmit={onSubmit}
          dynamic={dynamic}
          onReset={onReset}
        />
        {children}
      </ExpandableSection>
    </section>
  );
};

export default QuickTestSection;
