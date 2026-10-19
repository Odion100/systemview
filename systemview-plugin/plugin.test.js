const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const os = require("os");
const path = require("path");

// THE PLUGIN'S REQUEST HOOKS, CLAIMED FOR THE FIRST TIME.
//
// His card, 2026-10-19: *"the plugin's request hooks have no test harness… nothing mounts a service
// with the plugin applied, so there is no way to claim that a start/error/end trace carries its
// enrichment, that `exclude` really skips a module, or that the stats rollup counts what it
// should."* Two findings that week could only be verified by READING the source, which is the
// weakest evidence this system accepts.
//
// The harness is the card's own suggestion: the plugin takes `(App, system)`, so a fake App that
// records what it is handed is the whole fixture. Nothing here talks to a hub, a socket or a real
// service — the plugin's UI half is switched off (`useSystemViewUI: false`), which is exactly how a
// UI-less remote service runs anyway.

// A FAKE SystemLynx App. It only has to do the four things the plugin uses: take modules, take
// `$all` hooks, take lifecycle listeners, and hand a registered module back on `useModule`.
const makeApp = () => {
  const before = [];
  const after = [];
  const modules = {};
  const listeners = {};
  const emitted = [];
  const app = {
    module(name, Mod) {
      // Modules arrive as constructors (`function SystemViewLogModule(){ this.trace = … }`), which
      // is how the real App takes them.
      const inst = typeof Mod === "function" ? new Mod() : { ...Mod };
      // `trace`/`log` end with `this.emit("log", record)` — the service's own event channel. Here
      // it is the recorder the claims read.
      inst.emit = (evt, rec) => emitted.push({ evt, rec });
      modules[name] = inst;
      return inst;
    },
    before: (pattern, fn) => before.push(fn),
    after: (pattern, fn) => after.push(fn),
    on(evt, fn) {
      (listeners[evt] = listeners[evt] || []).push(fn);
    },
    loadService: () => {},
    useModule: (name) => modules[name],
    useService: () => ({}),
    getModules: () => modules,
    fire(evt, payload) {
      (listeners[evt] || []).forEach((fn) => fn.call(app, payload));
    },
  };
  return { app, before, after, modules, emitted };
};

const mount = (config = {}) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "sv-plugin-"));
  const h = makeApp();
  const plugin = require("./index")({
    projectCode: "testproj",
    serviceId: "Svc",
    root,
    useSystemViewUI: false, // no hub, no socket — the UI half is a different subject
    writeManifest: false,
    ...config,
  });
  plugin(h.app, {});
  // READY IS WHAT BINDS `sv` — without it the hooks trace nothing. The real App hands listeners a
  // system record (connectionData/modules/routing/services); the Plugin module reads it, so the
  // fake has to pass one or mounting throws before a single claim runs.
  h.app.fire("ready", { connectionData: {}, modules: {}, routing: {}, services: {} });
  return { ...h, root, traces: () => h.emitted.filter((e) => e.rec && e.rec.level === "trace").map((e) => e.rec) };
};

const reqFor = (module_name, fn, extra = {}) => ({
  module_name,
  fn,
  arguments: [{ email: "a@b.c" }],
  headers: {},
  session: { user_id: "u1" },
  Module: {},
  ...extra,
});

test("a mounted plugin registers the log module and both $all hooks", () => {
  const { modules, before, after } = mount();
  assert.ok(modules.SystemView, "the SystemView log module is registered");
  assert.ok(modules.Plugin, "the Plugin module is registered with or without a hub");
  assert.strictEqual(before.length, 1);
  assert.strictEqual(after.length, 1);
});

// THE GAP THIS CLOSES: `gaps/TRACE_ENRICHMENT_END_ONLY.md` reported that the `trace` function's
// context reached only the `end` record — so an errored request (which never produces an `end`)
// carried none of it, in exactly the case where knowing WHO hit the error matters most. The code
// now computes it fresh per entry via `svCtx(req)`. These are the claims that keep it that way.
test("the trace enrichment reaches start, error AND end — not just the one that happened to capture it", () => {
  const { app, before, after, traces } = mount({ trace: (req) => ({ user_id: req.session && req.session.user_id }) });
  const req = reqFor("Users", "signUp");
  const res = { sendError: () => {} };

  before[0](req, res, () => {});
  after[0](req, res, () => {});
  res.sendError(Object.assign(new Error("boom"), { status: 400 }));

  const byScope = Object.fromEntries(traces().map((r) => [r.scope, r]));
  assert.deepStrictEqual(Object.keys(byScope).sort(), ["end", "error", "start"]);
  assert.strictEqual(byScope.start.user_id, "u1", "the start entry carries the enrichment");
  assert.strictEqual(byScope.error.user_id, "u1", "the errored request carries it — the case the gap was about");
  assert.strictEqual(byScope.end.user_id, "u1", "and the end entry still does");
  assert.ok(app);
});

// FRESH PER ENTRY, not captured once: a value that changes mid-request (a session arriving late)
// has to show up as it was at each entry, or the anomaly is masked behind one snapshot.
test("the enrichment is computed per entry, so a value that changes mid-request shows the change", () => {
  const { before, after, traces } = mount({ trace: (req) => ({ user_id: req.session && req.session.user_id }) });
  const req = reqFor("Users", "signUp", { session: {} });
  before[0](req, { sendError: () => {} }, () => {});
  req.session.user_id = "arrived-late";
  after[0](req, { sendError: () => {} }, () => {});
  const byScope = Object.fromEntries(traces().map((r) => [r.scope, r]));
  assert.strictEqual(byScope.start.user_id, undefined);
  assert.strictEqual(byScope.end.user_id, "arrived-late");
});

// A `trace` fn that throws must not take the request with it — enrichment is a convenience, and a
// caller's bad lambda is not a reason for the service to 500.
test("a trace function that throws is swallowed, and the entry is still written", () => {
  const { before, traces } = mount({
    trace: () => {
      throw new Error("bad lambda");
    },
  });
  before[0](reqFor("Users", "signUp"), { sendError: () => {} }, () => {});
  assert.strictEqual(traces().length, 1);
  assert.strictEqual(traces()[0].scope, "start");
});

test("exclude really skips a module — no trace from it at all", () => {
  const { before, after, traces } = mount({ exclude: ["Quiet"] });
  before[0](reqFor("Quiet", "tick"), { sendError: () => {} }, () => {});
  after[0](reqFor("Quiet", "tick"), { sendError: () => {} }, () => {});
  assert.strictEqual(traces().length, 0);
});

test("exclude takes a single METHOD too, leaving the rest of its module traced", () => {
  const { before, traces } = mount({ exclude: ["Users.password"] });
  before[0](reqFor("Users", "password"), { sendError: () => {} }, () => {});
  assert.strictEqual(traces().length, 0);
  before[0](reqFor("Users", "signUp"), { sendError: () => {} }, () => {});
  assert.strictEqual(traces().length, 1);
});

// OUR OWN PLUMBING IS NEVER THE PROJECT'S TRAFFIC — a chat append must not be logged and counted
// as one of their calls.
test("the plugin's own modules are never traced", () => {
  const { before, traces } = mount();
  ["Plugin", "SystemView", "SystemViewChat"].forEach((name) =>
    before[0](reqFor(name, "getManifest"), { sendError: () => {} }, () => {}),
  );
  assert.strictEqual(traces().length, 0);
});

test("the stats rollup counts a call, and an errored call as an error", () => {
  const { before, after, modules } = mount();
  const req = reqFor("Users", "signUp");
  before[0](req, { sendError: () => {} }, () => {});
  after[0](req, { sendError: () => {} }, () => {});

  const bad = reqFor("Users", "signIn");
  const res = { sendError: () => {} };
  before[0](bad, res, () => {});
  res.sendError(Object.assign(new Error("nope"), { status: 401 }));

  const snap = modules.SystemView.getStats();
  const signUp = snap.methods.find((m) => m.moduleMethod === "Users.signUp");
  const signIn = snap.methods.find((m) => m.moduleMethod === "Users.signIn");
  assert.ok(signUp, "the successful call was counted");
  assert.strictEqual(signUp.errors, 0);
  assert.ok(signIn, "the errored call was counted");
  assert.strictEqual(signIn.errors, 1);
});

// RFC-015 Tier 2 — an inbound `x-sv-trace` is ADOPTED so a cross-service chain shares one id, and
// the caller rides along. Claimed because it is invisible until two services disagree.
test("an inbound trace id is adopted rather than replaced", () => {
  const { before, traces } = mount();
  before[0](reqFor("Users", "signUp", { headers: { "x-sv-trace": "abc-123", "x-sv-caller": "buAPI" } }), { sendError: () => {} }, () => {});
  assert.strictEqual(traces()[0].traceId, "abc-123");
});

test("records carry the service's identity, so a merged log can be split again", () => {
  const { before, traces } = mount();
  before[0](reqFor("Users", "signUp"), { sendError: () => {} }, () => {});
  const r = traces()[0];
  assert.strictEqual(r.projectCode, "testproj");
  assert.strictEqual(r.serviceId, "Svc");
  assert.strictEqual(r.moduleMethod, "Users.signUp");
});
