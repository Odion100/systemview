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
    //run only one test — flag it running BEFORE awaiting so the step shows its running indicator
    //(border + spinner) live, then settles to pass/fail once done.
    test.running = true;
    setState([...TestSection]);
    await test.runTest();
    test.running = false;
    setState([...TestSection]);
  };

  // Run every step in THIS section, in sequence (awaiting each) — so a section (Before / Events / After)
  // can be run on its own. Sequential mirrors the full-run discipline (shared session/cookies never race).
  // Each step flips its `running` flag around its await + re-renders, so the border/spinner track the
  // currently-running step and each one settles to pass/fail as the run walks down the section.
  this.runAllTest = async () => {
    for (let i = 0; i < TestSection.length; i++) {
      TestSection[i].running = true;
      setState([...TestSection]);
      await TestSection[i].runTest();
      TestSection[i].running = false;
      setState([...TestSection]);
    }
  };

  this.updateNamespace = (index, namespace) => {
    TestSection[index].namespace = namespace;
    TestSection[index].getConnection(connectedServices);
    setState([...TestSection]);
  };
  this.addTest = (namespace, args, title) => {
    TestSection.push(new Test({ namespace, args, title, editMode: true, FullTest }));
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
  // RFC-020 — target-value suggestions are natural-path references into the sections object:
  // `test.<section>[i].results`. FullTest is `{ before, main, events, after, <named> }`.
  this.getTargetSuggestions = () => {
    const suggestions = [];
    Object.entries(FullTest || {}).forEach(([name, secTests]) => {
      (secTests || []).forEach((t, i) => {
        if (!TestSection.includes(t)) {
          suggestions.push(`test.${name}[${i}].${t.response_type || "results"}`);
        }
      });
    });
    return suggestions;
  };

  return this;
}
