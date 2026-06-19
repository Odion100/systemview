const fs = require("fs");
const path = require("path");
const { createCookieClient } = require("./cookieClient");
const { initializeSavedTests } = require("../testing-utilities/transformTests");
const FullTestController = require("../testing-utilities/FullTestController");
const log = require("./logger");
const validationMessages = require("../testing-utilities/validtionMessages");
const { runFullTest } = new FullTestController();

const chalk = require("chalk");
const DIVIDER = chalk.dim("  " + "─".repeat(60));

module.exports = async function runTests(url, project_code, namespace, { json = false, verbose = false, manifest: manifestPath, headers: cliHeaders = {} } = {}) {
  const api = `${url}/systemview/api`;

  if (!project_code) {
    log.warn("project_code required. Example: systemview test myAPI");
    return 1;
  }

  const { services: connectedServices, probeHeaders: manifestHeaders } = await resolveServices(api, project_code, manifestPath);
  if (!connectedServices || !connectedServices.length) {
    log.warn("No connected services found for project: " + project_code);
    return 1;
  }

  const extraHeaders = { ...manifestHeaders, ...cliHeaders };
  const Client = createCookieClient(extraHeaders);

  if (!json) {
    connectedServices.forEach(({ serviceId, system }) => {
      log.success(`connected: ${serviceId} @ ${system.connectionData.serviceUrl}`);
    });
  }

  const allTestLists = await getTests(connectedServices, Client);
  const testToRun = allTestLists
    .map((list) =>
      namespace
        ? list.filter(({ namespace: n }) =>
            `${n.serviceId}.${n.moduleName}.${n.methodName}`.includes(namespace)
          )
        : list
    )
    .filter((list) => list.length);

  if (!testToRun.length) {
    log.warn(`No tests found matching: ${project_code}${namespace ? " " + namespace : ""}`);
    return 0;
  }

  const jsonOutput = json ? { projectCode: project_code, passed: 0, failed: 0, tests: [] } : null;
  let totalFailed = 0;

  for (const testList of testToRun) {
    const { serviceId } = testList[0].namespace;
    if (!json) log.info(`Initializing tests for ${serviceId}...`);

    try {
      const initialized = initializeSavedTests(testList, connectedServices, Client);
      const { passed, failed, jsonTests } = await runAllTests(initialized, url, project_code, json, verbose);
      totalFailed += failed;

      if (json) {
        jsonOutput.passed += passed;
        jsonOutput.failed += failed;
        jsonOutput.tests.push(...jsonTests);
      } else {
        log[failed ? "error" : "success"](
          `${serviceId}: ${passed + failed} tests, ${passed} passed, ${failed} failed`
        );
      }
    } catch (error) {
      log.error(`Unexpected error for ${serviceId}: ${error.message}`);
    }
  }

  if (json) {
    process.stdout.write(JSON.stringify(jsonOutput, null, 2) + "\n");
  } else {
    console.log("");
    log.info("TEST COMPLETE");
    console.log("");
  }

  return totalFailed > 0 ? 1 : 0;
};

const runAllTests = async (savedTests, url, project_code, json, verbose) => {
  const sum = { passed: 0, failed: 0, jsonTests: [] };

  for (const { Before, Main, Events, After, title, namespace } of savedTests) {
    const { moduleName, methodName, serviceId } = namespace;
    const fullTest = [Before, Main, Events, After];

    if (!json) {
      console.log("");
      console.log("  " + chalk.bold.cyan(`${serviceId}.${moduleName}.${methodName}(...)`));
      console.log(chalk.dim(`    UI → ${url}/${project_code}/${serviceId}/${moduleName}/${methodName}`));
      console.log("");
    }

    await runFullTest(fullTest);

    const hasFailed =
      countErrors(Before) + countErrors(Main) + countErrors(Events) + countErrors(After) > 0;

    if (hasFailed) sum.failed++;
    else sum.passed++;

    if (json) {
      sum.jsonTests.push({
        title,
        serviceId,
        moduleName,
        methodName,
        status: hasFailed ? "failed" : "passed",
        Before: serializePhase(Before),
        Main: serializePhase(Main),
        Events: serializePhase(Events),
        After: serializePhase(After),
      });
    } else {
      logPhase(Before, "Before", verbose, verbose);
      logPhase(Main, "Main", true, verbose);
      logPhase(Events, "Events", verbose, verbose);
      logPhase(After, "After", verbose, verbose);
    }
  }

  return sum;
};

function countErrors(tests) {
  return tests.reduce((n, t) => n + (t.errors ? t.errors.length : 0), 0);
}

function logPhase(tests, section, logSuccess = false, verbose = false) {
  tests.forEach(({ errors, results, namespace, title, args }) => {
    const { serviceId, moduleName, methodName } = namespace;
    const failed = errors && errors.length;
    if (!failed && !logSuccess) return;
    console.log(chalk.dim(`    ${section}: ${title}`));
    failed
      ? log.error(`  ${serviceId}.${moduleName}.${methodName}(...)`)
      : log.success(`  ${serviceId}.${moduleName}.${methodName}(...)`);
    if (verbose && args && args.length) {
      console.log("");
      args.forEach(({ name, input }) => {
        console.log(`    ${chalk.dim(name)}`, JSON.stringify(input));
      });
    }
    console.log("");
    console.log("    results:", JSON.stringify(results, null, 2).replace(/\n/g, "\n    "));
    console.log("");
    if (failed) {
      log.warn(`  ${errors.length} validation error(s)`);
      errors.forEach((err) => console.log(`    → ${validationMessages(err)}`));
      console.log("");
    }
    console.log(DIVIDER);
  });
}

function serializePhase(tests) {
  return tests.map((test) => {
    const { title, namespace, args, results, errors, evaluations } = test;
    const { serviceId, moduleName, methodName } = namespace;
    const hasFailed = errors && errors.length > 0;
    const entry = {
      title,
      serviceId,
      moduleName,
      methodName,
      args: args.map((a) => ({ name: a.name, input: a.input })),
      status: hasFailed ? "failed" : "passed",
      response: results,
    };
    if (hasFailed) {
      entry.failedEvaluations = (evaluations || [])
        .filter((e) => e.save && e.errors && e.errors.length)
        .map((e) => ({
          namespace: e.namespace,
          expected_type: e.expected_type,
          validations: e.validations,
          received: e.value,
        }));
    }
    return entry;
  });
}

async function getTests(connectedServices, Client) {
  const results = [];
  for (const { system } of connectedServices) {
    const { connectionData } = system;
    try {
      results.push(await Client.createService(connectionData).Plugin.getTests());
    } catch (error) {
      log.warn(`Failed to retrieve tests from ${connectionData.serviceUrl}`);
    }
  }
  return results;
}

async function resolveServices(api, project_code, manifestPath) {
  const manifestFile = manifestPath || path.join(process.cwd(), "systemview.manifest.json");

  if (fs.existsSync(manifestFile)) {
    try {
      const raw = JSON.parse(fs.readFileSync(manifestFile, "utf8"));
      const services = raw.services
        ? raw.services
        : [{ serviceId: raw.serviceId, system: raw.system, specList: raw.specList }];

      if (project_code && raw.projectCode && raw.projectCode !== project_code) {
        log.warn(`Manifest projectCode "${raw.projectCode}" doesn't match "${project_code}", falling back to API`);
      } else {
        return { services, probeHeaders: raw.probeHeaders || {} };
      }
    } catch (err) {
      log.warn(`Failed to read manifest: ${err.message}`);
    }
  }

  const BaseClient = createCookieClient();
  const services = await getConnectedServices(api, project_code, BaseClient);
  return { services, probeHeaders: {} };
}

async function getConnectedServices(api, project_code, Client) {
  try {
    const { SystemView } = await Client.loadService(api);
    return await SystemView.getServices(project_code);
  } catch (error) {
    log.error("Failed to connect to SystemView: " + error.message);
    return [];
  }
}
