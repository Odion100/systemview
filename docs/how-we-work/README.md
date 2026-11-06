# How we work

The METHOD, not any one project's facts. Every repo a system holds plans, builds, reviews and
records work the same way, and until this corpus existed that method was tribal: carried in one
agent's session, re-derived by the next, or written into a project handbook where the other repos
could not find it.

**This corpus is cross-project on purpose.** A project handbook answers *how does THIS codebase
work*. This one answers *how does work get done here* — and the answer must be one copy, because
the alternative is a handbook per repo, drifting into a method per repo.

**So it names no projects.** Which repos exist is whoever's system this is, and a method that
enumerates them is a method that fits one installation — so a passage needing a project says
`<projectCode>`. The exception is MECHANISM: where the method genuinely runs on a named thing, the
name is the fact rather than an example.

It lives in the systemview repo because a folder needs a tracked home and that is the repo owning
the context stack. It is not a SystemView document.

## Chapters

| | |
|---|---|
| `rfcs.md` | An RFC — what makes one, the lifecycle, and the claims list that makes it checkable |

Three more are nominated and unwritten: the report format, jobs and chores, and lanes/runs — which
lives in a project handbook today and belongs here.

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
