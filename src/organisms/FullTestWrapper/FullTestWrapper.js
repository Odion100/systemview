import React, { useState, useContext } from "react";
import TestBeforeSection from "../TestBeforeSection/TestBeforeSection";
import TestAfterSection from "../TestAfterSection/TestAfterSection";
import MainTestSection from "../MainTestSection/MainTestSection";
import ServiceContext from "../../ServiceContext";
import { getType } from "../MainTestSection/validations";

const FullTestWrapper = ({ project_code, service_id, module_name, method_name }) => {
  const [state, updateState] = useState(false);
  const createTest = (namespace, args) => ({
    title: "",
    args: args || [],
    results: null,
    response_type: "",
    namespace: namespace || { service_id: "", module_name: "", method_name: "" },
  });
  const createArg = (value, name, target_value) => ({
    value,
    data_type: getType(value),
    name: name || "argument",
    target_value: target_value || [],
  });
  const { TestServices } = useContext(ServiceContext);
  const [testBefore, setTestBefore] = useState([]);
  const [testAfter, setTestAfter] = useState([]);
  const [testMain, setTestMain] = useState([
    createTest({ namespace: { project_code, service_id, module_name, method_name } }),
  ]);

  const getArgs = (argData) =>
    argData.map(({ value }) => {
      return value;
    });
  const runFullTest = () => {
    const setStates = [setTestBefore, setTestMain, setTestAfter];

    [testBefore, testMain, testAfter].forEach((testData, i) =>
      testData.forEach(async (test, a) => {
        try {
          const { service_id, module_name, method_name } = test.namespace;
          const _args = getArgs(test.args);
          test.results = await TestServices[service_id][module_name][method_name].apply({}, _args);
          test.response_type = "success";
          setStates[i](testData);
        } catch (error) {
          test.results = error;
          test.response_type = "error";
          setStates[i](testData);
        }
      })
    );
  };
  const TestController = function (setState) {
    const testData = this;
    const addTest = () => {
      testData.push(createTest());
      setState(testData);
      updateState(!state);
    };
    const deleteTest = (index) => {
      testData.spice(index, 1);
      setState(testData);
      updateState(!state);
    };

    const addArg = (index, value, name, target_value) => {
      testData[index].args.push(createArg(value, name, target_value));
      setState(testData);
      updateState(!state);
    };

    const deleteArg = (index, argIndex) => {
      testData[index].args.splice(argIndex, 1);
      setState(testData);
      updateState(!state);
    };
    const editArg = (index, argIndex, value, data_type, name, target_value) => {
      testData[index].args[argIndex] = {
        value,
        data_type,
        name,
        target_value,
      };
      setState(testData);
      updateState(!state);
    };
    return { addTest, deleteTest, addArg, deleteArg, editArg, runFullTest };
  };

  return (
    <>
      <div className="row test-panel__section">
        <TestBeforeSection
          project_code={project_code}
          TestController={TestController.apply(testBefore, [setTestBefore])}
          testData={testBefore}
        />
      </div>
      <div className="row test-panel__section">
        <MainTestSection
          project_code={project_code}
          service_id={service_id}
          module_name={module_name}
          method_name={method_name}
          TestController={TestController.apply(testMain, [setTestMain])}
          testData={testMain}
        />
      </div>
      <div className="row test-panel__section">
        <TestAfterSection
          project_code={project_code}
          TestController={TestController.apply(testAfter, [setTestAfter])}
          testData={testAfter}
        />
      </div>
    </>
  );
};

export default FullTestWrapper;
