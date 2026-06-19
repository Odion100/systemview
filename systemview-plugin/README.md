# systemview-plugin

Connects a [SystemLynx](https://github.com/Odion100/SystemLynx) service to [SystemView](https://github.com/Odion100/systemview) — the documentation and testing suite for SystemLynx.

---

## Installation

```bash
npm install systemview-plugin
```

---

## Setup

```js
const { App } = require("systemlynx");

App.startService({ route, port })
  .module("Users", Users)
  .module("Orders", Orders);

if (process.env.SYSTEMVIEW_HOST) {
  const SystemViewPlugin = require("systemview-plugin")({
    connection: process.env.SYSTEMVIEW_HOST,  // SystemView API URL
    specs: "./specs",                          // local path for docs and test files
    projectCode: "myProject",                 // groups services together in SystemView
    serviceId: "MyService",                   // name for this service
  });
  App.use(SystemViewPlugin);
}
```

Set `SYSTEMVIEW_HOST` to your SystemView instance, e.g.:

```bash
SYSTEMVIEW_HOST=http://localhost:3000/systemview/api node index.js
```

---

## What it does on startup

1. **Registers with SystemView** — sends connection data to the SystemView server so the service appears in the UI under `projectCode > serviceId`
2. **Writes `systemview.manifest.json`** — saves connection data and spec file locations to the project root so the SystemView CLI can run tests without the SystemView server running

If multiple services in the same project use the plugin, each one merges its own entry into the manifest rather than overwriting it.

---

## `systemview.manifest.json`

Written automatically to the root of your service project on each startup:

```json
{
  "projectCode": "myProject",
  "services": [
    {
      "serviceId": "MyService",
      "system": {
        "connectionData": {
          "serviceUrl": "http://localhost:4100/my/api",
          "modules": [ ... ],
          "routing": { ... }
        }
      },
      "specList": {
        "docs": ["Users.md"],
        "tests": ["Users.signUp.json"]
      }
    }
  ]
}
```

Add it to `.gitignore` — it's a local artifact that regenerates on each startup.

With the manifest in place, the CLI can run tests directly against your live service without needing the SystemView server:

```bash
systemview test myProject
```

---

## Specs folder

The plugin reads and writes documentation and test files from the `specs` path you configure:

```
specs/
  docs/         # markdown files, one per method
  tests/        # JSON test files, one per method
```

These files are committed to your repo. The SystemView UI saves to them via the plugin's `saveDoc` and `saveTest` methods.
