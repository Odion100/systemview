# SystemView

An IDE for a codebase and the agents working in it.

Point it at a folder and you get the code, its history, and an agent that can read and change it —
in a window built for watching work happen rather than for browsing a repo. Connect a
[SystemLynx](https://github.com/Odion100/SystemLynx) service and that same window also carries the
service's modules and methods, its documentation, its live tests, its logs and its call statistics.

Services are additive. **A project is a project; a service connects to a project.** A folder is
enough.

---

## The shape

| layer | is |
|---|---|
| `src/` | the React window — the IDE itself |
| `api/` | the Express hub — serves files, git, images and reports, and hosts registered projects |
| `cli/` | the command surface, for a human at a terminal and for CI |

SystemView runs as its own server on port 3000 and draws its own window. Inside the **autobot**
desktop harness that happens for you: the shell health-checks the hub, spawns it if it isn't there,
and hosts the window — so you never type the command. Outside the harness it is an ordinary npm
package and the window is a browser tab.

```bash
npm install -g systemview   # Node >= 18
systemview                  # start on :3000, interactive
systemview shutdown
```

Everything else the CLI does — connecting services, running tests, streaming logs, probing methods,
driving an open window — is in **[docs/cli.md](docs/cli.md)**.

---

## What's in the window

| panel | holds |
|---|---|
| **Navigator** (left) | one card per project: its services, its files, its git state, its agent |
| **Center** | a tab strip of open documents — Documentation, Logs, Stage (reports), Code |
| **Right** | the test panel, or a document opened for editing |
| **Chat** | the agent attached to this project, floating or docked |

Top-level pages: **Code** (`/specs/:projectCode/:serviceId/:moduleName/:methodName`),
**Stats** (`/reports`), **Agents** (`/agents`).

**Documents are live.** Every markdown surface — documentation, reports, the chat, the TV, `.md`
file panes, help topics — renders through one renderer, so a chart, a runnable test, a file diff, a
question or a commit block works in all of them. Answers and verdicts are written back into the
markdown itself, so there is no second store to sync. The vocabulary is
**[docs/interactive-markdown.md](docs/interactive-markdown.md)**.

**Statistics** come from services running the plugin: bounded rollups of every call — counts, error
rates, latency percentiles, per-minute buckets — told back as reports on the Stats page, including a
live who-calls-whom topology and a module-coupling view.

---

## Adding things to it

**A folder.** `systemview init` registers one and the hub hosts a real testing service from it — one
file per module, every exported function a live, testable method. Registered this way a project has
files, git and an agent, and no service list at all.

**A SystemLynx service.** Install `systemview-plugin` in the service and pass it a `connection`, a
`projectCode` and a `serviceId`; it registers with the hub on startup. The plugin serves
**documentation and tests**. Files, git, diffs, staging and image bytes are the hub's job, by project
code — which is why the codebase surface works with every service down.

Details of both: **[agents/hosted-services.md](agents/hosted-services.md)** and
**[docs/cli.md](docs/cli.md)**.

---

## For agents

Inside the harness, agents don't shell out to the CLI. SystemView exposes an internal **MCP server**
and agents call its tools, with identity supplied by the session — there is no `--as` flag anywhere
(RFC-056):

`runTests` · `probe` · `projects` · `logs` · `stats` · `show` · `tv` · `reply` · `board` ·
`comments` · `nav` · `refresh` · `act` · `highlight` · `connect` · `disconnect`

`probe` calls one method on any **registered** service and hands back the real response.
`mcp__systemlynx__call` is the other door — the MCP tier, for whitelisted services that publish
their own routes and arrive with schemas.

Start at **[agents/AGENTS.md](agents/AGENTS.md)**, with the depth beside it:
[markdown.md](agents/markdown.md) · [chat.md](agents/chat.md) · [tests.md](agents/tests.md) ·
[namespaces.md](agents/namespaces.md) · [hosted-services.md](agents/hosted-services.md).

---

## Where things live

| | |
|---|---|
| plans | `RFCs/` — an approved plan is a file there before it is code |
| docs a project keeps | its own repo: `specs/docs/`, `<projectCode>.md` at the root |
| reports, boards, comments | `.systemview/` — git-ignored, never mixed into the project's docs |
| saved tests | the service's `specs/tests/<Module>.<method>.json`; actions in `specs/actions/` |

> Stories are retired. `systemview story` and `systemview stories` exit with an error pointing you at
> reports, which replaced them.
