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
guard: once-per-session
---

Context is past 60% of the window. Early is cheap and late is not…
```

`do` is a pointer — `skill:<name>` today — never a procedure. `author` records who wrote it
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

## Guards

A badly-scoped hook is a context leak that fires forever, so a hook may declare a guard:
`once-per-session`, or `cooldown:<seconds>` (`study` uses `cooldown:604800` — once a week).
Fired-state lives with the session, never globally, so "once per session" cannot quietly mean
"once per shell". An unknown guard does not block the hook — it is a typo, not a lock.

## Carrying — writing is not arming

A hook is a library entry: writing one makes it **exist** for everybody and **fire for nobody**.
It fires only for an agent that *carries* it, and the carry list lives on the agent's profile —
the human's to tick. `scope` is only the suggestion the editor pre-fills; carried-or-not is the
one real mechanism. An agent authoring a hook has proposed wiring, not armed it.

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
event wants a guard, and a rename is a move, not a copy.
Four hooks exist today: `context-retrieval-cold` (`session.started`, origin cold),
`context-retrieval` (`compaction.after`), `context-maintenance` (`usage`, pct ≥ 60), and `study`
(`session.started`, origin cold, weekly cooldown).
