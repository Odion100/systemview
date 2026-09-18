# The context system — the store, the corpora, and the pipeline between them

What this system knows lives in two places: **the store** (notes — small markdown files under
`~/.autobot/context/`, embedded so they can be searched) and **the corpora** (documentation —
folders of markdown, chunked by heading and embedded the same way). One tool reads both; a closed
pipeline moves knowledge from the first into the second. This page is for both readers — the human
at the window, whose surface edits notes and creates permanent corpora, and agents, who write
notes, run the searches, and keep both shelves clean. Siblings: [AGENTS.md](AGENTS.md) (the map),
[markdown.md](markdown.md) (the vocabulary docs render in).

---

## The two shelves — notes are info, corpora are crystallized knowledge

A **note** is *info*: fresh, cheap, written the moment something is learned — a gotcha, a
correction, a convention a grep had to prove. The bar is "would this help anyone this month";
nothing noted is a commitment. A **corpus chunk** is *crystallized knowledge*: a section of a real
document, distilled downstream when maintenance folds note-clusters into a handbook and retires
them. The truth conditions differ — a note is true because someone learned it; a chunk is true only
while its file has not changed — so results are labelled, never blended. Markdown is the truth on
both shelves; the vectors are derived and rebuildable, which is why an edit is always an edit to a
file, never to an embedding.

## Writing — `remember`, one concept per note

`remember(text)` is one motion: near-duplicate check, markdown write, embed. One concept per note,
with a `pointer` at the file, command, or report that proves it. If the response says a similar
note exists, update that one — `supersedes: <id>` replaces it — instead of piling on
near-duplicates. Scope says who it is for, and the session's identity is stamped by the harness,
never claimed:

| Scope | What belongs there |
| --- | --- |
| `system` | harness and SystemView conventions — every agent, forever |
| `project:<code>` | one repo's architecture and facts |
| `agent:<slot>` | lessons for whoever holds the slot next — survives re-clones |

What does NOT go in: behavioral moments, situational conclusions, anything a thinking agent
re-derives on the spot — and state. *Where* things are and *what the code says right now* is
re-read, never recalled; a note about it describes a dead world by the next commit. A search that
ends in a **convention** gets noted; a search that ends in a location does not.

## Reading — `context()`, one door, both shelves

About to derive how something works — from the code, a library's internals, or by experiment —
one `context("<the question>")` first. It answers from both shelves in one reply, **ranked
separately**: notes come with scope and id (`[note-id]` — what `remember(id=)` and `forget()`
take), documentation lines come with corpus, heading path, and their own match score, and say
STALE out loud when the file has changed since indexing. The rankings are not merged on purpose: a
one-line correction must never lose to the three paragraphs it corrects.

An empty answer means nothing matched *that phrasing* — try another angle, then proceed; the empty
answer licenses the search, and what the search finds gets `remember()`ed. "Store unavailable" is
an error, not an empty answer. Narrowing (`kind: "notes" | "docs"`, `scope`, `corpus`, `source`)
exists for curation, not for everyday asking: **broad to learn, narrow to curate** — `kind:
"notes"` when weeding the store, so a doc chunk is never mistaken for a duplicate note.

## Curating — `list`, edit in place, `forget`

The store only stays true because someone weeds it, and search cannot find the note you forgot you
wrote — it only returns what matches a question you thought to ask. `list({ order: "stale" })` can:
no question, oldest and least-read first, each line carrying age, read count, and last read. Old
and unread is a shortlist, never a verdict — read the note, then decide:

- **True but imprecise** → `remember(id=…)` edits it in place; the file is rewritten, the
  embedding re-derived, they never disagree.
- **Restates an existing note** → write once with `supersedes` — the old record leaves the index.
- **Describes a dead world** → `forget(id)`. Gone means gone.
- **A doc chunk now answers it** → `forget(id)` — the documentation absorbed it, and two copies
  drift. A chunk id (`corpus:path#n`) is not a note id: a chunk cannot be forgotten, only its
  source file fixed and re-indexed.
- **Several notes circling one subject** → nominate it (below); curation is not the moment to
  start authoring.

A line reading "none since tracking began, earlier unknown" is missing evidence, not neglect —
usage tracking is younger than some notes.

## The corpus lifecycle — create, write, plan, index, drop

A corpus is a folder of markdown; editing the files and maintaining the corpus are the same act.

1. **Create** — `docsIndex(name, root, glob)` with a NEW name and a `root` births one. Agents
   create `working` corpora: private research, never surfacing in anyone else's search unless
   named, theirs to drop. **Permanent corpora are the human's**, created from the context surface
   — an agent can neither mint one nor repoint one.
2. **Write** the files — one subject per heading, headings that name the real thing, never
   numbered, each section self-contained. Retrieval hands out a chunk, not a page, so the
   structure is part of the doc's correctness.
3. **`docsPlan`** — the dry run: every chunk the corpus would produce, with heading path and
   size, nothing embedded. Read the cuts; a subject split across two chunks, or two sharing one,
   is a structure bug in the doc.
4. **`docsIndex(name)`** — and **indexing publishes**: a wrong document that is indexed answers
   confidently, so plan and read first. Re-indexing is by file hash — unchanged files cost
   nothing. `docsList` shows every corpus and how many chunks have drifted from disk.
5. **`docsDrop`** — retires what was embedded, never the files. Working corpora are their maker's
   to drop; a permanent one is the human's call.

(The context server also carries the hooks tools — `hooksList` / `hooksWrite` / `hooksDrop`, the
context layer that fires on a moment instead of a question. A written hook is inert until the
human carries it on an agent.)

## Nominations — the closed pipeline from notes to handbook

**A note in the store about a documented topic is a bug report against the doc.** Somebody hit a
wall, found nothing, and wrote the answer into memory instead — so the store is a gap list, never
paste material. The pipeline that closes the loop:

1. **Notes accumulate** — `remember()` feeds it; every note is the corpora's raw material.
2. **Curation nominates** — when the context-maintenance pass sees several notes circling one
   subject, or one note read constantly, it writes a single note titled `doc-candidate:
   <subject>` naming the circling ids and the demand (read counts, empty searches). A nomination
   is a **pointer — zero knowledge moves** at this step.
3. **Doc maintenance folds** — its pass opens with `context("doc-candidate", kind: "notes")` as
   standing intake, then applies the inversion: for each note, not "where does this go" but
   *"what should the doc have said, so this note never had to exist?"* Each fact lands on the
   entry it belongs to — never a gotchas appendix.
4. **The fold retires** — the absorbed notes are `forget()`ed **and so is the nomination**. The
   chunk answers now; a note the doc absorbed is a second copy, and two copies drift.

**Every project has a handbook corpus, whether it has been born yet or not** — this folder,
`agents/`, is SystemView's. A codebase with no docs is a handbook at age zero, and the same
lifecycle above gives it its first.
