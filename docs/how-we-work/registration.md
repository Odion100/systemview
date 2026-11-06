# Registration — a document says what it is, and the system hears it

A document is an RFC, an arc, a report or a gap because it **says so at the top** — never because
of the folder it sits in. The saying is one leaf, the system's parse hears it, and from that moment
the document has an identity anything can point at and a state anything can read. (RFC-073 is the
design; this chapter is the part every agent needs.)

## The four leaves

One line at the top of the document, after the title and lead, beside `::members`:

```markdown
::rfc{id=RFC-073 arc=ARC-004}
::arc{id=ARC-004 owner=systemview-test title="Arcs become trackable"}
::report{id=subscribe-and-registration}
::gap{id=G-12}
```

- **`id` is the identity.** The number travels; the kebab title after it is cosmetic. A moved or
  renamed file updates the registry row — it is never a second document.
- **`arc=` on an RFC** is the one relationship the registry holds: *"what is being built for this
  arc"* becomes a read, not a grep.
- **A file in `RFCs/` with no leaf is a file**, not an RFC. A design in `docs/designs/` carrying
  `::rfc` is an RFC wherever it lives.
- In the window: right-click → **Register this document** picks the leaf and fills the id from the
  filename. No typing a block by hand.

## How a document registers

Write the leaf and save — that is all. Every write that the harness can see (an agent's Edit/Write
or Bash, his save in the window through `files:write`) causes one parse; a registration leaf at the
top upserts `{ id, kind, path, project }` into `~/.autobot/documents.json`. A report filed through
`show()` gets its `::report` leaf written for it — no skill has to remember.

The registry is a **lookup, never an authority**: delete the file and it rebuilds from the
documents. Beside identity each row carries a derived `state` (done-ness, verdict, objective
counts, approvals waiting, `parsed`) — what the last parse saw, at that time, never read as truth.

## What done means, per kind

Declared in one place (autobot `electron/markdown/blocks.cjs`), read off the document:

| kind | done when | stays listed after done |
|---|---|---|
| `rfc` | `verdict=` lands on its approval (built at its `## STATUS`) | ~30 days |
| `arc` | every `::objective` is `state=done` | ~30 days |
| `gap` | its leaf carries `resolved=` | ~14 days |
| `report` | never — a view only gets old | ~7 days |

After the window a sweep writes `retired` on the leaf and the document leaves the lists; the file
goes later (a report is deleted; an RFC or arc is his to delete).

## A gap is written into the OTHER project's repo

A bug, or a missing feature, found in another project while doing work that needed it: write a
document INTO THAT PROJECT'S repo carrying `::gap{id=…}` — one line of body is enough. It is a
message from outside, filed where the fix lives, for that project's owner to pick up. It is done
when its leaf says `resolved=`. A gap is **not** a board card — the board is the owner's own notes.

## Fires — who hears a decision, and the receipt

A registered document's blocks announce themselves: a block with an **answer** (`verdict=` on an
approval, `answer=` on a question, `state=done` on an objective, a claim's mark, a gap's
`resolved=`), an **audience**, and no **`told=`** covering that audience has fired. The harness
delivers one `document.updated` per fire — carrying the project, path, kind, id, the block's line
and its one-line summary — and stamps `told=` on the block's own line for exactly who was reached.

The audience ladder: the block's own `subscribe=` (may name a non-member) → the enclosing thread's
`subscribe=` (a reply ALWAYS takes the thread's; legacy `members=` on a thread still answers) → the
document's `::members{who=}`. No audience anywhere → no fire, no error.

`told=` is the only baseline: covered means silence forever; hand-edit it off and the block
delivers again; a fire nobody was running for is delivered by the next session's start sweep.

Result blocks (`::commit`, `:::cmd`, `::run`, `::test`, `::branch`) write nothing into the
document — `subscribe=` on them routes the completion event the chat already shows.

## A commit says what it served, and the document says it back

Agents commit their own work. The thing that makes that safe to allow is not review and not a
branch somebody can inspect — it is that **every commit is traceable to the decision it came
from, by a machine, without asking the agent that wrote it.**

So a commit carries a git trailer naming what it served, on its own line at the end of the
message:

```
Serves: ARC-004-O2
```

The value is a **registration id** — the id off the document's own leaf. An objective
(`ARC-004-O2`), a plan (`RFC-073`), a gap (`G-12`), a report (its title). Never a path: a
registration id is globally unique and survives the rename that breaks every path to a document.

**One id per line, and repeat the trailer** for work that served several. The value is the whole
line because a report's id is its TITLE, so it carries spaces and commas — a parser splitting on
either would shred exactly the ids this reaches for.

**Only the final trailer block counts**, which is git's own rule and worth following exactly. A
parser scanning the whole message would read `Serves:` out of a commit *quoting* the convention
and attribute work to a document nobody touched.

**IT NAMES WHAT THE WORK SERVES, NOT THE RUN YOU ARE INSIDE.** This is the one that is easy to get
wrong and invisible when you do, because the two are the same thing often enough to stop feeling
like a choice. Measured on the convention's first real evening: eight commits doing board work
carried `Serves:` naming the open assignment's report instead, because that was the document in
hand when each was written. Every trailer was present, every one parsed, and both ends disagreed —
which the checker found and no reader would have.

Ask what the work was FOR, not what you were doing when you did it. An assignment, a lane, a chore
round are all containers; the thing served is the objective, the plan, the gap, or the report the
work actually answers.

**The document says it back** with a `::commit{sha=…}` block. That is the other direction, and
both are needed: the trailer answers *what did this commit serve*, the block answers *what built
this*. Either alone is a claim nobody can check.

**A commit in ANOTHER REPO needs `project=` on the block** — `::commit{sha=506c727 project=<projectCode>}`,
the project CODE as `projects.json` keeps it. A record with no project resolves against the chat's or
document's own repo, finds nothing, and renders *no such commit* — which reads as a lie about work
that really happened rather than as a missing attribute. Work here is routinely two repos, so this is
the common case and not the exotic one.

**`commitLinks({projectCode})` checks the two against each other** and reports only disagreement,
in four kinds because each needs a different fix:

| | |
|---|---|
| `oneWay` | the commit names the document, the document does not carry the sha — add the `::commit` block |
| `dangling` | it serves an id nothing registered — a typo, or a document that never registered |
| `unclaimed` | the document names a sha whose commit points elsewhere — the wrong sha was pasted |
| `unlinked` | the commit served nothing. Honest for a typo fix; a hole for a slice |

Only the first three break agreement. **Run it on your own work before reporting it done** — a
run that says it finished and leaves the record one-way has handed over something nobody else can
verify.

A commit older than the window being read is never a finding: absence of evidence is not a broken
link, and reporting it as one would make every audit noisier the further back a document reaches.
