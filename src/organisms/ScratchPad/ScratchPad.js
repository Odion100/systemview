import React, { useContext, useEffect, useState } from "react";
import ReactJson from "react-json-view";
import JsonTextBox from "../../atoms/JsonTextBox/JsonTextBox";
import TestsIcon from "../../atoms/TestsIcon/TestsIcon";
import ServiceContext from "../../ServiceContext";
import { Client } from "tasksjs-react-client";
import "./styles.scss";

const testfn = (data) => console.log(data);
const ScratchPad = ({ project_code, service_id, module_name, method_name, testData, onSubmit }) => {
  const { TestServices } = useContext(ServiceContext);
  const connections = {};
  connections[project_code] = {};
  const [connected_services, setConnecteServices] = useState(connections);
  const [showTxb, setShowTxb] = useState(false);
  const [jsonData, setJsonData] = useState(testData);
  const [responseData, setResponseData] = useState({});
  const [responseNamespace, setResponseNamespace] = useState("");

  const showJsonTxb = () => setShowTxb(true);
  const hideJsonTxb = () => setShowTxb(false);
  const JsonTxbSubmit = (json) => {
    setJsonData(json);
    hideJsonTxb();
  };

  const runTest = async () => {
    try {
      const results = await connected_services[project_code][service_id][module_name][method_name](
        jsonData
      );

      setResponseData(results);
      setResponseNamespace("results");
      if (typeof onSubmit === "function") onSubmit(results, "results");
    } catch (error) {
      setResponseData(error);
      setResponseNamespace("error");
      if (typeof onSubmit === "function") onSubmit(error, "error");
    }
  };
  useEffect(() => {
    if (TestServices.length > 0) {
      const service = TestServices.find(
        (_service) => _service.project_code === project_code && _service.service_id === service_id
      );
      if (!service) return console.log("service not found");
      if (!Client.loadedServices[service.url])
        Client.loadService(service.url).then((_service) => {
          connected_services[project_code][service_id] = _service;
          setConnecteServices(connected_services);
        });
      else console.log("already loaded");
    }
  }, [project_code, service_id, TestServices]);

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
