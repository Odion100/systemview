# Interactive markdown — the playground

Everything on this page is **live**. Each section gives you the source you'd write, then the real
thing directly under it — click it, run it, toggle it. Nothing here is a picture of a feature.

For users: this is what your documents can do. For agents: this is the vocabulary, and
`src/atoms/Markdown/registry.js` is the map. Plan and status: `RFCs/RFC-025-interactive-markdown.md`.

---

## 1 · Namespace links — `:ns[…]`

```markdown
The chain test lives in :ns[Math.chainUse], the error fixtures in :ns[Auth.throwError],
and the session ride in :ns[GatedSibling.Auth.getSession].
```

The chain test lives in :ns[Math.chainUse], the error fixtures in :ns[Auth.throwError], and the
session ride in :ns[GatedSibling.Auth.getSession].



| Written | Means | Live |
|---|---|---|
| `:ns[Math.add]` | this document's service, from scope | :ns[Math.add] |
| `:ns[GatedService.Auth.getSession]` | a named service | :ns[GatedService.Auth.getSession] |
| `:ns[systemview-test.TestService.Math.add]` | fully qualified | :ns[systemview-test.TestService.Math.add] |
| `:ns[Math]` | a whole module | :ns[Math] |

:::run{title="Steps"}
- Module.method({ "a": 1 })
  - results.ok = true
:::


They resolve against the **live connection tree** — the services connected right now, with their
modules and methods, the same tree the left nav draws. A name that isn't in it renders dashed and
says why: :ns[Ghost.vanished]

:::run{title="Steps"}
- Module.method({ "a": 1 })
  - results.ok = true
:::

---

## 2 · File links — `:file[…]`

```markdown
The dispatch lives in :file[src/atoms/Markdown/Markdown.js#L20-46].
```

The dispatch lives in :file[src/atoms/Markdown/Markdown.js#L20-46], the vocabulary in
:file[src/atoms/Markdown/registry.js], the block components in
:file[src/atoms/Markdown/blocks/NsLink.js], and the range grammar they reuse is
:file[cli/stage.js#L43-52].

**Click one** — the navigator switches to the Codebases lens, expands to the file and **highlights**
it. The document you're reading stays put. ⌘-click opens the file in the centre instead (that's a
real history entry, so **back** returns here).

A file chip with nothing that can read it says so: :file[nowhere/at/all.js]

---

## 3 · Help links — `:help[…]`

```markdown
:help[markdown] :help[scratchpad] :help[stories]
```

:help[markdown] :help[scratchpad] :help[actions] :help[stories] :help[events] :help[navigator]

**Click one** — that help topic opens in the centre panel, the same channel every **?** icon uses.

---

## 4 · Callouts — `:::callout{type=…}`

```markdown
:::callout{type=warn}
Percentiles stay all-time even under a time range.
:::
```

:::callout{type=info}
`info` — the default. Context the reader needs but didn't ask for.
:::

:::callout{type=warn}
`warn` — percentiles stay **all-time** even under a time range. That's the bounded-memory contract.
:::

:::callout{type=danger}
`danger` — a runnable block can do anything a saved test can. A document is not permission.
:::

:::callout{type=success}
`success` — the suite is green at 56/57; the red one is the intentional `Math.subtract` demo.
:::

---

## 5 · Folds — `:::details{summary=…}`

```markdown
:::details{summary="Why raw HTML stays off"}
…any markdown, including other blocks…
:::
```

:::details{summary="Why raw HTML stays off — click me"}
No `rehype-raw`. Directives are the **only** extension point, so a document pulled off disk — or
written by an agent — can only reach blocks deliberately registered.

Blocks nest inside a fold, including live ones:

::chart{report=errors range=4h height=70}

An unknown block renders visibly rather than vanishing, so a document written against a newer
version degrades honestly. This one doesn't exist — that's the point: ::sparkline{of=everything}
:::

---

## 6 · Tabs — `::::tabs` / `:::tab{label=…}`

```markdown
::::tabs
:::tab{label="CLI"}
`node cli/index.js test systemview-test`
:::
:::tab{label="UI"}
Hit **Run** on an embedded test.
:::
::::
```

::::tabs
:::tab{label="CLI"}
Run the whole suite from the terminal:

```bash
node cli/index.js test systemview-test
```
:::
:::tab{label="UI"}
Or hit **Run** on the embedded test in section 8 — same specs, same engine, either way.
:::
:::tab{label="Nesting"}
The outer container takes one **more** colon than its children — `::::tabs` around `:::tab`. Any
markdown goes inside, including other blocks:

:::callout{type=info}
A callout inside a tab.
:::
:::
::::

---

## 7 · Columns — `::::columns` / `:::col`

```markdown
::::columns{split=55}
:::col
left
:::
:::col
right
:::
::::
```

::::columns{split=55}
:::col
**A lead, beside its evidence.** The same instinct as a lead pane sitting next to the pane it leads
into — except inside a single document. Columns collapse to one on a narrow pane.
:::
:::col
::chart{report=throughput range=1h height=70}
:::
::::

---

## 8 · Live embeds — `::chart{…}` and `::test[…]`

```markdown
::chart{report=throughput range=1h}
::test[Math.chainUse]
```

::chart{report=throughput range=1h}

::chart{report=latency range=4h}

`report` = `throughput` · `errors` · `latency`; also takes `range`, `service`, `height`. It's the
same `LineChart` the Stats page draws, from the same `getStats()` snapshot, so the page and the
embed can't drift — :file[src/organisms/Charts/LineChart.js].

A **saved test, runnable right here**:

::test[Math.chainUse]

The test stays the single source of truth — edit it in the Test Panel and every document embedding
it follows. `::test[Math.add:1]` pins one test by index.

---

## 9 · Checklists that edit the document

```markdown
- [x] directive parsing + registry
- [ ] ::run over the saved-action engine
```

This file is on disk, so these are **live** — ticking one rewrites `docs/interactive-markdown.md`:

- [x] directive parsing + block registry
- [x] navigation links (`:ns`, `:file`, `:help`)
- [x] structure (callouts, folds, tabs, columns)
- [x] live embeds (`::chart`, `::test`)
- [x] checklists that write back
- [x] `::question` — answers that persist into the document
- [x] `:::run` — steps written on the fly, plus `::run[name]` for a saved action
- [x] `::topology` · `::load` — the rest of the Stats page
- [x] `::::carousel` / `:::slide`
- [ ] `::cmd` — run a SystemView CLI verb, output inline
- [ ] media and external embeds
- [ ] `::mermaid` diagrams

Toggling a box writes down the same path the editor uses (`saveDoc` for the Documentation tab,
`writeFile` for file panes). Where a surface has nothing to save to, the boxes render disabled and
say so on hover — **the document is the state; there is no second store.**

---

## 10 · Inputs — the document asks *you* something

```markdown
::question[Do embeds complement panes, or replace them?]{id=fork options=complement|replace}
```

::question[Do embeds complement panes, or replace them?]{id=fork options=complement|replace answer=replace}

Answer it. The choice is written **into this file** as an attribute on the block itself:

```diff
- ::question[…]{id=fork options=complement|replace}
+ ::question[…]{id=fork options=complement|replace answer=complement}
```

Same rule as the checklists — the document is the state, and that's how an agent reads your verdict
back. This is the primitive behind RFC-024's plan-first stories.

---

## 11 · Runnables — steps written **on the fly**

The point isn't replaying something saved. It's that I can put steps together **here, because you
asked for them**, and you press Run.

A step is a **method call with as many arguments as the method really takes** — the call form is the
primary one, positional and comma-separated. Assertions hang under a step so a run reports
**pass/fail** instead of leaving you to read a response body.

```markdown
:::run{title="Two-argument call, checked"}
- Math.combine({ "a": 2, "label": "first" }, { "b": 3, "label": "second" })
  ✓ results.sum = 5
  ✓ results.inputs.a.label = "first"
  ✓ results.inputs.b.value = 3
:::
```

:::run{title="Two-argument call, checked"}
- Math.combine({ "a": 2, "label": "first" }, { "b": 3, "label": "second" })
  ✓ results.sum = 5
  ✓ results.inputs.a.label = "first"
  ✓ results.inputs.b.value = 3
:::

**Namespaces** take as much as you need to write. A document filed on a service can say
`Math.add`; one that isn't can spell it out — `systemview-test.TestService.Math.add`. Arguments can be
objects, arrays, numbers, strings, or `tv(…)` references to an earlier step:

```markdown
:::run{title="Mixed arguments, references, and a shared action"}
- use: seedSum
- systemview-test.TestService.Math.getItems(3)
  ✓ results.total = 10
  ✓ results.meta.pageSize = 10
- TestService.Math.chainUse({ "base": 1, "seeded": tv(test.seedSum[0].results.sum) })
  ✓ results.chained = true
  ✓ results.seeded = tv(test.seedSum[0].results.sum)
:::
```

:::run{title="Mixed arguments, references, and a shared action"}
- use: seedSum
- systemview-test.TestService.Math.getItems(3)
  ✓ results.total = 10
  ✓ results.meta.pageSize = 10
- TestService.Math.chainUse({ "base": 1, "seeded": tv(test.seedSum[0].results.sum) })
  ✓ results.chained = true
  ✓ results.seeded = tv(test.seedSum[0].results.sum)
:::

Notice what `use: seedSum` does — it stays a **shared action**, its own titled section, exactly as it
appears in the Scratch Pad. It is not flattened into anonymous steps, because it isn't anonymous.

**Assertion forms:** `✓ path = value` (numbers, booleans and strings compare by type), `✓ path ~ text`
(is-like / regex), and the value may itself be a `tv(…)` reference. `expect` works as a synonym for
`✓`.

And the **saved** form, for replaying an action by name — badged differently so you can always tell
which one you're looking at:

```markdown
::run[seedSum]
```

::run[seedSum]

:::callout{type=danger}
A run block does anything a saved test can. **Never auto-runs** — a click is always required, and a
document is not permission.
:::

---

## 12 · The rest of the Stats page — `::topology` and `::load`

```markdown
::topology
::load{limit=10}
```

::topology

::load{limit=10}

Both are the **same components** the Stats page draws, extracted to `organisms/Charts` and fed from
the same `getStats()` snapshots through the same derivations (:file[src/organisms/Charts/derive.js]),
so a document and the page cannot disagree. The topology graph is fully interactive here — drag the
nodes, click a card to expand the methods called on it, click a line to trace it.

---

## 13 · Carousel — `::::carousel` / `:::slide`

```markdown
::::carousel
:::slide{label="Throughput"}
::chart{report=throughput range=1h}
:::
:::slide{label="Load"}
::load{limit=8}
:::
::::
```

::::carousel
:::slide{label="Throughput"}
::chart{report=throughput range=1h height=80}
:::
:::slide{label="Errors"}
::chart{report=errors range=4h height=80}
:::
:::slide{label="Load"}
::load{limit=8}
:::
:::slide{label="A saved test"}
::test[Math.add]
:::
::::

One item at a time, with arrows and dots. Only the **active** slide is mounted, so an off-screen
chart or test isn't quietly fetching in the background.

---

## 14 · Approvals — a decision, wrapped around what's being decided

An agent proposes; you answer; the answer is written **into the document**, so reading the document
*is* reading the decision — the agent needs no second store to consult.

```markdown
:::approval{id=plan ask="Approve the migration plan?"}
Move the log store to per-service files.
:::
```

:::approval{id=playground ask="Approve this example?"}
Hit ✓ or ✗. The verdict lands in this file as `verdict=approved` / `verdict=rejected`, and the block
turns green or red so a shared document shows where things stand at a glance.

Click the same one again to **withdraw** it — "I take that back" has to be expressible.
:::

Anything nests inside: a diff, a checklist, a runnable, a thread. Right-click a block and use
**Wrap this in → Approval** to put one around something that's already written.

---

## 15 · Logs, files and diffs — the rest of the panes

```markdown
::logs[Math]{limit=25}
::file[src/atoms/Markdown/registry.js#L20-46]
::diff[cli/runTests.js]
```

The Logs tab's own viewer, scoped by the block instead of by the nav — run something above and watch
it land here:

::logs[Math]{limit=25}

A file, at a line range. The header path reveals it in the codebase tree; ⌘-click opens it:

::file[src/atoms/Markdown/registry.js#L20-46]

A diff against git HEAD — read-only here, because scrolling past one shouldn't be a chance to edit a
file by accident:

::diff[cli/runTests.js]

---

## 16 · Threads — reply on a block

Wrap anything you want to talk about and it gets the **same reply thread a story pane has** — the 💬
corner, your replies and agent replies in distinct looks, ⌘↵ to post.

```markdown
:::thread{id=extraction}
`TopologyGraph` came out of the Stats page whole — 435 lines, no behaviour change.
::topology
:::
```

::::thread{id=playground-demo}
Try it: hit the 💬 in the corner of this block and leave a reply. It is written **into this file** as
a `:::reply` block, so the document carries its own conversation — nothing else to fetch.
:::reply{author=agent ts=1786180000000}
An agent reply, written straight into the document. Anything with `author=agent` renders like this.
:::

Wrapping is deliberate — a thread belongs to the wrapper, the wrapper lives in the document, so it
moves with the content it's about. No hidden anchoring to guess at, no orphaned comments when a
paragraph gets reworded, and no gutter noise on paragraphs nobody wants to discuss.
::::

The `id` is what makes a thread survive edits above it. Without one it falls back to the source line,
which still works but re-anchors if the document shifts.

Comments live in a **sidecar**, not in the document: a comment is *about* the document, not part of
it, so threads stay out of your git diffs and off anyone you share the file with. Because the wrapper
names itself, the sidecar is a plain `id → replies` map.

---

## 17 · Still to come

Sketches only — these don't exist yet:

```markdown
::cmd[systemview test systemview-test]     ← run a SystemView CLI verb, output inline
::mermaid                                   ← diagrams
```

`::cmd` is the command-line idea: an allowlist of SystemView's own CLI verbs rather than a general
shell, with two states — unrun (a Run button) and already-run (the recorded transcript an agent
captured). Also ahead: media/external embeds and block-level comments.

---

## Where this works

One renderer, so every surface got all of the above at once: the **Documentation** tab, **story**
markdown panes and `.md` file panes, **agent notes** on test panes, the **codebase** preview, and
**help** topics. Open this same file as a story file pane or in the codebase tab — it behaves
identically.
