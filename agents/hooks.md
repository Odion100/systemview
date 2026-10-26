# Context hooks — an event points an agent at a skill

Context reaches an agent two ways: **loaded** (presence, the system context, the agent's doc —
paid every turn) and **retrieved** (the store, docs, skills — paid when the agent thinks to ask).
A hook is the third, for the procedure needed rarely and urgently: the agent will not think to
ask, because the moment — a compaction, a full window, a cold start — arrives from **outside**
and has to be pushed.

A hook holds no content — it says "this moment happened, and this skill applies" and hands over
a **pointer**; the agent still decides whether to pull it. Skills stay the single home of every
procedure (a hook has nothing to drift with); the only difference is who pulls the trigger: the
model's judgment for a skill, an event for a hook. **Same body, two doors.**


::rfc{id=}
## The hook file

A hook is a markdown file in `~/.autobot/hooks/` — editable, diffable, no database in the middle.
Front matter is the record; the body is a note that rides along with the pointer. A real one,
`context-maintenance.md`:

```
---
name: context-maintenance
on: usage
when: {"pct":{"gte":60}}
scope: agent:systemview-test
do: skill:context-maintenance
kind: context
rate: once-per-rise
---

Context is past 60% of the window. Early is cheap and late is not…
```

`do` is a pointer — `skill:<name>` (offered; the agent decides) or `job:<id>` (GIVEN; the job's
declared inputs ride the hook's `with:`, and a hook that cannot supply them is refused at the
writing door) — never a procedure. `author` records who wrote it
(`user`, or `agent:<slot>`); an agent may overwrite only its own, the operator anything. No
`author` means hand-written before attribution existed and reads as the operator's.

## The event vocabulary

A hook can only attach to a moment the system really emits — checked at the **writing** door,
because a hook on an event that never happens is silent and looks correct in every list. Hooks fire
from the same `emit()` that feeds the session's feed, so observability and hookability are one
surface: a new event source is hookable by being emitted, with nothing to wire. Fields
with a fixed set of values carry them as presets, so an author copies instead of guessing:

| event | when it fires | fields (presets) |
| --- | --- | --- |
| `session.started` | a session opened | `origin` (cold \| reinit \| resumed), `model` |
| `session.reinit` | re-initialized on current docs | `resumedFrom`, `agentId` |
| `session.ended` | finished or interrupted | `reason` (finished \| interrupted \| error) |
| `user.prompt` | a turn arrived from the human (or a visiting agent) | `text` |
| `assistant.text` | the agent spoke | `text`, `done` |
| `assistant.thinking` | the agent thought out loud | `text`, `done` |
| `tool.call` | the agent called a tool | `tool`, `summary`, `input.command`, `input.file_path` |
| `tool.result` | a tool answered | `tool`, `ok` (true \| false), `output` |
| `file.changed` | a file under the session's cwd changed | `path` |
| `permission.request` | the agent asked before acting | `title`, `detail` |
| `usage` | token usage reported — end of a turn, a safe place to hook | `pct`, `contextTokens`, `contextWindow`, `inputTokens`, `outputTokens` |
| `idle` | the session has been quiet since it last handed the turn back — the moment for work that must never compete with the human | `quietMin` |
| `compaction.after` | a compaction finished; the reasoning behind the summary is gone | `trigger` (auto \| manual), `preTokens`, `postTokens` |
| `todo.updated` | the worklist changed | `source`, `run` |
| `run.started` | a procedure's execution opened its own worklist | `source`, `id` |
| `run.finished` | an execution's list went all-done | `source`, `id` |
| `message.landed` | a cross-session message arrived | `from`, `text` |
| `status` | the session narrated its own state | `status` |
| `page.navigated` | a browser tab went somewhere — every tab, watched or not | `url`, `title`, `from`, `tabId` |
| `page.value-changed` | a watched page value is no longer what it was | `watch`, `label`, `from`, `to`, `url`, `selector` |

The two `page.*` events are **ambient**: they belong to no session, fan out to hooks and never to
feeds, and the **host emits them, never the page** — a page that could emit could forge its own
trigger. `assistant.text`/`assistant.thinking` fire only on `done: true` — a token at a time is
not a moment. `hook.fired` (every firing's receipt) is deliberately **not hookable**: a hook on
it would fire itself in a loop.

## When-conditions

`when` is a declarative match on fields of the event payload — microseconds, no scripts, no
filesystem, because it runs on every event. `{}` means "always, on this event"; a bare value means
equality, an array "any of these", and dotted paths reach nested fields (`input.command`).
Operators: `equals`, `not`, `contains`, `startsWith`, `endsWith`, `matches` (regex), `in`, `gt`,
`gte`, `lt`, `lte`, `exists` — the substring operators and `matches` are **case-insensitive**
(they point at human text; `equals` stays exact), and an unknown operator never silently passes.
**Whitespace is not normalised**, though: `contains: hooktest` does not match "hook test" — for a
phrase a human will type loosely, use `matches` with `\s*`.
The `when` clause is the whole difference between a firehose and a trigger: blanket `tool.call`
is a nightmare; `tool.call` where `input.command` contains `git push` is a trigger.

## Ambient fields

Every event is stamped, at fire time, with what the world can afford — so a `when` can mix "what
happened" with "what it costs now": a study hook on a cold start can add `{"ctxPct":{"lte":40}}`,
a quota-aware one can back off when the account is throttled.

- `ctxPct` — context-window fill % of the session the event belongs to
- `quotaStatus` — last account quota status the API reported (e.g. `rejected`)
- `quotaType` — which limit that report named: `five_hour` | `weekly`
- `quotaResetsInMin` — minutes until that limit resets, at fire time

The quota trio is **absent until the API reports a limit** — nothing invented; `exists` handles absence.

## The fire rate — a different axis from the condition

A badly-scoped hook is a context leak that fires forever, so a hook declares a **rate**. It is not
the same question as `when`: `when` is a CONDITION (what must be true right now), the rate is a fact
about this hook and this agent OVER TIME. "past 60%" and "at most once a day" compose without
interfering, which is the test that they were ever separate axes. `guard:` is the old spelling and
still reads; a hook edited once migrates itself, because the writer only ever emits `rate:`.

| family | forms | means |
|---|---|---|
| sliding | `cooldown:30m` `cooldown:3d12h` `cooldown:2w` | no sooner than N since the last fire. Bare digits still mean seconds, so old hooks keep their meaning |
| calendar | `once-per-day` · `once-per-week` · `once-per-month` | once within each period, however the periods fall — fire at 11pm Monday and a sliding day blocks all Tuesday daytime; the calendar one is what the words mean |
| session | `once-per-session` | once, then never again for this session's life |
| edge | `once-per-rise` | once per **crossing** of the hook's own `when`, re-armed when the condition goes false again |

**For a hook on a THRESHOLD, `once-per-rise` is almost always the one you want.** `once-per-session`
on `when: pct >= 60` fires at the first crossing and then stays silent for the rest of the session —
through every compaction and every refill, because the session's fired map is created at birth and
nothing clears it. That was a real, reported failure (2026-10-12), not a hypothetical. A rise is
re-armed by the FALL, so each climb past the line fires exactly once. It is session-scoped and never
written to disk: a restart is a new context and must find the hook armed. A `once-per-rise` with no
`when` is refused when you write it — with nothing to go false it would mean `once-per-session`.

**Calendar and sliding rates are PERSISTED** — `~/.autobot/hooks-fired.json`, keyed `<agent>|<hook>`,
so a shared hook carried by three agents has three cadences instead of the first one silencing the
rest. A hook's record dies with the hook; nothing accumulates. The session-scoped rates live in the
session, so "once per session" can never quietly mean "once per shell".

**A malformed rate is REFUSED at the writing door** — reversed from the old rule, which let an
unrecognised guard through as "a typo, not a lock". Sane for a condition, backwards for a rate:
`cooldown:2w` parsed as nothing and meant *no limit at all*, so the hook you slowed down became the
noisiest thing in the system, silently.

## Carrying — writing is not arming

A hook is a library entry: writing one makes it **exist** for everybody and **fire for nobody**.
It fires only for an agent that *carries* it, and the carry list lives on the agent (`def.hooks`).
`scope` is only the suggestion the editor pre-fills; carried-or-not is the one real mechanism.

**An agent arms its OWN hooks** — `hooksCarry({name, carry})`, settled 2026-10-12. Its own context,
its own continuation; a human in that loop is a bottleneck approving nothing. It applies immediately,
because the carry list is read per fire rather than copied onto the session when it opened — so
ticking a hook never needed a re-init either.

**Another agent's carry list is the human's.** That imposes standing behaviour on context somebody
else pays for every turn, which is a different act, and the verb refuses it by name rather than being
silently unable.

The press was never what protected anything: the **writing door** is, and it already refuses an event
that does not exist, a malformed rate, a `once-per-rise` with no `when`, and a job hook that cannot
supply what the job declares. Every fire is a feed row naming who wired it, so an armed hook was
never invisible — and the old rule produced the failure this page calls the worst one there is, a
hook that looks correct and silently never runs.

## Kinds

`kind: context` (the default): a pointer arrives and the agent decides — intended, not enforced,
the same trust skills already have. `kind: work`: something **runs** unattended. That branch is
where the trust level changes, so it is recorded explicitly; propose a `work` hook out loud.

## How the pointer arrives

The pointer rides the input queue exactly like a cross-session message: a `<context-hook>` wrapper
naming the moment and the skill, plus the file's note — never the procedure. Its own text says to
finish the human's work first: a hook says a moment happened, it does not get to reorder the work.
Every firing also emits a `hook.fired` receipt into the feed, so an unattended trigger is never silent.

## Authoring one

Agents author through the context MCP: `hooksList` first — the real event vocabulary and who
wrote each existing hook — then `hooksWrite`; the authoring rules live on those tools. A frequent
event wants a rate, and a rename is a move, not a copy.
Which hooks exist right now is STATE, so it is read, never recalled: `hooksList` answers with
the live set, who authored each, and the real event vocabulary — this page had a list of four here
once, and it was wrong by four within the week.
