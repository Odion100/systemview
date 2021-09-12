import React from "react";
import ExpandableSection from "../../molecules/ExpandableSection/ExpandableSection";
import AddButton from "../../atoms/AddButton/AddButton";
import TestPanelCaption from "../../atoms/TestPanelCaption/TestPanelCaption";
import QuickTestSection from "../../organisms/QuickTestSection/QuickTestSection";
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
          <QuickTestSection title="Action1:" />
          <QuickTestSection title="Action2:" /> <QuickTestSection title="Action3:" />
        </div>
      </ExpandableSection>
    </section>
  );
};

export default TestBeforeSection;
