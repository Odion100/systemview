// THE GUARANTEE, NOT THE DATA: one trace may be lost; the process may not. safeClone (layer one)
// keeps the record useful; these claims are about layer two — the thing that holds when a payload
// nobody anticipated reaches the encoder (gaps/TRACE_EMIT_CRASHES_HOST_ON_CIRCULAR).
const assert = require("node:assert");
const { test, beforeEach } = require("node:test");
const { safeEmit } = require("./safeEmit");

const captureStderr = (fn) => {
  const said = [];
  const real = console.error;
  console.error = (...a) => said.push(a.join(" "));
  try { fn(); } finally { console.error = real; }
  return said;
};

beforeEach(() => safeEmit.reset());

test("a normal emit goes through and says it did", () => {
  const seen = [];
  assert.strictEqual(safeEmit({ emit: (ev, r) => seen.push([ev, r]) }, { level: "trace" }), true);
  assert.deepStrictEqual(seen, [["log", { level: "trace" }]]);
});

// The real crash: socket.io-parser recursing on a cycle raises a synchronous RangeError at the call
// site, inside the host's own request hook. It IS catchable there — that is the whole fix.
test("a RangeError from the encoder is caught, not thrown at the host", () => {
  const exploding = { emit: () => { throw new RangeError("Maximum call stack size exceeded"); } };
  let out;
  const said = captureStderr(() => {
    assert.doesNotThrow(() => { out = safeEmit(exploding, { level: "trace" }, "trace"); });
  });
  assert.strictEqual(out, false); // and it REPORTS the drop rather than pretending it emitted
  assert.match(said[0], /could not be emitted and was dropped/);
  assert.match(said[0], /service is unaffected/);
});

test("any throw is caught, not only the one we know about", () => {
  const said = captureStderr(() => {
    assert.strictEqual(safeEmit({ emit: () => { throw new TypeError("converting circular"); } }, {}, "log"), false);
  });
  assert.strictEqual(said.length, 1);
});

// A service erroring in a loop must not have its stderr flooded by the thing watching it quietly.
test("it warns once per level and error kind, not once per record", () => {
  const exploding = { emit: () => { throw new RangeError("boom"); } };
  const said = captureStderr(() => {
    for (let i = 0; i < 50; i++) safeEmit(exploding, { i }, "trace");
  });
  assert.strictEqual(said.length, 1);
  // …but a DIFFERENT level is a different fact and is worth saying once too
  const more = captureStderr(() => safeEmit(exploding, {}, "error"));
  assert.strictEqual(more.length, 1);
});

test("an emitter that is missing or malformed costs the trace, not the process", () => {
  assert.doesNotThrow(() => safeEmit({}, { a: 1 }));
  assert.strictEqual(safeEmit({}, { a: 1 }), false);
  assert.doesNotThrow(() => safeEmit(null, { a: 1 }));
});

test("reporting a failed emit never emits — that recursion is the bug itself", () => {
  let emits = 0;
  const exploding = { emit: () => { emits += 1; throw new RangeError("boom"); } };
  captureStderr(() => safeEmit(exploding, {}, "trace"));
  assert.strictEqual(emits, 1, "exactly one attempt, no retry and no second record");
});
