const { HttpClient: http, App } = require("systemlynx");
const connectedServices = [];
const route = "systemview/api";
const port = 3300;
const host = "localhost";
const isUrl = (str) =>
  /^https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{2,256}\.[a-z]{2,4}\b([-a-zA-Z0-9@:%_\+.~#?&//=]*)$/.test(
    str
  );

function connect(data) {
  const { system, projectCode, serviceId } = data;

  const service = connectedServices.find(
    (service) =>
      service.system.connectionData.serviceUrl === system.connectionData.serviceUrl
  );
  console.log("connectedService found:---->", !!service);
  if (service) {
    console.log("connectionData---->", service.system.connectionData);

    service.system = system;
    service.projectCode = projectCode;
    service.serviceId = serviceId;
    this.emit(`service-updated:${serviceId}`, service);
  } else connectedServices.push({ system, projectCode, serviceId });
}

function getServices(searchText) {
  console.log("searchText---->", searchText, connectedServices);
  if (isUrl(searchText)) {
    const service = connectedServices.find(
      (service) => service.system.connectionData.serviceUrl === searchText
    );
    return [service || getConnectionData(searchText)];
  } else {
    return connectedServices.reduce(
      (sum, service) => (service.projectCode === searchText ? sum.concat(service) : sum),
      []
    );
  }
}

async function getConnectionData(url) {
  try {
    return await { system: { modules: http.request({ url }).modules } };
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
});

// {
//     services: [
//       {
//         name: 'PluginService',
//         url: 'http://localhost:8520/test-service',
//         onLoad: null,
//         client: {}
//       }
//     ],
//     modules: [
//       { name: 'testModule', __constructor: [Object] },
//       { name: 'plugin', __constructor: [Object] }
//     ],
//     configurations: {},
//     routing: null,
//     Service: {
//       startService: [Function (anonymous)],
//       Server: [Function: Server],
//       WebSocket: [Function: WebSocket],
//       module: [Function (anonymous)]
//     }
//   }
