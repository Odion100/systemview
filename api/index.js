const { HttpClient: http, App } = require("systemlynx");
const LocalData = require("./Connections")();
const route = "systemview/api";
const port = 3300;
const host = "localhost";
const isUrl = (str) =>
  /^https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{2,256}\.[a-z]{2,4}\b([-a-zA-Z0-9@:%_\+.~#?&//=]*)$/.test(
    str
  );

function connect(data) {
  const { system, projectCode, serviceId } = data;

  const service = LocalData.findService(system.connectionData.serviceUrl);

  if (service) {
    service.system = system;
    service.projectCode = projectCode;
    service.serviceId = serviceId;
    this.emit(`service-updated:${serviceId}`, service);
  } else LocalData.save({ system, projectCode, serviceId });
}

function getServices(searchText) {
  if (isUrl(searchText)) {
    const service = LocalData.findService(searchText);
    return [service || getConnectionData(searchText)];
  } else {
    return LocalData.findProject(searchText);
  }
}

async function getConnectionData(url) {
  try {
    const connectionData = await http.request({ url });
    return {
      system: { connectionData },
      serviceId: url,
      projectCode: url,
    };
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
