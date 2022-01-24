import React, { useState, useContext, useEffect } from "react";
import TestBeforeSection from "../TestBeforeSection/TestBeforeSection";
import TestAfterSection from "../TestAfterSection/TestAfterSection";
import MainTestSection from "../MainTestSection/MainTestSection";
import ServiceContext from "../../ServiceContext";
import { Client } from "tasksjs-react-client";
import { validateResults, getType } from "../../molecules/ValidationInput/validations";
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
  const createArg = (value, name, target_values) => ({
    value,
    data_type: getType(value),
    name: name || "arg" + (testMain[0].args.length + 1),
    target_values: target_values || [],
  });
  const { TestServices } = useContext(ServiceContext);
  const [testBefore, setTestBefore] = useState([]);
  const [testAfter, setTestAfter] = useState([]);
  const [testMain, setTestMain] = useState([
    createTest({ namespace: { project_code, service_id, module_name, method_name } }),
  ]);
  const [ConnectedProject, setConnection] = useState({});

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
            ConnectedProject[service_id] = _service;
            setConnection(ConnectedProject);
            console.log(ConnectedProject);
          })
          .catch((error) => console.log(error));
      else {
        ConnectedProject[service_id] = Client.loadedServices[service.url];
        setConnection(ConnectedProject);
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
      test.results = await ConnectedProject[service_id][module_name][method_name].apply({}, _args);
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
      ...testBefore.map(runTest),
      ...testMain.map(runTest),
      ...testAfter.map(runTest),
    ]);
  };

  const getTargetValue = (target_str) => {
    const map = target_str.split(".");
    const i = ["beforeTest", "mainTest", "afterTest"].indexOf(map[0]);
    if (i === -1) return undefined;
    if (!/^Action\d/.test(map[1])) return undefined;

    const targetTest = [testBefore, testMain, testAfter][i];
    const t_index = i === 1 ? 0 : parseInt(map[1].replace("Action", "")) - 1;

    if (map[2] !== targetTest[t_index].response_type) return undefined;

    const isValidName = (str) => /^(?![0-9])[a-zA-Z0-9$_]+$/.test(str); //_id
    const isNameAndArray = (str) => /^(?![0-9])[a-zA-Z0-9$_]+(\[\d\])+$/.test(str); //users[0]...
    let current_value = targetTest[t_index].results;

    for (let a = 3; a < map.length; a++) {
      if (isValidName(map[a])) {
        //parse value as object
        if (!getType(current_value) === "object") return undefined;
        current_value = current_value[map[a]];
      } else if (isNameAndArray(map[a])) {
        //seperate prop name from array indexes (ie. 'results[0][0]'...)
        const sub_map = map[a].split("[");
        //parse first submap as prop name of object
        if (!getType(current_value) === "object") return undefined;
        current_value = current_value[sub_map[0]];
        for (let x = 1; x < sub_map.length; x++) {
          //parse value as array indices
          if (!getType(current_value) === "array") return undefined;
          current_value = current_value[parseInt(sub_map[x].replace("]", ""))];
        }
      } else return undefined;
    }
    console.log(current_value);
    return current_value;
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
    controller.addArg = (index, value, name, target_values) => {
      testData[index].args.push(createArg(value, name, target_values));
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
      if (section === 1) {
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

    controller.addTargetValue = (testIndex, argIndex, target) => {
      testData[testIndex].args[argIndex].target_values.push({
        target_namespace: target,
        value: "",
        source_namespace: "",
      });
      setState(testData);
      updateState(!state);
    };
    controller.deleteTargetValue = (testIndex, argIndex, target_index) => {
      testData[testIndex].args[argIndex].target_values.splice(target_index, 1);
      setState(testData);
      updateState(!state);
    };
    controller.setTargetValue = (testIndex, argIndex, target_index, target_str) => {
      const targetValue = getTargetValue(target_str);

      testData[testIndex].args[argIndex].target_values[target_index] = {
        target_namespace: target_str,
        value: targetValue,
        source_namespace: "",
      };
      setState(testData);
      updateState(!state);
    };
    controller.getTargetSuggestions = (testIndex) => {
      //get target value suggestion (namespaces) from previous test including sub test
      const suggestions = [];
      const test_names = ["beforeTest", "mainTest", "afterTest"];
      //exclude all test section following current section
      const targetTests = [testBefore, testMain, testAfter].slice(0, section + 1);

      targetTests.forEach((test_section, sIndex) => {
        //exclude current test and those that follow from the suggestions
        const count = sIndex === section ? testIndex : test_section.length;
        for (let i = 0; i < count; i++) {
          suggestions.push(
            `${test_names[sIndex]}.${sIndex === 1 ? "" : "Action" + (i + 1) + "."}${
              test_section[i].response_type || "results"
            }`
          );
        }
      });

      return suggestions;
    };

    return controller;
  };

  return (
    <>
      <div className="row test-panel__section">
        <TestBeforeSection
          TestController={TestController.apply(testBefore, [setTestBefore, 0])}
          testData={testBefore}
        />
      </div>
      <div className="row test-panel__section">
        <MainTestSection
          TestController={TestController.apply(testMain, [setTestMain, 1])}
          testData={testMain}
        />
      </div>
      <div className="row test-panel__section">
        <TestAfterSection
          project_code={project_code}
          TestController={TestController.apply(testAfter, [setTestAfter, 2])}
          testData={testAfter}
        />
      </div>
    </>
  );
};

export default FullTestWrapper;
