import React, { useContext, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import AutoCompleteBox from "../../molecules/AutoCompleteBox/AutoCompleteBox";
import Args, { Argument } from "../../molecules/Args/Args";
import ServiceContext from "../../ServiceContext";
import "./styles.scss";
import Evaluations from "../TestPanel/Evaluations";
import EVAL_ICON from "../../assets/eval-icon.svg";

const ScratchPad = ({
  TestController,
  test,
  testIndex = 0,
  dynamic = false,
  staticArguments = false,
}) => {
  const placeholder = "service.module.method ";
  // The CURRENT PROJECT comes from the page URL — a test namespace never carries a projectCode, so
  // this is the only scope the step picker can trust.
  const { projectCode } = useParams();
  const { serviceId, moduleName, methodName } = test.namespace;
  const [nsp, setNsp] = useState(
    methodName ? `${serviceId}.${moduleName}.${methodName}` : ""
  );
  const [text_length, setLength] = useState(placeholder.length + 0.4);
  const [test_suggestions, setSuggestions] = useState([]);
  const { connectedServices } = useContext(ServiceContext);
  const [testResults, setTestResults] = useState(test.results);

  const runTest = async () => {
    TestController.runTest(testIndex);
  };
  const createSuggestions = () => {
    const new_suggestions = [];
    // An EVENTS step listens on a service.module's `on` (its methodName is "on"). For those, offer
    // `service.module.on()` across ALL services — you may want to assert a side-effect event on a service
    // OTHER than main's. A normal step offers the real methods.
    const isEvent = test.namespace.methodName === "on";
    // Only the CURRENT PROJECT's services — a step targets namespaces within the project, never
    // another project's (no projectCode on the URL = show everything, e.g. outside /specs routes).
    const scoped = projectCode
      ? connectedServices.filter((s) => s.projectCode === projectCode)
      : connectedServices;
    scoped.forEach((service) => {
      service.system.connectionData.modules.forEach((mod) => {
        if (isEvent) {
          new_suggestions.push(`${service.serviceId}.${mod.name}.on()`);
        } else {
          mod.methods.forEach((method) => {
            new_suggestions.push(`${service.serviceId}.${mod.name}.${method.fn}()`);
          });
        }
      });
    });
    setSuggestions(new_suggestions);
  };

  const changeConnection = (namespaces) => {
    //remove open-close parentheses
    namespaces = namespaces.slice(0, -2);
    const [serviceId, moduleName, methodName] = namespaces.split(".");
    TestController.updateNamespace(testIndex, { serviceId, moduleName, methodName });
  };

  const clearResponse = () => {
    TestController.resetResults(testIndex);
  };
  const resetLength = () => setLength(placeholder.length + 0.4);

  const toggleValidationStatus = () => {
    TestController.updateValidationStatus(testIndex);
  };
  useEffect(() => {
    setTestResults(test.results);
  }, [test.results]);
  useEffect(() => createSuggestions(), [projectCode, connectedServices]);
  useEffect(() => {
    const new_namespace = methodName ? `${serviceId}.${moduleName}.${methodName}` : "";
    setNsp(new_namespace);
    setLength((new_namespace || placeholder).length + 0.4);
  }, [test.namespace, connectedServices]);

  const style = { "--text-length": text_length ? text_length + "ch" : "auto" };
  return (
    <div className="scratchpad" style={style}>
      <div className="scratchpad__test-data-container">
        <div className="scratchpad__btn-container">
          <button type="button" className="scratchpad__run-test-btn" onClick={runTest}>
            ▶ Run
          </button>
        </div>
        <div className="scratchpad__test-data">
          <AutoCompleteBox
            className="scratchpad__test-method-input"
            suggestions={test_suggestions}
            onSubmit={changeConnection}
            value={`${nsp}`}
            disabled={!dynamic}
            placeholder={placeholder}
            onBlur={resetLength}
          />
          <span className="scratchpad__test-data__parentheses">{"("}</span>
          <Args
            args={test.args}
            controller={TestController}
            testIndex={testIndex}
            locked={staticArguments}
          />
          <span className="scratchpad__test-data__parentheses">{")"}</span>
        </div>
        <div
          className={`scratchpad__response-data scratchpad__response-data--visible-${
            test.test_end !== null
          }`}
        >
          <span
            onClick={clearResponse}
            className={`scratchpad__response-data__clear-btn btn`}
          >
            x
          </span>
          <span onClick={toggleValidationStatus} className={`scratchpad__eval-btn btn`}>
            {test.shouldValidate ? (
              <img style={{ width: 12 }} src={EVAL_ICON} alt="eval" />
            ) : (
              " + "
            )}
          </span>

          <div
            className={`scratchpad__response-value ${
              test.response_type === "error" ? "scratchpad__response-value--error" : ""
            }`}
          >
            <span className={`scratchpad__response-type`}>{test.response_type}</span>
            <Argument value={testResults} />
          </div>
        </div>
        <Evaluations
          updateTests={TestController.updateTests.bind({}, testIndex)}
          test={test}
        />
      </div>
    </div>
  );
};

export default ScratchPad;
