# How we work

The METHOD, not any one project's facts. Every repo a system holds plans, builds, reviews and
records work the same way, and until this corpus existed that method was tribal: carried in one
agent's session, re-derived by the next, or written into a project handbook where the other repos
could not find it.

**This corpus is cross-project on purpose.** A project handbook answers *how does THIS codebase
work*. This one answers *how does work get done here* — and the answer must be one copy, because
the alternative is a handbook per repo, drifting into a method per repo.

It lives in the systemview repo because a folder needs a tracked home and that is the repo owning
the context stack. It is not a SystemView document.

## Chapters

| | |
|---|---|
| `rfcs.md` | An RFC — what makes one, the lifecycle, and the claims list that makes it checkable |
| `claims.md` | A claim, its mark, and the proof it owes — the largest chapter here |
| `registration.md` | The four leaves, what makes a document registered, fires, and the commit convention |
| `reports.md` | A report goes away — which kind to file, what each owes, and why its window is that length |
| `second-opinion.md` | When a blind pass is owed, and the question only an outsider can ask |
| `intent.md` | The why an agent can act on — standing and operational, and why they are not interchangeable |
| `code.md` | The code those documents describe — does it cross a wire, and call it through the client |

Still nominated and unwritten: **jobs and chores**, and **lanes/runs** — which lives in
`autobot-docs` today and belongs here.

## How these chapters are written

**Name a project, never point into one.** His rule, 2026-11-09: *"you can learn from them, you can
use their name, you can mention them, but you can't point to them."* This corpus is the method every
repo shares, and it is read by agents working in trees that do not contain the file you were looking
at. A path into one project is an address that resolves for its author and nobody else — and the
reader who follows it and finds nothing concludes the chapter is stale rather than that it was never
theirs to open.

So: teach the SHAPE. `<service>/specs/tests/<Module>.<method>.json` travels; one repo's
`Profiles/specs/tests/Users.signIn.json` does not. Where a real case earns its place as evidence,
say what was measured and name the project in prose — the measurement is the point, not the
coordinates.

**And a fact about one codebase does not belong here at all.** It goes in that project's own
handbook; this corpus holds what is true after the repo it came from is gone.

## When this disagrees with something else

**Documentation, test and functionality adapt to each other.** So there is no ranking, and a
disagreement between them is never settled by asking which one outranks which. There are three
things, any of them can be the one that is wrong, and the only question is **which side moves.**

Ask whether anybody DECIDED:

- **Somebody chose differently** and the writing was never brought along — the documentation and
  the test move. This is most disagreements.
- **Nobody decided anything** and the code quietly stopped doing what was agreed — the test is
  authoritative and the FUNCTIONALITY moves.

A failing test is that same fork and nothing more: you fix the test, or you fix the code, or you fix
the documentation, depending on which of the three stopped telling the truth.

**Which is why an RFC is not history and is not fragile.** It is a spec — a contract somebody
pressed — and a spec is edited when the thing it specifies changes. Treating one as an argument too
settled to touch leaves the system's own record saying something nobody believes, which is the
failure this whole corpus exists to prevent.

If you find this corpus describing a procedure nobody follows any more, that is a bug in here — fix
the file and re-index it.
