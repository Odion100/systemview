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
      if (i === connections.length) return resolve(newConnections);

      const { serviceUrl } = connections[i].system.connectionData;
      try {
        const { Plugin } = await Client.loadService(serviceUrl);
        if (Plugin) {
          newConnections.push(await Plugin.getConnection());
        }
        recursiveCheckConnection(i + 1);
      } catch (error) {
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
