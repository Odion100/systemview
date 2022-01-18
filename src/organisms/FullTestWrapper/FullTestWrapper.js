import React, { useState, useContext, useEffect } from "react";
import TestBeforeSection from "../TestBeforeSection/TestBeforeSection";
import TestAfterSection from "../TestAfterSection/TestAfterSection";
import MainTestSection from "../MainTestSection/MainTestSection";
import ServiceContext from "../../ServiceContext";
import { Client } from "tasksjs-react-client";
import { getType } from "./validations";
import { validateResults } from "./validations";
import moment from "moment";

const FullTestWrapper = ({ project_code, service_id, module_name, method_name }) => {
  const [state, updateState] = useState(false);
  const createTest = ({ namespace, args } = {}) => ({
    title: "",
    args: args || [],
    results: null,
    response_type: "",
    namespace: namespace || {
      service_id: "",
      module_name: "",
      method_name: "",
    },
    test_start: null,
    test_end: null,
    evaluations: [],
    total_errors: 0,
  });
  const createArg = (value, name, target_value) => ({
    value,
    data_type: getType(value),
    name: name || "arg" + (testMain[0].args.length + 1),
    target_value: target_value || [],
  });
  const { TestServices } = useContext(ServiceContext);
  const [testBefore, setTestBefore] = useState([]);
  const [testAfter, setTestAfter] = useState([]);
  const [testMain, setTestMain] = useState([
    createTest({ namespace: { project_code, service_id, module_name, method_name } }),
  ]);
  const [ConnectedServices, setConnection] = useState({});

  const getConnection = ({ service_id }) => {
    console.log("---getting connnection", project_code, service_id);
    if (TestServices.length > 0) {
      const service = TestServices.find(
        (_service) => _service.project_code === project_code && _service.service_id === service_id
      );
      if (!service) return console.log("service not found");
      if (!Client.loadedServices[service.url])
        Client.loadService(service.url)
          .then((_service) => {
            ConnectedServices[service_id] = _service;
            setConnection(ConnectedServices);
            console.log(ConnectedServices);
          })
          .catch((error) => console.log(error));
      else {
        ConnectedServices[service_id] = Client.loadedServices[service.url];
        setConnection(ConnectedServices);
        console.log(console);
      }
    }
  };
  useEffect(() => {
    setTestBefore([]);
    setTestMain([
      createTest({ namespace: { project_code, service_id, module_name, method_name } }),
    ]);
    setTestAfter([]);
    //get connection for the main test
    getConnection({ project_code, service_id, module_name, method_name });
  }, [project_code, service_id, module_name, method_name, TestServices]);

  const getArgs = (args) =>
    args.map(({ value }) => {
      return value;
    });

  const runTest = async (test) => {
    try {
      const { service_id, module_name, method_name } = test.namespace;
      const _args = getArgs(test.args);
      test.test_start = moment().toJSON();
      test.results = await ConnectedServices[service_id][module_name][method_name].apply({}, _args);
      test.test_end = moment().toJSON();
      test.response_type = "results";
    } catch (error) {
      test.test_end = moment().toJSON();
      test.results = error;
      test.response_type = "error";
    }
  };
  const runFullTest = () => {
    return Promise.all([
      ...testBefore.map(async (test, a) => await runTest(test)),
      ...testMain.map(async (test, a) => await runTest(test)),
      ...testAfter.map(async (test, a) => await runTest(test)),
    ]);
  };
  const TestController = function (setState, section) {
    const testData = this;
    const controller = {};

    controller.updateNamespace = (index, namespace) => {
      testData[index].namespace = namespace;
      setState(testData);
      getConnection(namespace);
      updateState(!state);
    };
    controller.addTest = () => {
      testData.push(createTest());
      setState(testData);
      updateState(!state);
    };
    controller.deleteTest = (index) => {
      testData.splice(index, 1);
      setState(testData);
      updateState(!state);
    };
    controller.addArg = (index, value, name, target_value) => {
      testData[index].args.push(createArg(value, name, target_value));
      setState(testData);
      updateState(!state);
    };
    controller.deleteArg = (index, argIndex) => {
      testData[index].args.splice(argIndex, 1);
      setState(testData);
      updateState(!state);
    };
    controller.editArg = (index, argIndex, arg) => {
      testData[index].args[argIndex] = arg;
      setState(testData);
      updateState(!state);
    };
    controller.resetResults = (index) => {
      const { args, namespace, title } = testData[index];
      testData[index] = createTest({ args, namespace, title });
      setState(testData);
      updateState(!state);
    };

    controller.runTest = async (testIndex) => {
      console.log(section);
      if (section === "main") {
        await runFullTest();
        const { evaluations, totalErrors } = validateResults(
          testData[testIndex].results,
          testData[testIndex].response_type,
          []
        );
        testData[testIndex].evaluations = evaluations;
        testData[testIndex].total_errors = totalErrors;
      } else {
        await runTest(testData[testIndex]);
        setState(testData);
      }

      updateState(!state);
    };
    return controller;
  };

  return (
    <>
      <div className="row test-panel__section">
        <TestBeforeSection
          TestController={TestController.apply(testBefore, [setTestBefore, "before"])}
          testData={testBefore}
        />
      </div>
      <div className="row test-panel__section">
        <MainTestSection
          TestController={TestController.apply(testMain, [setTestMain, "main"])}
          testData={testMain}
        />
      </div>
      <div className="row test-panel__section">
        <TestAfterSection
          project_code={project_code}
          TestController={TestController.apply(testAfter, [setTestAfter, "after"])}
          testData={testAfter}
        />
      </div>
    </>
  );
};

export default FullTestWrapper;
