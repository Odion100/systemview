// RUNNING TESTS, AS A HUB CAPABILITY — the second half of the correction `api/probe.js` makes.
//
// The hub used to `require("../cli/runTests")` and call it in a "collect" mode. That is the CLI
// being the implementation with the hub as its caller, which is backwards: the CLI resolves services
// by making an HTTP call to the hub it is already inside, carries a cwd-relative cookie jar, logs to
// a terminal and answers with an exit code. None of that is orchestration — all of it is a
// terminal's assumptions, and under the hub they are silently wrong.
//
// What IS orchestration — transforming saved specs, resolving `{ use }` references, running the
// phases, evaluating — already lives in `testing-utilities/`, outside both faces. This file is the
// hub's own composition of it, and it answers with what a terminal never could: where each test
// lives, which services answered and which never replied, per-test timings, and the failing
// evaluations themselves rather than a printed transcript.
const { createClient } = require("systemlynx");
const { initializeSavedTests } = require("../testing-utilities/transformTests");
const FullTestController = require("../testing-utilities/FullTestController");
const { matchNamespace } = require("../cli/utils/matchNamespace");
const { headersFor } = require("./probe");

const Client = createClient();
const { runFullTest } = new FullTestController();

const idOf = (s) => s.serviceId || (s.system && s.system.connectionData && s.system.connectionData.serviceId);
const nsOf = (t) => {
  const n = (t && t.namespace) || {};
  return [n.serviceId, n.moduleName, n.methodName].filter(Boolean).join(".");
};

// PROJECT-WIDE HEADERS, computed from the target project's own `.systemview/` and nowhere else.
// `extraHeaders` reaches every step flat, so this merges the headers for each of the project's
// service origins — the same shape `connect --save-session -g` makes deliberate on the CLI, and
// bounded to one project because the caller named one.
function headersOf(services, extra = {}) {
  const merged = {};
  for (const s of services) Object.assign(merged, headersFor(s.root, s.system.connectionData.serviceUrl));
  return { ...merged, ...extra };
}

// A project's services can share one specs folder, so `getTests` returns the whole folder from every
// service. Keep only the specs belonging to THIS service, or a shared spec runs once per sibling.
async function collectTests(services) {
  const lists = [];
  const unreachable = [];
  for (const service of services) {
    try {
      const svc = Client.createService(service.system.connectionData);
      const list = (await svc.Plugin.getTests()) || [];
      lists.push(list.filter((t) => t && t.namespace && t.namespace.serviceId === idOf(service)));
    } catch {
      // A service that cannot be asked is NAMED, not silently counted as "no tests" — the difference
      // between "nothing to run" and "half your suite never got asked" is the whole answer.
      unreachable.push({ serviceId: idOf(service), at: service.system.connectionData.serviceUrl });
      lists.push([]);
    }
  }
  return { lists, unreachable };
}

// RFC-020 — a `{ use }` reference carries the service that stores it, so only the services a test
// actually names are asked, and they are asked at once.
async function actionsOfService(service) {
  const out = {};
  try {
    const svc = Client.createService(service.system.connectionData);
    if (!svc.Plugin || !svc.Plugin.getActions) return out;
    const id = idOf(service);
    for (const a of (await svc.Plugin.getActions()) || []) {
      if (!a || !a.name) continue;
      out[`${id}.${a.name}`] = a;
      if (!out[a.name]) out[a.name] = a;
    }
  } catch {
    /* an older plugin has no actions — not a failure */
  }
  return out;
}

async function actionMapFor(services, lists) {
  const wanted = new Set();
  (lists || []).flat().forEach((t) =>
    Object.values((t && t.sections) || {}).forEach((v) => {
      if (v && v.use) wanted.add(String(v.use));
    }),
  );
  if (!wanted.size) return {};
  const needed = new Set();
  wanted.forEach((ref) => {
    const dot = ref.indexOf(".");
    if (dot > 0) needed.add(ref.slice(0, dot));
  });
  const bare = [...wanted].some((r) => !r.includes("."));
  const chosen = services.filter((s) => bare || needed.has(idOf(s)));
  return Object.assign({}, ...(await Promise.all(chosen.map(actionsOfService))));
}

// ERRORS LIVE ON THE STEP, not on its evaluations. I wrote this reading `evaluations[].error` and the
// run came back `failed: 0` against a suite with a KNOWN deliberate failure — a green that would have
// been believed. The runner attaches `errors` to each step; that is the only thing to count.
const countErrors = (steps) => (steps || []).reduce((n, s) => n + ((s && s.errors ? s.errors.length : 0)), 0);

// The failing comparison itself, not a rendered transcript — an agent can act on the values.
function failuresOf(sections, order) {
  const out = [];
  for (const name of order || [])
    for (const step of sections[name] || [])
      for (const err of (step && step.errors) || [])
        out.push({
          phase: name,
          step: (step && step.title) || null,
          ...(typeof err === "string" ? { message: err } : err),
        });
  return out;
}

async function runTests(
  { projectCode, namespace, headers = {}, bail = false, dryRun = false, skip = [] } = {},
  connections = [],
) {
  if (!projectCode) return { error: "projectCode required" };
  const services = connections.filter((c) => c.projectCode === projectCode);
  if (!services.length) return { projectCode, error: `no connected services for ${projectCode}` };

  const { lists, unreachable } = await collectTests(services);
  const skips = Array.isArray(skip) ? skip : [skip].filter(Boolean);
  const selected = lists
    .flat()
    .filter((t) => !namespace || matchNamespace(nsOf(t), namespace))
    .filter((t) => !skips.some((p) => matchNamespace(nsOf(t), p)));

  const where = {
    projectCode,
    services: services.map((s) => ({ serviceId: idOf(s), at: s.system.connectionData.serviceUrl, root: s.root || null })),
    ...(unreachable.length ? { unreachable } : {}),
  };

  if (!selected.length)
    return {
      ...where,
      tests: [],
      passed: 0,
      failed: 0,
      // WHY there is nothing to run is the useful half: a filter that matched nothing, a project with
      // no saved tests, and a service that never answered are three different problems, and the
      // terminal's "no tests" said none of them.
      error: unreachable.length
        ? `no tests to run — ${unreachable.map((u) => u.serviceId).join(", ")} did not answer`
        : namespace
        ? `no tests matching "${namespace}" in ${projectCode}`
        : `${projectCode} has no saved tests`,
    };

  if (dryRun)
    return {
      ...where,
      dryRun: true,
      tests: selected.map((t) => ({
        namespace: nsOf(t),
        title: t.title || "",
        sections: Object.keys(t.sections || {}),
      })),
    };

  const actionMap = await actionMapFor(services, lists);
  const initialized = initializeSavedTests(
    selected,
    services,
    Client,
    headersOf(services, headers),
    (name) => actionMap[name] || null,
  );

  const started = Date.now();
  const rows = [];
  for (let i = 0; i < initialized.length; i += 1) {
    const test = initialized[i];
    const { sections, order, title } = test;
    // THE NAMESPACE DOES NOT SURVIVE INITIALIZATION. `initializeSavedTests` returns sections+order and
    // drops `namespace`, so reading it off the initialized test produced "undefined.undefined.undefined"
    // on every row — visible, but only if you look. The spec it came from is still right here, in order.
    const spec = selected[i] || {};
    const at = Date.now();
    await runFullTest({ sections, order });
    const failures = failuresOf(sections, order);
    rows.push({
      namespace: nsOf(spec),
      title: title || spec.title || "",
      passed: !failures.length,
      ms: Date.now() - at,
      ...(failures.length ? { failures } : {}),
    });
    if (bail && failures.length) break;
  }

  return {
    ...where,
    ms: Date.now() - started,
    passed: rows.filter((r) => r.passed).length,
    failed: rows.filter((r) => !r.passed).length,
    ...(bail && rows.some((r) => !r.passed) && rows.length < initialized.length
      ? { stoppedEarly: true, notRun: initialized.length - rows.length }
      : {}),
    tests: rows,
  };
}

module.exports = { runTests, collectTests, actionMapFor, countErrors };
