const fs = require("fs");
const { createClient } = require("systemlynx");
const { createCookieHttpClient } = require("../cli/cookieClient");
// Same manifest-header client as api/index.js and the CLI — so re-probing stored connections
// (refreshConnections) also carries operator-authored headers. A gated service would otherwise
// silently drop out of the UI on every refresh.
const Client = createClient(createCookieHttpClient());
const LOCAL_STORAGE = `${__dirname}/connections.json`;

// The connections store is a gitignored runtime file — absent on a fresh clone and until the first
// save. Read it defensively so a missing/empty/corrupt file reads as "no connections yet" instead of
// throwing ENOENT and crashing the UI on launch (refreshConnections runs on the `ready` event).
function readConnections() {
  try {
    const parsed = JSON.parse(fs.readFileSync(LOCAL_STORAGE, "utf8"));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function refreshConnections(connections) {
  return new Promise((resolve) => {
    const newConnections = [];
    const recursiveCheckConnection = async (i = 0) => {
      if (i === connections.length) {
        // A kept-dead row earns its place ONLY when it's the sole row for its service — if a
        // live row for the same (project, service) came through the probe, the dead one is a
        // superseded ghost (old port from a previous boot), not an offline service. Found as a
        // duplicate dead SystemViewCore row shadowing its live replacement and failing the suite.
        const key = (r) => `${r.projectCode}|${r.serviceId}`;
        const groups = {};
        newConnections.forEach((r) => { (groups[key(r)] = groups[key(r)] || []).push(r); });
        const result = newConnections.filter(
          (r) => !(r.__keptDead && groups[key(r)].some((o) => !o.__keptDead)),
        );
        result.forEach((r) => delete r.__keptDead);
        return resolve(result);
      }

      // RFC-021 — a DYNAMIC (project-defined/synthesized) service has no live URL: never probe it,
      // never rebuild it from a plugin, keep the stored entry verbatim. Without this branch every
      // server restart silently dropped synthesized services as "dead".
      if (connections[i].dynamic) {
        newConnections.push(connections[i]);
        return recursiveCheckConnection(i + 1);
      }

      const { serviceUrl } = connections[i].system.connectionData;
      try {
        const { Plugin } = await Client.loadService(serviceUrl);
        if (Plugin) {
          const fresh = await Plugin.getConnection();
          // getConnection doesn't know store-side flags — carry `hosted` over, or a hosted row
          // reads hosted:false after one refresh and its dead ghost is then KEPT (as a plain
          // offline row) instead of dropped on the next boot. Found as a duplicate dead
          // SystemViewCore row failing the suite.
          newConnections.push({ ...fresh, hosted: connections[i].hosted || fresh.hosted });
        } else if (!connections[i].hosted) newConnections.push({ ...connections[i], __keptDead: true });
        recursiveCheckConnection(i + 1);
      } catch (error) {
        // A dead service is OFFLINE, not GONE (his rule — "it doesn't even say offline, the
        // entire project is gone"): keep the stored entry so the row survives and renders
        // unreachable; the plugin's next connect refreshes it. Rows leave the store only by
        // explicit remove/disconnect — or when a LIVE row supersedes them (the dedupe above).
        // HOSTED entries stay dropped here on purpose — boot re-hosts them fresh and the
        // rehosted escape below re-adds the new registration.
        if (!connections[i].hosted) newConnections.push({ ...connections[i], __keptDead: true });
        recursiveCheckConnection(i + 1);
      }
    };

    recursiveCheckConnection();
  });
}

module.exports = function ConnectedServices() {
  this.refreshConnections = async () => {
    const connections = readConnections();
    const newConnections = await refreshConnections(connections);
    // The probe loop takes a while (dead URLs time out). Anything registered MEANWHILE — notably
    // RFC-021 dynamic services connected by the CLI's onReady loadManifest, which races this — is in
    // the store but not in our stale snapshot; a blind write would clobber it. Merge before writing.
    const current = readConnections();
    current.forEach((svc) => {
      const seenIdx = newConnections.findIndex(
        (s) => s.projectCode === svc.projectCode && s.serviceId === svc.serviceId,
      );
      const seen = seenIdx >= 0;
      // A service that RE-REGISTERED while we probed (fresh URL in the current store, not in our
      // stale snapshot) must beat a kept-offline entry — otherwise keeping dead rows would
      // clobber live re-registrations through the same door the old drop-them bug used.
      if (seen) {
        const sameAsProbed = connections.some(
          (s) =>
            s.projectCode === svc.projectCode &&
            s.serviceId === svc.serviceId &&
            s.system && svc.system &&
            s.system.connectionData.serviceUrl === svc.system.connectionData.serviceUrl,
        );
        if (!sameAsProbed) newConnections[seenIdx] = svc;
        return;
      }
      // RFC-027 — a HOSTED service re-registers with a FRESH port during boot, racing this probe
      // loop: the stale snapshot holds its old (dead) URL, so it isn't `seen`, and without the
      // hosted escape the merge reads the new registration as "the dead service we just dropped"
      // and clobbers it. Keep it only when it isn't the same stale entry we probed dead.
      const rehosted =
        svc.hosted &&
        !connections.some(
          (s) =>
            s.projectCode === svc.projectCode &&
            s.serviceId === svc.serviceId &&
            s.system && svc.system &&
            s.system.connectionData.serviceUrl === svc.system.connectionData.serviceUrl,
        );
      if (!seen && (svc.dynamic || rehosted || !connections.some(
        (s) => s.projectCode === svc.projectCode && s.serviceId === svc.serviceId,
      )))
        newConnections.push(svc);
    });
    if (newConnections.length)
      fs.writeFileSync(LOCAL_STORAGE, JSON.stringify(newConnections), "utf8");
    return newConnections;
  };

  this.save = (serviceData, index) => {
    const connections = readConnections();
    if (typeof index === "number") connections[index] = serviceData;
    else connections.push(serviceData);
    fs.writeFileSync(LOCAL_STORAGE, JSON.stringify(connections), "utf8");
  };

  this.findService = (url, code, id) => {
    const connections = readConnections();
    const index = connections.findIndex((service) => {
      if (id) return id === service.serviceId && code === service.projectCode;
      return (
        service.system.connectionData.serviceUrl === url &&
        (code ? service.projectCode === code : true)
      );
    });
    const service = connections[index];
    return { service, index };
  };

  this.findProject = (projectCode) => {
    const connections = readConnections();
    return connections.reduce(
      (sum, service) => (service.projectCode === projectCode ? sum.concat(service) : sum),
      []
    );
  };

  this.getAllConnections = () => {
    return readConnections();
  };

  this.deleteService = (projectCode, serviceId) => {
    const connections = readConnections();
    const filtered = connections.filter(
      (s) => !(s.projectCode === projectCode && s.serviceId === serviceId)
    );
    fs.writeFileSync(LOCAL_STORAGE, JSON.stringify(filtered), "utf8");
  };

  this.deleteProject = (projectCode) => {
    const connections = readConnections();
    const filtered = connections.filter((s) => s.projectCode !== projectCode);
    fs.writeFileSync(LOCAL_STORAGE, JSON.stringify(filtered), "utf8");
  };

  return this;
};
