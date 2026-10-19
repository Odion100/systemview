const fs = require("fs");
const { createClient } = require("systemlynx");
const { createCookieHttpClient } = require("../cli/cookieClient");
// Same manifest-header client as api/index.js and the CLI — so re-probing stored connections
// (refreshConnections) also carries operator-authored headers. A gated service would otherwise
// silently drop out of the UI on every refresh.
const Client = createClient(createCookieHttpClient());
// THE REGISTRY'S FILE, AND A PIN FOR IT. Fixed at `api/connections.json` until now, which made the
// store the one piece of hub state no test could exercise without writing HIS live registry — and a
// suite that crashes mid-fixture would have left it holding the fixture. Same shape as the other
// stores' pins (AUTOBOT_LEDGER_DIR, AUTOBOT_WORKLISTS_DIR): absent in production, set by tests.
const LOCAL_STORAGE = process.env.SYSTEMVIEW_CONNECTIONS_FILE || `${__dirname}/connections.json`;

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

  // A URL NOBODY CAN CALL IS NOT A REGISTRATION. Measured on his machine 2026-10-19:
  // `https://ballersunited.global:undefined/bu/api/mocks` had been sitting in the registry, handed
  // out by `getProjects` to every caller — an agent reading it cannot tell a deployment it has no
  // code for from a URL that was never callable, and the registry is the one place that can tell
  // the difference. So the store refuses it at the door, by name, rather than keeping junk that
  // every reader has to re-diagnose.
  const urlFault = (url) => {
    const s = String(url || "");
    if (!s) return "no serviceUrl";
    if (/:undefined|:NaN|:null/.test(s)) return "its port is literally undefined — the registering service sent no port";
    try {
      const u = new URL(s);
      if (!u.hostname) return "no host";
    } catch {
      return "it does not parse as a URL";
    }
    return "";
  };

  // SAVING IS IDEMPOTENT, because `connect` is a read-modify-write on one file and services boot in
  // parallel. Two registrations arriving together both read a store without their entry and both
  // appended — his `bu1` held two copies of Profiles and two of Networking, identical in every
  // field, and a refresh then re-pushed one copy per stored entry, so the duplicates sustained
  // themselves forever. Dropping any entry that addresses the same thing before appending makes a
  // double write converge instead of accumulating, which is what the find-then-save pattern can
  // never guarantee on its own.
  const addresses = (a, b) => {
    const url = (r) => ((r.system && r.system.connectionData && r.system.connectionData.serviceUrl) || "");
    if (a.projectCode !== b.projectCode) return false;
    return url(a) === url(b) || (!!a.serviceId && a.serviceId === b.serviceId);
  };

  this.save = (serviceData, index) => {
    const fault = urlFault(
      serviceData && serviceData.system && serviceData.system.connectionData
        ? serviceData.system.connectionData.serviceUrl
        : "",
    );
    // a DYNAMIC (project-defined) service legitimately has no live URL — RFC-021 — so it is the one
    // shape allowed through without one
    if (fault && !(serviceData && serviceData.dynamic))
      throw new Error(
        `refusing to register ${(serviceData && serviceData.projectCode) || "?"}.${(serviceData && serviceData.serviceId) || "?"}: ${fault}`,
      );
    const connections = readConnections();
    if (typeof index === "number") connections[index] = serviceData;
    else {
      const deduped = connections.filter((r) => !addresses(r, serviceData));
      deduped.push(serviceData);
      fs.writeFileSync(LOCAL_STORAGE, JSON.stringify(deduped), "utf8");
      return;
    }
    fs.writeFileSync(LOCAL_STORAGE, JSON.stringify(connections), "utf8");
  };

  // WHAT THE STORE IS HOLDING THAT IT SHOULD NOT — the duplicates and dead URLs that predate the
  // rules above. Returns what it removed so a caller can say so out loud instead of tidying quietly.
  this.sweep = () => {
    const connections = readConnections();
    const kept = [];
    const dropped = [];
    for (const r of connections) {
      const url = (r.system && r.system.connectionData && r.system.connectionData.serviceUrl) || "";
      const fault = r.dynamic ? "" : urlFault(url);
      if (fault) { dropped.push({ projectCode: r.projectCode, serviceId: r.serviceId, url, why: fault }); continue; }
      if (kept.some((k) => addresses(k, r))) {
        dropped.push({ projectCode: r.projectCode, serviceId: r.serviceId, url, why: "duplicate of an entry already kept" });
        continue;
      }
      kept.push(r);
    }
    if (dropped.length) fs.writeFileSync(LOCAL_STORAGE, JSON.stringify(kept), "utf8");
    return { dropped, kept: kept.length };
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
