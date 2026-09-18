# Worklists, runs, lanes and the whiteboard — how work is tracked and delegated

Every session carries three harness tools: `mcp__worklist__set` (write a plan), `mcp__worklist__get`
(read it all back), `mcp__worklist__whiteboard` (the board beside it). They are state, not prose — a
plan written as chat is forgotten by the next turn; a plan written with the tool outlives the turn,
survives compaction and restarts, and renders live under your bot in the chat. Everything here is
one store: one JSON file per owner in `~/.autobot/worklists/`, and the file is the truth.
Siblings: [AGENTS.md](AGENTS.md) (§5.5 is the short form), [chat.md](chat.md).

## The session plan — your own list

`set` with no `source` writes the session's own plan, owned by `session:<key>`. Send the **whole
list every call** — there are no deltas, so anything watching can render from one event. The tool
enforces **one active item** (extras demote to pending, first wins); states are `pending` · `active`
· `done`, and done rows render struck through. The user reads the active item's text as "what it's
doing right now", closed to one line (`3/7` and the step) or open as the whole list. Update it AS
you work — a list rewritten after the fact is a summary in a checklist costume, and he can tell,
because he watches it move. After a compaction, `get` restores the plan, the open run's list, and
the whiteboard in one call.

## A source opens a run — chosen versus followed

`set` **with** a `source` does not touch the session plan: it opens a **run** — a separate list
owned by that execution, in its own `run:<id>` file. The source says where the steps came from:
`skill:<name>` when following a skill, `job:<id>` for a job, `lane:<branch>` for a delegated lane,
or any namespace you make up on purpose (an unknown skill/job name gets one ignorable reminder
line, never an error). This is the only record that a procedure was **followed** and not merely
chosen: the Skill tool can say a skill fired, but nothing else says it got past step 2. The same
source continues the open run — after a harness restart mid-run, the newest unfinished run with
that source and session is still THE run, resumed instead of minting a corpse that reads as
died-at-step-3.

## The life of a run

Completion is **observed, never declared**: the write that marks every item done is what closes the
run — there is no state flag to lie with. A run that stops mid-list stays exactly where it stopped:
**died-in-place is the record**, and where a procedure died is the single most useful thing it can
tell anyone. Never tidy a dying list. Retention follows the same logic — a closed run older than
two weeks sweeps itself at process start; a died run is **never** swept, it stays until someone
acts on it. The run's edges are events: `run.started` and `run.finished` fire into the session and
are hookable, and every `todo.updated` from a sourced write carries its run id.

## Lanes — delegated work with a row on the screen

A **lane** is how work is handed to a subagent without the conversation stopping: one lane = one
git worktree + one branch + one run. The convention that ties them together is the source —
`lane:<branch>`, where **the suffix IS the branch name** (e.g. `lane:refine/auth-hardening`). The
lane agent works only in its worktree, drives its own run list, and commits on its branch; the
owner who spawned it reviews the branch before the user sees it, and delivery is a `::branch`
block. The full procedure is the **delegation** skill.

In the chat, each lane is a **row** in the same strip as the worklist and whiteboard: 🤖 icon, the
branch name, a **real** progress bar (the fraction of its run list done — never a spinner), the
count, and the step it is on. The whole row is the door — click anywhere to open the lane's panel.
Rows read the run **files** (`laneRuns`, project-scoped by the run's `session:<project>:<id>`
stamp), not session events, so a refresh cannot eat a row whose record is still on disk: standing
rows survive until the user deletes them. **The lane drives its bar to completion** — marking every
item done is what closes the run and fills the bar; a lane that finishes its work but not its list
looks dead at 4/5 forever.

## The lane panel — log, review, leftovers

The panel is the window into one lane, closed with ×. Three parts:

- **The header** says the truth of the run: `3/5` mid-flight, `run closed · 5/5`, or
  `died at: <the step it died on>`.
- **The review** is a live `::branch` block for the lane's branch — commits listed, diff on hand,
  and the landing menu: **land onto** the current branch, **switch to it** for a walk (two-step,
  and `git switch` refusing over dirty files is shown, never stashed around), **fast-forward** the
  base from on the branch, or **bring over as changes** — the review-first accept, where the work
  arrives uncommitted and the user's own commit is the acceptance.
- **The log** is what the lane actually ran. A subagent's messages carry `parent_tool_use_id`, so
  its events are stamped with the lane they belong to and route here instead of flooding the
  owner's feed.
- **The leftovers row** is the janitor's view: worktree still on disk or not, branch merged into
  its base or not, so what a lane left behind is never a surprise.

## Cleaning up a lane — the delete is the user's

A lane row is born from a spawn and dies only at cleanup; nothing in between kills it. The 🗑 on
the row is a **two-step confirm that reads git first**: it looks up whether the branch is merged
and whether the worktree survives, and says what the delete would destroy to the user's face —
`branch not merged — real work dies with it. Delete anyway?` is the honesty. Yes removes the
worktree, the branch (`-d` when merged, `-D` only after the warning said "not merged" out loud) and
the run record; the row disappearing is the verification. **This press is the user's, never an
agent tidying quietly.** An agent's part of cleanup is the delegation skill's: after a branch
lands, remove the worktree and delete the branch it created — and if review finds a problem,
message the lane rather than respawn it; the same source reopens its run, so the bar resumes
instead of resetting.

## The whiteboard — the conversation's state

The board is the worklist's sibling: same file, same lifetimes, different job. The **list is the
state of the work; the board is the state of the conversation** — drafts under discussion, values
being worked out, open threads that would otherwise float up the chat and have to be re-said.
`mcp__worklist__whiteboard` takes the **whole board** as markdown and replaces what was there;
sending nothing (or empty) wipes it. It renders live for the user in the same strip, folded under
its own header. Each write patches its own half of the shared file — a `set` never clobbers the
board, a board write never touches the list. **The wipe is mutual**: the user can erase the board
at any time, and no notification fires — anyone finds out a whiteboard got erased the way it was
meant to be read: by looking at it. Worklist items are tasks; the board is prose; long artifacts
belong in files, not here.
