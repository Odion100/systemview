const { createClient } = require("systemlynx");
const { createCookieHttpClient } = require("./cookieClient");
const cookieHttpClient = createCookieHttpClient();
const Client = createClient(cookieHttpClient);
const { initializeSavedTests } = require("../testing-utilities/transformTests");
const FullTestController = require("../testing-utilities/FullTestController");
const log = require("./logger");
const validationMessages = require("../testing-utilities/validtionMessages");
const { truncate, TruncationMarker } = require("./utils/truncate");
const resolveTarget = require("./utils/resolveTarget");
const { matchNamespace } = require("./utils/matchNamespace");

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

  const { services: connectedServices, resolvedNamespace } = await resolveServices(api, project_code);
  if (resolvedNamespace && !namespace) namespace = resolvedNamespace;
  if (!connectedServices || !connectedServices.length) {
    log.warn("No connected services found for project: " + project_code);
    return 1;
  }

  const extraHeaders = { ...cliHeaders };

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
  // Resolver for `{ use }` steps — only the actions these tests actually name (RFC-020, namespaced).
  const actionMap = await getActionMap(connectedServices, Client, allTestLists);
  const resolveAction = (name) => actionMap[name] || null;
  const testToRun = allTestLists
    .map((list) =>
      list.filter(({ namespace: n }) => {
        const full = `${n.serviceId}.${n.moduleName}.${n.methodName}`;
        const matchesInclude = !namespace || matchNamespace(full, namespace);
        const matchesSkip = skipPatterns.length && skipPatterns.some((p) => matchNamespace(full, p));
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
      const initialized = initializeSavedTests(testList, connectedServices, Client, extraHeaders, resolveAction);
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

  for (const test of savedTests) {
    // RFC-020 — a test is `{ sections, order }`; the run-order is a list of section names (built-in
    // before/main/events/after + any shared-action sections). We run and report each section in that order.
    const { title, namespace } = test;
    const sections = { ...test.sections };
    let order = [...(test.order || [])];

    if (phaseFilter) {
      const allowed = phaseFilter.split(",").map((p) => p.trim().toLowerCase());
      order = order.filter((name) => allowed.includes(name));
    }
    if (indexFilter !== undefined) {
      order.forEach((name) => {
        sections[name] = (sections[name] || []).slice(indexFilter, indexFilter + 1);
      });
    }

    const { moduleName, methodName, serviceId } = namespace;

    if (!json) {
      console.log(SUITE_DIVIDER);
      console.log("  " + chalk.bold("Test: ") + chalk.bold.cyan(title));
      console.log(SUITE_DIVIDER);
      console.log(chalk.dim(`    ${serviceId}.${moduleName}.${methodName} → ${url}/${project_code}/${serviceId}/${moduleName}/${methodName}`));
      console.log("");
    }

    await runFullTest({ sections, order });

    const hasFailed =
      order.reduce((n, name) => n + countErrors(sections[name] || []), 0) > 0;

    if (hasFailed) {
      sum.failed++;
      const failedPhases = [];
      order.forEach((name) => {
        const actions = (sections[name] || [])
          .filter((t) => t.errors && t.errors.length)
          .map((t) => ({ actionTitle: t.title, errors: t.errors }));
        if (actions.length) failedPhases.push({ phase: sectionLabel(name), actions });
      });
      sum.failures.push({ serviceId, moduleName, methodName, title, failedPhases });
    } else {
      sum.passed++;
    }

    if (json) {
      const jsonTest = { title, serviceId, moduleName, methodName, status: hasFailed ? "failed" : "passed" };
      order.forEach((name) => { jsonTest[sectionLabel(name)] = serializePhase(sections[name] || []); });
      sum.jsonTests.push(jsonTest);
    } else {
      const compact = !verbose;
      order.forEach((name) =>
        logPhase(sections[name] || [], sectionLabel(name), verbose, compact, name === "main")
      );
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

// RFC-020 — a section's display label. Built-ins get their capitalized name; a shared-action section shows
// its own name (so a custom section reads as itself, e.g. "seedSum", not "Before").
function sectionLabel(name) {
  return { before: "Before", main: "Main", events: "Events", after: "After" }[name] || name;
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
  for (const { serviceId, system } of connectedServices) {
    const { connectionData } = system;
    try {
      const list = await Client.createService(connectionData).Plugin.getTests();
      // A project's services can share one specs folder, so getTests returns the WHOLE folder
      // (every service's specs) from each service. Keep only the specs that belong to THIS service
      // (by serviceId) — otherwise a shared spec runs once per sibling service (double-count).
      results.push(list.filter((t) => t && t.namespace && t.namespace.serviceId === serviceId));
    } catch (error) {
      log.warn(`Failed to retrieve tests from ${connectionData.serviceUrl}`);
    }
  }
  return results;
}

// RFC-020 (revised 2026-08-17) — a `{ use }` reference CARRIES the service that stores it
// (`TestService.seedSum`), so only the services a test actually names are asked, and they are asked
// AT ONCE. The runner and the window have to agree about the same file, so this rule is the same one
// `src/organisms/SavedTests/transformTests.js` applies.
async function actionsOfService(service, Client) {
  const out = {};
  try {
    const svc = Client.createService(service.system.connectionData);
    if (!svc.Plugin || !svc.Plugin.getActions) return out;
    const list = (await svc.Plugin.getActions()) || [];
    const id = service.serviceId || (service.system.connectionData || {}).serviceId;
    list.forEach((a) => {
      if (!a || !a.name) return;
      out[`${id}.${a.name}`] = a;
      if (!out[a.name]) out[a.name] = a;
    });
  } catch (error) {
    /* older plugin / no actions — fine */
  }
  return out;
}

async function getActionMap(connectedServices, Client, testLists) {
  const wanted = new Set();
  (testLists || []).flat().forEach((t) => {
    Object.values((t && t.sections) || {}).forEach((v) => {
      if (v && v.use) wanted.add(String(v.use));
    });
  });
  if (!wanted.size) return {}; // no named sections anywhere — nobody gets asked
  const needed = new Set();
  wanted.forEach((ref) => {
    const dot = ref.indexOf(".");
    if (dot > 0) needed.add(ref.slice(0, dot));
  });
  // A BARE reference belongs to the test's own service, so when one shows up every service that has
  // tests in this run is a candidate — still only the ones in play, never the whole project blindly.
  const bare = [...wanted].some((r) => !r.includes("."));
  const chosen = connectedServices.filter(
    (s) => bare || needed.has(s.serviceId || (s.system.connectionData || {}).serviceId),
  );
  const maps = await Promise.all(chosen.map((s) => actionsOfService(s, Client)));
  return Object.assign({}, ...maps);
}

async function resolveServices(api, project_code) {
  try {
    const { SystemView } = await Client.loadService(api);
    return await resolveTarget(SystemView, project_code);
  } catch (error) {
    log.error("Failed to connect to SystemView: " + error.message);
    return { services: [] };
  }
}
