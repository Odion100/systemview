import React, { useState, useEffect } from "react";
import ExpandableSection from "../../molecules/ExpandableSection/ExpandableSection";
import TestPanelCaption from "../../atoms/TestPanelCaption/TestPanelCaption";
import ScratchPad from "../../organisms/ScratchPad/ScratchPad";
import "./styles.scss";

const TestDataSection = ({
  project_code,
  service_id,
  module_name,
  method_name,
  open,
  testData,
}) => {
  return (
    <section className="test-data-section">
      <ExpandableSection
        open={open}
        title_color="#0d8065"
        title={<TestPanelCaption text="Test:" />}
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

export default TestDataSection;
