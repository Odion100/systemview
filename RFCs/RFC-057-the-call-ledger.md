# RFC-057 — The call ledger: statistics for tools, MCP, skills and hooks

**Status:** BUILT. Defaults chosen where the open questions went unanswered — global with an agent
filter, dated files plus a sweeper (14 days), agent-only (his own clicks in the window are not
recorded). All three are one-line changes if he wants them the other way.

## Why

The context surface can answer "is this note earning its place?" because every retrieval is stamped
to `~/.autobot/context/usage.jsonl`. Nothing else in the harness is written down. Tool calls, MCP
calls, skill fires and hook fires all go out through `emit()` to the live feed and **vanish with the
session** — so the question he actually asked has no data behind it:

> "If we created these internal tools, are they being used properly?"

Today that can only be answered by reading a transcript. An always-loaded tool nobody calls is the
same kind of waste as a note nobody retrieves, and right now only one of the two is measurable.

## The shape

**One write site.** `emit()` is already the single chokepoint every observable thing passes through
— it is where hooks fire, so it is already the seam where "something happened" is known. The ledger
is one more line there: append-only JSONL, same disposable contract as `usage.jsonl`.

```
~/.autobot/logs/calls.jsonl
{"ts":"…","agent":"systemview-test","project":"systemview-test","kind":"tool","name":"Bash","ok":true,"ms":412}
{"ts":"…","agent":"buapp","project":"buAPI","kind":"mcp","name":"systemview.runTests","ok":false,"ms":1503,"err":"no service"}
{"ts":"…","agent":"systemview-test","project":"systemview-test","kind":"skill","name":"context-maintenance"}
{"ts":"…","agent":"systemview-test","project":"systemview-test","kind":"hook","name":"context-retrieval","on":"compaction.after"}
```

Deliberately flat and small: `ts · agent · project · kind · name · ok · ms · err`. No arguments, no
payloads — a ledger, not a transcript. Arguments are the thing that would make this file enormous
and make it a privacy question; the transcript already holds them.

**Kinds, from the existing event vocabulary** (RFC-048) — `tool`, `mcp`, `skill`, `hook`, `session`,
`compaction`. No new vocabulary invented; the ledger records what is already named.

**Streaming deltas are skipped**, the same filter `fireHooks` already applies. A ledger of token
deltas is noise with a disk cost.

## What it answers

| question | how |
|---|---|
| Which tools does an agent actually call? | count by `name`, grouped by `agent` |
| Which internal tools are **never** called? | the always-armed list minus the names seen |
| Are they used *properly*? | failure rate per tool (`ok:false` / total), with the error text |
| What is slow? | p50/p90 of `ms` per tool |
| Do the skills trigger? | `kind:skill` counts vs the skills the agent carries — a skill that never fires is a description problem, and `skill-authoring` already says the description IS the trigger |
| Do hooks fire, and on what? | `kind:hook` by `on` |

The last two are the ones we cannot see at all today, and they are the two where being wrong is
invisible: a skill that never triggers looks exactly like a skill that was never needed.

## The surface

A **Statistics page at page level** — not a chip at the bottom of another surface. His note on the
store panel is the rule: vector-store stats belong next to the store because they are *about* the
store; call statistics are about the system, so they get their own place.

Tabs: **Tools · MCP · Skills & hooks · Sessions**. Same table language already built for the store
panel (ranked bars, who-chips, tabular numbers) so there is one statistics dialect, not two.

The store panel **stays where it is**. It is not moved into this page and not duplicated there.

## Honesty rules, carried over from the store panel

1. **A `since` stamp.** The file is disposable and will be compacted. Anything before the first line
   has an UNKNOWN history, not a zero — "never called" is the sentence that deletes a tool.
2. **Name the gap.** Where reads can't be attributed, say the number rather than letting the table
   imply nobody is calling. (The store panel already does this: *15 of 102 reads carry a reader*.)
3. **No silent caps.** If a view shows a top-N, it says what it dropped.

## Cost

Two appends per tool call (start/finish) or one on completion. The usage log is 16KB after five
days of real use; this will be bigger — order of a megabyte a week — which argues for a dated file
(`calls-YYYY-MM-DD.jsonl`) and a sweeper, rather than one file that grows forever.

## Open — his call

1. **Per-agent or global first?** The store panel is scoped to one agent's three scopes. A call
   ledger is more useful global (which tools does the *system* use) with an agent filter.
2. **Retention.** Dated files plus a sweeper, or one file that gets compacted like `usage.jsonl`?
3. **Does the ledger record the human?** His own tool calls in the window (nav, show, commit) pass
   through different code. Include them or keep the ledger agent-only?

## Not in this RFC

Cost/token accounting per tool. `usage` already emits `pct`, and tokens-per-tool is a different
measurement with a different denominator — it would muddy a ledger whose whole value is being small.
