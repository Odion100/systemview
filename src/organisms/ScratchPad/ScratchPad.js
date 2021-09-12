import React, { useState } from "react";
import ReactJson from "react-json-view";
import JsonTextBox from "../../atoms/JsonTextBox/JsonTextBox";
import "./styles.scss";

const testfn = (data) => console.log(data);
const TestDataSection = ({ project_code, service_id, module_name, method_name, testData }) => {
  const [showTxb, setShowTxb] = useState(false);
  const [jsonData, setJsonData] = useState(testData);

  const showJsonTxb = () => setShowTxb(true);
  const hideJsonTxb = () => setShowTxb(false);
  const JsonTxbSubmit = (json) => {
    setJsonData(json);
    hideJsonTxb();
  };
  return (
    <div className="scratchpad">
      <div className={`scratchpad__json-txb scratchpad__json-txb--show-${showTxb}`}>
        <JsonTextBox onSubmit={JsonTxbSubmit} onCancel={hideJsonTxb} obj={jsonData} />
      </div>
      <div className="scratchpad__test-data-container">
        <span className="scratchpad__add-json-btn" onClick={showJsonTxb}>
          +JSON
        </span>
        <div className="scratchpad__test-data"></div>
        {`${service_id}.${module_name}.${method_name}`}(
        <ReactJson
          src={jsonData}
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
      <span>Run Test</span>
    </div>
  );
};

export default TestDataSection;
