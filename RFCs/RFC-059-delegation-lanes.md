# RFC-059 — Delegation lanes: the chat's instrument strip

*2026-09-17 · settled in conversation; this is the shape being built.*

## The experience being designed

The user tells a project's agent: *"here are three features — delegate."* The owner slices lanes,
spawns subagents — one per lane, each on its own worktree and branch — and the user **watches the
lanes from the chat** while they run, then lands each one from the same place when it finishes.

The chat's bottom strip is already the session's instrument panel: the worklist (the agent's plan),
the whiteboard (the conversation's held state). This RFC adds the third instrument: **lane rows** —
one row per live subagent lane.

## What a lane row is

A compact row in the strip, drawn from data that already exists:

- **the agent icon** — same mark the app uses for agents everywhere
- **the lane's name** — from its worklist source (see conventions)
- **a real progress bar** — `done/total` from the lane's own run list; a fraction, never a spinner
- **state** — running / done / failed, from the owner's Agent-task rows in the same feed
- **on completion: the `::branch` chip** — the row's tail becomes the review; pressing it renders
  the branch block (live diff, switch, land) right there

The strip IS the delegation UX: three bars crawl, three chips appear, the user presses each.

## Why the data is already there

1. **Run-owned worklists (10e6d41).** A `worklist set` carrying a `source` writes to that
   execution's own `run:<id>` file and emits `todo.updated {source, run}` on the session stream.
   Subagents share the session's in-process MCP servers, so a lane's writes flow through the same
   door: each lane's list is its own run, resumable by source, closed by all-done (`run.finished`).
2. **The feed already stacks lists** (a0c7371): `todoLists` keeps one entry per session/run key.
   Lane rows are a *presentation* of entries whose source says lane — not a new data path.
3. **Agent-task state** already renders as tool rows in the feed; a lane row joins its run list
   with its task row's state.

The one load-bearing assumption to verify before building on it: **a spawned subagent's sourced
`worklist set` really lands as its own run** (file + event). Verified live as part of this work.

## Conventions (the delegation skill carries these)

- A lane's worklist source is `lane:<branch>` — e.g. `lane:refine/auth-hardening`. The suffix IS
  the branch name, which is what lets the finished row offer `::branch[<branch>]` with no lookup.
- A lane marks every item done when its branch is ready — that closes the run (`run.finished`),
  which is what drives the bar to completion. A lane that dies mid-list leaves the record where
  it stopped, visible in the row.
- One lane = one worktree + one branch. The owner reviews before the user sees; landing is the
  user's, through the chip.

## What this RFC does not build

- **Steering a lane directly** — v1 routes through the owner ("tell the auth lane…"), chosen
  deliberately, revisit after the first real delegation.
- **Nav opening a worktree / lane transcripts** — mid-flight, a lane is its row; the report is
  the deliverable. Build these only if the first real use hurts without them.

## The pieces

| piece | repo | status |
|---|---|---|
| run-owned lists, run events | autobot | landed (10e6d41) |
| stacked lists in the feed | systemview | landed (a0c7371) |
| verify subagent→run assumption | — | this work |
| lane rows in the strip | systemview | this work |
| lane conventions in the delegation skill | skills | this work |
