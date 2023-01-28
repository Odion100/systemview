import { getType } from "../../../molecules/ValidationInput/validator";
import Test from "./Test.class";
import Argument, { TargetValue } from "./Argument.class";
export default function TestController({
  testData,
  setState,
  section,
  Tests,
  connectedServices,
}) {
  this.runTest = async (test_index) => {
    const test = testData[test_index];
    //run only one test
    await test.runTest();
    setState([...testData]);
  };

  this.runFullTest = async (updateAll) => {
    //run full tests plus evaluations if is main test
    const [Before, Main, Events, After] = Tests;
    //run events test asynchronously
    Events.forEach((test) => test.runTest());
    //run test synchronously
    await Promise.all([
      ...Before.map(async (test) => test.runTest()),
      ...Main.map(async (test) => test.runTest()),
      ...After.map(async (test) => test.runTest()),
    ]);
    updateAll && updateAll([Before, Main, Events, After]);
  };

  this.saveTests = async () => {
    const { title, evaluations, getConnection, namespace } = Tests[1][0];
    if (!title) return console.log("Test title is required");
    if (!evaluations.length) return console.log("You must run the test before saving");
    const { connection } = getConnection(connectedServices);

    const { SystemView } = connection[namespace.serviceId];

    if (SystemView) {
      const [Before, Main, Events, After] = Tests.map((test) =>
        test.map(({ args, evaluations, namespace, title }) => ({
          args,
          namespace,
          title,
          savedValidations: evaluations,
        }))
      );
      console.log({ Before, Main, Events, After, title, namespace });
      console.log(Tests);
      SystemView.saveTest({ Before, Main, Events, After, title, namespace });
    } else console.log("SystemView is undefined");
  };

  this.updateNamespace = (index, namespace) => {
    testData[index].namespace = namespace;
    testData[index].getConnection(connectedServices);
    setState([...testData]);
  };
  this.addTest = (namespace, args, title) => {
    testData.push(new Test({ namespace, args, title }));
    setState([...testData]);
    if (namespace) this.updateNamespace(testData.length - 1, namespace);
  };
  this.deleteTest = (index) => {
    testData.splice(index, 1);
    setState([...testData]);
  };
  this.addArg = (index) => {
    const name = "arg" + (testData[0].args.length + 1);
    testData[index].args.push(new Argument(name, Tests));
    setState([...testData]);
  };
  this.deleteArg = (index, arg_index) => {
    testData[index].args.splice(arg_index, 1);
    setState([...testData]);
  };
  this.editArg = (index, arg_index, arg) => {
    arg.data_type = getType(arg.input);
    testData[index].args[arg_index] = arg;
    setState([...testData]);
  };
  this.resetResults = (index) => {
    testData[index].clearResults();
    setState([...testData]);
  };

  this.addTargetValue = (
    test_index,
    arg_index,
    target_namespace,
    source_map,
    source_index
  ) => {
    //check to see if target value already exists first
    const arg = testData[test_index].args[arg_index];
    arg.addTargetValue(target_namespace, source_map, source_index);
    setState([...testData]);
  };
  this.setTargetValue = (
    test_index,
    arg_index,
    target_index,
    target_namespace,
    source_map,
    source_index
  ) => {
    const arg = testData[test_index].args[arg_index];

    arg.targetValues[target_index] = new TargetValue(
      target_namespace.trim(),
      source_map,
      source_index
    );
    setState([...testData]);
  };

  this.parseTargetValues = (test_index, arg_index, input, source_map) => {
    const arg = testData[test_index].args[arg_index];
    arg.parseTargetValues(input, source_map).checkTargetNamespaces();
    setState([...testData]);
  };
  this.checkTargetValues = (test_index, arg_index) => {
    const arg = testData[test_index].args[arg_index];
    arg.checkTargetNamespaces();
    setState([...testData]);
  };
  this.updateTitle = (test_index, title) => {
    testData[test_index].title = title;
    setState([...testData]);
  };
  this.getTargetSuggestions = (test_index) => {
    //get target value suggestion (namespaces) for previous test including sub test
    const suggestions = [];
    const test_names = ["beforeTest", "mainTest", "afterTest"];
    //exclude all test sections following current section
    const targetTests = Tests.slice(0, section + 1);

    targetTests.forEach((test_section, sIndex) => {
      //also exclude current test and the tests that follow from the suggestions
      const count = sIndex === section ? test_index : test_section.length;
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

  return this;
}
