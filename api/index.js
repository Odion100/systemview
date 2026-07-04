const { HttpClient: http, createClient, App } = require("systemlynx");
const ConnectedServices = require("./Connections")();
const Client = createClient();
const route = "systemview/api";
const host = "localhost";
const express = require("express");
const path = require("path");

const isUrl = (str) =>
  /^(http:\/\/|https:\/\/)?((localhost|\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})|([a-z0-9]+([\-\.]{1}[a-z0-9]+)*\.[a-z]{2,5}))(:[0-9]{1,5})?(\/.*)?$/.test(
    str,
  );

function connect({ system, projectCode, serviceId, specList }) {
  const { service, index } = ConnectedServices.findService(
    system.connectionData.serviceUrl,
    projectCode,
  );

  if (service) {
    service.system = system;
    service.projectCode = projectCode;
    service.serviceId = serviceId;
    service.specList = specList;
    ConnectedServices.save(service, index);
  } else ConnectedServices.save({ system, projectCode, serviceId, specList });
}

function updateSpecList(specList, projectCode, serviceId) {
  const { service, index } = ConnectedServices.findService(
    undefined,
    projectCode,
    serviceId,
  );
  if (service) {
    service.specList = specList;
    ConnectedServices.save(service, index);
    this.emit(`spec-list-updated:${projectCode}`, {
      projectCode,
      serviceId,
      specList,
    });
  }
}
function getServices(searchText) {
  if (isUrl(searchText)) {
    const { service } = ConnectedServices.findService(searchText);

    if (service) {
      const project = { ...service, projectCode: "SystemLynx", serviceId: "Service" };
      connect(project);
      return [project];
    } else {
      return getConnectionData(searchText);
    }
  } else {
    return ConnectedServices.findProject(searchText);
  }
}

async function getConnectionData(url) {
  try {
    const connectionData = await http.request({ url });
    if (!connectionData || !connectionData.SystemLynxService) return [];
    const svc = Client.createService(connectionData);
    let project;
    try {
      const connection = await svc.Plugin.getConnection();
      project = {
        system: connection.system,
        projectCode: connection.projectCode,
        serviceId: connection.serviceId,
        specList: connection.specList,
      };
    } catch {
      const routeSegs = (connectionData.route || "").split("/").filter(Boolean);
      const serviceId = [...routeSegs].reverse().find((s) => s.toLowerCase() !== "api") || "Service";
      project = {
        system: { connectionData },
        serviceId,
        projectCode: "connected-services",
        specList: { tests: [], docs: [] },
      };
    }
    connect(project);
    return [project];
  } catch (error) {
    return [];
  }
}
async function refreshConnection(searchText) {
  await ConnectedServices.refreshConnections();
  return getServices(searchText);
}

function getProjects() {
  const connections = ConnectedServices.getAllConnections();
  const projects = {};
  connections.forEach(({ projectCode, serviceId, system, specList }) => {
    if (!projects[projectCode]) projects[projectCode] = [];
    projects[projectCode].push({
      serviceId,
      serviceUrl: system.connectionData.serviceUrl,
      connectionData: system.connectionData,
      system,
      specList: specList || { tests: [], docs: [] },
    });
  });
  return projects;
}

function deleteService(projectCode, serviceId) {
  ConnectedServices.deleteService(projectCode, serviceId);
}

function deleteProject(projectCode) {
  ConnectedServices.deleteProject(projectCode);
}

const shutdown = () => process.exit(0);

module.exports = function launchSystemView(port = 3000) {
  const { server } = App;
  const buildPath = path.resolve(__dirname, "../build");
  const indexPath = path.join(buildPath, "index.html");

  server.use(express.static(buildPath));

  App.startService({
    route,
    port,
    host,
    staticRouting: true,
  })
    .module("SystemView", {
      connect,
      getServices,
      getProjects,
      updateSpecList,
      shutdown,
      refreshConnection,
      deleteService,
      deleteProject,
    })
    .on("ready", () => {
      server.get("*", (req, res) => {
        res.sendFile(indexPath);
      });

      ConnectedServices.refreshConnections();
    });

  return new Promise((resolve) => App.on("ready", resolve));
};
