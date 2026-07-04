const fs = require("fs");
const path = require("path");
const { createClient } = require("systemlynx");
const { createCookieHttpClient } = require("./cookieClient");
const cookieHttpClient = createCookieHttpClient();
const Client = createClient(cookieHttpClient);
const { initializeSavedTests } = require("../testing-utilities/transformTests");
const FullTestController = require("../testing-utilities/FullTestController");
const log = require("./logger");
const validationMessages = require("../testing-utilities/validtionMessages");
const { truncate, TruncationMarker } = require("./utils/truncate");

function formatTruncated(value, indent = 0) {
  const pad = "  ".repeat(indent);
  const inner = "  ".repeat(indent + 1);
  if (value instanceof TruncationMarker) return chalk.dim(value.message);
  if (value === null) return "null";
  if (typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) {
    if (!value.length) return "[]";
    const items = value.map((v) =>
      v instanceof TruncationMarker
        ? inner + chalk.dim(v.message)
        : inner + formatTruncated(v, indent + 1)
    );
    return "[\n" + items.join(",\n") + "\n" + pad + "]";
  }
  const keys = Object.keys(value);
  if (!keys.length) return "{}";
  const entries = keys.map((k) => {
    const v = value[k];
    if (k === "__more__" && v instanceof TruncationMarker)
      return inner + chalk.dim(v.message);
    return inner + JSON.stringify(k) + ": " + formatTruncated(v, indent + 1);
  });
  return "{\n" + entries.join(",\n") + "\n" + pad + "}";
}
const { runFullTest } = new FullTestController();

const chalk = require("chalk");
const DIVIDER = chalk.dim("  " + "─".repeat(60));
const SUITE_DIVIDER = chalk.cyan("  " + "─".repeat(60));

module.exports = async function runTests(
  url,
  project_code,
  namespace,
  {
    json = false,
    verbose = false,
    manifest: manifestPath,
    headers: cliHeaders = {},
    bail = false,
    dryRun = false,
    phase: phaseFilter = null,
    index: indexFilter = undefined,
    skip: skipPatterns = [],
  } = {}
) {
  const api = `${url}/systemview/api`;

  if (!project_code) {
    log.warn("project_code required. Example: systemview test myAPI");
    return 1;
  }

  const { services: connectedServices, probeHeaders: manifestHeaders, resolvedNamespace } = await resolveServices(
    api,
    project_code,
    manifestPath
  );
  if (resolvedNamespace && !namespace) namespace = resolvedNamespace;
  if (!connectedServices || !connectedServices.length) {
    log.warn("No connected services found for project: " + project_code);
    return 1;
  }

  const extraHeaders = { ...manifestHeaders, ...cliHeaders };

  if (!json) {
    connectedServices.forEach(({ serviceId, system }) => {
      log.success(`connected: ${serviceId} @ ${system.connectionData.serviceUrl}`);
    });
    if (namespace || skipPatterns.length) {
      console.log("");
      console.log(chalk.dim(`  Filters:`));
      if (namespace) console.log(`    ${chalk.dim(`namespace: ${chalk.white(namespace)}`)}`);
      if (skipPatterns.length) console.log(`    ${chalk.dim(`skip: ${chalk.white(skipPatterns.join(", "))}`)}`);
    }
  }

  const allTestLists = await getTests(connectedServices, Client);
  const testToRun = allTestLists
    .map((list) =>
      list.filter(({ namespace: n }) => {
        const full = `${n.serviceId}.${n.moduleName}.${n.methodName}`;
        const matchesInclude = !namespace || full.includes(namespace);
        const matchesSkip = skipPatterns.length && skipPatterns.some((p) => full.includes(p));
        return matchesInclude && !matchesSkip;
      })
    )
    .filter((list) => list.length);

  if (!testToRun.length) {
    log.warn(`No tests found matching: ${project_code}${namespace ? " " + namespace : ""}`);
    return 0;
  }

  if (dryRun) {
    const total = testToRun.reduce((n, list) => n + list.length, 0);
    console.log("");
    console.log(`  Would run ${total} ${total === 1 ? "test" : "tests"}:`);
    console.log("");
    testToRun.forEach((list) => {
      list.forEach(({ namespace: n, title }) => {
        console.log(`  ${chalk.cyan(`${n.serviceId}.${n.moduleName}.${n.methodName}`)} — "${title}"`);
      });
    });
    console.log("");
    return 0;
  }

  const jsonOutput = json ? { projectCode: project_code, passed: 0, failed: 0, tests: [] } : null;
  let totalFailed = 0;
  const serviceSummaries = [];
  const allFailures = [];

  for (const testList of testToRun) {
    const { serviceId } = testList[0].namespace;
    if (!json) log.info(`Initializing tests for ${serviceId}...`);

    try {
      const initialized = initializeSavedTests(testList, connectedServices, Client, extraHeaders);
      const { passed, failed, jsonTests, failures } = await runAllTests(
        initialized,
        url,
        project_code,
        json,
        verbose,
        { bail, phaseFilter, indexFilter }
      );
      totalFailed += failed;

      if (json) {
        jsonOutput.passed += passed;
        jsonOutput.failed += failed;
        jsonOutput.tests.push(...jsonTests);
      } else {
        serviceSummaries.push({ serviceId, passed, failed });
        allFailures.push(...failures);
      }

      if (bail && failed > 0) break;
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

    serviceSummaries.forEach(({ serviceId, passed, failed }) => {
      const total = passed + failed;
      log[failed ? "error" : "success"](
        `${serviceId}: ${total} tests, ${passed} passed, ${failed} failed`
      );
    });

    if (allFailures.length) {
      console.log("");
      log.warn("FAILED:");
      allFailures.forEach(({ serviceId, moduleName, methodName, title, failedPhases }) => {
        console.log("");
        log.error(`  ${serviceId}.${moduleName}.${methodName} — "${title}"`);
        failedPhases.forEach(({ phase, actions }) => {
          actions.forEach(({ actionTitle, errors }) => {
            console.log(`      ${phase}: "${actionTitle}"`);
            errors.forEach((err) => console.log(`        → ${validationMessages(err)}`));
          });
        });
      });
      console.log("");
    }
  }

  return totalFailed > 0 ? 1 : 0;
};

const runAllTests = async (savedTests, url, project_code, json, verbose, opts = {}) => {
  const { bail = false, phaseFilter = null, indexFilter = undefined } = opts;
  const sum = { passed: 0, failed: 0, jsonTests: [], failures: [] };

  for (const { Before: B, Main: M, Events: E, After: A, title, namespace } of savedTests) {
    let Before = [...B];
    let Main = [...M];
    let Events = [...E];
    let After = [...A];

    if (phaseFilter) {
      const allowed = phaseFilter.split(",").map((p) => p.trim().toLowerCase());
      if (!allowed.includes("before")) Before = [];
      if (!allowed.includes("main")) Main = [];
      if (!allowed.includes("events")) Events = [];
      if (!allowed.includes("after")) After = [];
    }

    if (indexFilter !== undefined) {
      Before = Before.slice(indexFilter, indexFilter + 1);
      Main = Main.slice(indexFilter, indexFilter + 1);
      Events = Events.slice(indexFilter, indexFilter + 1);
      After = After.slice(indexFilter, indexFilter + 1);
    }

    const fullTest = [Before, Main, Events, After];
    const { moduleName, methodName, serviceId } = namespace;

    if (!json) {
      console.log(SUITE_DIVIDER);
      console.log("  " + chalk.bold("Test: ") + chalk.bold.cyan(title));
      console.log(SUITE_DIVIDER);
      console.log(chalk.dim(`    ${serviceId}.${moduleName}.${methodName} → ${url}/${project_code}/${serviceId}/${moduleName}/${methodName}`));
      console.log("");
    }

    await runFullTest(fullTest);

    const hasFailed =
      countErrors(Before) + countErrors(Main) + countErrors(Events) + countErrors(After) > 0;

    if (hasFailed) {
      sum.failed++;
      const failedPhases = [];
      [
        { phase: "Before", tests: Before },
        { phase: "Main", tests: Main },
        { phase: "Events", tests: Events },
        { phase: "After", tests: After },
      ].forEach(({ phase, tests }) => {
        const actions = tests
          .filter((t) => t.errors && t.errors.length)
          .map((t) => ({ actionTitle: t.title, errors: t.errors }));
        if (actions.length) failedPhases.push({ phase, actions });
      });
      sum.failures.push({ serviceId, moduleName, methodName, title, failedPhases });
    } else {
      sum.passed++;
    }

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
      const compact = !verbose;
      logPhase(Before, "Before", verbose, compact, false);
      logPhase(Main, "Main", verbose, false, true);
      logPhase(Events, "Events", verbose, compact, false);
      logPhase(After, "After", verbose, compact, false);
    }

    if (bail && hasFailed) break;
  }

  return sum;
};

function logPhase(tests, section, verbose = false, compact = false, isMain = false) {
  tests.forEach(({ errors, results, namespace, title, args }) => {
    const { serviceId, moduleName, methodName } = namespace;
    const failed = errors && errors.length;

    const label = isMain ? chalk.bold.green(section) : chalk.blue(section);
    console.log(`    ${label}: ${chalk.dim(title)}`);
    if (failed) {
      console.log("  " + chalk.bold.red(`${serviceId}.${moduleName}.${methodName}(...)`));
    } else if (isMain) {
      console.log("  " + chalk.bold.green(`${serviceId}.${moduleName}.${methodName}(...)`));
    } else {
      log.success(`  ${serviceId}.${moduleName}.${methodName}(...)`);
    }

    if (verbose && args && args.length) {
      console.log("");
      args.forEach(({ name, input }) => {
        console.log(`    ${chalk.dim(name)}`, JSON.stringify(input));
      });
    }

    console.log("");
    if (compact) {
      console.log("    results:", JSON.stringify(truncate(results)));
    } else if (verbose) {
      console.log("    results:", JSON.stringify(results, null, 2).replace(/\n/g, "\n    "));
    } else {
      console.log("    results:", formatTruncated(truncate(results)).replace(/\n/g, "\n    "));
    }
    console.log("");

    if (failed) {
      log.warn(`  ${errors.length} validation error(s)`);
      errors.forEach((err) => console.log(`    → ${validationMessages(err)}`));
      console.log("");
    }

    console.log(DIVIDER);
  });
}

function countErrors(tests) {
  return tests.reduce((n, t) => n + (t.errors ? t.errors.length : 0), 0);
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
        const isNamespace = services.some(({ system }) =>
          (system.connectionData.modules || []).some(({ name, methods }) =>
            name.toLowerCase().includes(project_code.toLowerCase()) ||
            (methods || []).some(({ fn }) => fn.toLowerCase().includes(project_code.toLowerCase()))
          )
        );
        if (!isNamespace) {
          log.warn(
            `Manifest projectCode "${raw.projectCode}" doesn't match "${project_code}", falling back to API`
          );
        } else {
          return { services, probeHeaders: raw.probeHeaders || {}, resolvedNamespace: project_code };
        }
      } else {
        return { services, probeHeaders: raw.probeHeaders || {} };
      }
    } catch (err) {
      log.warn(`Failed to read manifest: ${err.message}`);
    }
  }

  const services = await getConnectedServices(api, project_code, Client);
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
