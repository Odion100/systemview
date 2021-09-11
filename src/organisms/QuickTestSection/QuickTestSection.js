import React from "react";
import ExpandableSection from "../../molecules/ExpandableSection/ExpandableSection";
import TestPanelCaption from "../../atoms/TestPanelCaption/TestPanelCaption";
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
}) => {
  return (
    <section className="quick-test-section">
      <ExpandableSection
        open={open}
        title_color="#0d8065"
        title={<TestPanelCaption text={title} />}
      >
        <ScratchPad
          project_code={project_code}
          service_id={service_id}
          module_name={module_name}
          method_name={method_name}
          testData={testData}
        />
      </ExpandableSection>
    </section>
  );
};

export default QuickTestSection;
