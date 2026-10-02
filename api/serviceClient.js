// ONE DOOR TO A SERVICE CLIENT, AND IT CANNOT SERVE A SURFACE THAT DISAGREES WITH THE REGISTRY.
//
// THE CONDITION THIS EXISTS TO END (2026-09-30, found with buapi-7e after three wrong theories):
// `Client.createService(connectionData)` returns a CACHED instance keyed by serviceUrl, and its
// module/method map is frozen at first construction. The hub is a long-lived process, so a service
// that gains a method later leaves the hub holding a client that cannot call it — while the
// registry record, the manifest, and the live service all list it. The browser builds its own
// client per page load, so the SAME saved test passes in the window and fails through the MCP.
//
// What that produced was not a wrong answer, it was an unanswerable one: `Storage publishes no
// method createClip` is a true statement about a stale object and a false statement about the
// system, and nothing on either side said which. Three theories came out of it — a client cache, a
// duplicate registration, the wrong deployed instance — and a working facilitator was deleted.
//
// THE FIX IS NOT A RESTART AND NOT A RE-CONNECT. Both are a human noticing and intervening, which
// means the condition is still there, waiting. The hub holds both halves of the contradiction: the
// registry DECLARES what a service publishes (`connectionData.modules[].methods[].fn`) and the
// built object either has those functions or does not. So it is checked, here, at the only place a
// client is obtained — and a disagreement rebuilds the client instead of being handed to a caller
// as a missing method. If it still disagrees after a genuine rebuild, that is a real mismatch
// between the registry and the service, and it is REPORTED with both surfaces named rather than
// surfacing later as a method that does not exist.
const { createClient } = require("systemlynx");

// What the registry says this service publishes: [{ module, methods: [...] }]
function declaredSurface(connectionData) {
  const mods = (connectionData && connectionData.modules) || [];
  return mods.map((m) => ({
    module: m.name,
    methods: (m.methods || []).map((x) => x.fn).filter(Boolean),
  }));
}

// Which declared methods the built object cannot actually call. Empty means they agree.
function missingFrom(service, connectionData) {
  const gaps = [];
  for (const { module, methods } of declaredSurface(connectionData)) {
    const M = service && service[module];
    if (!M) {
      if (module) gaps.push(`${module} (whole module)`);
      continue;
    }
    for (const fn of methods) if (typeof M[fn] !== "function") gaps.push(`${module}.${fn}`);
  }
  return gaps;
}

// `Client` is passed in rather than required here, because the hub's client carries its cookie jar
// and headers — a second client would be a second identity, which is its own class of bug.
function serviceClient(Client, connectionData, { onRebuild } = {}) {
  let service = Client.createService(connectionData);
  const gaps = missingFrom(service, connectionData);
  if (!gaps.length) return service;

  // THE REBUILD, ONCE. unloadService closes this instance's sockets and drops the cache entry, so
  // createService genuinely constructs a new one from the record we are holding.
  try { Client.unloadService(connectionData.serviceUrl); } catch {}
  service = Client.createService(connectionData);
  const still = missingFrom(service, connectionData);
  if (onRebuild) {
    try { onRebuild({ serviceUrl: connectionData.serviceUrl, was: gaps, now: still }); } catch {}
  }
  if (still.length) {
    // Not a stale client — the registry and the service genuinely disagree. Naming both halves is
    // the whole point: the caller can see it is a registration problem, not a missing method.
    const err = new Error(
      `${connectionData.serviceUrl}: the registry says this service publishes ` +
        `${still.join(", ")}, but the service does not. Re-register it (the record was written ` +
        `from an older build of the service), or the method was removed without re-registering.`
    );
    err.registryMismatch = still;
    throw err;
  }
  return service;
}

module.exports = { serviceClient, missingFrom, declaredSurface, createClient };
