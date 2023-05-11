const { HttpClient: http, App } = require("systemlynx");
const LocalStorage = require("./Connections")();
const route = "systemview/api";
const port = 3300;
const host = "localhost";
const isUrl = (str) =>
  /^(http:\/\/|https:\/\/)?((localhost|\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})|([a-z0-9]+([\-\.]{1}[a-z0-9]+)*\.[a-z]{2,5}))(:[0-9]{1,5})?(\/.*)?$/.test(
    str
  );

function connect({ system, projectCode, serviceId, specList }) {
  const { service, index } = LocalStorage.findService(
    system.connectionData.serviceUrl,
    projectCode
  );

  if (service) {
    service.system = system;
    service.projectCode = projectCode;
    service.serviceId = serviceId;
    service.specList = specList;
    LocalStorage.save(service, index);
  } else LocalStorage.save({ system, projectCode, serviceId, specList });
}

function updateSpecList(specList, projectCode, serviceId) {
  const { service, index } = LocalStorage.findService(undefined, projectCode, serviceId);
  if (service) {
    service.specList = specList;
    LocalStorage.save(service, index);
    this.emit(`spec-list-updated:${projectCode}`, {
      projectCode,
      serviceId,
      specList,
    });
  }
}
function getServices(searchText) {
  if (isUrl(searchText)) {
    const { service } = LocalStorage.findService(searchText);
    if (service) {
      const project = { ...service, projectCode: "SystemLynx", serviceId: "Service" };
      connect(project);
      return [project];
    } else {
      return getConnectionData(searchText);
    }
  } else {
    return LocalStorage.findProject(searchText);
  }
}

async function getConnectionData(url) {
  try {
    const connectionData = await http.request({ url });
    const project = {
      system: { connectionData },
      serviceId: "Service",
      projectCode: "SystemLynx",
      specList: { tests: [], docs: [] },
    };

    connect(project);
    return [project];
  } catch (error) {
    return [];
  }
}

App.startService({
  route,
  port,
  host,
}).module("SystemView", {
  connect,
  getServices,
  updateSpecList,
});
