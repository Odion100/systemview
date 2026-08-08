# RFC-021: SystemLynx-agnostic SystemView — test (and view) any system

**Status:** Vision / direction. The concrete first slice lands via RFC-020's CLI-as-a-service; this RFC
records the destination so the engine and CLI work don't bake in assumptions that block it.
**Depends on / extends:** RFC-020 "Named Actions" (CLI-as-a-service, dynamic namespaces).




## The reframe — a namespace is just a locator; the service can be synthesized

In any test suite you organize tests by an organizational unit. In Jest that unit is basically the **file**.
SystemView's unit is a **namespace** — `service / module / method` — and today it's special because it
**points at a real running service** (the namespaces are read out of SystemLynx's `connectionData`).

Going agnostic does **not** drop the service. A namespace still hangs under a **service**. What changes is
where the service comes from: instead of being **discovered from a live SystemLynx connection**, the
service is **created arbitrarily from the project structure**. You just create namespaces the way you would
in any other test framework — and file tests, docs, stories, and named actions on them.

Three modes, one model:

- **SystemLynx app** — services/namespaces discovered from the live connection (today).
- **Non-SystemLynx app** — the service is synthesized from the project structure; namespaces are whatever
  you (or an agent) create. `Profiles / Auth / signIn` is purely an organizing path; `signIn` is a test that
  reaches the app however the app is reachable.
- **SystemLynx, augmented** — a real connection, plus synthesized namespaces layered on top for things the
  live service doesn't advertise.

The names come from **whatever gets created** — no theory needed about their origin. Later we add features
that facilitate creating/managing them; the mechanism is just: the CLI-service (RFC-020) registers a
`connectionData`-shaped description for the namespaces you invent, and SystemView renders the exact same
tree it renders for a real service. It can't tell the difference.

## The namespace map is a SAVED CONFIGURATION — and it starts empty

A synthesized namespace isn't discovered and isn't hardcoded — so it must be **persisted**. It lives as
the **same per-service manifest shape in `.systemview/`** that real plugins write (RFC-017): a synthesized
service is just a manifest file an **agent wrote instead of a plugin**. That buys everything for free:

- The loader **already reads that folder** — no new registration path.
- The map is **versioned with the repo**, hand-editable, reviewable in a PR.
- The UI/CLI genuinely can't tell a synthesized service from a real one — the thesis above, made literal.

**Cold start is the normal case.** Day one on a non-SystemLynx project: connected codebase, **zero
services**. No namespace exists until you (or an agent) study the project and write the first manifest.
The map grows incrementally — a service here, a module there — as understanding of the project grows.
Empty is not an error state; it's the starting state, and the UI treats it as the bootstrap affordance
(see RFC-022's codebase surface).

## Wrapping the interface — the step says how it reaches out

SystemLynx is about **web + functions**: a namespace maps to a callable. Agnostic SystemView expects a
**stateless approach** and lets a test **wrap whatever the interface is**:

- **An HTTP API** — the step wraps the endpoint (sign in, then call the thing under test).
- **A JavaScript object / module** — the way SystemLynx itself works. When the interface is a JS object you
  **pass the object in directly** and call its methods — especially easy when the object is **flat**, which
  most API surfaces effectively are.
- **(later) The client** — a SystemView client plugin listening on WebSockets, so tests can be driven from
  and against the front end.

Implication for the engine (flagged for RFC-020's build, not a blocker): a test **step**'s transport must be
**pluggable** — SystemLynx RPC today, raw HTTP and direct-object-call next, client-side later. Don't wire
`systemlynx-client` so deep into the step runner that the HTTP / object transports become a rewrite.

## Agents — find the interface, then file the tests

If you want an agent to stand up tests with SystemView, the **agent documentation** guides it. For an
agnostic project the docs tell the agent: **the structure is whatever you create — so first find the
interface.** Whether that means pulling in a module or connecting through an API, the agent's job is to
**locate the interface**, then:

1. **Create the service + namespaces** from the project structure (`service / module / method`).
2. **Write named tests** on those namespaces that wrap the interface (sign in, do X, assert Y).
3. Use the RFC-020 primitives — **named actions** and the **runner component** — so setup ("sign in, seed
   data") is reusable and its results live in the story.

### `docs/agents/namespaces.md` — the decomposition methodology (required deliverable)

"The structure is whatever you create" is not enough instruction. This RFC ships a **third agent doc**
(sibling of `agents/stories.md` and `agents/tests.md`) that teaches the **breakdown itself** —
how to study an arbitrary project and decompose it into the namespace model, the way well-organized
SystemLynx systems (buAPI) already decompose:

- a **service** is a domain / deployable boundary,
- a **module** is a cohesive surface — usually ≈ one file or one object,
- a **method** is one callable.

Find the interface first, name what you found, **write the `.systemview/` manifest** for it, then file
tests/docs/stories on the namespaces — and wrap whatever transport the interface speaks.

This is the difference between SystemView and a plain test runner: once the agent has done this, it's **more
than testing — it's viewing your system.** You start with tests; every other SystemView feature we build to
work agnostically stacks on top of the same synthesized namespaces.

## Where it shows in the UI — the codebase surface, not the Services nav

A synthesized service does **not** appear as a peer of real live connections in the Services nav — that
would muddy what's actually running. It homes under its **codebase** in RFC-022's Files lens: every
connected CLI/codebase carries its **file system** plus its **project-defined services** (empty at
first, growing as the map is built). The Services nav stays purely real connections.

Nuance for the **augmented** mode (real SystemLynx + synthesized extras): the extra namespaces still
*render* layered into the real service's tree — but they're *stored and owned* like codebase namespaces
(`.systemview/` manifests), so provenance stays clear.

## What you get on day one (agnostic)

Even at the first slice — **tests + stories** — you get most of the SystemLynx-suite feel:

- Save tests on namespaces you created, run them, see pass/fail.
- **Stories** with the **run-and-store-results** power (RFC-020): "sign in, test this, run that action, keep
  the results" — assembled and re-runnable in the window.
- The whole thing works whether or not the project runs SystemLynx.

More agnostic features follow; the point of this RFC is to make sure the **namespace-is-a-locator** and
**pluggable-transport** assumptions are honored now so we don't have to unwind them later.

## Non-goals (for the first slice)

- Rebuilding the namespace/rendering model — it already treats namespace as a path; we synthesize the
  `connectionData` instead of reading it live.
- Full client-plugin / WebSocket-driven client testing — later; noted here so the transport stays pluggable.
- Auto-discovering an arbitrary app's interface — the agent (or you) finds and wraps it; SystemView provides
  the surface to file and run it.

---

## Revision 2026-08-03 — identity, the codebase card, and the SEPARATE testing project

Settled in review. Where this conflicts with anything above (notably dynamic services homing under
existing projects' codebases), **this section wins**.

### 1. The testing project is its OWN project — never attached to yours

- Created **explicitly**, never ambient: a CLI command (verb TBD — e.g. `systemview create-testing-service <name>`)
  or from the UI. **You name it at creation**, and that name becomes its **own project code automatically**.
- It shows up as a **project like any other** — its own card, its own codebase — with an **extra indicator**
  (badge/coloring) that separates it as a *testing* project. It is NOT labeled "SystemView CLI"; it wears
  the name you gave it.
- It is backed by the CLI (CLI-as-a-service, RFC-020 Phase 4): the CLI owns the cwd, serves file access,
  and hosts the **synthesized namespaces** (`.systemview/*.manifest.json`).
- **Project-defined/dynamic services no longer hang under existing SystemLynx projects.** The services
  section of a codebase card KEEPS its look, placement, and title treatment — its members become the
  project's REAL services; synthesized namespaces belong to a testing project only, presented with that
  same mini-tree style in the testing project's own card. (The SystemViewCore dogfood migrates there.)
- Zero-SystemLynx flow: create the testing project → agent studies the codebase → files namespaces,
  tests, stories. With SystemLynx: it's an optional EXTRA standalone project alongside the real ones.
- **UI-buildable (2026-08-06):** the defining UX difference from a real service — you can BUILD the
  testing service from the UI. Its nav display carries **add buttons: add module, add method** (the
  way real services never do — their shape comes from code). You grow the namespace tree in place;
  it's also part of why it must read *a bit different in the UI* than a deployed service (own
  badge/tint, domain/action vocabulary — see the story thread).
- **Docs + SOURCE are first-class on synthesized actions (2026-08-06).** The asymmetry: a SystemLynx
  step is self-describing (the namespace IS the real function), but an agnostic action is a WRAPPER —
  one step may fan into many real actions, or the wrapper itself does the whole test internally and
  just returns a verdict-shaped response. The step is opaque from the stage, so transparency moves to
  two channels: the action's **documentation** (what it means, what it touches) and its **source** —
  the wrapper's actual file, shown when you click the method in the testing service's nav. `source`
  RETURNS here, and works where it was weak before: the wrapper is written code at a known location,
  and the namespace map (a saved configuration) records the exact **file + span at creation time** —
  no `**/Module.js` convention-guessing, no dynamic-attachment blindness.

### 2. The codebase card = the project's SERVICES + its codebase(s)

- **Top: ALL the project's real connected services**, in the mini navigable tree style (service → module
  → method, doc/test indicators) — the presentation style stays; the membership changes to the project's
  actual services. Same section-title treatment, but "services".
- **Below: the codebase** (file tree), its own expandable header. Everything in the card is expandable,
  including the codebase.
- A project whose services span **multiple locations** repeats the pattern **within the same card**:
  services-at-location → that location's codebase → next group. **One codebase per LOCATION, never per
  service.**
- Separate projects sharing a cwd (systemview-test / systemview-logtest) **stay separate cards** —
  decided 2026-08-03: stories and selection context distinguish them; merging would lose that.

### 3. Registration carries the LOCATION (plugin update)

- The plugin stamps its `process.cwd()` (the location) into the registration/manifest; the CLI passes it
  through; the api stores it; the UI groups by it. (Today nothing carries the cwd — which is exactly why
  same-repo projects/services can't recognize each other.)
- **The location VALUE is a token, not the path** (settled 2026-08-05, superseding the raw-cwd-first
  lean). Why: registration is a NETWORK call to SYSTEMVIEW_HOST — remote-capable by design and used
  remotely in real deployments (buAPI) — and nothing off-box ever needs the raw path (grouping =
  equality; file access goes through the plugin/CLI on the owning box; display wants a label). Sending
  the path is gratuitous disclosure (username, dir layout) for zero benefit. NOT a hash — `hash(cwd)`
  is dictionary-reversible. The user's design: a **random token persisted once in the shared
  `.systemview/` (e.g. `location.token`)** — first plugin to boot generates it, same-cwd siblings read
  the same file ("fuse the same secret"). Zero path material by construction, and grouping survives a
  directory rename, which raw cwd and hashing both break.
- **The UI treats location as an OPAQUE grouping key** — never parses it, displays a label
  (projectCode / plugin-config name / user-set) instead of a path.
- This one change solves BOTH: (a) same-location service grouping inside the codebase card, and (b) the
  **stories file picker** — services from the same location group together, clicking one highlights the
  whole group, and the codebase is listed once instead of pretending only one service has files.

### 4. The nav's + becomes a small menu

- Options: **Load service** (restoring the previous long click-to-open bar look, then the input) and
  **Create testing service** — each with a line of small help text.

### Sequencing

1. Plugin stamps location (+ api/CLI pass-through).
2. UI grouping: codebase card restructure (services top, codebase(s) below) + story file-picker grouping.
3. The + menu / create-testing-service flow (UI + CLI command) — the testing project registers, marked.
4. CLI-as-a-service transport so tests on synthesized namespaces RUN (the standing next bridge).
