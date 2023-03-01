import { getType } from "../../../molecules/ValidationInput/validator";
import Test from "./Test.class";
import Argument, { TargetValue } from "./Argument.class";
export default function TestController({
  TestSection,
  setState,
  section,
  FullTest,
  connectedServices,
}) {
  this.runTest = async (testIndex) => {
    const test = TestSection[testIndex];
    //run only one test
    await test.runTest();
    setState([...TestSection]);
  };

  this.runAllTest = async () => {};

  this.updateNamespace = (index, namespace) => {
    TestSection[index].namespace = namespace;
    TestSection[index].getConnection(connectedServices);
    setState([...TestSection]);
  };
  this.addTest = (namespace, args, title) => {
    TestSection.push(new Test({ namespace, args, title, editMode: true }));
    setState([...TestSection]);
    if (namespace) this.updateNamespace(TestSection.length - 1, namespace);
  };
  this.deleteTest = (index) => {
    TestSection.splice(index, 1);
    setState([...TestSection]);
  };
  this.addArg = (index) => {
    const name = "arg" + (TestSection[0].args.length + 1);
    TestSection[index].args.push(new Argument(name, FullTest));
    setState([...TestSection]);
  };
  this.deleteArg = (index, arg_index) => {
    TestSection[index].args.splice(arg_index, 1);
    setState([...TestSection]);
  };
  this.editArg = (index, arg_index, arg) => {
    arg.data_type = getType(arg.input);
    TestSection[index].args[arg_index] = arg;
    setState([...TestSection]);
  };
  this.resetResults = (index) => {
    TestSection[index].clearResults();
    setState([...TestSection]);
  };

  this.addTargetValue = (
    testIndex,
    arg_index,
    target_namespace,
    source_map,
    source_index
  ) => {
    //check to see if target value already exists first
    const arg = TestSection[testIndex].args[arg_index];
    arg.addTargetValue(target_namespace, source_map, source_index);
    setState([...TestSection]);
  };
  this.setTargetValue = (
    testIndex,
    arg_index,
    target_index,
    target_namespace,
    source_map,
    source_index
  ) => {
    const arg = TestSection[testIndex].args[arg_index];

    arg.targetValues[target_index] = new TargetValue(
      target_namespace.trim(),
      source_map,
      source_index
    );
    setState([...TestSection]);
  };

  this.parseTargetValues = (testIndex, arg_index, input, source_map) => {
    const arg = TestSection[testIndex].args[arg_index];
    arg.parseTargetValues(input, source_map).checkTargetNamespaces();
    setState([...TestSection]);
  };
  this.checkTargetValues = (testIndex, arg_index) => {
    const arg = TestSection[testIndex].args[arg_index];
    arg.checkTargetNamespaces();
    setState([...TestSection]);
  };
  this.updateTitle = (testIndex, title) => {
    TestSection[testIndex].title = title;
    setState([...TestSection]);
  };
  this.updateEvaluations = (testIndex, evaluations) => {
    TestSection[testIndex].evaluations = evaluations;
    setState([...TestSection]);
  };
  this.updateTests = () => {
    setState([...TestSection]);
  };
  this.updateValidationStatus = (testIndex) => {
    if (section !== 1) {
      TestSection[testIndex].shouldValidate = !TestSection[testIndex].shouldValidate;
      if (TestSection[testIndex].shouldValidate) TestSection[testIndex].validate();
      else TestSection[testIndex].evaluations = [];
      setState([...TestSection]);
    }
  };
  this.getTargetSuggestions = (testIndex) => {
    //get target value suggestion (namespaces) for previous test including sub test
    const suggestions = [];
    const test_names = ["beforeTest", "mainTest", "afterTest"];
    //exclude all test sections following current section
    const targetTests = FullTest.slice(0, section + 1);

    targetTests.forEach((test_section, sIndex) => {
      //also exclude current test and the tests that follow from the suggestions
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

  return this;
}
