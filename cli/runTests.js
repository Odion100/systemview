const { Client } = require("systemlynx");
const { initializeSavedTests } = require("../testing-utilities/transformTests");
const FullTestController = require("../testing-utilities/FullTestController");
const log = require("./utils/log");
const validationMessages = require("../testing-utilities/validtionMessages");
const PARTITION =
  "-------------------------------------------------------------------------";

module.exports = async function runTests(
  api,
  project_code,
  namespace,
  printAll,
  trackTime
) {
  if (!project_code) {
    return log("project_code or service_url are required", "warning", "warning");
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
    const executeTest = async (savedTests) => {
      const tests = initializeSavedTests(savedTests, connectedServices);
      await runAllTests(tests, trackTime);
    };

    await new Promise((resolve) => {
      async function recursiveExecuteTest(i = 0) {
        if (i === testToRun.length) resolve();
        else {
          const { serviceId } = testToRun[i][0].namespace;
          log(`Initializing Tests...`, "info", serviceId);
          executeTest(testToRun[i]).then(() => recursiveExecuteTest(i + 1));
        }
      }
      recursiveExecuteTest();
    });
  } else {
    log(`No tests found matching ${project_code} ${namespace}`, "warning", "warning");
  }
};

const Logger = function (trackTime) {
  this.start = (test) => {
    // if (trackTime) {
    //   console.log
    // }
  };

  this.end = ({ errors, results, namespace, title }) => {
    // const { moduleName, methodName, serviceId } = namespace;
    // if (errors.length) {
    //   log(title, "error", "failed");
    //   console.error(results);
    //   errors.forEach((err) => console.log(validationMessages(err)));
    // } else {
    //   log(title, "success", "passed");
    //   console.log(`${serviceId}.${moduleName}.${methodName}(...)`);
    // }
  };
};
const sections = ["Before", "Main", "Events", "After"];
const { runFullTest } = new FullTestController();

const runAllTests = async (savedTest, trackTime) => {
  const runTest = async ({ Before, Main, Events, After }) => {
    const fullTest = [Before, Main, Events, After];
    const testResults = await runFullTest(fullTest, new Logger(trackTime));
    const { title, namespace, results } = Main[0];
    const { serviceId, moduleName, methodName } = namespace;
    const totalError = testResults.reduce((sum, testSection) => {
      return sum + testSection.reduce((sum, test) => (sum += test.errors.length), 0);
    }, 0);
    //console.log(PARTITION);
    console.log(PARTITION);
    if (totalError) {
      log(title + ` (${totalError} errors)`, "error", namespace.serviceId);
      testResults.forEach((testSection) => {
        testSection.forEach(({ errors, results, namespace, title }, i) => {
          const { serviceId, moduleName, methodName } = namespace;
          log(title, "error", sections[i]);
          console.log(`${serviceId}${moduleName}.${methodName}(...)`);
          console.log("results:", results);
          errors.forEach((err) => console.log(validationMessages(err)));
        });
      });
    } else {
      log(title, "success", namespace.serviceId);
      console.log(`Main: ${serviceId}.${moduleName}.${methodName}(...)\n`);
      console.log("results:", results);
    }
  };

  await new Promise((resolve) => {
    function recursiveRunTest(i = 0) {
      if (i === savedTest.length) resolve();
      else runTest(savedTest[i]).then(() => recursiveRunTest(i + 1));
    }
    recursiveRunTest();
  });
};
async function getTests(connectedServices) {
  return await new Promise(async (resolve) => {
    const results = [];

    return (async function recursiveGetTests(i = 0) {
      if (i < connectedServices.length) {
        const { connectionData } = connectedServices[i].system;
        try {
          results.push(await Client.createService(connectionData).Plugin.getTests());
        } catch (error) {
          console.log(`Failed to retrieve test from:${connectionData.serviceUrl}`);
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
    console.log("Failed to connect to systemview");
  }
}
