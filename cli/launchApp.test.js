// WHO HOSTS THE HUB — the one rule in this file, and the day it was not covered cost him his IDE.
//
// MEASURED 2026-11-07. Hosting was removed from `launchApp` entirely (fabf2226) on an argument that
// is right for most of the CLI: a command that EXITS must never stand up a hub, because a rival on
// the same port knows none of your projects, documents or connected services and then answers
// confidently against an empty world. What the change missed is that the shell brings SystemView up
// by running THIS COMMAND — autobot's `electron/apps/registry.cjs` carries
// `start: ["/usr/local/bin/systemview", "start", "3000"]` — so removing the host left the system with
// none. He stopped the hub, clicked open SystemView, and the launcher spawned `systemview start 3000`
// eleven times in two minutes; every one printed "the hub is not running — open SystemView and the hub
// comes up with it" and exited 0.
//
// So the claims below pin BOTH halves, because either one alone is the bug: `start` hosts, and
// nothing else does.
//
// NO NETWORK AND NO HUB. `appIsRunning` and `../api` are the two doors this module reaches through,
// and both are replaced in the require cache before a fresh copy of the module is loaded — the same
// pattern manifestHeaders.test.js uses, for the same reason: this file caches its requires on load.
const assert = require("node:assert");
const { test } = require("node:test");
const path = require("node:path");

const PORT = 3999;

// A fresh launchApp whose two doors are stubs. `up` decides what the probe sees; the returned
// `hosted` array records every port the hub module was asked to serve.
const fresh = ({ up }) => {
  const hosted = [];
  const said = [];

  const place = (id, value) => {
    const file = require.resolve(id);
    require.cache[file] = { id: file, filename: file, loaded: true, exports: value };
    return file;
  };

  const files = [
    place("./appIsRunning", async () => up),
    place("../api", async (port) => { hosted.push(port); }),
    // Neither of these should run in a non-interactive call, and a real one would reach the network.
    place("./listTests", async () => {}),
    place("./startLineReader", async () => {}),
    place("./logger", {
      error: (m) => said.push(String(m)),
      info: (m) => said.push(String(m)),
      success: (m) => said.push(String(m)),
      warn: (m) => said.push(String(m)),
    }),
  ];

  // console.log carries half the refusal, so it is captured too — the claim is about what he READS.
  const log = console.log;
  console.log = (...a) => said.push(a.join(" "));

  delete require.cache[require.resolve("./launchApp")];
  const launchApp = require("./launchApp");

  return {
    launchApp,
    hosted,
    read: () => said.join("\n"),
    done: () => {
      console.log = log;
      for (const f of files) delete require.cache[f];
      delete require.cache[require.resolve("./launchApp")];
    },
  };
};

test("`start` HOSTS the hub when nothing is serving the port", async () => {
  const h = fresh({ up: false });
  try {
    // interactive + host is exactly what cli/index.js's startApp passes, and nothing else does.
    const ok = await h.launchApp(PORT, { interactive: true, host: true });
    assert.equal(ok, true, "it answers true — there is a hub now");
    assert.deepEqual(h.hosted, [PORT], "and the hub module was asked to serve that port");
    assert.ok(!/is not running/.test(h.read()), "no refusal: refusing here is what left him with no way up");
  } finally { h.done(); }
});

test("every other command REFUSES rather than hosting one it would take down on exit", async () => {
  const h = fresh({ up: false });
  try {
    const ok = await h.launchApp(PORT);
    assert.equal(ok, false, "false, so the caller can exit non-zero");
    assert.deepEqual(h.hosted, [], "AND NOTHING WAS HOSTED — a hub that dies with the command is worse than none");
    const out = h.read();
    assert.ok(/is not running on port 3999/.test(out), out);
    // THE REFUSAL HAS TO NAME THE WAY UP. The old wording said "open SystemView and the hub comes up
    // with it", which is a circle: opening SystemView runs this command.
    assert.ok(/systemview start 3999/.test(out), "it names the command that actually hosts");
    assert.ok(/SV_PORT/.test(out), "and the override, because the probe and the hub read the same one");
  } finally { h.done(); }
});

test("a hub already serving the port is ATTACHED to, never replaced", async () => {
  const h = fresh({ up: true });
  try {
    assert.equal(await h.launchApp(PORT), true);
    assert.deepEqual(h.hosted, [], "a second hub on one port answers against an empty world");
    // Same under the host flag: `start` run twice must attach to the first, not fight it.
    const again = fresh({ up: true });
    try {
      assert.equal(await again.launchApp(PORT, { host: true }), true);
      assert.deepEqual(again.hosted, [], "and `start` on an occupied port hosts nothing either");
    } finally { again.done(); }
  } finally { h.done(); }
});

test("the refusal is printed ONCE per process, however many call sites miss", async () => {
  const h = fresh({ up: false });
  try {
    await h.launchApp(PORT);
    await h.launchApp(PORT);
    const hits = h.read().match(/is not running on port/g) || [];
    assert.equal(hits.length, 1, "two misses in one run read as two faults");
  } finally { h.done(); }
});

test("the module is loaded from cli/, beside the command that runs it", () => {
  // A guard against the file moving without this suite following it — the require.cache pattern
  // above is silent about a path that no longer exists.
  assert.equal(path.basename(require.resolve("./launchApp")), "launchApp.js");
});
