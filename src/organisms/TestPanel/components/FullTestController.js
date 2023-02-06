const sections = ["Before", "Main", "Events", "After"];

export default function FullTestController({ FullTest, connectedServices }) {
  this.runFullTest = async ([Before, Main, Events, After] = FullTest) => {
    Events.forEach((test) => test.runTest());
    await Promise.all([
      ...Before.map(async (test) => test.runTest()),
      ...Main.map(async (test) => test.runTest()),
      ...After.map(async (test) => test.runTest()),
    ]);
    return [Before, Main, Events, After];
  };

  function validateTest({ title, evaluations, shouldValidate }, section, index) {
    if (!title)
      return {
        message: `${sections[section]}: Action ${index + 1} description is required`,
        error: true,
      };
    if (!evaluations.length && shouldValidate)
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

    const { SystemView } = connection[namespace.serviceId];

    if (SystemView) {
      const [Before, Main, Events, After] = Tests.map((testSection) =>
        testSection.map(({ args, evaluations, namespace, title }) => ({
          args,
          namespace,
          title,
          savedEvaluations: evaluations,
        }))
      );

      await SystemView.saveTest({ Before, Main, Events, After, title, namespace }, index);
      return { message: "Test Saved!", error: false };
    } else return { message: "SystemView Plugin not connected!", error: true };
  };
}
