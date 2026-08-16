# RFC-033 — Commit from the document

*Status: APPROVED (his `verdict=approved` on the TV plan, 2026-08-16). Not started — standing by
for the signal to build.*

## Motivation

A commit message in a report is a line to copy into a terminal. Make it a button instead. His words:
*"I want to be able to make a commit and I wanted to even be able to push… you throw in the commit
message but I could easily just click it to commit."*

Where it belongs is judgment, like the message itself. Nothing here is a rule about that.

The panel already stages (RFC-026 follow-on, shipped 2026-08-16: the version-control lens,
`Plugin.stageFiles`, row menus). Commit is the next verb, and the interesting part is WHERE it
lives: in the markdown, so the report that describes the work is also the thing that commits it.

## The inversion worth stating

He has never let an agent commit, and this does not change that — it inverts it. `::commit` is a
**control for him**, not a verb for an agent:

- An agent can WRITE `::commit{message="…"}` into a document. It cannot press it.
- No `systemview commit` / `systemview push` CLI verb. No agent-callable method that commits or
  pushes. The plugin's write surface stays `stageFiles` (add / restore --staged) plus a
  **read-only** `gitState()`.
- Push is outward-facing and hard to walk back: same rule, his click, never automatic.

If that rule ever gets relaxed it is his call, said explicitly — not something the implementation
drifts into.

## Decisions taken on the TV (2026-08-16)

| Question | Answer |
|---|---|
| Confirm step on Commit? | **Two-step: click arms it, click again commits** — his answer, same shape as the danger items in the row menus. |
| Commit only what's staged, or stage-then-commit? | *Unanswered — proceeding with **only what's staged**.* Staging is already his, one click away in the lens; a block that quietly stages is a block that commits something he didn't look at. Revisit on his word. |
| Where does Push live? | *Unanswered — proceeding with **same block, second button, appears only when the branch is ahead**.* Revisit on his word. |

## The block

```markdown
::commit{message="feat(nav): version-control lens"}
```

Renders: the message (editable in place — it is his commit), the files **staged right now** read
live rather than whatever was staged when the report was written, the branch, and the ahead count.
Two-step Commit button. Push appears beside it once ahead.

After it runs, the block writes its result back into the markdown — the same mechanic `::question`
(`answer=`) and `:::approval` (`verdict=`) already use:

```markdown
::commit{message="feat(nav): version-control lens" sha=a4f81c2 ts=1786883000000}
```

The report becomes the receipt for the commit it caused. A week later the same line still says
which commit this work turned into.

**Dead when it should be dead:** nothing staged → the button is disabled and says so. A stale
report cannot commit an empty tree, and cannot commit a tree that has moved on since.

## The panel

The version-control lens grows a commit box at its top: message field, two-step **Commit**, and
**Push** carrying the ahead count. Same behaviour as the block, in the place he already stages from.

## Plugin surface

| Method | Kind | Notes |
|---|---|---|
| `gitState()` | read | branch, upstream, ahead, behind, whether a remote exists. Feeds the block and the panel. |
| `commit({ message })` | write, human-triggered | `git commit -m` on what is staged. Refuses an empty index and an empty message. Returns the new sha + fresh `changedFiles()`. |
| `push()` | write, human-triggered | current branch to its upstream. Refuses with no upstream rather than inventing one. Returns fresh `gitState()`. |

None of the three are reachable from the CLI. `commit` and `push` exist to serve a click.

## Open, deliberately

- No amend, no force, no branch switching, no discard. If those ever arrive they arrive named,
  in their own RFC, with his say-so.
- Commit body/multi-line message: message field is single-line to start.

## Verification plan

Same as the staging work: a throwaway git repo in the scratchpad — **never his index, never his
history**. Cases: commit with a staged tree, commit with an empty index (refused), empty message
(refused), push with no upstream (refused), push with an upstream (against a local bare repo, not
a real remote), sha written back into the document.
