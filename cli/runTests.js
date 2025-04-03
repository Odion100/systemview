const { Client } = require("systemlynx");
const { initializeSavedTests } = require("../testing-utilities/transformTests");
const FullTestController = require("../testing-utilities/FullTestController");
const log = require("./utils/log");
const validationMessages = require("../testing-utilities/validtionMessages");
const { runFullTest } = new FullTestController();

const PARTITION =
  "-----------------------------------------------------------------------------";

module.exports = async function runTests(url, project_code, namespace) {
  const api = `${url}/systemview/api`;
  if (!project_code) {
    log("project_code and/or service_url are required", "warning", "warning");
    console.log(`Example -> systemview test myAPI Users`);
    return;
  }
  // get connected services from the systemview api
  const connectedServices = await getConnectedServices(api, project_code);
  //get all the test for each service or the targeted services
  if (!connectedServices.length) {
    log("No connected services found!", "warning");
    console.log(
      "You may have to refresh your systemlynx apps for project_code: " + project_code
    );
    return;
  } else {
    connectedServices.forEach(({ serviceId, system }) => {
      log(`connected! @${system.connectionData.serviceUrl}`, "success", serviceId);
    });
  }

  const testsReceived = await getTests(connectedServices);
  const testToRun = !namespace
    ? testsReceived
    : testsReceived
        .map((testList) => {
          return testList.filter(({ namespace: n }) => {
            return `${n.serviceId}.${n.moduleName}.${n.methodName}`.includes(namespace);
          });
        })
        .filter((testList) => testList.length);

  if (testToRun.length) {
    const summary = {};
    await new Promise((resolve) => {
      async function recursiveExecuteTest(i = 0) {
        if (i === testToRun.length) resolve();
        else {
          const { serviceId } = testToRun[i][0].namespace;
          log(`Initializing Tests...`, "info", serviceId);

          try {
            const tests = initializeSavedTests(testToRun[i], connectedServices);
            summary[serviceId] = await runAllTests(tests, url, project_code);
          } catch (error) {
            log(`Unexpected error halting test`, "error", serviceId);
          } finally {
            recursiveExecuteTest(i + 1);
          }
        }
      }
      recursiveExecuteTest();
    });
    console.log(PARTITION);
    console.log(PARTITION);
    log("TEST COMPLETE!", "info");
    for (let key in summary) {
      const { passed, failed } = summary[key];
      log(
        `tests: ${passed + failed}, passed: ${passed}, failed: ${failed}`,
        failed ? "error" : "success",
        key
      );
    }
  } else {
    log(`No tests found matching ${project_code} ${namespace}`, "warning", "warning");
  }
};

const runAllTests = async (savedTest, url, project_code) => {
  const sum = { passed: 0, failed: 0 };
  const runTest = async ({ Before, Main, Events, After }) => {
    const fullTest = [Before, Main, Events, After];
    const { namespace } = Main[0];
    const { moduleName, methodName, serviceId } = namespace;

    console.log(PARTITION);
    log(
      `testing -> ${serviceId}.${moduleName}.${methodName}(...)`,
      "info",
      namespace.serviceId
    );
    console.log(
      `systemview ui -> @${url}/${project_code}/${serviceId}/${moduleName}/${methodName}`
    );
    console.log(PARTITION);

    await runFullTest(fullTest);
    if (
      logResults(Before, "Before") +
      logResults(Main, "Main", true) +
      logResults(Events, "Events", true) +
      logResults(After, "After")
    ) {
      sum.failed++;
    } else {
      sum.passed++;
    }
  };

  await new Promise((resolve) => {
    function recursiveRunTest(i = 0) {
      if (i === savedTest.length) resolve();
      else runTest(savedTest[i]).then(() => recursiveRunTest(i + 1));
    }
    recursiveRunTest();
  });

  return sum;
};
function logResults(tests, section, logSuccess = false) {
  let failed = 0;
  tests.forEach(({ errors, results, namespace, title, response_type }) => {
    const { serviceId, moduleName, methodName } = namespace;
    const LOG_TYPE = errors.length ? "error" : "success";
    const LABEL = LOG_TYPE === "error" ? "FAILED" : "PASSED";

    if (LOG_TYPE === "error" || logSuccess) {
      log(title, "info", section + ":");
      log(`${serviceId}.${moduleName}.${methodName}(...)`, LOG_TYPE, `${LABEL}`);
      console.log(`${response_type}:`, results);
      errors.length && log(`${errors.length} errors`, "warning", "validations");
      errors.forEach((err) => console.log(`-> ${validationMessages(err)}`));
      console.log(PARTITION);
      if (!failed && errors.length) failed = 1;
    }
  });
  return failed;
}
async function getTests(connectedServices) {
  return await new Promise(async (resolve) => {
    const results = [];

    return (async function recursiveGetTests(i = 0) {
      if (i < connectedServices.length) {
        const { connectionData } = connectedServices[i].system;
        try {
          results.push(await Client.createService(connectionData).Plugin.getTests());
        } catch (error) {
          console.log(`Failed to retrieve test from:${connectionData.serviceUrl}:\n`);
        }

        await recursiveGetTests(i + 1);
      } else resolve(results);
    })();
  });
}
async function getConnectedServices(api, project_code) {
  try {
    const { SystemView } = await Client.loadService(api);
    try {
      return await SystemView.getServices(project_code);
    } catch (error) {}
  } catch (error) {
    console.log("Failed to connect to systemview", error);
  }
}
