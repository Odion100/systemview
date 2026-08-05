# Namespaces — a guide for agents (decomposing any project)

This document is written **for AI agents** working in a codebase with SystemView installed — especially
a codebase that does **not** run SystemLynx. It teaches the one skill RFC-021 asks of you: **study an
arbitrary project and decompose it into the namespace model**, so SystemView's whole surface (tests,
docs, stories, shared actions) works on it. Siblings: [tests.md](tests.md),
[stories.md](stories.md).

---

## The model — three levels, one meaning each

SystemView organizes everything by a **namespace**: `service / module / method`. On a SystemLynx
project these are discovered from the live connection. On any other project **no namespaces exist until
you create them** — the map is a **saved configuration you author**, and empty is the normal starting
state, not an error.

The decomposition, learned from how well-organized SystemLynx systems (like buAPI) already break down:

| Level | What it is | Heuristics |
| --- | --- | --- |
| **service** | a domain / deployable boundary | one API, one app, one worker, one bounded context. A small project is usually ONE service. |
| **module** | a cohesive surface inside it | usually ≈ one file, one class/object, one router, one resource (`Users`, `Locations`, `Auth`). |
| **method** | one callable | one endpoint, one exported function, one command — the unit a test calls and a doc describes. |

## The procedure

1. **Find the interface first.** Before naming anything, locate how the project is *reached*: an HTTP
   API (routes), an exported JS object/module, a CLI. The interface's own shape usually IS the
   decomposition — API surfaces are effectively flat.
2. **Name what you found.** Group the callables into modules, modules into a service (or a few).
   Prefer the project's own vocabulary (its route names, file names, domain words) — you are indexing
   the project, not inventing a taxonomy.
3. **Write the manifest** (the saved configuration — next section).
4. **File specs on it.** Tests ([tests.md](tests.md)) whose steps wrap the
   interface (sign in, call the endpoint, assert), docs, stories, shared actions for the multi-step setup blocks that repeat across tests (see tests.md — an action must EARN extraction: multi-step + multi-test).
5. **Grow it as you go.** The map is incremental — add a module when you study a new area. It's
   versioned with the repo, so a PR reviews your decomposition like any other change.

## The saved configuration — `.systemview/<ServiceId>.manifest.json`

A synthesized (project-defined) service is the **same per-service manifest file a real plugin writes**,
plus `"dynamic": true` (which tells SystemView: nothing live to probe — register as-is):

```json
{
  "projectCode": "myProject",
  "serviceId": "Storefront",
  "dynamic": true,
  "system": {
    "connectionData": {
      "serviceUrl": "project://myProject/Storefront",
      "modules": [
        {
          "name": "Orders",
          "methods": [{ "fn": "create" }, { "fn": "cancel" }, { "fn": "get" }]
        },
        {
          "name": "Catalog",
          "methods": [{ "fn": "search" }, { "fn": "get" }]
        }
      ]
    }
  },
  "specList": { "tests": [], "docs": [] }
}
```

- `serviceUrl` is an identifier, not an address — the `project://` scheme makes that visible.
- The CLI reads `.systemview/` on startup and registers every manifest; `dynamic: true` entries skip
  the aliveness probe and survive server restarts verbatim.
- One file per service. Delete the file to retire the service.

## Where it shows up

- **The Codebase nav tab** — every connected codebase lists its **project-defined services**; yours
  appears there (purple dot = authored, not discovered). The SystemLynx tab shows only real live
  connections.
- Navigating to the service (`/specs/<projectCode>/<ServiceId>`) gives it the full namespace surface:
  docs, stories, and the scratchpad against its modules/methods.

## Wrapping the interface

A namespace is a locator; the **test step** says how to reach the app (RFC-021 "pluggable transport").
Today the step runner speaks SystemLynx RPC — for a non-SystemLynx target, wrap the interface the way
the RFC prescribes: reach the app however it is reachable (its HTTP API, its exported object) from the
steps themselves. As the transport layer opens up (CLI-as-a-service), steps on synthesized namespaces
run directly; the namespaces, tests, and docs you author now carry over unchanged — the map outlives
the transport.
