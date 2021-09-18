import React, { useContext, useEffect, useState } from "react";
import ReactJson from "react-json-view";
import JsonTextBox from "../../atoms/JsonTextBox/JsonTextBox";
import TestsIcon from "../../atoms/TestsIcon/TestsIcon";
import AutoCompletBox from "../../molecules/AutoCompleteBox/AutoCompleteBox";
import ServiceContext from "../../ServiceContext";
import { Client } from "tasksjs-react-client";
import "./styles.scss";

const testfn = (data) => console.log(data);
const ScratchPad = ({
  project_code,
  service_id,
  module_name,
  method_name,
  testData,
  onSubmit,
  mode,
}) => {
  const { TestServices } = useContext(ServiceContext);
  console.log(TestServices);
  const [connectedServices, setConnection] = useState({});
  const [showTxb, setShowTxb] = useState(false);
  const [jsonData, setJsonData] = useState(testData);
  const [responseData, setResponseData] = useState({});
  const [responseNamespace, setResponseNamespace] = useState("");
  const [test_suggestions, setSuggestions] = useState([]);
  const [testConfig, setConftig] = useState({
    project_code,
    service_id,
    module_name,
    method_name,
  });
  const runTest = async () => {
    console.log(connectedServices);
    try {
      const results = await connectedServices[service_id][module_name][method_name](jsonData);
      console.log(results, "klsdkfjlks");
      setResponseData(results);
      setResponseNamespace("results");
      if (typeof onSubmit === "function") onSubmit(results, "results");
    } catch (error) {
      console.log(error);
      setResponseData(error);
      setResponseNamespace("error");
      if (typeof onSubmit === "function") onSubmit(error, "error");
    }
  };

  const createSuggestions = () => {
    const new_suggestions = [];
    TestServices.forEach((service) => {
      service.server_modules.forEach((server_module) => {
        server_module.methods.forEach((method) => {
          new_suggestions.push(`${service.service_id}.${server_module.name}.${method.fn}()`);
        });
      });
    });
    console.log(new_suggestions);

    setSuggestions(new_suggestions);
  };

  const getConnection = () => {
    if (TestServices.length > 0) {
      const service = TestServices.find(
        (_service) =>
          _service.project_code === testConfig.project_code &&
          _service.service_id === testConfig.service_id
      );
      if (!service) return console.log("service not found");
      if (!Client.loadedServices[service.url])
        Client.loadService(service.url)
          .then((_service) => {
            connectedServices[service_id] = _service;
            setConnection(connectedServices);
          })
          .catch((error) => console.log(error));
      else {
        connectedServices[service_id] = Client.loadedServices[service.url];
        setConnection(connectedServices);
      }
    }
  };

  const showJsonTxb = () => setShowTxb(true);
  const hideJsonTxb = () => setShowTxb(false);
  const JsonTxbSubmit = (json) => {
    setJsonData(json);
    hideJsonTxb();
  };

  useEffect(() => createSuggestions(), [project_code]);
  useEffect(() => getConnection(), [project_code, service_id, TestServices]);

  return (
    <div className="scratchpad">
      <div className={`scratchpad__json-txb scratchpad__json-txb--show-${showTxb}`}>
        <JsonTextBox onSubmit={JsonTxbSubmit} onCancel={hideJsonTxb} obj={jsonData} />
      </div>
      <div className="scratchpad__test-data-container">
        <div className="scratchpad__btn-container">
          <span className="scratchpad__add-json-btn" onClick={showJsonTxb}>
            +JSON
          </span>
          <span className="scratchpad__run-test-btn" onClick={runTest}>
            <TestsIcon isSaved={true} />
          </span>
        </div>
        <div className="scratchpad__test-data">
          <AutoCompletBox
            className="scratchpad__test-method-input"
            suggestions={test_suggestions}
            value={`${testConfig.service_id}.${testConfig.module_name}.${testConfig.method_name}(`}
          />
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
        <div
          className={`scratchpad__response-data scratchpad__response-data--visible-${!!responseData.status}`}
        >
          <ReactJson
            src={responseData}
            name={responseNamespace}
            displayObjectSize={false}
            displayDataTypes={false}
            collapsed={true}
          />
        </div>
      </div>
    </div>
  );
};

export default ScratchPad;
