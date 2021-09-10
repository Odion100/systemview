import React from "react";
import ReactJson from "react-json-view";
import ExpandableSection from "../../molecules/ExpandableSection/ExpandableSection";
import AddButton from "../../atoms/AddButton/AddButton";
import TestPanelCaption from "../../atoms/TestPanelCaption/TestPanelCaption";
import TestDataSection from "../../organisms/TestDataSection/TestDataSection";
import "./styles.scss";

const testfn = (data) => console.log(data);
const TestBeforeSection = ({ project_code, service_id, module_name, method_name }) => {
  return (
    <section className="test-before-section">
      <ExpandableSection
        title={
          <div>
            <TestPanelCaption text="Before Test:" />
            <AddButton hiddenCaption="action before test" />
          </div>
        }
        title_color="#0d8065"
      >
        <div className="test-before-section__test-data">
          <TestDataSection />
          <TestDataSection /> <TestDataSection />
        </div>
      </ExpandableSection>
    </section>
  );
};

export default TestBeforeSection;
