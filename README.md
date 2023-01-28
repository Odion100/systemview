# Establishing a connection between SystemView and the Test Services

## SystemView Plugin

```javascript
const SystemView = require("systemView")({
  SystemViewConnection: "http://localhost:3300", //default
  SystemViewDocumentation: "./SystemView", //default
  projectCode: "ProjectName", //optional. Used to conveniently load multiple services as one project
  serviceId: "ServiceName", //required. If not included
});

App.use(SystemView);
```

Every time the app reload the plugin will load the SystemView Service using the `SystemViewConnection` value provided. It also adds a local module called `SystemView` to the test Service with the following methods and event:

- `SystemView.saveDoc`
- `SystemView.getDoc`
- `SystemView.emit("specs-updated")`

Once the test Service is ready the plugin will send the `system` data to the SystemView Service via the following method call.

```javascript
SystemView.connect({
  system,
  projectCode,
  serviceId,
});
```

The SystemView Service will Store the `system` data in memory. When the SystemView app makes a request for a connection (`SystemView.getConnection`), then the it will return the data from memory or from the service directly

> Normally it's not a good idea to hold data in memory or maintain state with in a service but since this is a local project it won't be an issue.

## Loading One or More Services

1. User enters a `projectCode` or a `serviceUrl` in the search input
2. The `SystemView.api.getConnection(projectCode || servicerUrl)` method will be called. This method will facilitate the process of retrieving the `connectionData` for the Service or Services being searched.

- if a url is passed it will first check for a `system` in memory with that url and return that, or make a request for the `connectionData` and return that
- if a `projectCode` is passed the service will check for a `system` in memory with the same `projectCode` and return that data to the app, or a 404 error
  > It's ok to use memory as this is a local project

## Saving Tests and Documentation

1. SystemView plugin creates a SystemView module in the test Service
   - `SystemView.saveDoc`
   - `SystemView.getDoc`
2. The plugin also adds the SystemView service and calls `SystemView.connect` when the app is read
3. The users enters a project code in the search input
4.

## Quick Testing Random Services (Without the plugin)

1. User enters a service url in the search input
