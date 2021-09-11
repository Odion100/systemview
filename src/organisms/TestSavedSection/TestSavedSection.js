import React from "react";
import ExpandableSection from "../../molecules/ExpandableSection/ExpandableSection";
import TestPanelCaption from "../../atoms/TestPanelCaption/TestPanelCaption";
import "./styles.scss";

const TestSavedSection = ({ project_code, service_id, module_name, method_name }) => {
  return (
    <section className="test-saved-section">
      <ExpandableSection
        title={
          <div>
            <TestPanelCaption text="Saved Tests:" />
          </div>
        }
        title_color="#0d8065"
      >
        <div className="test-saved-section__test-data">
          <span>no saved tests</span>
        </div>
      </ExpandableSection>
    </section>
  );
};

export default TestSavedSection;
