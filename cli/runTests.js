const { Client } = require("systemlynx");
const { initializeSavedTests } = require("../testing-utilities/transformTests");
const FullTestController = require("../testing-utilities/FullTestController");
const log = require("./utils/log");
const validationMessages = require("../testing-utilities/validtionMessages");
const { runFullTest } = new FullTestController();

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

const runAllTests = async (savedTest, trackTime) => {
  const runTest = async ({ Before, Main, Events, After }) => {
    const fullTest = [Before, Main, Events, After];
    await runFullTest(fullTest, new Logger(trackTime));
    const { namespace } = Main[0];
    const { moduleName, methodName } = namespace;

    log(`Testing --> ${moduleName}.${methodName}(...)`, "info", namespace.serviceId);
    console.log(PARTITION);
    console.log(PARTITION);
    logTestSection(Before, "Before");
    logTestSection(Main, "Main", true);
    logTestSection(Events, "Events");
    logTestSection(After, "After");
  };

  await new Promise((resolve) => {
    function recursiveRunTest(i = 0) {
      if (i === savedTest.length) resolve();
      else runTest(savedTest[i]).then(() => recursiveRunTest(i + 1));
    }
    recursiveRunTest();
  });
};

function logTestSection(tests, section, logSuccess = false) {
  tests.forEach(({ errors, results, namespace, title, response_type }, i) => {
    const { serviceId, moduleName, methodName } = namespace;
    const LOG_TYPE = errors.length ? "error" : "success";
    const LABEL = LOG_TYPE === "error" ? "FAILED" : "PASSED";
    if (LOG_TYPE === "error" || logSuccess) {
      log(title, "info", section + ":");
      log(`${serviceId}.${moduleName}.${methodName}(...)`, LOG_TYPE, `${LABEL}`);
      console.log(`${response_type}:`, results);
      errors.forEach((err) => console.log(`-> ${validationMessages(err)}`));
      console.log(PARTITION);
    }
  });
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
    console.log("Failed to connect to systemview", error);
  }
}
