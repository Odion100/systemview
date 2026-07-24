# RFC-015 — SystemView Reports (statistics, topology & load-balancer insight)

**Status:** Planning (draft) · **Depends on:** RFC-004/005/006 observability layer, plus new SystemLynx capabilities (see §7)

## Problem / vision

SystemView today shows you **logs** — they answer *"what happened in this one call?"* They're episodic. As systems get driven and inspected more by AI, the question shifts to *"what's **true** about my system over time?"* — and that's a statistical, synthesized question no single log line answers.

**Reports** is that layer. Same raw material the plugin already emits (the `before/after $all` trace events with `traceId`, `duration`, `moduleMethod`, args, returnValue, level), rolled up and **told back as a story**: what carries the load, what's slow, what's breaking, what's untested, how the system is wired, and — new — **how the load balancer is behaving**. SystemView becomes the place you (or an agent) point at a system to *see* it, and the place that says, in words, *"scale this, horizontally, now."*

## A capability worth leaning on — available / used / tested

One thing SystemView can do that a generic tool (Datadog, Grafana) can't: it holds **three** views at once, not just traffic.

- **Available** — the full declared surface: every module/method the plugin advertises (already in `connectionData.modules`; it powers docs + nav).
- **Used** — what's actually being called, from traces.
- **Tested** — what has specs and their pass/fail, from the Test feature.

Because it has the **catalog + traffic + tests together**, a report can talk about what *isn't* happening — dead endpoints, **untested hot paths** — not just what is. This is a strong capability that several reports lean on (esp. Surface Coverage, §4). It's *a* pillar of Reports, not the sole frame — the reports below stand on their own metrics too.

## What we collect (tiers)

**Tier 0 — foundation (already exists).** `before/after $all` instrumentation stamps `traceId`, `duration`, `moduleMethod`, args (start), returnValue (end), errors. Reports are *aggregation on top of this* — for Tier 1 we invent no new capture, only roll-up.

**Tier 1 — method-level metrics.** Per `module.method`: call count, error count + rate, latency distribution (**p50/p95/p99/max — not just avg**; the tail is what triggers scaling), **total wall-time = count × avg** (the "who carries the load" number), throughput over time, first/last seen, payload/response sizes.

**Tier 2 — topology.** Caller→callee edges across modules **and services**. Node = service/module (sized by load), edge = calls (weight = volume, color = error rate). Needs a correlation id that survives a cross-service call — a SystemLynx gap (§7).

**Tier 3 — insight / recommendations.** Derived narrative: hotspots, tail-latency degradation, concurrency saturation, and **scale-direction hints (vertical vs horizontal)**. The AI-facing payload. With the load balancer online (§5), this tier can also read *actual* balancing behavior instead of only inferring it.

## The report gallery

A report = a **one-sentence headline verdict** (the story, AI-facing) + supporting cards, each drill-down-able into the raw logs/tests. Example lede:

> *"System healthy. 12.4k calls today, 0.3% errors. Busiest: Profiles. ⚠ Watch: `Basketball.Games.get` p99 up 40% since yesterday — and it has no test."*

The reports are not silos — they're the **same aggregated data sliced into narratives**. Build the aggregation + synthesis layer once; each report is a view.

1. **State of the System** — landing page. Health tiles per service, total throughput, error rate, today's hotspots, "what changed since yesterday." *Is my system OK, and where's the weight?*
2. **Load & Scaling** — the decision report. Load concentration (total wall-time by method), throughput trends, tail latency, concurrency saturation → scale-direction hints. **With the load balancer: live clone counts, per-clone distribution, routing behavior (§5).**
3. **Topology & Health** — the auto-generated diagram. Services→modules→methods, edges colored by error rate, nodes sized by load. (Needs §7 trace propagation.)
4. **Reliability** — error-rate trends, failures clustered by `traceId` (what breaks *together*), status-code mix.
5. **Surface Coverage** — the pure available/used/tested report: unused endpoints (declared, never called), **untested hot paths** (heavily called, no spec — the scariest quadrant), test pass-rate over the busy surface.
6. **Change / Deploy diff** — compare two windows: *"latency +30% on X, new error type appeared, Y stopped being called."* The before/after story tied to deploys.
7. **Module Coupling** — the *pre-split* map: within one service, which local modules call/emit-to which, weighted by frequency. Answers *"if I extract module B into its own service, what breaks?"* — loosely-coupled = safe to split, dense cluster = plan for it. **In-process, so it does NOT need the trace-propagation gap** (distinct from #3 topology, which is the *post*-split picture). Needs a small local-coupling signal from SystemLynx — see `SystemLynx/gaps/SYSTEMVIEW_LOCAL_MODULE_COUPLING.md`.

### The hero card — cross-feature synthesis in one tile

The tile that sells the feature, because nothing else can render it:

> **`Profiles.Locations.get`**  ·  🔴 watch
> 60% of total wall-time · p99 210ms (▲40%) · 0.1% errors · **no test** · 3 downstream deps · balanced across 2 clones

Stack a few of those and you *have* the story.

## Load-balancer observability (§5)

SystemLynx is implementing its load balancer now (WIP in the SystemLynx repo: `LoadBalancer/` rewrite, RFCs 003/004). Shape of it, so the observability design is grounded:

- **The balancer is itself a normal SystemLynx service.** Inside it runs the **`Tentacle`** module — the cluster brain (`systemlynx/LoadBalancer/components/Tentacle.js`): it holds the service registry, per-location load, heartbeats, and routing policy.
- **A service joins the cluster with one line:** `App.use(LoadBalancer.clone({ url }))`. The **clone plugin** (`LoadBalancer/clone.js`) auto-registers the service, injects `this.clone` on modules, tracks in-flight count via `$all` middleware, and pushes load + heartbeat to the Tentacle every `reportInterval` (default 10s).
- **Discovery *is* balancing.** A client connects to the LB once, gets `connectionData` for a specific clone, and stays sticky to that clone for the socket's life. The balance decision is **connect-time, not per-request** (preserves WebSocket affinity) — round-robin by default (`Tentacle.nextLocation`), or **least-load** when `Tentacle.policy = "least-load"`.

**What SystemView can show — and most of it needs *no* new framework hook.** Two facts shape it: (a) cluster state (`Tentacle.services`/`loads`/`policy`) lives **in the LoadBalancer's own process**, so it's read by running the SV plugin *inside* the LB — `LoadBalancer.use(systemview({…}))` — where it reaches the Tentacle in-process (`App.getModule("Tentacle")`) and subscribes to its **local `$emit` events**; (b) every clone already runs the SV plugin, so per-clone **traffic** already flows through the normal trace stream. So the window assembles from three sources:

1. **The LB registry & load state — read in-process inside the LB** (public Tentacle fields today): `Tentacle.services` → `[{ route, name, locations: [url], index }]`; `Tentacle.loads` → `Map<location → { load, seen }>`; `Tentacle.policy`. → live **clone count per service**, each clone's **last reported load + last-seen**, and **active routing policy**.
2. **The Tentacle's local lifecycle events** (already emitted): `new_service`, `new_clone`, `location_removed` (`reason: "stale"`) — subscribed via `.on(...)` in-LB (local events fire the dispatcher's listeners; there's no `$on`, `.on` catches them). → a **spawn / join / evict timeline** you literally watch.
3. **Existing per-clone traces** (SV plugin in each clone, once it stamps each record with the clone's `location`/`serviceId` — a small SV-side change, not a framework gap): per-clone **traffic share, latency, error rate** — *is the balancer spreading load evenly, or is one clone hot?*

The one genuinely-missing signal is a **routing-decision event** (`Tentacle.$emit("route_assigned", …)`) for balance-fairness — one `$emit` line, using the local-event mechanism that already exists. See the gap doc.

### Opt-in — the LB is just another project node

The LoadBalancer is an exported app, so the user opts in the same way a service does — one line, pointed at the **same project**:

```js
LoadBalancer.use(systemview({ projectCode: "infra", serviceId: "loadbalancer" }));
```

- **`systemview(config)` returns the plugin** (`function(App){…}`) with configurable functions — the exact same entry point services use.
- **The plugin knows it's in a load balancer** — by config, or by detecting it internally on `ready` (a `Tentacle` module is present). In LB mode it attaches to cluster behavior instead of only method traces.
- **It reuses the machinery it already has.** Just as it injects its `SystemView`/`Plugin` modules into a service today (for file save/load and connection to the UI), in LB mode it injects its module(s) for **stats/log file I/O** and grabs a **handle on the Tentacle** (`App.getModule("Tentacle")`) to **listen to its local events via `.on(...)`**. No new subsystem — the same plugin, in a mode.

So the LB becomes just another node in the project's Reports; only *what it records* differs — cluster state and routing behavior instead of method calls. In the nav it lists **alongside the project's services**, flagged a **distinct color** (badge/dot) so it reads as the balancer at a glance rather than a normal service.

**The window:** a **Load Balancer** view (or a panel in **Load & Scaling**) per balanced service showing — live clones and their health tiles, a **per-clone distribution bar** (traffic share; reveals an unfair balance at a glance), each clone's load/last-seen/latency, the active policy, and the **join/evict timeline**. This turns *"I think I should scale"* into *"I can watch it balance,"* and feeds Tier-3 recommendations real cluster state instead of inference (e.g. *"3 clones, but 80% of traffic on clone-1 — routing skew, not a capacity problem"*).

## Architecture

- **We track — we don't hoard raw.** The plugin keeps **rolling aggregates**: time-bucketed counters + latency histograms per `module.method` (and per clone), flushed periodically to a per-project stats store alongside the logs. That's the whole point of Reports — *track* the things worth tracking, not replay every trace. What gets tracked and at what granularity is **configurable** (which metrics, bucket size, retention) via plugin config, with sensible defaults — so we can dream up new tracked dimensions without a re-architecture.
- **Stats API:** the plugin exposes the rollups the way it exposes logs today (a `SystemView`-module method, e.g. `getStats`/`getReport`), read by `api/` and the browser client — same path the logs already travel.
- **UI:** a **Reports** area per project — health tiles, top-N tables, time-series charts, topology graph, LB window. **CSP constraint:** charts/graph must be **self-contained SVG** — the artifact/CSP blocks any CDN (no d3-from-CDN), so we render lightweight in-house or vendor a small lib into the bundle.

## How SystemView taps SystemLynx (§7)

Tiers 0/1 are free — the trace data already flows. The higher tiers observe framework internals, and
the good news after reading the SystemLynx source: **SystemView rides mechanisms that already exist.**
A plugin gets `App` + `system` on install; on `ready` it reads live handles (`this.useModule`,
`App.getModule(s)`); local events are `$emit` (already used to feed a SystemView observer — see
`Router.js`); and to see the load balancer's cluster state you load the SV plugin *into* the LB
(`LoadBalancer.use(systemview)`) and read the Tentacle in-process. No handle-acquisition gap, no new
event system, **no new remote methods.** The accurate write-up lives in the gap doc:

> **`SystemLynx/gaps/SYSTEMVIEW_LOAD_BALANCER_OBSERVABILITY.md`**

Two genuinely-new needs sit on top:

1. **Cross-service trace propagation** (Tier 2 topology) — mechanism is **SystemLynx RFC-005
   (client-side hooks)**: `Client.use(plugin)` + a client `before` hook that sets
   `this.setHeaders({ "x-sv-trace": inboundTrace || newTrace() })`; the receiving service adopts it as
   parent and the caller→callee edge falls out of the existing trace stream. SystemView ships a **client
   plugin** for this once RFC-005 lands. **This one change unlocks the entire dependency diagram.**
2. **A routing-decision event on the load balancer** (§5) — `Tentacle.$emit("route_assigned", …)` for
   balance-fairness, plus the hard prerequisite of the circular-reference guard on emit
   (`EMIT_CRASHES_HOST_ON_CIRCULAR`), since Reports rides more data over emits. Everything else in the
   LB window is already-existing reads + local events (gap doc).

We'll handle the SystemLynx side — it keeps pace with SystemView by design.

## Phasing

- **Phase 1 — Tier 1 + State of the System + Load & Scaling (metrics only).** Data already flows; ships value fast; no framework change. Aggregation layer + stats API + Reports page + first two reports.
- **Phase 2 — Load Balancer window.** The *basic* window (clone count, per-clone load/health/traffic-share, policy, join/evict timeline) needs **no framework change** — it reads the LB registry + existing per-clone traces (§5). The fairness/health/coordination depth waits on the §7.2 hooks. Highest-signal new capability; ship the basic window as soon as the LB lands.
- **Phase 3 — Topology & Health diagram.** Requires §7.1 trace propagation.
- **Phase 4 — Reliability, Surface Coverage, Change/Deploy diff, Tier-3 recommendations.**

## Decided

- **We track, configurably.** Rolling aggregates, not raw replay; tracked metrics / bucket size / retention are plugin config with defaults (§Architecture).
- **SystemLynx keeps pace.** We tap it via handles + local events per the gap doc; the framework side gets handled — not treated as a blocker.
- **available/used/tested** is a leaned-on capability, not the sole frame.

## Open questions

1. **The lede.** **State of the System** as the landing report with **Load & Scaling** as the workhorse — and how many reports are "lead reports" surfaced up front vs reached into. (rec: those two lead.)
2. **Config defaults** — out-of-the-box tracked metrics, bucket size, retention window.
3. **Charts** — vendor a small SVG charting lib into the bundle vs hand-roll (CSP-safe either way).
4. **Where the LB window lives** — its own report vs a panel inside Load & Scaling.
