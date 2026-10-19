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
const { claimsOf } = require("../testing-utilities/stepClaims");
const { serviceClient } = require("./serviceClient");

const FullTestController = require("../testing-utilities/FullTestController");
const { matchNamespace } = require("../cli/utils/matchNamespace");
const { headersFor } = require("./probe");

const Client = createClient();
const { runFullTest } = new FullTestController();

// THE CLIENT THE RUNNER USES CHECKS ITSELF AGAINST THE REGISTRY (api/serviceClient.js).
// `testing-utilities/` is shared with the BROWSER, which builds a client per page load and so
// never had this problem — which is exactly why the same saved test passed in the window and
// failed through the hub. The verification therefore belongs on the client the HUB hands in, and
// every hub test path inherits it: collecting the specs, resolving actions, and the connection
// each test opens to execute.
//
// PER RUN, not per process, so what it repaired is reported with the run that repaired it.
function verifiedClientFor(rebuilds) {
  const c = Object.create(Client);
  c.createService = (cd) =>
    serviceClient(Client, cd, {
      onRebuild: ({ serviceUrl, was, now }) => {
        // SAID OUT LOUD. A silent self-heal is how this hid for a week: the run would simply start
        // passing, and nobody would learn the hub had been answering with a stale surface.
        const recovered = was.filter((m) => !now.includes(m));
        if (recovered.length) rebuilds.push({ serviceUrl, recovered });
      },
    });
  return c;
}

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
async function collectTests(services, client) {
  const lists = [];
  const unreachable = [];
  for (const service of services) {
    try {
      const svc = client.createService(service.system.connectionData);
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
async function actionsOfService(service, client) {
  const out = {};
  try {
    const svc = client.createService(service.system.connectionData);
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

async function actionMapFor(services, lists, client) {
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
  return Object.assign({}, ...(await Promise.all(chosen.map((s) => actionsOfService(s, client)))));
}

// ERRORS LIVE ON THE STEP, not on its evaluations. I wrote this reading `evaluations[].error` and the
// run came back `failed: 0` against a suite with a KNOWN deliberate failure — a green that would have
// been believed. The runner attaches `errors` to each step; that is the only thing to count.
const countErrors = (steps) => (steps || []).reduce((n, s) => n + ((s && s.errors ? s.errors.length : 0)), 0);


// DEAD WIRE, NAMED — not failed. When the registry itself says a service never answered
// (`unreachable`, above), a test whose every failure is connection noise did not RUN: it died
// dialing a socket the run already knew was dead. Counting that as "failed" buried four chat tests
// in standing red for weeks — a real regression would have been invisible inside it (the gap file
// gaps/CHAT_SUITE_ASSERTS_A_RETIRED_GATE_AND_SPRAYS_LIVE_ROOMS.md carries the chain). Two gates,
// both required: the registry must NAME an unreachable service, and every failure on the row must
// read as the wire, not the work — either the raw connect-error shapes or the dead service's own
// address. One real assertion failure on the row keeps the whole row failed.
const WIRE_NOISE = /AggregateError|ECONNREFUSED|ECONNRESET|ENOTFOUND|EHOSTUNREACH|ETIMEDOUT|socket hang up|Network Error|connect/i;
function isDeadWire(failures, unreachable) {
  if (!(unreachable || []).length || !(failures || []).length) return false;
  const addrs = unreachable.map((u) => String(u.at || "").replace(/^https?:\/\//, "")).filter(Boolean);
  return failures.every((f) => {
    const msg = String((f && f.message) || "");
    return WIRE_NOISE.test(msg) || addrs.some((a) => a && msg.includes(a));
  });
}

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

/**
 * RUN A LIST OF SAVED-TEST-SHAPED SPECS. The one execution path, extracted so that the thing which
 * EXECUTES is independent of where the specs came from: `runTests` collects them from each service's
 * `Plugin.getTests()`, and `api/proofs.js` builds them out of a document's `:::run` blocks. Two
 * collectors, one engine — a second runner would mean a proof that passes in one place and not the
 * other, with no way to tell which answer is the real one.
 *
 * `specs` are on-disk shape (`{ namespace, title, Before, Main, …, sections, run }`); each comes back
 * as a row with its namespace, pass/fail, duration and — only when it failed — the comparisons.
 */
async function executeSpecs(specs, { services, client, actionMap = {}, headers = {}, bail = false, unreachable = [] } = {}) {
  const initialized = initializeSavedTests(
    specs,
    services,
    // the VERIFIED client, so the connection each test executes against is checked against the
    // registry too — this is the one that actually runs the method under test
    client,
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
    const spec = specs[i] || {};
    const at = Date.now();
    await runFullTest({ sections, order });
    const failures = failuresOf(sections, order);
    // CLASSIFIED WHERE THE ROW IS BUILT, so a document's run block gets the dead-wire rule for free
    // rather than only the saved-test face. The row keeps its failures either way — classification
    // changes the COUNT, never the evidence.
    const deadWire = isDeadWire(failures, unreachable);
    // HOW MANY ASSERTIONS RAN, in the answer. An agent reading `passed: true` cannot tell four
    // assertions from none, and a step whose evaluations are all unsaved used to produce exactly
    // the same row as one that asserted everything (gaps/UNSAVED_EVALUATIONS…). The engine now
    // refuses that combination outright; this is the number that makes the refusal legible — and
    // that shows a suite quietly asserting less than its author thinks.
    //
    // COUNTED WHERE THE ROW IS BUILT, for the same reason the dead-wire rule is: a document's run
    // block is executed through this function too, so its proof rows carry the count for free.
    const asserted = (order || []).reduce(
      (n, name) => n + (sections[name] || []).reduce((m, s) => m + claimsOf(s).asserted, 0),
      0,
    );
    rows.push({
      namespace: nsOf(spec),
      title: title || spec.title || "",
      passed: !failures.length,
      ...(deadWire ? { deadWire: true } : {}),
      assertions: asserted,
      ms: Date.now() - at,
      // WHERE THE SPEC CAME FROM, when the collector attached one — a document's run block has no
      // file in `specs/tests/`, so without this a failing proof row names nothing a reader can open.
      ...(spec.at ? { at: spec.at } : {}),
      ...(failures.length ? { failures } : {}),
    });
    // A DEAD WIRE DOES NOT STOP THE RUN. Bailing on it would end a suite on a socket nobody was
    // testing, which is the opposite of what the classification is for.
    if (bail && failures.length && !deadWire) break;
  }
  return { rows, ms: Date.now() - started, ran: rows.length, total: initialized.length };
}

async function runTests(
  { projectCode, namespace, headers = {}, bail = false, dryRun = false, skip = [] } = {},
  connections = [],
) {
  if (!projectCode) return { error: "projectCode required" };
  const services = connections.filter((c) => c.projectCode === projectCode);
  if (!services.length) return { projectCode, error: `no connected services for ${projectCode}` };

  const rebuilds = [];
  const client = verifiedClientFor(rebuilds);
  const { lists, unreachable } = await collectTests(services, client);
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

  const actionMap = await actionMapFor(services, lists, client);
  const { rows, ms, total } = await executeSpecs(selected, { services, client, actionMap, headers, bail, unreachable });

  return {
    ...where,
    ms,
    passed: rows.filter((r) => r.passed).length,
    failed: rows.filter((r) => !r.passed && !r.deadWire).length,
    // the honest third number: tests that never really ran because a named service was down.
    // `unreachable` (in `where`, above) says who; this says how much it cost.
    ...(rows.some((r) => r.deadWire)
      ? {
          notRun: rows.filter((r) => r.deadWire).length,
          notUp: [...new Set((unreachable || []).map((u) => u.serviceId).filter(Boolean))],
        }
      : {}),
    // WHAT THE RUN HAD TO REPAIR BEFORE IT COULD RUN. Reported, not swallowed: a run that silently
    // fixed a stale client is a run that hid the reason the previous one failed.
    ...(rebuilds.length ? { rebuilt: rebuilds } : {}),
    ...(bail && rows.some((r) => !r.passed && !r.deadWire) && rows.length < total
      ? {
          stoppedEarly: true,
          notRun: total - rows.length + rows.filter((r) => r.deadWire).length,
        }
      : {}),
    tests: rows,
  };
}

module.exports = {
  runTests,
  collectTests,
  actionMapFor,
  countErrors,
  executeSpecs,
  verifiedClientFor,
  headersOf,
  idOf,
  isDeadWire,
};
