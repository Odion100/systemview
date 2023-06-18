const { Client } = require("systemlynx");
const { initializeSavedTests } = require("../testing-utilities/transformTests");
const FullTestController = require("../testing-utilities/FullTestController");
const log = require("./utils/log");
const validationMessages = require("../testing-utilities/validtionMessages");
module.exports = async function runTests(project_code) {
  if (!project_code) {
    return log("project_code or service_url are required", "warning", "warning");
  }
  // get connected services from the systemview api
  const connectedServices = await getConnectedServices(project_code);
  //get all the test for each service or the targeted services
  if (!connectedServices.length) {
    return log("No connected services found!", "warning");
  } else {
    connectedServices.forEach(({ serviceId, system }) => {
      log(`connected @${system.connectionData.serviceUrl}`, "success", serviceId);
    });
  }

  const Tests = await getTests(connectedServices);
  //transform the test from the saved format to the testing format

  const executeTest = async (savedTests) => {
    const tests = initializeSavedTests(savedTests, connectedServices);
    await runAllTests(tests);
  };
  (
    await new Promise((resolve) => {
      async function recursiveExecuteTest(i = 0) {
        const { serviceId } = connectedServices[i];
        log(`Initializing Tests...`, "info", serviceId);
        if (i === Tests.length) resolve();
        else executeTest(Tests[0]).then(() => recursiveExecuteTest(i + 1));
      }
      recursiveExecuteTest();
    })
  )();
};
const Logger = function (trackTime) {
  this.start = (test) => {
    if (trackTime) {
    }
  };

  this.end = ({ errors }) => {
    errors.forEach((err) => {
      const msg = validationMessages(err);
      log(msg, "error", err.namespace);
    });
  };
};
const { runFullTest } = new FullTestController();
const runAllTests = async (savedTest) => {
  const runTest = async ({ Before, Main, Events, After }) => {
    const fullTest = [Before, Main, Events, After];
    const [B, M, E, A] = await runFullTest(fullTest, new Logger());
    const { title, namespace } = Main[0];
    return { Before: B, Main: M, Events: E, After: A, title, namespace };
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
        const { connectionData } = connectedServices[1].system;
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
async function getConnectedServices(project_code) {
  try {
    const { SystemView } = await Client.loadService(
      "http://localhost:3300/systemview/api"
    );
    try {
      return SystemView.getServices(project_code);
    } catch (error) {}
  } catch (error) {
    console.log("Failed to connect to systemview");
  }
}
