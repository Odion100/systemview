# RFC-025 — Interactive Markdown

**Status:** P0–P2 BUILT (2026-08-07) — navigation, structure and the first embed are live; P3–P4 open
**Date:** 2026-08-07
**Depends on:** nothing. **Feeds:** RFC-024 (§9 chat, §10 plan-first stories), RFC-021 (docs + source on synthesized actions), RFC-022 (codebase surface)

---

## 1. The idea in one paragraph

Markdown is already the shared language of this app. The Documentation tab is markdown. Story
markdown panes are markdown. Story `.md` **file** panes are markdown. Agent notes on test panes are
markdown. Help topics are markdown. The agent writes markdown. And every one of those surfaces
renders through **one 48-line atom** — `src/atoms/Markdown/Markdown.js`, `react-markdown` +
`remark-gfm`, static text out the other end.

That atom is the highest-leverage file in the repo. Teach it to host live components and *every*
markdown surface gains the same vocabulary in the same commit. We don't build "runnable docs",
"richer stories", "interactive help", and "a chat that can show you things" as four projects. We
build one component registry, and they all light up at once.

```
                    ┌──────────────────────────────┐
   Documentation ──▶│                              │
   Story md pane ──▶│   atoms/Markdown  ← registry │──▶ links · runnables · embeds
   Story md file ──▶│   (remark-directive)         │     structure · inputs · actions
   Agent note    ──▶│                              │
   Help topics   ──▶│                              │
   (future) chat ──▶└──────────────────────────────┘
```

The unlock: **the agent's native output format becomes the app's native UI format.** It stops
needing a new pane schema for every idea it wants to express. It writes a document, and the document
does things.

---

## 2. Syntax — directives, not HTML

`remark-directive` gives us three shapes, all valid CommonMark-adjacent, all invisible-ish when read
as plain text (they degrade to readable prose in an editor or on GitHub):

| Shape | Syntax | Use |
|---|---|---|
| **inline** | `:name[label]{attrs}` | links inside a sentence |
| **leaf** | `::name{attrs}` | a block-level embed on its own line |
| **container** | `:::name{attrs}` … `:::` | wraps other markdown (callouts, tabs, columns) |

```markdown
The retry lives in :ns[Math.chainUse] and the guard is in :file[cli/runTests.js#L120-140].

::chart{report=throughput range=1h service=Profiles}

:::callout{type=warn}
This path is **untested** — see the Surface Coverage report.
:::
```

**Raw HTML stays off.** We never enable `rehype-raw`. Directives are the *only* sanctioned extension
point, which means the surface can't be used for HTML/script injection — an agent (or a doc pulled
off disk) can only reach components we deliberately registered.

**Backtick autolink (opt-in, nice touch):** a plain `` `Service.Module.method` `` gets linked *only*
when it resolves against the live connection tree. No resolution, no link — so prose that happens to
look like a namespace is never mangled.

---

## 3. The registry

One exported map. A block type is a `{ match, Component, persists? }` entry; the atom does the
directive→component dispatch and nothing else. Adding a feature = adding a registry entry, not
touching the renderer.

```js
// src/atoms/Markdown/registry.js
export const BLOCKS = {
  ns:        { inline: true,  Component: NsLink },
  file:      { inline: true,  Component: FileLink },
  chart:     { Component: ChartEmbed },
  test:      { Component: TestEmbed },
  probe:     { Component: ProbeBlock,  acts: true },
  checklist: { Component: Checklist,   persists: true },
  ...
};
```

Every embed receives a shared **context** from the hosting surface: `{ projectCode, serviceId,
moduleName, methodName, dark, state, setState, navigate }`. That's how the same `::chart` block
knows which project it's in whether it's living in a doc, a story pane, or a chat bubble — and how
it renders correctly in dark mode, which the atom already takes as a `dark` prop.

---

## 4. The catalog

### 4.1 Links — navigate, don't describe

- **`:ns[Math.add]`** — a namespace reference that navigates the UI to that method (docs + tests +
  everything). Documentation stops *describing where things are* and starts *taking you there*.
- **`:file[cli/stage.js#L40-70]`** — now that we have **codebase connections** (RFC-022), a file
  reference is a real, resolvable thing. Click it and the codebase surface opens that file at that
  range. Same `path#L40-70` grammar the story `--file` flag already parses (`parseFileSpec()` in
  `cli/stage.js`) — one syntax, two consumers.
- Both render as chips with a kind badge, and both **dead-link visibly** when the target isn't
  connected, so a stale doc says so instead of lying.

### 4.2 Runnables — real sequences, not one-shot probes

The point is not "a doc can call a method." It's that **the agent sets things up and you run them
yourself.** That only works if a runnable block is as capable as a real test — because the useful
things need setup. You have to sign up a user before you can do anything as that user.

So a runnable block is **not a new execution model**. It is the existing one — the same steps,
sections, saved actions, and `tv(...)` references that the Test Panel and the scratchpad already run:

```markdown
::run{title="Sign up and post"}
- use: signUpUser                                  ← a SAVED ACTION, by reference
- Profiles.Users.signIn { email: tv(test.signUpUser[0].results.email) }
- Basketball.Games.create { host: tv(test.signIn[0].results.userId) }
```

- **Saved actions by reference.** `use: signUpUser` stores a `{ "use": "<name>" }` reference exactly
  like a test section does — so the action stays the single source of truth. Edit the action once
  and every document that runs it follows. Documents don't fork setup logic; they borrow it.
- **`tv(...)` references work the same way, and the document is the run context.** Steps see earlier
  steps' output, and blocks later in the document see earlier blocks' — a doc's runnable blocks are
  *sections of one test*, the same way `Before / Main / Events / After` and inserted action sections
  are today. `random(6)` works too, so a doc is re-runnable without collisions.
- **`::test{Math.chainUse}`** still embeds an existing saved test whole, runnable in place with its
  pass/fail state — the *same* `SavedTestItem` the story test panes render.
- **Promotion both ways.** A block gets **Save as action** / **Open in scratchpad**; and a sequence
  built in the scratchpad can be dropped into a doc. Same JSON either side, so nothing is stranded
  in prose.

That closes a real gap: today, asking for a runnable setup means asking *me* to run it. This makes
the answer an artifact you keep — a document that hands you the button.

**Never auto-run.** Everything requires a click. Anything destructive confirms first. A document is
not permission.

### 4.3 Embeds — whatever we want to embed

Two halves, and the second is the bigger one.

**(a) Reuse what the UI already draws — with common sense.** Not every component earns a directive,
and one that only makes sense inside its own page stays there. The test is whether the block reads
naturally in a sentence of prose, not whether it technically renders.

The app is full of components that currently only exist on one page:
`LineChart`, `LoadColumns`, `LoadBar`, `TopologyGraph`, health tiles, the coupling table, the log
analyzer, `CodeView`, the diff view, `SavedTestItem`. Right now they're **trapped inside
`pages/Reports/Reports.js`** (a single enormous file) and inside the Stage's pane renderers.

Embeds mean extracting them into shared components — which is worth doing on its own merits — and
then any of them can be dropped into any document:

```markdown
Throughput held flat while errors climbed:

::chart{report=throughput range=4h}
::chart{report=errors range=4h}

The hot path nobody tests:

::coverage{service=Profiles}
```

Also `::file`, `::diff`, `::logs{level=error}`, `::topology`, `::stat{p99}`.

**(b) Embeds are not limited to what the UI can already draw.** That half is just the cheap half. An
embed is *whatever we want to put in a document* — media (`::image`, `::video` for when a screen
recording is the clearest explanation), a sandboxed external `::embed{url}`, a JSON payload viewer, a
response rendered as a table, a form, purpose-built widgets that exist only as embeds and have no
page of their own. The registry is the gate (nothing renders that we didn't register — §2), but the
registry is **not** a mirror of the existing UI. New blocks get written because a document needs
them, not because a page already had them.

**The through-line:** the story pane *kinds* (markdown / file / diff / test) become **vocabulary
inside a document**, not just layout units. A pane stops being the only way to show something.

### 4.4 Structure

- **`:::details{summary=…}`** — collapsible sections (long docs stop being walls).
- **`:::tabs`** / `:::tab{label=…}` — one concept, several angles.
- **`:::callout{type=info|warn|danger|success}`**.
- **`:::columns`** — side-by-side prose and evidence, same instinct as a lead pane sitting next to
  the pane it leads into.
- **`::mermaid`** — real diagrams. (Plus the ASCII sketches we already lean on.)

### 4.5 Inputs — the document asks *you* things

- **Interactive checklist** — GFM task lists (`- [ ]`) become live checkboxes, and toggling one
  **rewrites the source markdown** (`- [x]`). No new persistence layer: the file *is* the state.
  Beautifully, this also means the agent can read its own checklist back off disk.
- **`::slider{min max step}`** — a value you drag that other blocks in the same document read
  (e.g. a slider that re-windows every chart on the page).
- **`::question{options=a|b|c}`** — an option block. This is the primitive behind RFC-024 §10's
  plan-first stories: the agent lays out a plan and *asks*, and your answer is captured where the
  plan lives instead of in a chat scrollback.
- **`::action{label=… }`** — a button that does a thing: approve / reject, open in scratchpad,
  insert this action into a test, re-run the suite.

### 4.6 State — **the document is the source of truth**

One rule, no tiers: **an interactive block writes back into the markdown it came from.** Ticking a
checklist isn't updating some parallel store that shadows the doc — *you are editing the
documentation.* The file changes, and the file is what everyone reads next.

```diff
- - [ ] wire ::probe to the live client
+ - [x] wire ::probe to the live client
```

```diff
- ::question{id=fork options=complement|replace}
+ ::question{id=fork options=complement|replace answer=complement}
```

This is not a new capability — **we already edit documentation from the UI.** The Documentation tab
saves through `saveDoc`, `.md` file panes save through `writeFile`. An interactive block is just a
*narrower edit* to the same file through the same path. Nothing new to build, nothing to reconcile.

Consequences worth stating plainly:

- **Answers are durable, shared, and committed** — they ride in the repo with the doc, so a checklist
  you ticked is a checklist your teammate (or the agent, reading the file back off disk) sees ticked.
- **A markdown *pane* in a story** works identically; its "file" is the pane's own text, rewritten
  through the story save that already round-trips whole (as RFC-019's grid tree did). Same rule.
- **No write target ⇒ read-only.** Help topics are a code registry, not files on disk, so
  interactive blocks there are decorative and say so rather than pretending to save.
- **Which makes the agent loop close on its own**: it writes a checklist into a doc, you tick items
  as you go, and it reads the same file back to know where you got to. The document is the shared
  state, not a message it has to be told.

---

## 5. Where it lights up (for free)

| Surface | What it gains |
|---|---|
| **Documentation tab** | Docs that navigate, run their own examples, and embed live charts/logs |
| **Story markdown panes** | "Narrate AND show" in *one* pane — the prose and the evidence stop being separate objects |
| **Story `.md` file panes** | RFCs in the repo become interactive when read in the window |
| **Agent notes on test panes** | A note can point at the exact file/line and the exact failing chart |
| **Help topics** | Help that shows the real thing instead of describing it |
| **RFC-024 chat** | The agent's replies are markdown → the chat inherits the entire vocabulary on day one, with zero chat-specific work |
| **RFC-024 §10 plan-first** | `::question` / `::action` *are* the verdict mechanism |
| **RFC-021 synthesized actions** | `::file` / docs-first is exactly the "documentation and source" requirement |

---

## 6. The one real fork

**Do embeds complement panes, or replace them?**

Recommendation: **complement.** Panes stay the layout unit — the grid, the resizing, the per-pane
reply threads, the gallery rail. Embeds are inline references *inside* prose. If embeds replace
panes, stories drift into one giant markdown blob and we lose everything the Stage does well.

The natural division: **a pane is a thing you arrange; an embed is a thing you mention.**

---

## 7. Phasing

| Phase | Scope |
|---|---|
| ✅ **P0 — foundation** | `remark-directive` + registry + surface context + theme pass-through. Cleanup: the atom still passes `renderers={{ code: CodeBlock }}`, a **react-markdown v5 API that has done nothing since the v8 upgrade** — dead code to delete while we're in there. Write `docs/agents/markdown.md` (the vocabulary is useless if the agent doesn't know it) |
| ✅ **P1 — navigation** | `:ns[]`, `:file[]`, resolved-backtick autolink, dead-link states |
| 🔸 **P2 — embeds** (LineChart extracted + `::chart`; the rest still to come) | Extract charts/tiles/topology out of `Reports.js` into shared components; `::chart` `::test` `::file` `::diff` `::logs` `::stat` `::topology` |
| **P3 — run & act** | `::run` over the existing step/section engine — saved-action `use:` references, `tv(...)` across steps *and* across blocks, `random()`, Save-as-action / open-in-scratchpad; `::test`; `::action`; confirm-on-destructive |
| **P4 — interactive** | checklists, `::slider`, `::question` — all writing back to the source doc (§4.6) — plus `:::tabs` `:::details` `:::callout` `:::columns`, `::mermaid`, media and non-UI embeds |

P0–P1 is the smallest thing that's already visibly worth it. P2 is the one that pays for the
extraction work twice.

---

## 8. Open questions

1. **Autolink aggressiveness** — backticks only, or bare `Service.Module.method` in prose too?
2. **Does an answer *trigger* the agent, or is it read-back-only?** §4.6 already gives it a durable
   shared state (the doc on disk), so read-back works with no wiring at all. Pushing an event the
   moment you tick something is the RFC-024 question, not this one.
3. **Blast radius of a `::run` block** — the run engine is shared with the Test Panel, so a doc can
   do anything a test can. Do doc-authored runs need a marker in the logs (`source: doc`) so a
   surprise write in prod traces back to the document that fired it?
4. **Versioning the vocabulary** — a doc written against a newer block set opens in an older UI. An
   unknown directive should render as a visible "unsupported block" chip, not vanish silently.
5. **Print/plain fallback** — what a doc full of embeds looks like on GitHub. (Directives degrade to
   readable text; embeds degrade to nothing. Acceptable?)

---

## 9. Appendix — where does a `::run` payload live? (written out, not theorized)

Open question raised while reading: should run payloads live **inline in the markdown**, or be saved
into the `.systemview/` folder with the doc **pointing** at them? The honest way to answer is to
write real ones — with real payloads, not the tidy one-argument example in §4.2 — and read them.

**First, the thing that isn't obvious until you write them out: rendered, all of these look
identical.** A `::run` block draws steps with collapsed argument indicators either way, so *where*
the payload is stored costs the reader nothing at read time. The difference only shows up in the
**source text** — which is what you see on GitHub, in an editor, and while editing.

### Case A — trivial (one step, small argument)

```markdown
::run
- Math.add { a: 2, b: 3 }
```

vs. `::run{src=.systemview/runs/doc-math-add.json}`

**Inline wins, and it isn't close.** The file version is pure indirection — a pointer to two numbers.

### Case B — one real step (the payload *is* the documentation)

```markdown
::run{title="Sign up a test user"}
- Profiles.Users.signUp
    { email: "user_random(6)@test.com",
      password: "K1234567#a",
      user_name: "user_random(6)",
      gender: "male",
      location: "Brooklyn, NY",
      coordinates: [-73.97, 40.68],
      dob: "1990-01-01T00:00:00.000Z" }
```

Eight lines of JSON for a single step — heavy. **But on the doc for `Users.signUp`, showing the full
argument shape is the entire point.** Hiding it in a file would make the documentation worse.

**Inline wins here too**, for a reason that has nothing to do with size: the payload is the content.

### Case C — a real sequence with setup (where it hurts)

```markdown
::run{title="Host a game at a new court"}
- Profiles.Users.signUp
    { email: "user_random(6)@test.com", password: "K1234567#a",
      user_name: "user_random(6)", gender: "male",
      location: "Brooklyn, NY", coordinates: [-73.97, 40.68],
      dob: "1990-01-01T00:00:00.000Z" }
- Profiles.Users.signIn
    { email: tv(test.run[0].results.email), password: "K1234567#a" }
- Profiles.Locations.save
    { location: "Court random(4)", coordinates: [-73.9588, 40.6413],
      location_type: "court", public: true }
- Basketball.Games.create
    { host: tv(test.run[1].results.userId),
      location: tv(test.run[2].results._id),
      startsAt: "2026-08-09T18:00:00.000Z", size: 10 }
```

Sixteen lines, and the prose around it is gone. Versus:

```markdown
::run{use=signUpUser}
::run{title="Host a game at a new court" src=hostAtNewCourt}
```

**The reference wins** — but note *which* reference won.

### Case D — the same setup used by three docs

`::run{use=signUpUser}` — a **named saved action**, which already exists today and already stores as
`{ "use": "<name>" }`. Nothing new is needed for this case at all.

### What writing them out actually settles

The choice isn't two-way, it's **three-way**, and naming the third option is what resolves it:

| Where | When it wins |
|---|---|
| **Inline in the markdown** | small blocks, and any block where the payload *is* the documentation (Case A, B) |
| **A named action in `specs/actions/`** | anything with real setup, and anything reused — **already built** (Case C, D) |
| **An anonymous temp run in `.systemview/runs/`** | …the narrow band left over: too big to read inline, but not worth naming |

That last band is thin. If a sequence is big enough to hurt inline, it's almost always worth a name —
and naming it costs nothing and gets you reuse for free.

**So the recommendation flips from "file by default" to this:** `.systemview/runs/` is not a storage
tier competing with the doc — it's **the drafting state**. It's where a block lives while you're
still iterating on it, before it has a name. **Save as action** is the graduation, and it's a *move*,
not a conversion. Docs in the wild reference named actions; `.systemview/runs/` holds drafts.

Which also disposes of the lifecycle worry: drafts are *supposed* to be swept. A run file with no doc
referencing it is garbage by definition, not a decision anyone has to make.

---

## 10. Build log — P0–P2 (2026-08-07)

Shipped into the tree (uncommitted, unpublished):

| What | Where |
|---|---|
| directive parsing → one hast element → registry dispatch | `src/atoms/Markdown/directives.js`, `Markdown.js` |
| the block registry | `src/atoms/Markdown/registry.js` |
| surface scope (explicit prop → `/specs/…` URL fallback) | `src/atoms/Markdown/context.js` |
| `:ns[…]` resolved against the live connection tree, `?tab=` carried, dead state | `blocks/NsLink.js` |
| `:file[path#L40-70]` → `sv:openFileInNav` (+ `lines`) | `blocks/FileLink.js` |
| select + center the range in the opened file | `atoms/CodeView/CodeEditor.js` (`focusLines`), `CodePane.js` |
| `:::callout`, `:::details`, unknown-block chip | `blocks/Structure.js` |
| `::chart{report,range,service,height}` on live `getStats()` | `blocks/ChartEmbed.js` |
| `LineChart` extracted out of the Stats page (+ its styles) | `src/organisms/Charts/` |
| document-scoped theme tokens so embeds follow the DOCUMENT, not the app | `atoms/Markdown/styles.scss` |
| dead react-markdown **v5** `renderers` prop + `CodeBlock` | deleted |

Showcase surfaces: the `systemview-test` **project doc** is now a live document
(`systemview-test.md`), plus `docs/interactive-markdown.md` and a `markdown` **help topic**.

Verified in the browser: 10 chips / 3 callouts / 1 fold / 2 live charts render in the Documentation
tab; clicking `:ns[Math.add]` navigates to `/specs/systemview-test/TestService/Math/add?tab=docs`
(tab carried); clicking a `:file` chip opens the codebase surface on that file; the same blocks
render inside story panes; light and dark both correct. Suite 56/57 (the intentional
`Math.subtract` demo).

**Deliberately not built yet:** `::run` (P3) — it depends on the appendix's decision that a payload
either sits inline or names a saved action, and on reusing the Test Panel's engine rather than a
second executor. `::question` / `::slider` / write-back checklists (P4) need the §4.6 write path
(`saveDoc` / `writeFile`) wired to a block, which is a separate, careful change.

---

## 11. Build log — second wave (2026-08-07)

Driven by review feedback on the first wave.

**Fixes**

- **Browser back after opening a file.** The file open was state, not a location
  (`sv:openFileInNav` → React state + localStorage), so there was nothing to go back to — while
  `:ns[…]` worked because it pushes a route. The open file now lives in the URL
  (`?file=…&fproj=…&fsvc=…&flang=…&flines=…&fnav=<lens to restore>`), one URL→state effect is the
  only writer, and back closes the file and restores the lens. Side effect: **a file view is now
  shareable/deep-linkable**.
- **Dead and unknown chips now say WHY** — "not connected" / "no file host" / "unknown block", with
  a tooltip explaining the cause. Demonstrating a failure state without labelling it just looks
  broken.

**New blocks**

| Block | Notes |
|---|---|
| `::test[Math.chainUse]` | a saved test, runnable in place — renders the *same* `TestPane` story test panes use (lazy-imported: TestPane renders notes through Markdown, so the import is a real cycle). Takes a LABEL, not `{…}` — remark-directive can't parse a bare word as an attribute. |
| `::::tabs` / `:::tab{label=…}` | children register their labels upward through context; a container nests by giving the OUTER block one more colon |
| `::::columns` / `:::col` | grid, collapses to one column under 900px |
| `:help[markdown]` | opens a help topic in the centre panel via the existing `helpStore` channel |
| GFM task lists | **write back to the source document** (§4.6) — see below |

**§4.6 made real.** Toggling a checkbox rewrites the `- [ ]` on that source line and hands the whole
document to the hosting surface to save: the Documentation tab through `saveDoc`, a file pane and the
codebase preview through `writeFile`. A surface with no write path (help topics are a code constant)
renders the boxes disabled and says so on hover. GOTCHA worth keeping: react-markdown's `node` is the
**hast** node, so `node.checked` does not exist — remark-gfm has already produced
`<li class="task-list-item"><input type=checkbox>`; read the state off that child and drop the
rendered input. `node.position` survives the mdast→hast conversion, which is what gives the line
number to write back to.

**Surfaces re-aimed.** The `systemview-test` project doc went back to being *documentation* (its
blocks are there because they're useful — the service table links to namespaces, one runnable test,
one traffic chart, a live fixture checklist). The feature tour moved to where it belongs: the
**hub** — the document you land on with nothing selected — now a `:help[…]` chip row plus
`::::tabs` over Documents / Tests / Stories / Stats / Codebase, each carrying a read-only checklist
of what is and isn't built.

**Verified in the browser:** hub renders 5 tabs / 7 help chips / 11 read-only boxes, tab switching
and help chips work; the project doc renders a live test embed, a chart, 4 live boxes and a fold;
toggling a box changed `- [ ]` → `- [x]` **in the file on disk**; open-file → back returns to the
doc with the code pane closed. Zero page errors. Suite 56/57.

**Still open:** `::run` (P3), `::question` / `::slider` (P4), media/external embeds, `::mermaid`.
Extraction of the remaining Stats components (`LoadColumns`, `TopologyGraph`, tiles) is what unlocks
the rest of the P2 embeds.

### A refinement to `::run` from review

A `::run` block should have **two states**, not one: *unrun* (a Run button, for a human) and
*already run* (the recorded result rendered inline, because an agent ran it from the CLI). Same
block either way — so a document can carry **proof** rather than only an invitation.

---

## 12. Proposed — block-level comments (raised in review)

> "What if I could leave comments on the tables, code, the test embeds? What if it was on sections?
> I don't want it to be tacky."

Today a thread attaches to a whole story **pane**. Reading a long document, that's too coarse: the
thing you want to answer is *this table*, *this paragraph*, *that embedded test*. This proposes the
same conversation one level deeper — and, ideally, **unified**: a pane reply and a block comment
become one mechanism at two granularities (a pane is just a coarser anchor).

**What's commentable.** Every top-level markdown node: a heading (= the section it opens), a
paragraph, a table, a code fence, a list, and any `::block` — chart, test, callout, fold. We already
intercept components, so each top-level node gets wrapped once.

**Where comments live — sidecar, not inline.** A comment is conversation, not documentation. Writing
`:::comment` into the file would mean a doc shared outside the app carries chatter, and every reply
would dirty the git working tree. So: `.systemview/comments/<doc-key>.json`, keyed by anchor. This is
the one place the "document is the source of truth" rule (§4.6) does **not** apply, and the reason is
worth stating: §4.6 is about a document's own *content*; a comment is about the document.

**Anchoring** is the hard part — the Google-Docs problem. Proposed anchor, resolved in order:

1. `heading-slug` of the nearest preceding heading (stable across edits elsewhere),
2. index of the block within that section,
3. a short content hash of the block.

Resolution: exact (slug + index + hash) → hash anywhere in the doc (the block moved) → slug only
(the block changed; show the thread as **orphaned**, attached to the section, saying so). Never
silently drop a comment because a paragraph was reworded.

**Not tacky — the affordance.** No bubbles down the page. A thin left **gutter** (the story stage
already has one): hovering a block fades in a small `+` in the margin; a block that *has* comments
shows a small count dot. Click opens the thread — inline under the block, in the same visual language
as pane replies, so it reads as one feature rather than two.

**Why it matters beyond convenience.** It's the highest-precision channel into RFC-024: "this
paragraph is wrong" beats "something in this pane is wrong". An agent reading a doc plus its comment
sidecar gets your reaction anchored to the exact sentence, table row or failing test that provoked it.

**Open:** whether a comment can be *promoted* into the document (accepting a correction rewrites the
paragraph and resolves the thread) — the natural bridge to `::question` in P4.

---

## 13. Build log — third wave (2026-08-07)

**Links REVEAL, they don't navigate.** Review: *"the whole point is I just don't wanna navigate
away."* Clicking a reference while reading a document used to replace what you were reading — which
is exactly backwards, because you clicked it to understand the document, not to leave it.

Now a `:ns[…]` or `:file[…]` click **points the navigator at the target**: the lens switches
(SystemLynx / Codebases), the tree expands down to it, and the row is marked with a dashed amber ring
— deliberately a different language from selection, so *pointed at* can never read as *you are here*.
The centre panel doesn't move. Selecting is then your own click in the tree. **⌘/Ctrl-click** still
does the old thing (navigate outright / open the file), for when that IS what you meant.

Implementation: a `sv:revealInNav` event → page-level `reveal` state → passed into both trees.
Deliberately **not** in the URL — a pointer is not a location, so it must not push history. An actual
selection clears it (it has been acted on). The codebase side reuses the existing expand-to-and-
scroll-to logic by handing it the revealed file, with a separate `revealedPath` for the softer style.

**Input blocks — `::question` and `::slider` (P4).**

```markdown
::question[Do embeds complement panes, or replace them?]{id=fork options=complement|replace}
::slider{label="stats window" min=15 max=1440 step=15 value=60 unit=m}
```

Answering writes the answer **into the block's own attributes in the source document**:

```diff
- ::question[…]{id=fork options=complement|replace}
+ ::question[…]{id=fork options=complement|replace answer=complement}
```

Same §4.6 rule as checklists, one level up: a directive now carries its source line (`dline`, from
the mdast position that survives into hast), and the atom exposes a small write channel —
`setAttr(line, key, value)` — that rewrites that attribute inside the directive's `{…}` and hands the
whole document to the surface to save. The slider commits **on release**, not per pixel. Where a
surface can't save, the controls are disabled and say so.

Verified: deep-linked the playground file into the code preview, answered the live question, and
confirmed the attribute landed on the **live block (line 235)** while the identical fenced *example*
(line 231) was untouched — the parser doesn't see code fences as directives, so the line targeting is
correct by construction.

**Status:** built — links (`:ns`/`:file`/`:help`), reveal, callouts, folds, tabs, columns, `::chart`,
`::test`, checklists, `::question`, `::slider`, unknown-block chip. Remaining — `::run`, `::mermaid`,
media/external embeds, block-level comments (§12), and extracting the rest of the Stats components.

---

## 14. `::run` — ad-hoc first, saved second (corrected in review)

The first cut of `::run` only replayed a **saved** action by name. That inverted the point:

> "you're supposed to be able to just put together actions on the fly that you want that… I want you
> to run"

The whole value is that I can assemble steps **in the document, because you asked for them**, and you
press Run. Replaying something already saved is the lesser case — and if both exist they must be
**visually distinguished**, which they now are (an ad-hoc block carries a purple rail and reads
`run · written here`; a saved one reads `saved action · from specs/actions`).

```markdown
:::run{title="Seed, then chain"}
- Math.add { "a": 2, "b": 3 }
- use: seedSum                                       ← pull a saved action in as a step
- Math.chainUse { "base": tv(test.main[0].results.sum) }
:::
```

A step is `Module.method { json }` or `Service.Module.method { json }`; JSON may span lines. `tv(…)`
and `random(n)` work unchanged because it **is** the same engine — the parsed steps are handed to the
same `SavedTestItem`/`FullTestController` the Test Panel and story panes use. Implementation note: a
container directive now carries its **raw body** (`dsrc`, sliced from the source by mdast offsets),
because rendered children can't be parsed as instructions.

Verified end to end: an ad-hoc block with two written steps ran against the live service and reported
**PASSED**; a block mixing `use: seedSum` with a written step resolved to three steps.

### Follow-on raised in the same breath: the CLI should be able to START a service

> "the CLI needs to start a service for stuff like that"

Ad-hoc steps need something to run *against*. Today that's whatever the project already has
connected. For the agnostic case (RFC-021's testing project — a service you build up in the UI with
modules and methods), the CLI needs a verb that **stands a service up** so a document's ad-hoc steps
have a target that isn't someone's production surface. Filed here as the link between the two RFCs;
not designed yet.

---

## 15. `::run` — the corrections that made it real

Three things were wrong with the first ad-hoc cut, all found by using it:

**1. One argument is not an argument list.** A SystemLynx method takes as many arguments as any
function does, so the **call form** is now primary and positional:

```markdown
- Math.combine({ "a": 2, "label": "first" }, { "b": 3, "label": "second" })
- systemview-test.TestService.Math.getItems(3)
```

Splitting happens on **top-level commas only** — quotes, braces, brackets and nested parens (a
`tv(…)` is full of them) are never split through. The bare-object form stays as shorthand for the
one-argument case.

**2. A namespace must be spellable in full.** A document doesn't always know its service — a help
topic has no namespace at all, and a doc can be read from anywhere. So a step takes 2–4 segments:
`Module.method`, `Service.Module.method`, `project.Service.Module.method`. Whatever you leave off
comes from the document's scope, which is the same rule `:ns[…]` already follows. (Two segments IS
enough when the document is filed in the project — that's the common case, not the only one.)

**3. A shared action must stay a shared action.** Flattening `use: seedSum` into anonymous steps threw
away the thing that makes it useful. It is now a real **named section** carrying a `{ use }`
reference, so it renders and behaves exactly as it does in the Scratch Pad, and the block's header
counts it (`4 steps · 1 shared action`).

**And evaluations, because a run should be legible.** Assertions hang under a step:

```markdown
- Math.combine({ "a": 2, "label": "first" }, { "b": 3, "label": "second" })
  ✓ results.sum = 5
  ✓ results.inputs.a.label = "first"
  ✓ results.inputs.b.value = 3
```

`✓ path = value` compares by type (number / boolean / string), `✓ path ~ text` is is-like, `expect` is
a synonym, and a value may be a `tv(…)` reference. They produce the same `savedEvaluations` a test
carries, so a run reports **PASSED / FAILED** per step instead of leaving you to read a payload.

**The plumbing that made references actually work:** a `tv(…)` is not merely a string in the payload —
the engine resolves it from the argument's `targetValues`, each entry recording *where in the input*
the value belongs (`source_map`) and, for an embedded reference, its offset in the string. Authored
references are now lifted out of the JSON into exactly that shape — bare namespace in the input plus
a `targetValues` entry — which is why a reference across sections resolves at run time.

Verified live: a two-argument call with three assertions → **PASSED**; a four-step block mixing a
shared action, a fully-qualified namespace, a bare-number argument and a cross-section `tv(…)`
reference with four assertions → **PASSED**.

### Still open — the temporary, namespace-free action

> "you put the actions together, and you save that block in the dot systemview folder and you point
> to it with the CLI's service that's created because it's not tied to any particular namespace"

A saved action today lives in a service's `specs/actions/` and therefore belongs to a namespace. What
a document wants is a **temporary shared action**: assembled ad hoc, saved into `.systemview/` at the
project root, referenced by name from any document, and owned by the CLI-created service rather than
by any real one — the same drafting-state argument as §9's appendix. That needs a plugin method to
persist it and a CLI verb to stand the owning service up (§14), so it is designed here and not built.

---

## 16. Threads — BUILT (supersedes §12's design)

> "just like how we can comment… I can comment on story panes is what I mean"
> "maybe it shouldn't just be automatically… maybe it's a markdown that allows for replies, that wraps something"

§12 proposed making *every* block commentable with a gutter affordance, which dragged in the whole
anchoring problem (heading slugs + content hashes + an orphaned-comment state). The wrapper idea is
better and is what shipped:

```markdown
:::thread{id=extraction}
`TopologyGraph` came out of the Stats page whole — 435 lines, no behaviour change.
::topology
:::
```

The thread belongs to the wrapper, the wrapper lives in the document, so it **moves with the content
it's about** — no anchoring to guess at, no orphans when a paragraph is reworded, and no gutter noise
on paragraphs nobody wants to discuss. The affordance is the same one a story pane has: a quiet 💬 in
the corner that only asserts itself once there are replies, your replies and agent replies in
distinct looks, ⌘↵ to post. Reply shape is identical to a pane's: `{ text, ts, author }`.

**Storage: sidecar, not the document.** A comment is *about* a document, not part of it — inline
threads would land in every git diff and travel to anyone the file is shared with. Because the
wrapper names itself, the sidecar is a plain `id → replies` map, which is why none of §12's anchoring
machinery is needed. It requires **no new plugin method**: `.systemview/comments.<key>.json` goes
through the same `readFile`/`writeFile` the codebase surface uses.

Two implementation notes worth keeping:

- The path is **flat inside `.systemview/`** deliberately. The plugin's `writeFile` did not create
  missing directories, so a nested `comments/` path failed with ENOENT and looked like a silent
  no-op. `writeFile` now `mkdir -p`s (a good fix on its own), but the flat path keeps threads working
  against every already-published plugin.
- One sidecar read per document, shared by every thread in it, so a doc with ten threads makes one
  request.

Surfaces supply the key: the Documentation tab by namespace, a file pane and the codebase preview by
path. A surface with no key (help topics are a code constant) renders the thread read-only and says
so instead of pretending to save.

Verified: posted a reply in the browser → `.systemview/comments.file-docs-interactive-markdown.md.json`
appeared holding `{ "playground-demo": [ { text, ts, author: "you" } ] }` → after a full reload the
reply and its count badge came back.

---

## Shipped — systemview@2.18.0 (2026-08-08)

The first iteration is published. What landed beyond the original plan, because he corrected the
design while it was being built:

- **Threads are a WRAPPER** (`:::thread{id=…}`), not a per-block gutter — his design, and it removes
  the whole anchoring problem the plan had.
- **A right-click menu owns every saveable document**: start a thread, wrap the block in an approval
  / callout / fold, or insert a chart / logs / test / run / file / diff through a DRAWER that asks
  which target it should point at. Removing a wrapper unwraps; removing a leaf block asks first.
- **`:::approval`** — the story verdict as a wrapper, written back into the document, which is how an
  agent reads the decision.
- **`::logs`, `::file`, `::diff`** — the Logs viewer and the story file/diff panes, in prose.
- **The Report tab** — namespace-scoped documents in `.systemview/`, one line of chrome, several per
  namespace: what a story is for, without the frame.
- **Runnables settled**: no Main (an ad-hoc run has a `steps` section), assertions are a nested list,
  `test.` optional in references, `args` is a reference root, and steps resolve against the live tree.
- **Docs**: `agents/AGENTS.md` is the single agent file (was `docs/agents/`).

NOT shipped: `::cmd`, `::mermaid`, media embeds, a verdict tally across a document.
