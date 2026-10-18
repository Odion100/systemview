const Test = require("./Test.class");

const sections = ["Before", "Main", "Events", "After"];

module.exports = function FullTestController({ FullTest, connectedServices } = {}) {
  // RFC-020 — a test is `{ sections, order }`. Loop the **run-order** (a list of section names), flatten
  // the referenced sections into one sequential run. No hardcoded `[...Before,...Events,...Main,...After]`
  // — the order is data, so a named section runs wherever the list places it.
  this.runFullTest = async (test = FullTest) => {
    const { sections = {}, order = [] } = test || {};
    const flat = order.reduce((all, name) => all.concat(sections[name] || []), []);

    // A REJECTED TEST MUST NOT KILL THE PROCESS. This chain had no catch, so one rejection —
    // observed live: a stale cached client answering "Plugin publishes no method clearMockEvents" —
    // became an unhandled rejection and Node killed THE HUB mid-run: 56 silent respawns in one log,
    // every one a 1–2 minute outage and a truncated test sweep (gaps/SYSTEMVIEW_HUB_DROPS…, cause
    // found 2026-10-18 by reading the launcher's filed stdout). The run continues past a rejected
    // test — the test records its own failure state; a crash records nothing.
    await new Promise((resolve) => {
      function recursiveRunTest(tests, i = 0) {
        if (i === tests.length) resolve();
        else
          tests[i]
            .runTest()
            .catch((error) => {
              // the resolution-phase throws (missing module/method) escape before Test.class's own
              // recorder — mirror it, so the run report shows the error instead of losing it
              try { tests[i].results = error; tests[i].response_type = "error"; } catch {}
            })
            .then(() => recursiveRunTest(tests, i + 1));
      }
      recursiveRunTest(flat);
    });

    return test;
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
};
