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

  this.saveTests = async (Tests = FullTest) => {
    const { title, evaluations, getConnection, namespace } = Tests[1][0];
    if (!title) return console.log("Test title is required");
    if (!evaluations.length) return console.log("You must run the test before saving");
    const { connection } = getConnection(connectedServices);

    const { SystemView } = connection[namespace.serviceId];
    debugger;
    if (SystemView) {
      const [Before, Main, Events, After] = Tests.map((testSection) =>
        testSection.map(({ args, evaluations, namespace, title }) => ({
          args,
          namespace,
          title,
          savedEvaluations: evaluations,
        }))
      );

      await SystemView.saveTest({ Before, Main, Events, After, title, namespace });
      return [Before, Main, Events, After];
    } else console.log("SystemView is undefined");
  };
}
