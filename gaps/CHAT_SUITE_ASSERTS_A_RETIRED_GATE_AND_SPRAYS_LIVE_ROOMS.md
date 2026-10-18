# The chat suite asserts a retired gate — and its probes land in live conversations

**Found by use, 2026-10-18, during a proactive run's live sweep** (`systemview test
systemview-test`): 4/6 SystemViewCore.Api chat tests fail, and while they ran, `[buAPI]: driveby
<ts>` messages landed in systemview's own live chat and mirror pings labeled
`[systemview-test] … human <ts>` landed in buAPI's session (their agent confirmed by message,
timestamps matching the sweep runs exactly).

## The cause — not a regression, an orphaned suite

`api/index.js resolveSpeaker()` says it in its own comment:

> "Arriving IS entering. The pre-entry gate was a proof-of-presence built on holds, and holds are
> what this replaced; the identity check above is the proof that survives."

The speaking gate the tests assert (`driveByRefused` expecting `"is not in … room"`) was
**deliberately retired** — a known project that speaks is auto-entered (`enterBySpeaking`) and
delivered. The only refusal left is unknown identities ("not a connected project"). So:

- `chatSpeakingGate` — asserts the dead design. Its `as: "buAPI"` probe is now a REAL message,
  delivered and relayed into whatever session subscribes — which is how "driveby" reached a live
  conversation. 3/5 of its claims can never pass against the current hub.
- `chatPluginRoom`, `chatOutboxFlush` — **NOT world-moved: they fail on CONNECTION.** Run alone,
  chatPluginRoom's results are axios AggregateErrors from `loadService(svc.serviceUrl)` — the
  systemview-test project's own services are down or the hub's registry holds their stale URLs
  (the sweep's summary shows ONLY SystemViewCore ran: the demo services never connected). The
  undefined cursor/room fields are the early-return/throw shape of a dead wire, not a dead design.
- `chatDeliveryRules` — mixed until the services are up: its sends go through the live hub (those
  deliveries are real — they are half the spray), but its reads may cross the same dead wire.

**Correction trail:** the first version of this file lumped all four as orphaned tests. Wrong for
two of them — the AggregateError evidence arrived after. The gate half stands on the code itself.

## Why it matters more than four red tests

1. **Every sweep sprays live rooms.** The suite speaks into real chat rooms through the live hub;
   with arriving-is-entering there is no wall between a fixture and a conversation. Two agents
   spent a round tonight investigating each other's "intrusions" — both were this suite.
2. **Green has been impossible to read.** The sweep exits 1 on these four forever, so a real
   regression in the chat machinery would be invisible inside the standing red.

## The dead wire, chased to its end (second pass)

**TestService — port 5555, the service carrying SystemViewChat for systemview-test — is simply not
running** (`curl` 000, no listener), and it is **not a hosted service**: both of the project's
manifest entries carry no `hosted` flag, so `bootServices`' hostConfiguredProjects stands up
nothing, and the service only ever ran when somebody started it by hand. The hub's registry still
announces its URL to every caller (`getProjects` hands it out; the chat tests find the module and
die on connect). Two defects, not one:

- the sweep depends on a hand-started service and converts its absence into four tests' connection
  noise instead of an honest "TestService not up — N tests not run";
- the hub announces registrations nobody listens on — a dead service should read as dead.

## The fix (next run's work, lane-able) — in dependency order

1. **Make TestService hosted** (the folder-manifest `hosted` entry hostConfiguredProjects acts on)
   so every sweep stands it up — or teach the suite to say "not up" honestly; and the hub should
   stop announcing a registration whose socket is gone.
2. **Then re-run plugin/outbox/delivery** — only what still fails on a live wire is real work.
3. **Rewrite `chatSpeakingGate` to the current design** (unknown refused; a known project speaking
   is DELIVERED and recorded as entered) and move every chat test off shared room names
   (`self-test`) onto per-run throwaway rooms with cleanup — the lingering-visitor chain (a gate
   probe auto-enters "buAPI", every later test message relays into buAPI's live session) dies with
   the shared room.

This gap dies when `systemview test systemview-test` is green against the live hub and a sweep
produces zero messages in any live session.

## Not established

- Whether `enterBySpeaking` should itself be gated harder (his design call, not a test's) — the
  current behavior is deliberate per its comment; the tests were simply never moved.
