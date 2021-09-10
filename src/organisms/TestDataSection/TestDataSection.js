import React from "react";
import ReactJson from "react-json-view";
import ExpandableSection from "../../molecules/ExpandableSection/ExpandableSection";
import AddButton from "../../atoms/AddButton/AddButton";
import TestPanelCaption from "../../atoms/TestPanelCaption/TestPanelCaption";
import JsonTextBox from "../../atoms/JsonTextBox/JsonTextBox";
import "./styles.scss";

const testfn = (data) => console.log(data);
const TestDataSection = ({ project_code, service_id, module_name, method_name }) => {
  return (
    <section className="test-data-section">
      <JsonTextBox onSubmit={(value) => console.log(value)} />
      <ExpandableSection
        title={
          <div>
            <TestPanelCaption text="Test Data:" />
            <AddButton hiddenCaption="json test data" />
          </div>
        }
        title_color="#0d8065"
      >
        <div className="test-data-section__test-data">
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

export default TestDataSection;
