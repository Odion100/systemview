import Test from "./Test.class";

const sections = ["Before", "Main", "Events", "After"];

export default function FullTestController({ FullTest, connectedServices }) {
  // `onStep` (optional) is called after every running-flag flip so the caller can re-render between steps
  // — that's what makes the scratchpad show WHICH step is running/passing/failing live during a full run
  // (without it the whole run is opaque until the end). TestStory calls this with no onStep (it renders
  // its own way), so its behavior is unchanged.
  this.runFullTest = async (onStep) => {
    const [Before, Main, Events, After] = FullTest;
    const order = [...Before, ...Events, ...Main, ...After];
    for (let i = 0; i < order.length; i++) {
      order[i].running = true;
      if (onStep) onStep();
      await order[i].runTest();
      order[i].running = false;
      if (onStep) onStep();
    }
    return [Before, Main, Events, After];
  };

  function validateTest({ title, evaluations, shouldValidate }, section, index) {
    if (!title)
      return {
        message: `${sections[section]}: Action ${index + 1} description is required`,
        error: true,
      };
    if (shouldValidate && !evaluations.filter((e) => e.save).length)
      return {
        message: `${sections[section]}: Action ${index + 1} validations required`,
        error: true,
      };

    return { error: false };
  }
  this.saveTests = async (Tests = FullTest) => {
    const { title, getConnection, namespace, index } = Tests[1][0];

    for (let i = 0; i < Tests.length; i++) {
      for (let x = 0; x < Tests.length; x++) {
        const res = Tests[i][x] ? validateTest(Tests[i][x], i, x) : {};
        if (res.error) return res;
      }
    }

    const { connection } = getConnection(connectedServices);

    const { Plugin } = connection[namespace.serviceId];

    if (Plugin) {
      const [Before, Main, Events, After] = Tests.map((testSection) =>
        testSection.map((test) => {
          const { args, evaluations, namespace, title } = test;
          //resetting scope of test
          Object.assign(test, new Test(test));
          return {
            args,
            namespace,
            title,
            savedEvaluations: evaluations
              .filter((e) => e.save)
              .map(({ namespace, expected_type, validations, save, indexed }) => ({
                namespace,
                expected_type,
                validations,
                save,
                indexed,
              })),
          };
        })
      );

      const testIndex = await Plugin.saveTest(
        { Before, Main, Events, After, title, namespace },
        index
      );
      return { message: "Test Saved!", error: false, testIndex };
    } else return { message: "Plugin Plugin not connected!", error: true };
  };
}
