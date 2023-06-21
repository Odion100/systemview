const fs = require("fs");
const appIsRunning = require("../cli/appIsRunning");
const LOCAL_STORAGE = "./connections.txt";

module.exports = function ConnectedServices() {
  this.clearStorage = async () => {
    const connections = JSON.parse(fs.readFileSync(LOCAL_STORAGE, "utf8"));
    const appUrls = connections.map(({ system }) => system.connectionData.serviceUrl);
    const runningApps = await Promise.all(appUrls.map(appIsRunning));
    const filteredConnections = connections.filter((c, i) => runningApps[i]);
    fs.writeFileSync(LOCAL_STORAGE, JSON.stringify(filteredConnections), "utf8");
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
