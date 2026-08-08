# SystemViewCore — SystemView testing itself

RFC-021 used to *depict* this service as a `project://` ghost — namespaces with nothing behind
them. RFC-027 made it real: the hub hosts it from the committed `systemview-test/` folder, the
same agnostic-service machinery any codebase gets from `systemview init`.

- **The configuration**: ::file[systemview-test/service.json]
- **`Cli` really runs the systemview CLI** — each method spawns the real command:
  :file[systemview-test/methods/Cli.js]
- **`Api` really calls the hub's own service API** — the same door the UI and CLI use:
  :file[systemview-test/methods/Api.js]

Prove it — the saved test, runnable here:

::test[Api.getProjects]

Or on the fly. This is the markdown that writes a runnable — a step is a method call, the nested
list under it is the assertions:

```markdown
:::run{title="SystemView answers about itself"}
- Api.getProjects()
  - results.ok = true
:::
```

…and that same block, live:

:::run{title="SystemView answers about itself"}
- Api.getProjects()
  - results.ok = true
:::
