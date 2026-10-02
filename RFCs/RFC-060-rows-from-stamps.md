# RFC-060 — Rows from stamps: a subagent is visible because the harness saw it

*2026-09-19 · DESIGN ONLY. Nothing here is built; this is the argument and the shape.*

## The hole

Another agent — buAPI — put four subagents in flight, each rewriting a different documentation
file. Plain `Agent()` calls: no worktree, no branch, no run record, no sourced worklist. They ran,
they finished, they changed files. Nothing appeared anywhere. His question afterwards was the whole
RFC in one line:

> "Agents can still delegate without me seeing it, right?"

Yes. And the reason is structural, not accidental. `lanesShown`
(`src/organisms/AgentChat/AgentChat.js:4480`) builds the strip's rows from exactly two sources:

1. **standing run files** — `work.standingLanes`, the host's `laneRuns()` door, which returns run
   records whose `source` begins `lane:`;
2. **this session's live lists** — `work.state.todoLists`, filtered the same way.

Both are the same fact wearing two clothes: *a subagent is visible if and only if it declared
itself a lane by writing a lane-sourced worklist.* A cooperative subagent following the delegation
skill gets a row. Everything else is invisible, and invisible is the default, because the default
`Agent()` call writes no worklist at all.

That is an announcement mechanism. It is the exact thing this system has ruled against everywhere
else — `::branch` reads git instead of quoting an agent's report, lane cleanup verifies by the row
disappearing rather than by a message saying it cleaned up — and it survived here because lanes
were designed from the cooperative end first. RFC-059 built the lane row for the delegation skill.
This RFC re-bases it on what the harness sees.

## What is already true, verified on disk

The raw material for a row exists before anyone says anything.

- **Subagent events carry a parent stamp.** The host tags every event a subagent produces with the
  `tool_use` id of the `Agent` call that spawned it (`ev.parent`).
  `splitLaneEvents` (`src/organisms/AgentWorkbench/feedRows.js:73`) already buckets the feed by
  that id — one bucket per subagent, cooperative or not, holding its last `LANE_LOG_CAP` (300)
  events. The buckets for buAPI's four subagents existed in buAPI's session the whole time. Only
  nothing drew them.
- **The spawning brief is already captured.** The same pass keys each `tool.call` prompt by its
  `tool_use` id and attaches it to the matching bucket (`briefs`, lines 95–100). The panel already
  renders it behind *"the brief — what this lane was told"*. Nobody has to re-say what a lane was
  asked to do; the argument the owner actually passed is held.
- **The spawn is already in the ledger.** RFC-057's call ledger records it today —
  `~/.autobot/logs/calls-2026-09-19.jsonl` has `{"agent":"buapi","project":"buAPI","kind":"tool",
  "name":"Agent","ok":true,"ms":3}` for each of those four. So the harness not only *can* know, it
  already writes it down. What the ledger line lacks is identity and lifetime: no `tool_use` id, no
  brief, and `ms:3` is the dispatch, not the subagent's life.
- **The terminal event exists.** `tool.result` / `tool-end` carries the same id as its call
  (`IS_RESULT`, feedRows.js:31). The `Agent` call's result, in the owner's own feed, is the end of
  the subagent — ok or error, already in the vocabulary (RFC-048).
- **The run file's shape is known.** `~/.autobot/worklists/run-<id>.json` =
  `{owner:"run:<id>", source, session:"session:<project>:<id>", items, updatedAt}`. There is **no
  parent id in it** — which is why the current join between a row and its log is done by matching
  `lane.source === l.source` (AgentChat.js:6241), i.e. through the worklist again.

So: the harness has the stamp, the brief, the spawn, and the terminal. It has no record that
outlives the session, and the surface does not read the stamp at all.

## The principle this serves

**Surfaces read state; they never testify.** A row that exists because an agent wrote
`source: "lane:…"` is testimony — a well-behaved agent's courtesy. A row that exists because the
harness stamped an event is state. Delegation must not be the one place where being seen is
optional, because delegation is the one place where work happens out of his sight by construction.

## The one new piece: the spawn record

Everything else in this RFC is a read. This is the only write.

At the seam that already emits — the same `emit()` chokepoint RFC-057 writes the call ledger from,
in the shell — an `Agent` `tool.call` writes a small record, and the matching `tool.result` closes
it:

```
~/.autobot/worklists/spawn-<tool_use_id>.json
{
  "owner":   "spawn:toolu_01abc…",          // the tool_use id — the identity, and the join key
  "session": "session:buAPI:f2e1473d-…",     // same stamp run files carry; scopes the row to a room
  "agent":   "buapi",                        // who spawned it
  "type":    "general-purpose",              // input.subagent_type
  "title":   "rewrite the auth doc",         // input.description — the Agent tool requires it
  "brief":   "…the full prompt…",            // input.prompt, stored whole
  "startedAt": 1789853158815,
  "endedAt":   null,                         // set from the Agent call's tool.result
  "ok":        null,                         // true | false | null (never ended)
  "err":       ""
}
```

It lives beside the run files, in the same folder, read by the same door, because it is the same
kind of thing: a durable record of one execution. A run record says *a procedure was followed*; a
spawn record says *an execution was started*. `laneRuns()` returns both; the two are joined in the
renderer on `owner`.

Why not just widen the call-ledger line? Because the ledger is append-only statistics — it answers
"how much", it sweeps on a date, and it never mutates. A row needs identity and a terminal that
arrives minutes later. Those are different files with different lifetimes, written at the same
seam.

## 1. Does every spawn get a row?

**Yes. Every `Agent()` call writes a record and every record can be seen — but a row's *weight* is
decided after the fact, by what the harness observed, never before, and never by the agent.**

The temptation is a filter: only long spawns, only ones that write files, only ones with a
worktree. Every one of those is the announcement problem in new clothes — some property decides in
advance whether he is allowed to know, and the agent (which chooses its tools, its prompt, its
worktree) controls the property. A read-only search subagent is exactly what the sneaky case would
dress as.

The discriminator that is safe is **retrospective**, because it can only ever fold a row that has
already been visible:

- **While it is alive, every spawn is a full row.** No threshold, no exception. A three-second
  search subagent flashes a row for three seconds; that is correct, and it is also how he learns
  what the fast ones look like.
- **When it ends, a spawn that is `ok`, ran under a threshold (start at 90s — see the open edges),
  and left nothing standing — no run record, no branch by its name, no worktree — collapses into a
  grouped line**: `▸ 4 spawns · searches and reads · 3s–40s`. The group is one row, it is
  expandable, and its members are the full records. Nothing is deleted and nothing is hidden;
  a finished trivial spawn simply stops taking a row's worth of screen.
- **Everything else keeps its row**: still running, failed, never ended, or left debris. Those
  are the ones with consequences.

The property that makes this safe is that the test runs on the *record*, after the terminal, and
its inputs (duration, exit, what is on disk) are all things the harness measured. An agent cannot
make itself trivial except by actually being trivial, and even then the row existed while it ran.

## 2. What names a row with no worklist

Today a row's name is `source.slice(5)` — the branch (`LaneRow`, AgentChat.js:900). A stamp-born
row has no source and may have no branch, so the name has to come from the call.

**The title is `input.description`.** The `Agent` tool's own schema requires it — *"A short (3-5
word) description of the task"* — so it is present on every spawn including the careless ones, it
is already short enough for a row, and crucially it is **not addressed to the surface**: it is an
argument the model writes to invoke the tool, the same way `prompt` is. That is the difference
between a field and an announcement. If it is missing or empty, fall back to the first non-empty
line of the brief, cut to 48 characters at a word boundary with an ellipsis. Never invent one; a
row with neither shows the subagent type and its id-tail, which is ugly and true.

**The brief is not truncated anywhere except the row.** It is stored whole in the record and
rendered whole in the panel, behind the fold that already exists. The row is a glance; the panel
is the look. That split is already the design.

**There is no bar.** RFC-059's rule — *a real progress bar, a fraction, never a spinner* — means a
row without a run list must not draw one. Where the bar and `done/total` sit on a lane row, a
stamp-born row shows **elapsed time and the last tool it ran** (the same two facts the minimised
brief already shows for the owner's own session: what it last did). Both are read from its event
bucket. The absence of a bar is itself information: *this subagent is not driving a list.* The
moment it writes a sourced list, the bar appears — which is the enrichment below, and it is the
only honest way to earn a fraction.

## 3. Three sources, one row set — and the join key

**The join key is the spawning `tool_use` id.** The shape is the one that was expected: a spawn
record *creates* a row; a lane-sourced worklist *upgrades* one that already exists.

```
spawn record (owner: spawn:<tool_use_id>)      → the row exists, is named, has a brief and a state
  + event bucket (splitLaneEvents, key = parent = same id)   → its log, its last tool, live
  + run record (source: lane:<branch>, parent: <same id>)    → branch name, bar, git cleanup
```

Precedence within one row: **the run record wins on name and progress** (a lane that declared a
branch should read as its branch, not as its description), the spawn record wins on brief and
lifetime, and the event bucket is always the log. Nothing overwrites; each source fills what it
knows.

For the join to happen, **the run record must carry the spawning id**. That is the second host-side
change and it is one field: when a sourced `worklist set` arrives from a subagent, the host already
knows the parent stamp — it is stamping the accompanying events with it — so it writes `parent`
into the run file alongside `session`. This also retires the current join-by-source
(AgentChat.js:6241), which is a string match between two things that merely happen to agree.

Three reconciliation cases have to behave, and they do:

- **Old run records with no `parent`** (everything already on disk) fall back to today's
  source match, and if nothing matches they stand as their own row — exactly as now.
- **A run record whose spawn was never seen** — a lane spawned in a session that has since ended,
  whose spawn record aged out or was never written — is a row on its own. This is the standing-lane
  case and it must keep working untouched.
- **A spawn and a run must never both draw a row.** One row set, keyed by id, built in one pass;
  the map is the deduplication, the way `lanesShown` already builds one.

## 4. Dying before it writes anything

Today a subagent that dies immediately leaves nothing: no run file, no events, no bucket — a
`splitLaneEvents` test pins exactly this (*"a spawning call with no lane events leaves no phantom
lane"*, whiteboardFold.test.js). Died-in-place is this system's record-keeping rule, and a row that
never appeared cannot die in place.

**The fix is to write the record at the call, not at the first sign of life.** The spawn record is
written when the `Agent` `tool.call` is emitted — before the subagent has run a single tool — so
the row exists from the instant the owner presses the button, and everything after that is the row
changing state rather than the row coming into being. Three terminals, all read, none declared:

- **`ok: true`** — the `tool.result` came back clean. The row settles (and may collapse, §1).
- **`ok: false`** — the result carried an error. The row stays, red, with the error text where the
  active step would be. Where it died is the most useful thing it can say, so the last event in its
  bucket rides the row: `died at: Bash — yarn test`. If the bucket is empty, it says so:
  `died before its first step`.
- **`ok: null`** — no terminal ever arrived: the shell restarted, the owner's session was killed
  mid-turn, the machine slept. This is not "running forever". The renderer can distinguish them,
  because whether the owning session is alive is readable state
  (`window.systemview.agent.sessions()`, `src/utils/hostAgent.js`): session live and no terminal
  → **running**; session gone and no terminal → **orphaned — no result recorded**. That second
  state is the one the system has never had, and it is the honest name for it.

Note what this does *not* change: `splitLaneEvents` stays a log router. No events, no log — its
test stays true. The row comes from the record; the log comes from the events. Keeping those two
derivations separate is what lets a row exist for a subagent that produced nothing at all.

## 5. Rows for subagents in other agents' rooms

**Out of scope here, deliberately — and this RFC pays the one field that keeps the door open.**

The case that started this was a peer's: buAPI's four subagents, seen from another room. So the
temptation to build the fleet view here is real, and it should still be resisted, for two reasons.

First, this RFC already closes the reported hole *where the hole is*. Rows are project-scoped
through the `session:<project>:<id>` stamp, so buAPI's spawns surface in buAPI's room — which is
where a delegation by buAPI belongs, and which today shows nothing at all. "I can see it when I
open his room" is a different complaint from "he can delegate and I never find out", and only the
second one is a hole in the mechanism.

Second, a single view of everything running is a *surface* question, not a data question — where
does it live, the rail, a tab, a panel; what does it do when there are thirty rows; what does
pressing one do when it belongs to a session you are not attached to. None of that is forced by
the problem at hand, and answering it inside this RFC would settle it by accident.

What this RFC does owe the fleet view is that the data not be shaped against it. The spawn record
is **host-wide** (one folder, `~/.autobot/worklists/`, not per project) and carries **`agent` and
`session`** even though the chat filters both away. That makes the eventual "everything running"
view a query over a directory rather than a new mechanism — one `readdir`, group by agent. One
field now instead of a migration later.

## 6. What must not change

RFC-059 slice 2 was fought for and it holds, in the stronger form:

- **A row is born from a spawn and dies at the user's cleanup.** Nothing in between kills it — not
  a refresh, not the session ending, not the subagent dying, not the owner forgetting. The only
  change is that "spawn" now means the `Agent` call itself rather than the first worklist write,
  so rows are born *earlier* and the window in which delegation is invisible closes to zero.
- **Rows are fed by standing files with live events as overlay.** Keep that exactly: the record on
  disk owns the row's existence; the event bucket owns its freshness. A view attaching late sees
  every row and the logs it missed read *"no log held — the lane ran before this view attached"*,
  which is already the honest message.
- **The delete stays the user's, two-step, reading git first.** And it already degrades correctly
  for a row with no branch: `armDelete` reads `worktrees()` and `branchState()`, finds neither,
  and the existing copy says *"no branch left — delete the lane's record?"* No new confirm wording
  is needed. What does need care: `LaneRow` derives `branch` from `source.slice(5)`, so a
  source-less row must skip the branch read and the `::branch` block in the panel rather than look
  up a branch named after a truncated prompt.
- **`clearedLists` keeps working.** It is what stops a deleted row from being resurrected by the
  session's own event echo, and a stamp-born row has the same echo problem.
- **The bar never lies.** No run list, no bar (§2).

## Nesting

A lane that spawns its own subagent produces a record whose parent is the lane's call, not the
owner's. **The strip stays flat and one level deep**: only spawns made by the attached session get
a row, because the strip is the owner's delegation. A grandchild appears inside its parent's panel,
where its parent's log already is, and the parent's row carries the count (`2 of its own`) so that
nothing is concealed — only relocated to the place where it makes sense. The record's `owner` and
the parent id it carries make this a filter, not new machinery.

## Retention

Spawn records need a sweep or a busy week leaves thousands. It follows the rule runs already have,
with one addition:

- **Never swept while `ok: false` or `ok: null`** — same as a died run. Failed and orphaned records
  are the ones someone may still need to act on.
- **`ok: true` with debris** (a branch or worktree by its name still on disk, or a linked run
  record): swept at two weeks, like a closed run.
- **`ok: true`, collapsed, no debris**: swept at 24 hours. These are the search subagents; their
  value is same-day.

## The pieces

| piece | repo | status |
|---|---|---|
| `parent` stamped on subagent events | autobot | landed (RFC-059) |
| brief captured from the spawning call | systemview | landed (`splitLaneEvents`) |
| `Agent` spawns in the call ledger | autobot | landed (RFC-057) |
| spawn record written at `tool.call`, closed at `tool.result` | autobot | this RFC |
| `parent` written into sourced run records | autobot | this RFC |
| `laneRuns()` returns spawn records too | autobot | this RFC |
| row set joined on the spawn id; `LaneRow` tolerates no-branch | systemview | this RFC |
| retrospective collapse + the group row | systemview | this RFC |
| orphaned state from live-session lookup | systemview | this RFC |

## What this RFC does not settle

Flagging these is cheaper than pretending:

- **The 90-second collapse threshold is a guess.** It should be set after watching one real day of
  spawns, and it may want to be "collapse when the row has been settled for N seconds" instead of
  a duration test — that version has the nicer property of never collapsing anything he is looking
  at. Not decided.
- **Whether a subagent is *editing* files is not in the design.** "Left nothing standing" is
  currently branch/worktree/run — a read-only searcher and a subagent that rewrote four docs with
  no branch both look trivial to that test, and buAPI's four were the second kind. The call ledger
  records `Edit` and `Write` per session but the records are not currently attributable to a
  subagent. If they can be, "wrote to disk" belongs in the test and probably outranks duration.
  Unresolved, and it is the weakest part of §1.
- **What a row does when its session is not attached.** The record exists host-wide; pressing a row
  belonging to a dead session has no defined behaviour beyond showing the record.
- **Whether the collapse group is per-turn, per-session or per-day.** Grouping "4 spawns" needs a
  boundary and no argument here picks one.
- **Cost of the folder at scale** — `~/.autobot/worklists/` gaining a file per `Agent()` call, read
  by a door that currently returns a handful of runs. The sweep is designed for it; the read is not
  measured.
- **Whether the ledger line and the spawn record should converge later.** They are kept separate
  here on a lifetime argument, which is sound, but two writers at one seam recording the same event
  is a thing to revisit rather than a thing to be pleased about.
