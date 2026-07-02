const { Argument } = require("./Argument.class");
const Test = require("./Test.class");

function initializeSavedTests(savedTests, connectedServices, client, extraHeaders) {
  return savedTests.map((ft) => {
    // context matters
    const newTests = [];
    const { title, namespace } = ft;

    const Before = ft.Before.map((test) =>
      resetTestClass(test, newTests, connectedServices, false, client, extraHeaders)
    );
    const Main = ft.Main.map((test) =>
      resetTestClass(test, newTests, connectedServices, false, client, extraHeaders)
    );
    const Events = ft.Events.map((test) =>
      resetTestClass(test, newTests, connectedServices, false, client, extraHeaders)
    );
    const After = ft.After.map((test) =>
      resetTestClass(test, newTests, connectedServices, false, client, extraHeaders)
    );
    newTests.push(Before);
    newTests.push(Main);
    newTests.push(Events);
    newTests.push(After);
    return { Before, Main, Events, After, title, namespace };
  });
}

const resetTestClass = (test, FullTest, connectedServices, editMode, client, extraHeaders) => {
  return new Test({
    ...test,
    args: test.args.map(
      (arg) =>
        new Argument(arg.name, FullTest, arg.input_type, arg.input, arg.targetValues)
    ),
    editMode,
    client,
    extraHeaders,
  }).getConnection(connectedServices);
};

const resetFullTest = (FullTest, connectedServices, editMode) => {
  //context matters
  const newTests = [[], [], [], []];
  return FullTest.map((section, i) => {
    return section.map((test) => {
      const newTest = resetTestClass(test, newTests, connectedServices, editMode);
      newTests[i].push(newTest);
      return newTest;
    });
  });
};
module.exports = {
  initializeSavedTests,
  resetTestClass,
  resetFullTest,
};
