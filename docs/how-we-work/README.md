# How we work

The METHOD, not any one project's facts. Every repo in this system — systemview, autobot, blink,
buAPI, BUStudio — plans, builds, reviews and records work the same way, and until this corpus
existed that method was tribal: carried in one agent's session, re-derived by the next, or written
into a project handbook where the other repos could not find it.

**This corpus is cross-project on purpose.** A project handbook (`systemview-docs`, `autobot-docs`)
answers *how does THIS codebase work*. This one answers *how does work get done here* — and the
answer must be one copy, because the alternative is five handbooks drifting into five methods.

It lives in the systemview repo for the same reason the `jev` corpus does: a folder needs a tracked
home, and this is the repo that owns the context stack. It is not a SystemView document. Nothing in
here should mention a SystemView internal unless the method genuinely runs on one.

## Chapters

| | |
|---|---|
| `rfcs.md` | An RFC — what makes one, the lifecycle, and the claims list that makes it checkable |

Three more are nominated and unwritten: the report format, jobs and chores, and lanes/runs (which
exists today in `autobot-docs` and belongs here).

## When this disagrees with something else

**The code wins, then the project handbook, then this, then an RFC.** An RFC is an argument at a
point in time; this is the method as practised now. If you find this corpus describing a procedure
nobody follows any more, that is a bug in here — fix the file and re-index it.
