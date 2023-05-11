import Argument from "../TestPanel/components/Argument.class";
import Test from "../TestPanel/components/Test.class";

export function resetSavedTests(savedTests, connectedServices) {
  return savedTests.map((ft) => {
    // context matters
    const newTests = [];
    const { title, namespace } = ft;

    const Before = ft.Before.map((test) =>
      resetTest(test, newTests, connectedServices, false)
    );
    const Main = ft.Main.map((test) =>
      resetTest(test, newTests, connectedServices, false)
    );
    const Events = ft.Events.map((test) =>
      resetTest(test, newTests, connectedServices, false)
    );
    const After = ft.After.map((test) =>
      resetTest(test, newTests, connectedServices, false)
    );
    newTests.push(Before);
    newTests.push(Main);
    newTests.push(Events);
    newTests.push(After);
    return { Before, Main, Events, After, title, namespace };
  });
}

export const resetTest = (test, FullTest, connectedServices, editMode) => {
  return new Test({
    ...test,
    args: test.args.map(
      (arg) =>
        new Argument(arg.name, FullTest, arg.input_type, arg.input, arg.targetValues)
    ),
    editMode,
  }).getConnection(connectedServices);
};

export const resetFullTest = (FullTest, connectedServices, editMode) => {
  //context matters
  const newTests = [[], [], [], []];
  return FullTest.map((section, i) => {
    return section.map((test) => {
      const newTest = resetTest(test, newTests, connectedServices, editMode);
      newTests[i].push(newTest);
      return newTest;
    });
  });
};
