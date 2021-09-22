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
  testData,
  title,
  onSubmit,
  children,
  dynamic,
  onReset,
}) => {
  const classname = "quick-test";
  return (
    <section className={classname}>
      <ExpandableSection
        open={open}
        title_color="#0d8065"
        title={<TestCaption caption={<b>{title}</b>} />}
      >
        <ScratchPad
          project_code={project_code}
          service_id={service_id}
          module_name={module_name}
          method_name={method_name}
          testData={testData}
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
