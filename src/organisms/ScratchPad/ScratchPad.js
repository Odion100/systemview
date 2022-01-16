import React, { useContext, useEffect, useState } from "react";
import ReactJson from "react-json-view";
import TestsIcon from "../../atoms/TestsIcon/TestsIcon";
import AutoCompletBox from "../../molecules/AutoCompleteBox/AutoCompleteBox";
import Args from "../../molecules/Args/Args";
import ServiceContext from "../../ServiceContext";
import "./styles.scss";

const ScratchPad = ({ TestController, test, test_index = 0, dynamic = false }) => {
  console.log(test);
  const { project_code, service_id, module_name, method_name } = test.namespace;
  const { TestServices } = useContext(ServiceContext);
  const [test_suggestions, setSuggestions] = useState([]);
  const [text_length, setLength] = useState(0);
  const [conn_str, setConnStr] = useState(`${service_id}.${module_name}.${method_name}`);

  const runTest = async () => {
    TestController.runTest(test_index);
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
    setSuggestions(new_suggestions);
  };

  const changeConnection = (namespaces) => {
    const [service_id, module_name, method_name] = namespaces
      .substr(0, namespaces.length - 1)
      .split(".");
    TestController.updateNamespace(test_index, { service_id, module_name, method_name });
  };

  const clearResponse = () => {
    TestController.resetResults(test_index);
  };

  useEffect(() => createSuggestions(), [project_code, TestServices]);
  useEffect(() => {
    const new_namespace = `${service_id}.${module_name}.${method_name}`;
    setConnStr(new_namespace);
    setLength((new_namespace || "").length + 0.3);
  }, [test.namespace, TestServices]);

  const style = { "--text-length": text_length ? text_length + "ch" : "auto" };
  return (
    <div className="scratchpad" style={style}>
      <div className="scratchpad__test-data-container">
        <div className="scratchpad__btn-container">
          <span className="scratchpad__run-test-btn btn" onClick={runTest}>
            <TestsIcon isSaved={true} />
          </span>
        </div>
        <div className="scratchpad__test-data">
          <AutoCompletBox
            className="scratchpad__test-method-input"
            suggestions={test_suggestions}
            onSubmit={changeConnection}
            value={`${conn_str}`}
            disabled={!dynamic}
          />
          <span className="scratchpad__test-data__parentheses">{"("}</span>
          <Args args={test.args} controller={TestController} test_index={test_index} />
          <span className="scratchpad__test-data__parentheses">{")"}</span>
        </div>
        <div
          className={`scratchpad__response-data scratchpad__response-data--visible-${
            test.test_end !== null
          }`}
        >
          <span onClick={clearResponse} className={`scratchpad__response-data__clear-btn btn`}>
            x
          </span>
          <ReactJson
            src={test.results || {}}
            name={test.response_type}
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
