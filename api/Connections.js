const fs = require("fs");
const { Client } = require("systemlynx");
const LOCAL_STORAGE = `${__dirname}/connections.json`;

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
    const connections = JSON.parse(fs.readFileSync(LOCAL_STORAGE, "utf8"));
    const newConnections = await refreshConnections(connections);
    if (newConnections.length)
      fs.writeFileSync(LOCAL_STORAGE, JSON.stringify(newConnections), "utf8");
    return newConnections;
  };

  this.save = (serviceData, index) => {
    const connections = JSON.parse(fs.readFileSync(LOCAL_STORAGE, "utf8"));
    if (typeof index === "number") connections[index] = serviceData;
    else connections.push(serviceData);
    fs.writeFileSync(LOCAL_STORAGE, JSON.stringify(connections), "utf8");
  };

  this.findService = (url, code, id) => {
    const connections = JSON.parse(fs.readFileSync(LOCAL_STORAGE, "utf8"));
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
    const connections = JSON.parse(fs.readFileSync(LOCAL_STORAGE, "utf8"));
    return connections.reduce(
      (sum, service) => (service.projectCode === projectCode ? sum.concat(service) : sum),
      []
    );
  };
  return this;
};
