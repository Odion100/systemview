// THE DEAD-WIRE RULE. A test whose every failure is connection noise against a service the
// registry already named unreachable did not RUN — it died dialing a dead socket. Four chat tests
// sat in standing red for weeks as "failed" (the gap file carries the chain); a real regression
// would have been invisible inside that red. These are the classifier's own rules: BOTH gates
// required, and one real assertion keeps the whole row failed.
const assert = require("node:assert");
const { test } = require("node:test");
const { isDeadWire } = require("./runTests");

const DEAD = [{ serviceId: "TestService", at: "http://localhost:5555/test/api" }];
const noise = (msg) => ({ phase: "run", step: "s", message: msg });

test("gate 1 — no unreachable service means NOTHING classifies, however noisy the failure", () => {
  assert.equal(isDeadWire([noise("AggregateError")], []), false);
  assert.equal(isDeadWire([noise("connect ECONNREFUSED 127.0.0.1:5555")], undefined), false);
});

test("gate 2 — empty failures are not a dead wire (a passing row needs no classification)", () => {
  assert.equal(isDeadWire([], DEAD), false);
});

test("pure connection noise against a named-dead service classifies", () => {
  assert.equal(isDeadWire([noise("AggregateError"), noise("connect ECONNREFUSED ::1:5555")], DEAD), true);
});

test("the dead service's own address classifies even without a noise keyword", () => {
  assert.equal(isDeadWire([noise("request to localhost:5555/test/api returned nothing")], DEAD), true);
});

test("one real assertion failure keeps the WHOLE row failed — noise never outvotes evidence", () => {
  const mixed = [noise("AggregateError"), noise("expected cursor 3, got undefined")];
  assert.equal(isDeadWire(mixed, DEAD), false);
});

test("a string error without message field still reads as what it says", () => {
  // failuresOf spreads string errors into { message } — but a caller handing { message: undefined }
  // must not crash the classifier or silently classify
  assert.equal(isDeadWire([{ phase: "run", step: null }], DEAD), false);
});

// ── THE PER-TEST DEADLINE ───────────────────────────────────────────────────────────────────
// A method that HANGS used to hang the whole run with nothing said, and the row it eventually
// produced was worse than silence: nothing answered, so every evaluation read `undefined` and the
// failures printed as "expected boolean, got undefined" — a broken-assertion face on a fixture
// that never came up. Measured on Api.chatDeliveryRules / Api.chatPluginRoom.
const { withDeadline, limitFor, timeoutFailure, DEADLINE, DEFAULT_TIMEOUT_MS, executeSpecs } = require("./runTests");

const hangs = () => new Promise(() => {});
// A SPEC IN ITS ON-DISK SHAPE: `namespace` is the three parts, not a dotted string — which is what
// `nsOf` joins, and what makes a failing row name something a reader can open.
const spec = (methodName, extra = {}) => ({
  namespace: { serviceId: "T", moduleName: "M", methodName },
  title: `T.M.${methodName}`,
  Main: [{ title: "the step", method: `T.M.${methodName}`, arguments: {}, evaluations: [] }],
  ...extra,
});

test("a promise that never settles comes back as the deadline, not as a value", async () => {
  assert.equal(await withDeadline(hangs(), 20), DEADLINE);
});

test("a promise that answers in time wins, and its value is untouched", async () => {
  assert.equal(await withDeadline(Promise.resolve("answered"), 50), "answered");
});

// A TEST THAT THROWS IS A DIFFERENT FAILURE FROM ONE THAT HANGS. The race must not convert the
// first into the second — the thrown message is the evidence.
test("a rejection still rejects", async () => {
  await assert.rejects(() => withDeadline(Promise.reject(new Error("boom")), 50), /boom/);
});

test("the deadline is per spec: its own timeoutMs wins, anything unusable falls back", () => {
  assert.equal(limitFor({ timeoutMs: 1500 }), 1500);
  assert.equal(limitFor({ timeoutMs: 0 }), DEFAULT_TIMEOUT_MS);
  assert.equal(limitFor({ timeoutMs: -5 }), DEFAULT_TIMEOUT_MS);
  assert.equal(limitFor({ timeoutMs: "soon" }), DEFAULT_TIMEOUT_MS);
  assert.equal(limitFor({}), DEFAULT_TIMEOUT_MS);
  assert.equal(limitFor({ timeoutMs: 1500 }, 200), 1500);
  assert.equal(limitFor({}, 200), 200);
});

test("the timeout says the cause and names the step, in the unit a reader thinks in", () => {
  const f = timeoutFailure(60000, "the step");
  assert.match(f.message, /^timed out after 60s — the method never answered/);
  assert.equal(f.step, "the step");
  assert.equal(f.timedOut, true);
  assert.match(timeoutFailure(250).message, /after 250ms/);
  assert.equal(timeoutFailure(250).step, null);
});

// THE WIRING, which is the half that matters: the row has to SAY it timed out, carry the timeout
// as its only failure, claim no assertions, and — the whole point — the run has to keep going.
test("a hung spec fails with the timeout, asserts nothing, and the run continues past it", async () => {
  let ran = 0;
  const out = await executeSpecs([spec("hangs"), spec("answers")], {
    services: [],
    client: {},
    timeoutMs: 25,
    runOne: () => (ran++ === 0 ? hangs() : Promise.resolve()),
  });
  assert.equal(out.rows.length, 2, "both rows exist — the hang did not end the run");
  const [hung, next] = out.rows;
  assert.equal(hung.timedOut, true);
  assert.equal(hung.passed, false);
  assert.equal(hung.assertions, 0, "nothing answered, so nothing was asserted");
  assert.equal(hung.failures.length, 1, "the timeout is the ONLY failure — no undefined comparisons");
  assert.match(hung.failures[0].message, /timed out after 25ms/);
  assert.equal(hung.namespace, "T.M.hangs", "and the row still names what hung");
  assert.ok(!next.timedOut, "the second spec ran on its own terms");
});

test("a spec's own timeoutMs beats the run's", async () => {
  const out = await executeSpecs([spec("slow", { timeoutMs: 20 })], {
    services: [],
    client: {},
    timeoutMs: 60000,
    runOne: hangs,
  });
  assert.match(out.rows[0].failures[0].message, /timed out after 20ms/);
});

// A RUN WHERE THREE METHODS NEVER ANSWERED IS A DIFFERENT MORNING from one with three wrong
// assertions, and the summary used to read identically.
test("bail stops at a timeout, because a hang is a failure", async () => {
  const out = await executeSpecs([spec("a"), spec("b")], {
    services: [],
    client: {},
    timeoutMs: 20,
    bail: true,
    runOne: hangs,
  });
  assert.equal(out.rows.length, 1);
  assert.equal(out.ran, 1);
  assert.equal(out.total, 2);
});

// ── A STALE REGISTRATION DOES NOT END THE RUN ───────────────────────────────────────────────────
// Found by USING the door, 2026-11-07: `runProofs` over 27 collectable specs died on one stale
// method reference — a record written from an older build of the service — and answered with a
// single error string. Twenty-seven proofs that had nothing to do with it never ran. This file's own
// run loop states the doctrine that was broken: a dead wire does not stop the run.
const { degradedService, declaredSurface } = require("./serviceClient");

const CD = {
  serviceId: "T",
  serviceUrl: "http://localhost:4000/t/api",
  modules: [{ name: "Plugin", methods: [{ fn: "getTests" }, { fn: "fixturesRunning" }] }],
};

test("a degraded service carries the surface the REGISTRY declared, so the engine indexes it normally", () => {
  const err = new Error("the registry says this service publishes Plugin.fixturesRunning, but the service does not");
  const svc = degradedService(CD, err);
  // the shape is the record's, not the live service's — that is what makes it a drop-in
  assert.deepEqual(declaredSurface(CD), [{ module: "Plugin", methods: ["getTests", "fixturesRunning"] }]);
  assert.equal(typeof svc.Plugin.getTests, "function");
  assert.equal(typeof svc.Plugin.fixturesRunning, "function");
});

test("...and every method on it answers with the disagreement itself", async () => {
  const err = new Error("the registry says this service publishes Plugin.fixturesRunning, but the service does not");
  err.registryMismatch = ["Plugin.fixturesRunning"];
  const svc = degradedService(CD, err);
  await assert.rejects(() => svc.Plugin.fixturesRunning(), /registry says this service publishes/);
  // THE METHOD THAT IS FINE FAILS TOO, and that is correct rather than unfortunate: the record this
  // service was built from cannot be trusted about any of its surface, so a spec leaning on it has
  // to fail saying that — not pass against a shape nobody can vouch for.
  await assert.rejects(() => svc.Plugin.getTests(), /registry says this service publishes/);
});

test("a module the registry names but nothing declares is skipped, not invented", () => {
  const svc = degradedService({ modules: [{ name: "", methods: [{ fn: "x" }] }] }, new Error("x"));
  assert.deepEqual(Object.keys(svc), []);
  assert.deepEqual(Object.keys(degradedService({}, new Error("x"))), []);
});
