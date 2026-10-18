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
