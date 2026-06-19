# SystemView

A documentation and testing suite for [SystemLynx](https://github.com/Odion100/SystemLynx) services. SystemView gives you a browser-based UI to browse your service's modules and methods, read and write markdown documentation, build and run tests interactively, and execute saved test suites from the CLI.

---

## Installation

```bash
npm install -g systemview
```

> Requires Node >= 18

---

## Starting SystemView

```bash
systemview
# or
systemview start        # default port 3000
systemview start 4000   # custom port
```

Once running:
- **UI** → `http://localhost:3000`
- **API** → `http://localhost:3000/systemview/api`

To open the browser directly (optionally navigating to a specific service):

```bash
systemview open                                  # open to home
systemview open myProject                        # open to project
systemview open myProject Basketball/Games/add   # open to a specific method
```

To stop a running instance:

```bash
systemview shutdown        # default port
systemview shutdown 4000   # custom port
```

---

## Connecting a SystemLynx Service

Install the plugin in your service:

```bash
npm install systemview-plugin
```

Then add it to your SystemLynx app. The plugin connects your service to the SystemView instance on startup and enables saving/loading docs and tests locally.

```js
const { createApp } = require("systemlynx");
const App = createApp(server);

App.startService({ route, port, host })
  .module("Users", Users)
  .module("Orders", Orders);

if (process.env.SYSTEMVIEW_HOST) {
  const SystemView = require("systemview-plugin")({
    connection: process.env.SYSTEMVIEW_HOST,  // e.g. "http://localhost:3000"
    specs: "./MyService/specs",               // local path for saving docs and tests
    projectCode: "myProject",                 // groups services together in the UI
    serviceId: "MyService",                   // name for this service
    module: plugin,                           // optional: expose extra methods to SystemView
  });
  App.use(SystemView);
}
```

Once connected, the service appears automatically in the SystemView UI under `myProject > MyService`.

---

## Using the UI

The UI has three panels:

| Panel | Description |
|---|---|
| **Navigator** (left) | Browse connected projects, services, modules, and methods |
| **Documentation** (center) | Read and write markdown docs for the selected method |
| **Test Panel** (right) | Build, run, and save tests for the selected method |

### URL routing

The UI URL reflects your current location:

```
http://localhost:3000/:projectCode/:serviceId/:moduleName/:methodName
```

### Building a test

The Test Panel (also called Scratch Pad) lets you build a full test sequence:

- **Before** — setup calls that run before the main test
- **Main** — the method call being tested, with argument inputs and response validations
- **Events** — WebSocket events to listen for during the test
- **After** — teardown calls that run after the main test

Click **Run** to execute the full sequence. Click **Save** to persist the test to the service's `specs/` folder via the plugin.

---

## Running Tests from the CLI

Run all saved tests for a project:

```bash
systemview test myProject
```

Run tests filtered to a specific namespace:

```bash
systemview test myProject Games
systemview test myProject Games.add
```

SystemView connects to the running instance, fetches saved tests from each service, runs the full test sequence for each, and prints a summary:

```
✔  Basketball   tests: 12, passed: 12, failed: 0
✖  Profiles     tests: 4, passed: 3, failed: 1
```

---

## CLI reference

| Command | Description |
|---|---|
| `systemview` | Start SystemView on port 3000 |
| `systemview start [port]` | Start on a custom port |
| `systemview open [projectCode] [namespace]` | Open the UI in a browser |
| `systemview test <projectCode> [namespace]` | Run saved tests from CLI |
| `systemview shutdown [port]` | Stop a running instance |
| `systemview help` | Print help |
