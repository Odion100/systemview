# RFC-055 — Agent context: what's asked, what's learned, what's derived

**Status: proposed 2026-09-08** · planning conversation, his direction · SystemView + autobot

## Why

An agent came out of a compaction and taught him a world that no longer exists — the old message
pipeline, described to his face while he typed directly into its conversation. It wasn't a stale
document; the verbs it read were current. What it lacked was any way to know **how it was
connected right now**.

The class, in one line: **agents remember the world instead of reading it.** Compaction summaries
preserve dead models perfectly — that is their job. Memory files quote docs and outlive the
corrections. Vendored skill files rot between regenerations. Every copy decays, and the agent has
no way to tell that it's holding one.

His goal, in his words: *"even if the agent is just a brand new agent, they will automatically come
in with certain knowledge."*

## Three kinds of remembering — the distinction the whole plan rests on

| kind | example | where it lives | how it's kept true |
|---|---|---|---|
| **Asked** — facts about *now* | you're attached in SystemView's harness; his words arrive in this conversation; your cwd, project, tools, MCPs | **nowhere.** Generated at session start by the thing that knows | can't rot: the harness *is* the connection it describes |
| **Learned** — why, decided, broke | "reports are files, the index is bookkeeping"; "a cache that outlives its shape lies" | **the AGENT, in the harness** — associated with a workspace, never inside it | human-edited; the graph indexes, never authors |
| **Derived** — structure | what calls what, what imports what, which doc references which method | `graph.json`, rebuilt from source | thrown away and rebuilt; never hand-written |

Conflating these is the bug. Presence stored as learned knowledge is what bit bweb. Learned
knowledge treated as derived is what makes a wiki feel like overhead. Derived facts hand-written
are what every stale doc in this repo used to be.

---

## Part A — Presence: asked, never remembered

**The rule: the vendored artifact is a pointer, never content.**

1. **A thin skill (~5 lines)** in every repo: *at session start, run `systemview presence` and read
   what it returns.* It contains no facts, so it cannot go stale. It's a pointer.
2. **A hook** so it actually fires — session start, and again after a compaction, which is the
   moment the model's self-image is rebuilt from scratch.
3. **`systemview presence`** generates the answer fresh: you are attached in the harness / you are
   a terminal session wired by hooks; this is SystemView, this is the browser; your project, cwd,
   worktree; your tools and MCPs; what you can do and what you should do here.
4. **The text is editable in the UI.** When we notice "we forgot to tell them they can do X," we
   fix it in one place and every next session has it. No regenerating six skill files.

Why the harness owns it: **the harness cannot be wrong about how an agent is connected, because it
is the thing doing the connecting.** Same principle that makes the worklist stale-proof — injected,
not remembered.

### The agent definition, managed in the browser

His ask, and the surface this lands on: an agent is a thing you **open and edit** —

- its tools and MCPs (visible today)
- its skills
- its knowledge sources, and which files back them
- **its presence text**, editable

Ownership split, the same one the worklist proved: **the harness owns the state, SystemView renders
and edits it.**

> **DECIDED (2026-09-08).** SystemView is *one application in the harness*, not the platform — his
> correction, and the same one he made on RFC-053 when I put SystemView's model of the world into a
> shared bag. Precedent is already here twice: dictation (the host captures, SystemView renders) and
> the terminal (RFC-045: *SystemView renders it; the embedding host runs it*).

---

## Part B — The knowledge graph, built in our own runtime

### The decision, and the argument that changed it

First read said: don't rebuild extraction — Graphify has 37 tree-sitter grammars, Apache-2.0, files
on disk. His correction: **we're JavaScript, and we're the browser.**

- We need **four** grammars — JavaScript, JSX/TSX, JSON/SCSS, Markdown — not thirty-seven. The
  inventory that made adoption look cheap is mostly weight we'd never lift.
- Graphify's extraction is **Python**: a second runtime installed on six machines, invoked as a
  subprocess, versions drifting, and the hub cannot `require()` any of it.
- `tree-sitter` compiles to **WASM**. `web-tree-sitter` runs in Node *and* in a browser tab from
  the same package. Extraction happens where the rendering happens — no bridge, no install step.
- Tree-sitter is **incremental** by design, which made a live parse look attractive — see decision
  3, where that idea died: nobody here types continuously, so the rebuild trigger is a turn ending,
  not a keystroke. What survives is the runtime argument, which is the load-bearing one.

**Build it. Steal the design, not the code.**

### What we take from Graphify's design (ideas are free)

- **Output is files** — `graph.json` + a human-readable report, in a folder you can delete and
  rebuild. Files are truth, graph is index (the exact relationship reports/index already proved).
- **Deterministic AST parsing over LLM extraction** for anything structural. No API key to know
  what calls what.
- **Edge provenance** — every edge tagged `EXTRACTED` (read from source) or `INFERRED` (resolved by
  guess). Same honest-failure principle we apply everywhere: a stated guess beats a confident one.
- **Rebuild hooks** on commit, so the index can't drift far from the files.

### What is ours, and structurally can't be theirs

The node types. A general tool graphs files, functions, classes, imports. Our system's spine is
`project → service → module → method`, plus **tests, reports, board notes, chat decisions, and the
agents themselves**. A graph that answers *"this method has three saved tests, two failing, and a
report from August explaining why"* is only possible here.

And the multi-repo question answers itself by construction — but by the HARNESS knowing its
workspaces, not the hub (decision 1). A per-repo tool would need stitching; the thing that starts
the agents doesn't. See *Still open* on where that workspace list lives.

### What the graph does NOT fix

**It makes knowledge findable, not correct.** A wrong note, graphed beautifully, is still wrong.
Staleness is Part A's problem and stays there. Worth stealing from Graphiti/Zep, though, without
their database: **facts carry when-true, not just what** — a validity window is two dates on a
note, and it's the difference between "this was true in July" and "this is true."

---

## Retrieval: three modes, one bridge

Finding something has three shapes, and they are complementary — not competing:

| mode | question it answers | needs | belongs to |
|---|---|---|---|
| **structural** (graph) | what calls this method | AST parse, no model | derived / code |
| **lexical** (grep) | find this exact string | nothing | everything |
| **semantic** (vectors) | what did we learn about staleness | an embedding model | **learned knowledge** |

Semantic is the one that fixes the wiki's actual failure mode: the rule is *grep before you
investigate*, and it is a coin flip because the note that would have saved you is filed under words
you did not think to search. "A cache that outlives its shape lies" does not contain "stale."
Traversal doesn't fix it either — traversal assumes you are already standing at the right node.

**The record is a POINTER WITH A SEARCHABLE SUMMARY** (his shape, from the Chroma work in autobot's
first life). The embedded text is a summary; the metadata points at the markdown file, the graph
node, the namespace, the agent, the date. So a semantic hit **lands you on a node** and the graph
walks the neighborhood from there. Vectors find the entry; the graph does the rest.

Rules, same as everywhere else here:

- **Derived, always.** Summary, pointer and embedding are all rebuildable from the markdown. The
  moment the vectors *are* the memory, the knowledge lives in a blob nobody can read or delete.
- **Same runtime argument as tree-sitter.** Chroma is Python — the exact dependency shape decision 1
  rejected. If we do this it is JS, and autobot already has the precedent for local models
  (whisper.cpp + ggml weights in `~/.autobot/models/`, no key, no cloud).
- **Scale first.** Thirty wiki pages do not need vectors; grep is honestly fine there. Six agents
  accumulating for a year do. At our size the index can be a JSON file and a cosine loop — no
  database, no server, still a file you can delete. Design the store so embeddings drop over it
  later without moving anything; build them when the corpus actually hurts.

> **BUILT 2026-09-08 — see "The store, built" below.** The scale argument was overtaken: the store
> got built early because MCP discovery needed it, which turned out to be the right order. A
> consumer that could be checked by hand found three silent bugs the wiki corpus never would have.

## Decided — 2026-09-08, one at a time, with him

**1 · Extraction is a HARNESS capability, not a SystemView feature.** It runs in the harness's main
process — headless, always available, no window required — and is exposed like `files` and
`dictation`. Every app in the harness gets it, including ones that don't exist yet. The question
"hub or browser" was the wrong question; it was **harness vs app**, and where the harness runs it is
a deployment choice the WASM package makes cheap. **SystemView owns the overlay** — services,
namespaces, tests, reports, board notes — because those node types *are* SystemView's model of the
world.

**2 · Knowledge belongs to the AGENT; the code graph belongs to the repo.** His call, and it
corrects this RFC's first draft:

- **Learned knowledge → the agent slot in the harness.** Not in the repo. It survives a
  delete-and-re-clone, and a NEW agent taking that slot inherits it — which is the whole
  *"a brand new agent comes in already knowing things"* goal. The agent is a **slot, not a person**:
  the model doesn't matter, the session doesn't matter.
- **The wiki's private half moves there.** ~30 pages of learnings that were never his and had
  nowhere else to live. A wiki HE asks for in his project stays in his project — that one is a
  project artifact.
- **The code graph → per project, derived.** Rebuilt from source, dies with the repo, free to
  regenerate. The harness holds the set and answers cross-repo questions, because it knows the
  workspaces.
- **Reports → `.systemview/`**, ephemeral by design ("if you deleted a report I'd be pissed, say
  regenerate it, then delete it later myself"). **RFCs → the codebase**, permanent, they ship with
  the code. `.systemview/` is the ephemeral zone; the repo proper is what lasts; the agent's own
  memory was never either.

**3 · Rebuild at TURN BOUNDARIES. The shared-parse idea is dropped, not deferred.** "Live while you
type" was borrowed from IDE-world and doesn't survive contact with this system: he speaks, agents
write files in bursts, and the interaction is turn-based. An agent writing fifteen files in a turn
should not trigger fifteen rebuilds — one at the boundary means the graph is current exactly when
someone might next ask it something. No CodeMirror coupling.

## Sequencing

1. **Part A first.** It's small, it's the live failure, and it's the one an agent hits every
   compaction. Presence generator + thin skill + hook.
2. **The definition surface** in the browser — agents as things you open, with the presence text
   editable. This is what makes A maintainable instead of another artifact that rots.
3. **Part B's extractor** — four grammars, WASM, in the HARNESS's main process, `graph.json` as
   output, rebuilt at turn boundaries.
4. **Our overlay** — SystemLynx node types on top of the structural graph.
5. **Rendering in the browser**, with the live/incremental parse as the thing to prove.

## Division

- **autobot**: session start + post-compaction injection; the definition object; anything that must
  be true of every session they spawn.
- **SystemView**: `systemview presence`, the SystemLynx overlay, the editing surface, rendering.
- **autobot also**: the extractor itself (harness capability) and the agent's knowledge store.
- Both: the graph is served through the hub, so an agent on any machine gets the same answer.

## MCP: what the approach review left us — 2026-09-08

Reviewed 012 against **our system**, not as code. Four gaps; three landed in SystemLynx the same
day (161/161). What remains is ours, and it belongs to this RFC because it is the same class as
presence: *an agent still cannot answer "what tools exist here" without a human editing config on
its machine.* Told, not asked.

**Theirs, done:** a service now publishes its served MCP routes in `connectionData` —
`[{ path, kind: "served"|"module", module? }]`, published live so a route served after start
appears. Their argument beat mine: if the hub must be TOLD the routes, the registry drifts, which is
"told, not asked" one layer up with the hub as the victim. `kind` survives the routes-only rule
because it is **structural** — computed from how the route came to exist, never authored.

**Ours, and the constraint that comes first:**

1. **The registry — discovery only.** Aggregate every connected service's `mcp` routes. THE
   CONSTRAINT, and it is not a note: *a service publishes routes it serves, which is not the same
   as routes an agent should get.* Fifty per-module endpoints under one project is not a curated
   surface — it is the estate, in a new costume. ~~**Discovery answers what exists; curation is his.**~~
   **SUPERSEDED 2026-09-08.** That sentence made him the filter, permanently. You do not curate the
   list down — you QUERY it. What remains his is one whitelist file, which is a decision per service
   rather than per method.
2. **Curation, harness-side, with zero framework change.** `createMCPServer(<serviceUrl>)` — the
   standalone form, already built — lets the harness stand up ITS OWN server with its own routes and
   expose lists, fronting a service it does not own. A remote `serve()` was refused deliberately: it
   is a control plane, and whoever reaches it widens any agent's reach. The trade accepted instead:
   **the proxy's own credentials are the boundary**, and the blast radius is one harness-owned
   process rather than the service itself.
3. **Schema drift — diff, never generate.** My "derive schemas from saved tests" died on one
   sentence of theirs: *a test payload proposes, it never asserts.* It proves a field CAN be sent,
   never that it must be, never the domain, and a field no test sent is invisible — generation would
   produce confident, narrow, wrong schemas. The sharper version: diff the declared schema against
   observed payloads and report drift for a human. **Probes beat tests as evidence** (an agent hit a
   method it needed, and it covers methods no test exists for).
   - **PREREQUISITE, verified 2026-09-08: probes are NOT recorded structurally.** A probe runs,
     prints, and survives only as text in a feed row. Somewhere to put payloads is the real
     precondition — but SystemLynx moved it somewhere better than the CLI:
   - **RECORD EVERY CALL, NOT PROBES.** Our plugin can register an **afterware** today, no framework
     change: `parseRequest` sets `req.arguments` before anything runs, so `service.after((req…))`
     sees `{ module_name, fn, arguments }` on every call that reaches the service. It covers probes
     for free (a probe IS an ordinary call), covers real traffic (stronger evidence than any
     fixture), and covers methods nobody ever tested — the population the diff most wants.
   - **TWO SUBSCRIPTIONS, THREE STATES — and the middle one is the whole point.** Verified in their
     `Router.js`, both directions:
     - `sendError` responds directly and never calls `next()`, so a THROWN failure never reaches
       afterware. Second subscription: the local-only
       `Module.$emit("error", { module_name, fn, arguments, status })`.
     - But `handleRequest` sets `req.returnValue` and calls `next()` on ANY return — so a method
       returning `{status: 400}` (this framework's own idiom, encouraged over throwing) walks the
       identical path to a 200 and reaches afterware **indistinguishably**. Labelling by which
       subscription fired would file every refusal as a success.
     - So the discriminator is `req.returnValue.status`, never the path. And **keep the status, not
       a boolean**: a thrown exception usually means the method broke; a returned 400 usually means
       THE CALLER SENT THE WRONG SHAPE — which is the finding. `{status:400} × 40` against a
       declared `{id}` is a sentence a human acts on; `ok:false × 40` is a shrug.
   - **SHAPES ARE POSITIONAL — `req.arguments` is an ARRAY.** `parseRequest` builds it from
     `body.__arguments`, falling back to `[query]` when the body is empty. Methods are variadic, so
     two calls can differ in ARITY, not just keys: a recorder reading `arguments[0]` would describe
     the first argument as the whole shape and mislabel every multi-arg method. Signature = shape
     per argument + count. The query fallback also means the same method can be observed
     body-shaped from one caller and query-shaped from another — capture both rather than
     flattening; a declaration matching only one of them is itself a finding.
   - **SHAPE, NEVER VALUES** — a signIn payload is a password. Key names and types only; the payload
     is never written anywhere, not even in transit to the aggregator.
   - **FREQUENCY IS WHAT MAKES IT A SCHEMA.** With N observations, optionality becomes answerable:
     `id` in 100% of 400 calls is required, `cursor` in 12% is optional. One fixture is one point and
     a point has no distribution — this is the property tests structurally cannot provide. Aggregate
     at write time, keyed `(module, fn, shape-signature)` with counts and an ok/failed split:
     bounded by distinct shapes, not by traffic.
   - **UPLOADS SUBSTITUTE — normalize or every upload method diffs as drifted forever.**
     `parseRequest` doesn't just assemble `req.arguments`, it MUTATES them: `arg.file === "__file__"`
     becomes multer's file object (`fieldname`, `originalname`, `mimetype`, `path`, `size`, maybe a
     `buffer`). A caller sends the placeholder STRING; afterware sees the object. So a naive
     recorder types `file` as a seven-key object of multer internals and calls that the method's
     API, while the declared schema correctly says `file: string` — a **false finding that never
     goes away**, which is worse than a gap: it teaches people to ignore the tool.
     Normalize back to the placeholder before signing, gated on ALL THREE conditions (key-name alone
     has a mirror failure — it would corrupt a method that legitimately takes a `file` OBJECT, and
     that error produces a *plausible* wrong shape, which is harder to catch):
     1. the route is `/sf/…` or `/mf/…` (Router.js:16). NOTE: on a plain route the branch still
        RUNS — `parseRequest` destructures `file`/`files` off `req` unconditionally, so a caller who
        sends the literal `"__file__"` there gets `{ file: undefined }`, not the placeholder. The
        rule still gates correctly (condition 3 fails), but a normalizer written against a surviving
        placeholder would be wrong. SystemLynx added `path` to the error emit so BOTH subscriptions
        can evaluate this condition — it was unreachable on the error side before.
     2. the key is exactly `file` or `files`
     3. the value carries multer's signature (`fieldname`/`originalname`/`mimetype`)
     **Both subscriptions need it** — `sendError` emits the same post-substitution `arguments`, so
     normalizing only in afterware would make upload methods diff correctly on success and falsely
     on failure. (Rejected alternative: reading `req.body.__arguments` is pre-substitution but also
     pre-query-fallback — trading a false finding for a blind spot is not a trade.)
   - **SIGN SHAPES FROM `Object.keys`, NEVER FROM SERIALIZATION.** `{ file: undefined }` VANISHES
     under `JSON.stringify` — the key is dropped, not nulled — so the most obvious implementation
     erases the observation before anyone sees it. And that observation is worth having: an
     `undefined` key on a plain route means a caller sent an upload placeholder to a method that
     takes no uploads. Record `undefined` as its own type.
   - **DISTINCT CALLERS GATE THE CLAIM, they don't merely qualify it.** 400 calls from one caller in
     a loop is a distribution of ONE wearing a big number — no evidence about optionality at all.
     Nothing says "required" from a single origin however large N is. So the aggregate needs a
     caller identity it can COUNT without storing: a hash of whatever identifies the caller, never
     the identity. Same rule as payloads — enough to distinguish, never enough to reveal.
> **The method that produced all of this, worth keeping:** every one of the four findings above came
> from reading the CALL PATH, and none of them is visible in any description. Uploads substitute;
> `arguments` is an array; an in-method `{status:400}` is indistinguishable from a success at the
> observation point; a thrown error never reaches afterware. Two were theirs in our design, two were
> ours in their code. Anything either side asserted from a description rather than the path turned
> out wrong at least once.

### The dogfood pass — run 2026-09-08, and what it settled

**The wiring, and why it's the real result.** SystemLynx's MCP reached this agent through
`~/.autobot/agents/systemview-test.json`, not a terminal command — the definition's `mcpServers`
array is now mapped to the Record the SDK wants and merged alongside the worklist. Their comment had
said that plumbing was *"left unwired until there is a real server to wire."* So the first MCP server
to reach an agent **because of what that agent is** proves the distribution argument this RFC makes:
capabilities come from the harness, per agent, editable — not from a file on a machine.

**HIS REFRAME, and it corrected both of us:** *"would an agent reach for it unprompted"* is a
RETRIEVAL question — context, memory, the vector store — not an MCP question. Pointing it at the
server would have had us fixing a thing the server cannot cause. The MCP question is only:
**would you use it, is it sufficient, is it better than sufficient?**

**Verdict — better than sufficient, and precisely where the shell is worst:** typed input (the schema
says what to send; through Bash you guess and find out by failing), structured output (no parsing
stdout, no truncation), **no shell in the path at all** (an entire class of quoting/escaping bugs
disappears), and calls that render as auditable tool rows instead of shell lines nobody can decode.
Worse at exactly one thing: composition. A tool returns one shaped answer with nowhere to pipe it,
so exploratory chaining still belongs to the shell.

**THE EXPOSURE FILTER, and it beats the token argument on its own terms:** *does this do something
the caller cannot already do?* `Repo.reconcile` (read 13 files, extract a declared field, report the
population) passes outright; `Codebase.grep` fails even when correct, because it wraps a primitive
the caller already has and loses on composability. **Apply it PER METHOD, not per module** — those two
live one module apart and land on opposite sides, which means the automatic per-module endpoints are
a setup convenience and a bad default for exposure. The curated route is the shape that survives.

**THE FAILURE CLASS, three instances in one session:** wrong `Host` → wrong service; wrong status
regex → empty value; MCP's single-object call bound whole to a positional parameter → zero matches
for a symbol present five times. Every one returned a **well-formed answer**, none was visible to the
protocol. **MCP's failure mode is not errors — it is confident wrong answers**, because the surface is
built to always return something shaped like an answer. And the consumer-side cost outlives the fix:
after one silent under-report I could no longer distinguish a true zero from a broken one without
leaving the tool. **A tool that has ever silently under-reported costs more to use than one that has
only ever crashed** — a crash announces itself; a false zero trains the caller to verify, and
verification is the whole cost the tool existed to remove.

**AND THE DEFERRED-SCHEMA DISCOVERY, which invalidated a shared assumption.** This harness delivers
MCP tools as NAMES ONLY — schemas load on demand. So *"every tool's name, description and schema
enters the model's context on tools/list"* is false here, and the token argument for curation
evaporates while the conclusion stands on the better reason (a shorter menu is worth having anyway).
Consequence for authors: **a name must be legible alone AND the description must carry**, because the
protocol permits both policies and no author can know which host they will get. Also: `Module.method`
arrives as `mcp__<server>__Module_method` — the dotted path exists nowhere a consumer can see, so
consumer docs must say "the findRfc tool on the workbench server," never `Repo.findRfc`.

**HIS RULE, and it sits above all the machinery:** SystemLynx can consume any method, and
**object-shaped methods are the shape that fits everything.** Every positional finding today — the
single-object binding, the arity check, `args`, middleware reading `[1]` — is the cost of multiple
positional arguments. A `({ … })` method has none of it: MCP hands one object and the method takes
one object, there is no arity to get wrong, no missing `[1]` for a guard to mis-read, and the
signature publishes its own parameter names (which is what makes the destructuring check possible at
all). So the guidance is not "annotate your positional methods" — it is **a method meant to be
consumed should take one object.** Positional is fine where the caller is a programmer holding the
signature; it is the wrong shape at a boundary where the caller has only a schema. Everything built
today is scaffolding for methods that predate that advice.

> **FIRST TARGET, offered by SystemLynx:** a disposable testbed service that throws, refuses
> in-method with `{status:400}`, takes an upload, and takes multi-arg calls — all five paths
> exercised against something we can check by hand before the recorder ever sees production.

4. **SystemView's own hub methods as MCP tools** — agreed in August, never written. Their side is
   done and ours is not, which is why the only MCP carrying real traffic here is the worklist.

## The store, built — 2026-09-08

Built in **autobot**, not here. SystemView supplies corpora and renders; the harness owns the
runtime. Same split as dictation and the terminal.

### What runs

| layer | what |
|---|---|
| library | `@huggingface/transformers` 4.2.0 — npm, no Python |
| runtime | `onnxruntime-node`, **napi-v6 prebuilts** — ABI-stable, so no electron-rebuild |
| model | `Xenova/bge-small-en-v1.5`, `q8` — 22MB, 384 dims |
| weights | `~/.autobot/models/embed/` — the slot beside the whisper ggml files |
| store | `~/.autobot/vectors/<collection>.json`, brute-force cosine |
| network | one download, then offline forever |

`electron/apps/vectors.cjs` + `vectors-worker.cjs` + `vectors-host.cjs` + `vectorsBridge.cjs`,
exposed as `window.autobot.vectors` and `window.systemview.vectors`.

The JS-not-Python argument held: the old ChromaDB + OpenAI code in `common/driver/` is **dead** —
nothing references it, nothing runs on :8000. What survived from it was the shape, not the stack.

### The model was chosen by measurement, and the deciding property is not accuracy

Three models over the real 227-chunk wiki. bge won on relevance, but the reason it is *correct* is
**score spread**: bge ranges 0.55–0.68 where `e5-small-v2` compressed everything to ~0.83, hits and
misses alike. A model whose misses score like its hits cannot be thresholded, so it can never return
zero, so it can never say *"nothing here matches."* That is the confident-wrong-answer failure the
MCP pass already charged us for. Hence `min` exists and scores are always reported: the gap between
#1 and #2 is information.

bge is **asymmetric** — queries take an instruction prefix, passages none. Same text for both
degrades ranking silently.

### The embedder is a child process, and the reason is unexplained

onnxruntime does this work in plain node in ~10s and **SIGTRAPs or hangs indefinitely in the electron
main process**. Cause never found; filed at `autobot/gaps/ONNXRUNTIME_HANGS_IN_ELECTRON_MAIN_PROCESS.md`
along with the variable that was never isolated (model and batch size changed together). Out of
process is right regardless — a native crash would otherwise take the whole browser, and a 10s index
would block every window — and it matches dictation shelling out to `whisper-cli`.

## The three tiers — 2026-09-08, his model

The first consumer, and it added a row the RFC did not have:

| tier | server | fixed when | whose |
|---|---|---|---|
| tools | `mcp__worklist__*` | build time | the harness's own |
| MCP servers | `mcp__discovery__findTool` | session start | anyone's — standard, shallow |
| **SystemLynx services** | `mcp__systemlynx__*` | **any time** | ours — catalog + schemas + reach |

Only the third row changes mid-session, and it is the only one where we own both ends. That is why
it is a tier and not a special case of MCP.

**Dynamic reach, static protocol surface.** `notifications/tools/list_changed` has uneven client
support and was not needed: the tool list never changes — it is always `services` / `loadService` /
`call`. What changes is what is indexed and what `call` can reach.

**Two reads, one load.** `connectionData` gives method NAMES and nothing about use; schemas and
descriptions live on the MCP surface. Indexing the manifest alone would produce a searchable list of
names with nothing behind them. The `mcp` routes field SystemLynx shipped during the MCP pass is what
makes this systematic — and its `kind: "served"|"module"` is load-bearing a layer further out than
either side imagined: `loadService` prefers the curated surface, which applies the exposure filter
automatically.

**Context cost is flat.** Three tool names whether a service has 6 methods or 661. The estate lives
outside the window; only search results enter it.

**Reach is the whitelist, and only the whitelist.** Agents pass a NAME, never a URL —
`loadService(anyUrl)` would be a privilege-escalation primitive, the same concern SystemLynx refused
a remote `serve()` over. `~/.autobot/services.json`, one `{name, url}` per entry.

**Proven end to end** against the live workbench: attach → 6 methods across 2 modules (4 with
schemas) → `findTool` returns the right method at #1 → called it using only the pointer the hit
carried. Raw URLs refused. Off-topic queries return zero.

### What maintenance taught, and it is the same lesson three times

Asking "how do we clear stale embeddings" surfaced three bugs, all silent:

1. **The clobber.** Discovery used a full-replace `index()` on a collection shared with
   `loadService`, on a 5-minute timer — so an attached service silently vanished minutes after being
   attached. Fixed with `replaceWhere(collection, scope, docs)`: every writer owns its own scope and
   nothing else, which also makes pruning free (a method deleted from a service is simply absent).
2. **Orphans.** Records written before scoping carried no `kind`, so no writer's filter could ever
   claim or prune them. Immortal by accident.
3. **The one introduced fixing #2.** Bumping the store version broke every read because `v` was
   hardcoded at two call sites and `write()` never stamped it — writes succeeded, reads returned
   empty. Now stamped in exactly one place.

All three shared a shape: **the write succeeded and the read disagreed, and nothing errored.** None
would have appeared in happy-path tests.

## Part A, refined — the `context` tool

His idea, and the correction that makes it work: **it cannot be only a tool.** The bweb failure was
not an agent that failed to look something up — it was an agent that did not know it was wrong, and a
confident agent never calls the tool. So push and pull, with levels as the seam:

- **Level 0 — pushed, unconditional, tiny.** Session start and after every compaction. Small enough
  to never be worth skipping, and it carries the pointer.
- **Levels 1+ — pulled, on demand, deep.** Thirty pages that could never be pushed.

The levels are not new machinery — they are the `where` clause already built and tested:

| level | question | filter |
|---|---|---|
| presence | how am I connected right now | generated, never stored |
| project | what is this repo, its conventions | `where: {kind: "project"}` |
| learned | why was this decided, what broke | `where: {kind: "learned"}` |
| history | what happened in this room recently | `where: {kind: "history"}` |

## Still open

- **Does the harness get its own workspace list?** Today SystemView's connections registry is the
  only thing that knows all six roots. If extraction is a harness capability, the harness needs its
  own idea of what workspaces exist — or it asks SystemView, which inverts the layering just fixed.
- The storage shape of the agent's knowledge (markdown pages are the obvious start — it is what the
  wiki already is, and it is inspectable). **The RETRIEVAL half is answered** — a collection in the
  harness store, scoped by `kind`. What is still open is where the markdown lives and who edits it.
- Whether an existing graph MCP is worth using as the index while ours is built.
- **Making the index LIVE.** It is lazy and manual today: discovery refreshes on a 5-minute TTL,
  services only when `loadService` is called again. The shape that fixes it is cheap-check /
  expensive-rebuild — `connectionData` is a small GET, so take a signature of the method set and
  re-embed only when it differs. Cadence follows decision 3: not on a timer, not on every call — on
  USE and on CHANGE. Removal needs a real trigger, not a poll: a service dropped from the whitelist
  should lose its records immediately.
- **The duplication across tiers.** `Repo.findRfc` indexes twice — once via `tools/list`, once via
  `loadService`. They are genuinely different call paths, so neither is wrong, but a search returning
  the same capability twice in different clothes wants a decision rather than drift.
