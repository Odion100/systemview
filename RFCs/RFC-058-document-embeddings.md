# RFC-058 — Document embeddings

**Status:** built. Chunker, `plan`, `index`, `search`, `drop` and `listCorpora` are in
`autobot/electron/agents/docs.cjs`; the five tools are on the context MCP; tests are
`autobot/tests/docs.js`. The `systemlynx` corpus is indexed — 5 files, 102 chunks.

Not built: §8, the human surface on the context page. And no corpus exists yet for SystemView's own
documentation, deliberately — see §10 item 6.

## Why

The context layers table has listed **Embedded docs — reference — retrieved, asked not searched**
since it was written, with *"chunking pipeline (to build)"* beside it. It is the last unbuilt layer,
and its absence shows as store notes doing documentation's job — *"file chips: one colon links, two
embeds"* — facts about how the system works, written into a lessons store because there was nowhere
else to put them.

Two consumers, not one:

1. **Reference.** An agent asks how SystemLynx behaves and gets the paragraph, not the file.
2. **Working memory.** An agent writes research to a file, embeds it, and queries it **without ever
   reading the whole thing into context**. This is the one that changes day-to-day behaviour: web
   search pulls text straight into context, which is the flooding it is supposed to prevent.

## Vocabulary

| term | is |
|---|---|
| **corpus** | a named, configured set of files — root, glob, excludes, kind |
| **kind** | `permanent` (indexer writes, agents read) or `working` (an agent owns it and drops it) |
| **chunk** | one indexed unit: text, heading path, source, line, hash |
| **collection** | the vector collection a corpus writes to — `docs-<name>` |

A chunk is never a note. `context()` must not return one, and `docs()` must not return a note. A
note is true because someone learned it; a chunk is true only while its file hasn't changed.

## 1 · Config — `~/.autobot/corpora.json`

Configured, never hardcoded. That is the difference between a pipeline for two repos and a feature
someone else can point at their own docs.

```json
[
  {
    "name": "systemlynx",
    "kind": "permanent",
    "root": "/Users/odionedwards/Systemly/SystemLynx",
    "glob": "**/*.md",
    "exclude": ["RFCs/**", "scratch/**", "**/gaps/**", "**/CLAUDE.md"]
  }
]
```

`exclude` is not optional garnish. The first real dry run pulled SystemLynx's RFCs, scratch notes and
bug write-ups into a "reference" corpus: 270 of 372 chunks were material explicitly ruled out. With
excludes the same corpus is 5 files and 102 chunks.


**Glob support is exactly three forms** and the order of substitution matters, because a pattern that
matches nothing excludes nothing, silently:

| form | means |
|---|---|
| `**/` | any number of directories, or none |
| `**` | anything, including slashes |
| `*` | one path segment, never crosses `/` |

## 2 · The chunker — `chunkMarkdown(text, {maxChars, minChars})` — BUILT

Markdown is already structured, so no fixed token window: cut where the author cut.

```js
[{ headingPath: ["Modules", ".before()"], text, line, part: "2/3" | null }]
```

Rules, all of which are visible in a dry run and arguable:

1. **A heading starts a chunk**, and the chunk carries its full heading path, so an answer says
   where in the document it came from.
2. **A code fence is never split**, and a heading inside one is text. Half a code block is an
   example that is subtly wrong rather than obviously broken.
3. **Oversize splits at paragraph breaks** (`maxChars`, default 2200), never mid-sentence, and the
   pieces are labelled `1/3`, `2/3`.
4. **A heading with no body of its own is dropped** (`minChars`, default 40) — a parent above
   subheadings indexes as a title that matches everything and answers nothing.
5. Front matter is metadata about the file, not content of it.

## 3 · The dry run — `plan(name)` — BUILT

Returns every chunk, its heading path, size, source and the file's hash, and **embeds nothing**.

```js
{ corpus, kind, root, glob,
  files: [{ source, bytes, hash, chunks: [{headingPath, text, line, part, chars}] }],
  totals: { files, chunks, chars, biggest, overMax, split, empty } }
```

Chunking is normally invisible, which is exactly why RAG rots. Nothing is indexed until the cuts
have been read once. `plan` is also the reviewer's tool afterwards: change `maxChars`, re-run, diff.

## 4 · Indexing — `index(name)` — BUILT

```js
index(name) -> { corpus, indexed, skipped, removed, at }
```

- Chunk id: `${corpus}:${source}#${n}` — stable across runs, so re-indexing replaces rather than
  duplicates.
- Metadata on every chunk: `{ kind: "docchunk", corpus, source, headingPath, line, part, hash,
  indexedAt }`.
- **Re-index by file hash.** A file whose hash is unchanged is skipped entirely — no embedding
  calls. Changed files have their chunks replaced via `vectors.replaceWhere(collection, {source})`.
  Files that no longer exist have their chunks removed.
- `hash` on the chunk is the FILE's hash, which is what makes staleness detectable: compare the
  stored hash to the file on disk without re-reading the index.

## 5 · Retrieval — `search({q, corpus, source, limit})` — BUILT

```js
search({ q, corpus, source, limit = 5 })
  -> [{ text, score, source, headingPath, line, corpus, indexedAt, stale }]
```

- `corpus` and `source` are **query filters**, not separate servers. Narrowing to one document is
  `{ q, source: "research/vendor-api.md" }`. This is the compartmentalisation — a good filter, not a
  second system.
- Every result says **where it came from and as of when**. `stale: true` when the file's current
  hash differs from the indexed one: staleness visible instead of silent.
- Searching with no `corpus` searches every `permanent` corpus. A `working` corpus is only searched
  when named — an agent's research dump must not surface in someone's question about the framework.

## 6 · Lifecycle — who may write what

| | permanent | working |
|---|---|---|
| created by | the human, in config | an agent, via `docsIndex` |
| written by | the indexer | the agent that made it |
| dropped by | the human | the agent that made it, or the human |
| when wrong | **fix the file, re-index** | drop and rebuild |

Never patch a chunk. It is derived; the next run overwrites the edit. An agent that finds a wrong
chunk **flags** it — file, line, what's wrong — the same shape as the agent-doc proposal: the agent
reports, the human and the indexer act.

`drop(name)` removes a corpus's whole collection. Cheap because `corpus` is a first-class field from
day one, miserable to add later.

## 7 · The agent face — tools on the context MCP — BUILT

Not a new server. It is where agents already look, discovery already indexes it, and the
separate-verb rule holds inside one server.

| tool | signature | notes |
|---|---|---|
| `docs` | `{ q, corpus?, source?, limit? }` | search. Never returns notes |
| `docsList` | `{}` | corpora, kinds, chunk counts, last indexed |
| `docsIndex` | `{ name, root?, glob?, exclude?, kind? }` | create-or-refresh. Creating a `permanent` corpus is refused — that is a human act |
| `docsDrop` | `{ name }` | refuses a `permanent` corpus |
| `docsPlan` | `{ name }` | the dry run, so an agent can judge its own cuts |

The working-corpus flow this enables, end to end:

```
research -> write findings to research/vendor-api.md
         -> docsIndex({ name: "vendor-api", root: "research", glob: "vendor-api.md", kind: "working" })
         -> docs({ q: "how does their auth refresh work", corpus: "vendor-api" })
         -> docsDrop({ name: "vendor-api" })
```

The file is never read whole. That is the point.

## 8 · The human face — on the context surface

Beside the notes and the read-only tool index, because that is the vector store's location and he
should not have to ask an agent to see his own index.

- **Corpora list** — name, kind, files, chunks, last indexed, and how many chunks are stale.
- **Add / edit a corpus** — root, glob, excludes, kind. Writes `corpora.json`.
- **Dry run** — renders the chunk plan: heading path, size, source, and the chunk text itself. The
  cuts are readable before anything is embedded.
- **Index / re-index / drop** — the same operations the tools call. One implementation, two doors.
- **Browse the chunks** — after indexing, every chunk stays visible with its source and `indexedAt`,
  exactly as `mcp-tools` is rendered read-only today.

## 9 · Tests — `autobot/tests/docs.js` — BUILT

Against the real module, on fixture markdown, throwaway paths only:

- a code fence containing `## Heading` produces one chunk, not two
- a heading followed by ONE oversized fence stays one chunk — the split used to shed the heading as
  a four-character chunk of its own, which is the "matches everything, answers nothing" case rule 4
  exists to prevent, and it orphaned the fence from the line that said what it was
- a fence longer than `maxChars` is still never split
- `~~~` inside a ``` block does not close it
- heading paths nest and reset correctly (`h2` after `h3`)
- a heading with no body is dropped; with a body it is kept
- oversize splits land on paragraph edges and are labelled `n/total`
- `globToRe`: `RFCs/**`, `**/CLAUDE.md`, `docs/**/*.md`, `*.md` each match what they should and
  nothing else
- re-index with an unchanged hash performs zero embedding calls
- `search` on a `working` corpus does not appear in an unfiltered search

## 10 · Order

1. Chunker + `plan`. **Built.**
2. The SystemLynx plan in front of him. Judge the cuts, tune `maxChars`, re-run.
3. `index` + `search` + the `docs` tool. Index `systemlynx`. **Built and indexed.**
4. The corpora surface on the context page.
5. `docsIndex` / `docsDrop` for working corpora, and the flag-a-chunk path.
6. Correct SystemView's own docs — they still describe an npm plugin driven by a CLI. **Embedding a
   doc publishes it**, so that corpus is not indexed until it is true. How much is a rewrite and how
   much is an edit is a question for when they are read.

## Out of scope, deliberately

- **RFCs and reports.** Plans and logs, not reference. That is what the context store and memory are
  for.
- **A skill for this.** No procedure exists yet to write down. If the cleanup discipline turns out to
  be what everyone skips, that is when it earns one.
