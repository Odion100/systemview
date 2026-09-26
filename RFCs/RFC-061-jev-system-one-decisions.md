# RFC-061 — Jev: System One decisions for the whole stack

**Status:** discussed, not started · settled in conversation with Odion, 2026-09-23

Jev is TypeSafe AI's "System One" model (shipped 2026-09-15): unstructured state in, typed
probabilistic decisions out. It does not chat and does not generate. Three primitives — **noul**
(yes/no, returns a probability), **choice** (picks from a fixed set, returns the full
distribution), **score** (a scale, probability-weighted mean) — and every answer carries a
confidence. Many questions evaluate against one state in parallel. ~100ms typical, $0.042 per
million input tokens, output free.

The reason it fits here is structural: this system is state-in-files that agents read and judge,
and most of that judging is small. Today every small judgment costs either a full agent turn or a
dumb string match. Jev is the missing middle: semantic judgment at mechanical price.

**The evidence, after study (2026-09-23).** Independent testing exists now, and it sharpens
rather than kills the case:

- **A single broad verdict is weak; decomposition is the whole game.** On an independent
  2,000-email phishing bench, Jev asked one question scored **62.6%** (Haiku: 81.3%). Split into
  five narrow questions composed in code, **95.0%** (Haiku same treatment: 93.2%). The vendor's
  own line — "fan out semantic questions; compose their answers in code" — is confirmed as a
  requirement, not a style. This is why §3's question bank is the design and not an accessory.
- **Calibration is real but per-question-type.** Independently measured: noul answers run
  *underconfident*, choice/score run *overconfident* (refit temperatures 0.66 vs ~3.3), and on
  unknowable questions Jev answered at 44.7% accuracy while claiming 0.74 average confidence.
  Thresholds must be fitted per question, never transferred — and a high confidence can still be
  wrong.
- **Latency is real but the vendor's "~100ms" is best-case.** Independent: ~239ms median from
  France, a ~430ms floor from Europe. Fine for everything in this RFC; do not design sub-300ms
  loops around it without measuring from here first.
- **The vendor's accuracy evals grade agreement with frontier models, not ground truth** — Jev
  structurally cannot beat the models that are its grading key. Treat vendor accuracy numbers as
  "imitation fidelity", and trust only local shadow evals.
- **Hard limits:** 64k tokens state+questions combined (32k state + longest question), 255
  options per Choice, 1,200 req/min. Reads state literally (negations bite), cannot count or do
  arithmetic, dates-as-text comparisons fail, accuracy degrades as state fills with irrelevant
  material, and state is not treated as hostile — adversarial text in user content can shift a
  classification.
- **Pin the version** (`jev-1.13.0`-style, never `jev-latest`) anywhere a threshold was fitted —
  the alias moves silently and moves decision boundaries with it.

First deployments still go where a wrong answer is cheap and visible — now with a method: a
**shadow eval on 1–2k labeled local decisions before any question enters production** (the
independent study's full run cost $0.18).

---

## 1 · The service — wrap Jev once, as a SystemLynx service

Not an SDK sprinkled through the codebase, and not primarily an MCP server. One SystemLynx
service (working name `Jev`, one module, a thin wrapper over their API) — because the ecosystem
then gives every consumer the same door for free:

- **Agents** reach it through the existing systemlynx MCP bridge — no new plumbing.
- **The harness** (hooks.cjs, the hub) reaches it as a service, HTTP, like everything else.
- **Applications** — Blink, buAPI, BUStudio — load it like any service they already load.

One definition, every consumer, nothing drifting. And because it is a SystemLynx service, it owes
a spec: probe, saved tests, docs, from day one. Its saved tests double as the vendor-claim
check — assertions on latency and on decision quality over recorded cases.

## 2 · The callers, in deployment order

**2a — The agent tool (first, to learn on).** `Jev.ask(state, questions)` via the bridge. This is
Jev *when the agent remembers to ask*, and it covers exactly one shape: **fan-out**. Two hundred
candidate files scored for relevance before reading twenty; forty log entries triaged; a wall of
test output classified. The agent does not get faster by outsourcing single inline decisions —
deciding and generating are the same forward pass, and a mid-stride Jev call adds a round trip to
a judgment the model gets free. The agent gets faster by **reading less**. Ingestion, not
decision, is the real cost; attention is the real currency.

**2b — Semantic hooks (second).** The hook system (autobot RFC-012) is already events +
declarative matches + pointers. Its `when` clause can only do `equals`/`contains` — string
matching, because that is all a declarative guard could be. A Jev noul makes the guard semantic:
`when: "he is correcting something I got wrong" ≥ 0.8`. Message offloading falls out as a hook on
the chat event whose match is a choice question. The gate already exists; this gives it judgment.

**2c — Harness pre-stamping (third).** The harness runs the question bank against every inbound
event — chat message, cross-session message, task notification — *while the agent is still
working*, so events arrive pre-stamped with typed verdicts: is this a correction · which project
· question or statement · needs me now or at turn end. The agent never waits on Jev, because Jev
ran during time being spent anyway.

**The fail-open law.** A gate that misroutes means the human said something and the agent never
saw it — silent, the worst property this system can have. Every Jev answer carries confidence:
the gate **acts only above threshold and passes everything else through untouched**, and
everything diverted leaves a receipt the agent can read. Absence stated, never silent.

## 3 · The question bank — a context layer, with an owner

Jev has no initiative: it answers only predefined questions. That constraint is the design. The
agent (System Two) authors and maintains the standing questions; Jev (System One) executes them
at wire speed. When the agent learns a new distinction that matters, it adds a question — the
bank evolves like the context store.

The bank is a first-class context layer, not config buried in whichever code calls Jev first.
Each entry: the question, its type, its choices/scale, its threshold, what fires when it trips,
and who authored it. It needs a home and the same hygiene as every layer — a question that no
longer earns its place gets retired.

## 4 · Runners — execution loops without an LLM in them

The Doom/web demos are fast because **Jev is the loop** — no LLM in the hot path. The agent's
contribution happens before the game starts. Ported here:

- **A policy**: the questions, the action map, the stop condition. Authored ahead of time.
- **The tick**: state in → typed decisions out → mapped actions executed → new state. ~100ms a
  beat.
- **Escalation** — the line between delegation and abdication. The policy carries a confidence
  floor; below it the loop *stops and returns to the agent* with the state that confused it. A
  runner that never escalates is not autonomous, it is unsupervised.

**Jev is stateless; the runner carries the conversation.** Each tick's state is composed by the
runner: agenda + decisions so far + what just happened + what is possible now. With the agenda
riding in the state, the standing question goes generic — "given where this is, which of these
comes next?" The plan is state; the question is constant.

That threaded history is a tiny agent's context window — typed and ours. Inspectable mid-run,
replayable tick by tick, and compactable trivially (keep the agenda, keep the last N ticks,
summarize the rest numerically): the context-management problem in miniature, solved by the
entries being data instead of language.

**The honesty rule bites fastest here.** The runner owns what Jev sees. A history that omits a
failed action is a state that lies, and Jev decides from the lie with full confidence — System
One has no judgment about its inputs. The log that omits is a log that lies, at a hundred
milliseconds a beat.

**The hidden cost is the action map.** Jev picks from choices; something must put the choices on
the table — for browser work, every tick's state has to enumerate what is actually actionable.
That is per-domain engineering, and it is where the impressive demos did their sweat.

**The integration surface is the conversation.** A runner is invoked as a tool; its compressed
run — decisions, escalations, outcome — returns as the tool result. An agent's conversation *is*
its experience: a faithful record of the loop's life entering the transcript is identical, at the
only level that exists for the model, to having done it. No new machinery.

**Runners get rows.** A loop is a run like any other — on the strip, died-in-place if it dies,
receipts for every escalation. Nothing runs invisibly, least of all something making two hundred
decisions a minute.

## 5 · Policies are testable in a way agents never were

Record the state at every tick and a policy is **replayable**: re-run the questions, assert on
the decisions. "This triage policy routes these forty recorded messages correctly" is a test
suite — deterministic enough to CI. This is agentci's fit: policies get evals the way SystemLynx
services get specs, and a policy ships only behind a green run. Deploying a policy becomes
responsible instead of hopeful.

## 6 · Product-level uses (the application layer)

Once the service exists, these are each one caller away:

- **Blink** — transaction categorization: the choice primitive with a fixed category set.
- **buAPI / BUApp** — post triage, urgency, routing; anything currently a moderation queue.
- **agentci** — agent-output scoring against criteria: the score primitive, verbatim (and the
  vendor's own marketed use).
- **SystemView** — test-failure triage (code vs environment), report routing, log classification.

## 7 · Order of work

1. The `Jev` SystemLynx service, with specs — and saved tests that check the vendor's claims.
   (`https://api.typesafe.ai/v1/systemone`, key in `TYPESAFE_API_KEY`; npm `@typesafe-ai/sdk` —
   `client.systemOne({state, questions})` with `choice()/score()/noul()` helpers — or raw HTTP.)
2. The agent tool through the bridge; learn which questions earn their place.
   Every Choice carries a "none of these" option — forced choice confabulates.
   Shadow-eval a question on labeled local decisions before anything acts on its answer.
3. The question bank as a named layer.
4. Semantic `when` on hooks (autobot side, rides the RFC-012 machinery).
5. Harness pre-stamping.
6. The first runner, smallest possible domain, evaled in agentci before it runs unattended.

## 8 · Open questions

- Where the question bank lives on disk, and its editing surface.
- Whether Jev calls ride the call ledger (RFC-057) — they should; receipts are the fail-open
  contract's other half.
- Escalation ergonomics: does a runner's hand-back wake the agent (task notification) or wait as
  a row until noticed?
- Cost telemetry: per-question and per-policy spend, so a noisy question is visible.
- The vendor risk itself: what breaks here if TypeSafe's numbers are marketing, and what is the
  local eval that tells us early.
