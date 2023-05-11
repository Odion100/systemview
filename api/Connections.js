const fs = require("fs");

module.exports = function ConnectedServices() {
  const LOCAL_STORAGE = "./api/connections.txt";
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
  // clear & ensure file existence
  fs.writeFileSync(LOCAL_STORAGE, "[]", "utf8");

  return this;
};
