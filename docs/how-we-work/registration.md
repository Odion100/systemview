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
