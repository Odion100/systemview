// OBSERVABILITY MAY NOT KILL THE OBSERVED. Every claim here is some version of one sentence: after
// safeClone, `JSON.stringify` cannot throw and the encoder cannot recurse — and the result is still
// worth reading (gaps/TRACE_EMIT_CRASHES_HOST_ON_CIRCULAR).
const assert = require("node:assert");
const { test } = require("node:test");
const { safeClone } = require("./safeClone");

// The gap's own object, built to its own diagram:
//   query → mongooseCollection → collection → s → db → s → topology → s → sessionPool → topology
const mongooseQuery = () => {
  const topology = { s: {} };
  const sessionPool = { topology };
  topology.s.sessionPool = sessionPool;
  const db = { s: { topology } };
  topology.s.db = db;
  const collection = { s: { db } };
  return { _conditions: { _id: "abc" }, mongooseCollection: { collection } };
};

test("the Mongoose Query that crashed the host now serializes", () => {
  const args = [mongooseQuery(), { limit: 10 }];
  assert.throws(() => JSON.stringify(args), /circular/i); // the live object, for the record
  const out = JSON.stringify(safeClone(args, { redact: [] }));
  assert.ok(out.length > 0);
  assert.match(out, /"_id":"abc"/); // and the part worth reading survived
});

test("a cycle is named by where it pointed, not just reported", () => {
  const req = { arguments: [{}] };
  req.arguments[0].back = req;
  const clone = safeClone(req);
  assert.strictEqual(clone.arguments[0].back, "[Circular ~]");
  const nested = { a: { b: {} } };
  nested.a.b.up = nested.a;
  assert.strictEqual(safeClone(nested).a.b.up, "[Circular ~.a]");
});

// THE DEFAULT CONFIG WAS THE DANGEROUS ONE: `if (!paths.length) return data` handed the caller's
// live object to the encoder. It must clone whether or not anything is redacted.
test("it ALWAYS clones, even with no redact paths", () => {
  const live = { nested: { n: 1 } };
  const clone = safeClone(live, { redact: [] });
  assert.notStrictEqual(clone, live);
  assert.notStrictEqual(clone.nested, live.nested);
  assert.deepStrictEqual(clone, { nested: { n: 1 } });
});

test("redaction still works, with the same path syntax the host configures", () => {
  const data = { user: { password: "hunter2", name: "od" }, list: [{ token: "abc" }] };
  const clone = safeClone(data, { redact: ["user.password", "list[0].token"] });
  assert.strictEqual(clone.user.password, "[REDACTED]");
  assert.strictEqual(clone.user.name, "od");
  assert.strictEqual(clone.list[0].token, "[REDACTED]");
});

test("redaction survives a circular payload — the combination that threw synchronously in the hook", () => {
  const data = { user: { password: "hunter2" }, q: mongooseQuery() };
  data.q.self = data.q;
  const clone = safeClone(data, { redact: ["user.password"] });
  assert.strictEqual(clone.user.password, "[REDACTED]");
  assert.doesNotThrow(() => JSON.stringify(clone));
});

test("a value's own toJSON wins — the caller already said how it reads", () => {
  const query = { toJSON: () => ({ conditions: { _id: 1 } }), huge: mongooseQuery() };
  assert.deepStrictEqual(safeClone(query), { conditions: { _id: 1 } });
  // …and a toJSON that throws is still not allowed to throw out of here
  assert.strictEqual(safeClone({ toJSON: () => { throw new Error("nope"); } }), "[Unserializable Object]");
});

test("non-JSON leaves become honest strings instead of {}", () => {
  const clone = safeClone({
    fn: function namedFn() {},
    anon: () => {},
    buf: Buffer.from("hello"),
    when: new Date("2026-10-19T00:00:00.000Z"),
    re: /ab+c/gi,
    err: new Error("boom"),
    map: new Map([[1, 2]]),
    set: new Set([1, 2, 3]),
    inf: Infinity,
    big: 10n,
  });
  assert.strictEqual(clone.fn, "[Function namedFn]");
  assert.match(clone.anon, /^\[Function /);
  assert.strictEqual(clone.buf, "[Buffer 5B]");
  assert.strictEqual(clone.when, "2026-10-19T00:00:00.000Z");
  assert.strictEqual(clone.re, "/ab+c/gi");
  assert.deepStrictEqual(clone.err, { name: "Error", message: "boom" });
  assert.strictEqual(clone.map, "[Map 1]");
  assert.strictEqual(clone.set, "[Set 3]");
  assert.strictEqual(clone.inf, "Infinity");
  assert.strictEqual(clone.big, "10n");
  assert.doesNotThrow(() => JSON.stringify(clone)); // JSON.stringify alone throws on the BigInt
});

test("a getter that throws costs its own key, not the trace", () => {
  const data = { ok: 1 };
  Object.defineProperty(data, "landmine", { enumerable: true, get() { throw new Error("detached"); } });
  const clone = safeClone(data);
  assert.strictEqual(clone.ok, 1);
  assert.match(clone.landmine, /Threw on read: detached/);
});

test("depth and node budgets bound the walk — a trace is a breadcrumb, not a heap dump", () => {
  let deep = { end: true };
  for (let i = 0; i < 40; i++) deep = { down: deep };
  assert.match(JSON.stringify(safeClone(deep)), /Depth limit/);
  const wide = { list: Array.from({ length: 5000 }, (_, i) => ({ i })) };
  const out = JSON.stringify(safeClone(wide));
  assert.match(out, /node budget/);
  assert.ok(out.length < 200000, "the record stays a breadcrumb");
});

// A SIBLING THAT REUSES ONE OBJECT IS NOT A CYCLE. Marking it as one would make ordinary shared
// references (a config object passed to two arguments) read as corruption.
test("the same object in two sibling positions is cloned twice, not called circular", () => {
  const shared = { id: 7 };
  const clone = safeClone({ a: shared, b: shared });
  assert.deepStrictEqual(clone, { a: { id: 7 }, b: { id: 7 } });
});

test("something with no readable own keys is named rather than rendered as an empty object", () => {
  class Socket {
    constructor() {
      Object.defineProperty(this, "fd", { value: 12, enumerable: false });
    }
  }
  assert.strictEqual(safeClone({ sock: new Socket() }).sock, "[Socket]");
});

test("primitives, null and undefined pass through unharmed", () => {
  assert.strictEqual(safeClone(null), null);
  assert.strictEqual(safeClone(undefined), undefined);
  assert.strictEqual(safeClone(5), 5);
  assert.strictEqual(safeClone("x"), "x");
  assert.strictEqual(safeClone(false), false);
  assert.deepStrictEqual(safeClone([]), []);
});
