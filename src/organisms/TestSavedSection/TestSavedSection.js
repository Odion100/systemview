import React from "react";
import ReactJson from "react-json-view";
import ExpandableSection from "../../molecules/ExpandableSection/ExpandableSection";
import TestPanelCaption from "../../atoms/TestPanelCaption/TestPanelCaption";
import "./styles.scss";

const testfn = (data) => console.log(data);
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
          {`${service_id}.${module_name}.${method_name}`}(
          <ReactJson
            src={{}}
            name="data"
            onAdd={testfn}
            onEdit={testfn}
            onDelete={testfn}
            displayObjectSize={false}
            displayDataTypes={false}
            collapsed={true}
          />
          )
        </div>
      </ExpandableSection>
    </section>
  );
};

export default TestSavedSection;