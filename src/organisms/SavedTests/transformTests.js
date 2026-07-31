import Argument from "../TestPanel/components/Argument.class";
import Test from "../TestPanel/components/Test.class";

export function initializeSavedTests(savedTests, connectedServices) {
  return savedTests.map((ft) => {
    // context matters
    const newTests = [];
    const { title, namespace } = ft;

    // RFC-020: a saved test may carry `{ use: <action> }` steps. Expanding them in the browser needs the
    // action definitions (a follow-up: fetch via Plugin.getActions and splice). Until then, DROP them here
    // so a use-step (which has no `args`) can't crash the saved-test view. The CLI runner expands them.
    const steps = (section) => (section || []).filter((s) => s && !s.use);

    const Before = steps(ft.Before).map((test) =>
      resetTest(test, newTests, connectedServices, false)
    );
    const Main = steps(ft.Main).map((test) =>
      resetTest(test, newTests, connectedServices, false)
    );
    const Events = steps(ft.Events).map((test) =>
      resetTest(test, newTests, connectedServices, false)
    );
    const After = steps(ft.After).map((test) =>
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
    args: (test.args || []).map(
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
