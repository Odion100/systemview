import Argument from "../TestPanel/components/Argument.class";
import Test from "../TestPanel/components/Test.class";

export function resetSavedTests(savedTests, connectedServices) {
  return savedTests.map(({ Before, Main, Events, After, title, namespace }) => {
    const FullTest = [Before, Main, Events, After];
    return {
      Before: Before.map((test) => resetTest(test, FullTest, connectedServices)),
      Main: Main.map((test) => resetTest(test, FullTest, connectedServices)),
      Events: Events.map((test) => resetTest(test, FullTest, connectedServices)),
      After: After.map((test) => resetTest(test, FullTest, connectedServices)),
      title,
      namespace,
    };
  });
}

export const resetTest = (test, FullTest, connectedServices) => {
  return new Test({
    ...test,
    args: test.args.map(
      (arg) => new Argument(arg.name, FullTest, arg.input_type, arg.input)
    ),
  }).getConnection(connectedServices);
};

export const resetFullTest = (FullTest, connectedServices) => {
  //context matters
  const newTests = [[], [], [], []];
  return FullTest.map((section, i) => {
    return section.map((test) => {
      const newTest = resetTest(test, newTests, connectedServices);
      newTests[i].push(newTest);
      return newTest;
    });
  });
};
