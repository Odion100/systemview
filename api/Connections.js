const fs = require("fs");

module.exports = function ConnectedServices() {
  const LOCAL_STORAGE = "./api/connectedServices.json";
  this.save = (serviceData) => {
    const connectedServices = JSON.parse(fs.readFileSync(LOCAL_STORAGE, "utf8"));
    connectedServices.push(serviceData);
    fs.writeFileSync(LOCAL_STORAGE, JSON.stringify(connectedServices), "utf8");
  };

  this.findService = (url) => {
    const connectedServices = JSON.parse(fs.readFileSync(LOCAL_STORAGE, "utf8"));
    return connectedServices.find(
      (service) => service.system.connectionData.serviceUrl === url
    );
  };

  this.findProject = (projectCode) => {
    const connectedServices = JSON.parse(fs.readFileSync(LOCAL_STORAGE, "utf8"));
    return connectedServices.reduce(
      (sum, service) => (service.projectCode === projectCode ? sum.concat(service) : sum),
      []
    );
  };
  // clear & ensure file existence
  const res = fs.writeFileSync(LOCAL_STORAGE, "[]", "utf8");
  console.log(res);
  return this;
};
