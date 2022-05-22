import React, { useState, useContext, useEffect } from "react";
import TestBeforeSection from "../TestBeforeSection/TestBeforeSection";
import TestAfterSection from "../TestAfterSection/TestAfterSection";
import MainTestSection from "../MainTestSection/MainTestSection";
import ServiceContext from "../../ServiceContext";
import { Client } from "tasksjs-react-client";
import { validateResults, getType } from "../../molecules/ValidationInput/validations";
import moment from "moment";

const FullTestWrapper = ({ project_code, service_id, module_name, method_name }) => {
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
  const createArg = (input, name, targetValues, input_type) => ({
    input, //user input
    input_type: input_type + "",
    value: undefined, //calculated arg value
    data_type: getType(input),
    name: name || "arg" + (testMain[0].args.length + 1),
    targetValues: targetValues || [],
  });
  const createTargetValue = ({ target_value, target_namespace, source_map, source_index }) => {
    return {
      target_value: target_value, //value captured after with target namespace
      target_namespace: target_namespace, //string target value  selector / replacer
      source_map: source_map || ["value"], //array map to arg value where to return target_value
      source_index, //in case of targetreplacer, the starting index of string to be replaced
    };
  };
  const { TestServices } = useContext(ServiceContext);
  const [testBefore, setTestBefore] = useState([]);
  const [testAfter, setTestAfter] = useState([]);
  const [testMain, setTestMain] = useState([
    createTest({ namespace: { project_code, service_id, module_name, method_name } }),
  ]);
  const [ConnectedProject, setConnection] = useState({});

  const applyValue = (arg, map, target_value, target_namespace) => {
    let obj = arg;
    const last = map.length - 1;
    //loop until up to the last index
    for (let i = 0; i < last; i++) {
      obj = obj[map[i]];
    }
    if (
      /tv\(((?:before|main|after)Test(?:.Action\d){0,1}.(?:error|results)(?:.(?![0-9])[a-zA-Z0-9$_]+(?:\[\d\])*)*)\)/.test(
        target_namespace
      )
    ) {
      obj[map[last]] = obj[map[last]].replace(`${target_namespace}`, target_value);
    } else {
      obj[map[last]] = target_value;
    }
  };
  const getArgValue = (arg, update = true) => {
    switch (arg.input_type) {
      case "object":
        arg.value = { ...arg.input };
        break;
      case "array":
        arg.value = [...arg.input];
        break;
      default:
        arg.value = arg.input;
    }

    arg.targetValues.forEach(({ target_namespace, source_map, target_value }) => {
      applyValue(
        arg,
        source_map,
        update ? getTargetValue(target_namespace) : target_value,
        target_namespace
      );
    });

    return arg.value;
  };
  const runTest = async (test) => {
    try {
      const { service_id, module_name, method_name } = test.namespace;
      const args = test.args.map(getArgValue);
      test.test_start = moment().toJSON();
      test.results = await ConnectedProject[service_id][module_name][method_name].apply({}, args);
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
  const isEqualArrays = (a, b) => {
    console.log(a, b, a.join(".") === b.join("."));
    return a.join(".") === b.join(".");
  }; //specifically for string arrays
  const isObjectLike = (value) => ["object", "array", "string"].indexOf(getType(value)) > -1;
  const isValidName = (str) => /^(?![0-9])[a-zA-Z0-9$_]+$/.test(str); //_id
  const isNameAndArray = (str) => /^(?![0-9])[a-zA-Z0-9$_]+(\[\d\])+$/.test(str); //users[0]...
  const isTargetSelector = (str) =>
    /^(?:before|main|after)Test(?:.Action\d){0,1}.(?:error|results)(?:.(?![0-9])[a-zA-Z0-9$_]+(?:\[\d\])*)$/.test(
      str
    );
  const targetReplacerRegex =
    /tv\(((?:before|main|after)Test(?:.Action\d){0,1}.(?:error|results)(?:.(?![0-9])[a-zA-Z0-9$_]+(?:\[\d\])*)*)\)/g;

  const hasTargetReplacer = (str) => targetReplacerRegex.test(str);

  const getTargetValue = (target_input) => {
    if (hasTargetReplacer(target_input))
      target_input = target_input.substring(3, target_input.length - 1);
    if (!isTargetSelector(target_input)) return undefined;

    const map = target_input.split(".");
    const s_index = ["beforeTest", "mainTest", "afterTest"].indexOf(map[0]);
    const targetTest = [testBefore, testMain, testAfter][s_index];

    const t_index = s_index === 1 ? 0 : parseInt(map[1].replace("Action", "")) - 1;

    if (map[s_index === 1 ? 1 : 2] !== targetTest[t_index].response_type) return undefined;

    let current_value = targetTest[t_index].results;

    for (let a = s_index === 1 ? 2 : 3; a < map.length; a++) {
      if (isValidName(map[a])) {
        //parse value as object
        if (!isObjectLike(current_value)) return undefined;
        current_value = current_value[map[a]];
      } else if (isNameAndArray(map[a])) {
        //seperate prop name from indices (ie. 'results[0][0]'...)
        const sub_map = map[a].split("[");
        //parse first submap as prop name of object
        if (!isObjectLike(current_value)) return undefined;
        current_value = current_value[sub_map[0]];
        for (let x = 1; x < sub_map.length; x++) {
          //parse remaining submap as indices
          if (!isObjectLike(current_value)) return undefined;
          current_value = current_value[parseInt(sub_map[x].replace("]", ""))];
        }
      } else return undefined;
    }
    console.log(current_value);
    return current_value;
  };

  const getConnection = ({ service_id }) => {
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

  const TestController = function (setState, section) {
    const testData = this;
    const controller = { isTargetSelector, hasTargetReplacer };

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
        setState({ ...testData });
      }
    };
    controller.updateNamespace = (index, namespace) => {
      testData[index].namespace = namespace;
      setState({ ...testData });
      getConnection(namespace);
    };
    controller.addTest = () => {
      testData.push(createTest());
      setState({ ...testData });
    };
    controller.deleteTest = (index) => {
      testData.splice(index, 1);
      setState({ ...testData });
    };
    controller.addArg = (index, input, name, targetValues) => {
      testData[index].args.push(createArg(input, name, targetValues));
      setState({ ...testData });
    };
    controller.deleteArg = (index, argIndex) => {
      testData[index].args.splice(argIndex, 1);
      setState({ ...testData });
    };
    controller.editArg = (index, argIndex, arg) => {
      arg.data_type = getType(arg.input);
      testData[index].args[argIndex] = arg;
      setState({ ...testData });
    };
    controller.resetResults = (index) => {
      const { args, namespace, title } = testData[index];
      testData[index] = createTest({ args, namespace, title });
      setState({ ...testData });
    };

    controller.deleteTargetValue = (testIndex, argIndex, target_index) => {
      testData[testIndex].args[argIndex].targetValues.splice(target_index, 1);
      controller.editArg(testIndex, argIndex, testData[testIndex].args[argIndex]);
    };

    controller.addTargetValue = (
      testIndex,
      argIndex,
      target_namespace,
      source_map,
      source_index
    ) => {
      //check to see if target value already exists
      const arg = testData[testIndex].args[argIndex];
      const target_index = arg.targetValues.findIndex(
        (tv) =>
          tv.target_namespace === target_namespace &&
          isEqualArrays(tv.source_map, source_map || []) &&
          tv.source_index === source_index
      );
      console.log("u------------", target_index);
      if (target_index === -1) {
        arg.targetValues.push(
          createTargetValue({
            target_namespace,
            source_map,
            target_value: getTargetValue(target_namespace),
            source_index,
          })
        );
        console.log(arg);
        getArgValue(testData[testIndex].args[argIndex], false);
        controller.editArg(testIndex, argIndex, testData[testIndex].args[argIndex]);
      }
    };
    controller.setTargetValue = (
      testIndex,
      argIndex,
      target_index,
      target_namespace,
      source_map,
      source_index
    ) => {
      const arg = testData[testIndex].args[argIndex];
      if (isTargetSelector(target_namespace))
        arg.targetValues[target_index] = createTargetValue({
          target_namespace,
          target_value: getTargetValue(target_namespace),
          source_map,
          source_index,
        });
      getArgValue(arg, false);
      controller.editArg(testIndex, argIndex, arg);
    };

    controller.parseTargetValues = (testIndex, argIndex, target_input, source_map) =>
      Array.from(target_input.matchAll(targetReplacerRegex)).forEach((match) => {
        const target_replacer = match[0];
        const source_index = match.index;
        console.log("target_replacer----", target_replacer);
        controller.addTargetValue(testIndex, argIndex, target_replacer, source_map, source_index);
      });

    //check target value for deletion
    controller.checkTargetValues = (testIndex, argIndex, target_input, source_map) => {
      const arg = testData[testIndex].args[argIndex];
      const matches = Array.from(target_input.matchAll(targetReplacerRegex));
      console.log(matches, arg);
      arg.targetValues = arg.targetValues.filter((tv) => {
        let test_passed = true;
        if (isEqualArrays(tv.source_map, source_map)) {
          test_passed =
            matches.findIndex(
              (match) => match[0] === tv.target_namespace && match.index === tv.source_index
            ) !== -1;
        }
        console.log(arg);
        return test_passed;
      });

      //getArgValue(arg, false);
      controller.editArg(testIndex, argIndex, arg);
    };
    controller.getTargetSuggestions = (testIndex) => {
      //get target value suggestion (namespaces) for previous test including sub test
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
