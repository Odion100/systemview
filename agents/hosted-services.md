# Hosted services — testing a codebase with NO framework

This document is written **for AI agents** working in a repo that does **not** run SystemLynx —
which is exactly where you need SystemView the most. Since RFC-027 the CLI can HOST a real testing
service for any codebase, built from one committed folder. You write plain functions; SystemView
gives you probe, saved tests, documentation, logs, reports and the whole UI on top of them.
Siblings: [AGENTS.md](AGENTS.md) (the map), [tests.md](tests.md), [markdown.md](markdown.md),
[namespaces.md](namespaces.md).

---

## 1 · One command

```bash
systemview init                 # interview; ENTER accepts every default
systemview init < /dev/null     # ← the AGENT path: non-interactive, all defaults
```

Defaults: project name **`systemview`** (this becomes both the project code AND the folder name),
service name **`Test`**, port **0** (the hub picks a free one at each boot). `init` also works at
the `>` prompt of a running `systemview` session.

Re-running init is safe: existing files are **never overwritten** — on a cloned repo it just
re-registers the folder with the hub.

## 2 · What exists afterwards

```
<projectCode>/                  ← COMMITTED — this folder IS the service, it travels with the repo
  service.json                  ← { "serviceId": "Test", "port": 0 }
  methods/
    Tests.js                    ← ONE FILE PER MODULE — the filename IS the module name
  specs/
    tests/Tests.example.json    ← a saved test that passes immediately
    docs/Test.md                ← service doc (interactive vocabulary, teaches :::run)
    docs/Tests.example.md       ← method doc
```

Plus a registration entry in `.systemview/<serviceId>.manifest.json` — that's how the hub finds
the folder (registration, never name-scanning). The hub hosts every registered folder as part of
its own boot; the first `systemview test <projectCode>` is **green out of the box**.

## 3 · Writing methods — the whole job

A module is a file. A method is an exported function. That is the entire API surface:

```js
// <projectCode>/methods/Api.js — this file IS the `Api` module
async function health() {
  const res = await fetch("http://localhost:8080/health");
  return { ok: res.ok, status: res.status };
}

async function signUp({ email, password }) {
  const res = await fetch("http://localhost:8080/users", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  return res.json();
}

module.exports = { health, signUp };
```

```js
// <projectCode>/methods/Build.js — another module: call the system however it really talks
const { execFile } = require("child_process");
module.exports = {
  lint: () =>
    new Promise((resolve) =>
      execFile("npx", ["eslint", ".", "--format", "json"], { timeout: 60000 },
        (err, stdout) => resolve({ ok: !err, report: JSON.parse(stdout || "[]") })),
    ),
};
```

- **Return a result object** — the engine evaluates it like any service response
  (`results.ok = true` in a test/`:::run` step). Prefer booleans/numbers/strings you can assert on.
- **Save the file and it's live** — the hub watches `methods/` and re-hosts on the same port; a
  new function or a whole new file appears in the nav without any restart.
- **Add a module = add a file. Delete a module = delete its file.** The folder is the state.
- `require` resolves from the target repo, so its own node_modules are available.

The namespace is `<projectCode> → <serviceId> → <ModuleFile> → <function>` — everything in
[tests.md](tests.md) and the interactive vocabulary applies unchanged:

```bash
systemview probe Test.Api.health
systemview test <projectCode>
```

## 4 · Documentation and specs

`specs/docs/` and `specs/tests/` follow the standard shapes ([tests.md](tests.md)):
`<Module>.md` / `<Module>.<method>.md` for docs, `<Module>.<method>.json` for saved tests — and a
saved test's `namespace.serviceId` must match the configured serviceId. The scaffolded
`Tests.example` pair is the working template: copy its shape. Docs render live blocks
(`::test[...]`, `:::run`, `:file[...]` — full vocabulary in [markdown.md](markdown.md)).

## 5 · The UI

The hosted service renders like any service, wearing the **plum dot** (= the CLI runs this). The
open service row shows where everything lives (`⚙ <folder>/service.json · methods/ · specs/` —
click opens the config). **Right-click** a row for the configuration hand:

- service row → *Rename service… · Add module… · Delete project (removes the folder)*
- module row → *Rename module… · Delete module* (spec files stay — move them yourself on a rename)
- destructive items confirm in-place, two clicks.

## 6 · Deleting

| Intent | How | What happens |
| --- | --- | --- |
| Delete the project | `systemview delete <projectCode>` (y/N; `--force` skips) — or right-click → Delete project | unhosted + deregistered + **the folder is removed** |
| Same, by hand | delete the folder | the hub notices and cleans up the registration and nav entry itself |
| Keep the folder, drop the hosting | `systemview disconnect <projectCode>` | connection + registration removed; `init` brings it back |

`delete` refuses anything that wasn't made this way — plain connections are `disconnect`'s job.

## 7 · Traps

- **Module file must export an object** (`module.exports = { fn, … }`). A broken file un-hosts the
  service until you fix it and save — check the hub's console output if the service vanished.
- **Names are identifiers**: service and module names must match `[A-Za-z_$][A-Za-z0-9_$]*`.
- **Don't scaffold by hand** — run `init`; it writes the registration the hub actually reads.
- **Port 0 means the URL changes across boots.** Never hardcode a hosted service's URL; address it
  by namespace through the CLI/UI.
- Renaming a module renames its file only — existing `specs/` files keep their old names until you
  move them.
