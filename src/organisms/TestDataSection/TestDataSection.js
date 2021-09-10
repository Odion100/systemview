import React, { useState, useEffect } from "react";
import ReactJson from "react-json-view";
import ExpandableSection from "../../molecules/ExpandableSection/ExpandableSection";
import AddButton from "../../atoms/AddButton/AddButton";
import TestPanelCaption from "../../atoms/TestPanelCaption/TestPanelCaption";
import JsonTextBox from "../../atoms/JsonTextBox/JsonTextBox";
import "./styles.scss";

const testfn = (data) => console.log(data);
const TestDataSection = ({ project_code, service_id, module_name, method_name }) => {
  const [showTxb, setShowTxb] = useState(false);
  const [testData, setTestData] = useState(undefined);

  const showJsonTxb = () => setShowTxb(true);
  const hideJsonTxb = () => setShowTxb(false);
  const JsonTxbSubmit = (json) => {
    setTestData(json);
    hideJsonTxb();
  };
  return (
    <section className="test-data-section">
      <ExpandableSection
        open={true}
        title={
          <div>
            <TestPanelCaption text="Test:" />
            <AddButton hiddenCaption="json test data" onClick={showJsonTxb} />
          </div>
        }
        title_color="#0d8065"
      >
        <div className={`test-data-section__json-txb test-data-section__json-txb--show-${showTxb}`}>
          <JsonTextBox onSubmit={JsonTxbSubmit} onCancel={hideJsonTxb} obj={testData} />
        </div>
        <div className="test-data-section__test-data">
          {`${service_id}.${module_name}.${method_name}`}(
          <ReactJson
            src={testData}
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
