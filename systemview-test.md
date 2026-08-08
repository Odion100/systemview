# systemview-test

SystemView's own **dogfood project**: the fixture services the CLI suite and the UI are developed
against. Everything here is real — these services run locally, the tests below execute, and the
charts are this project's own traffic.

It is also a **live document** (RFC-025): the second half demonstrates every markdown block the app
supports, source first and rendered result underneath. Same file, both jobs.

## The services

| Service | Port | Role |
|---|---|---|
| **TestService** | 5555 | the main fixture — :ns[Math.add], :ns[Math.chainUse], and the whole :ns[CLI.probe] surface the CLI suite drives |
| **GatedService** | 5556 | credentialed/cookie service — proves the auth-header contract |
| **GatedSibling** | 5557 | proves a captured session **rides** to a sibling service in the same project |
| **LoadBalancer** | 5569 | the LB observer rig behind the Stats page's cluster window |



Source lives under :file[test/service/index.js]; the LB rig is :file[test/lb/index.js].

## Running the suite

```bash
node cli/index.js test systemview-test          # everything
node cli/index.js test systemview-test Math     # one module
node cli/index.js test systemview-test --json   # for CI / agents
```

:::callout{type=info}
The suite is green at **56 / 57**. The single failure is deliberate: `Math.subtract` asserts a wrong
expected value so there is always one red row to look at.
:::

## Fixture health checklist



These boxes are live — ticking one **edits this file** (`systemview-test.md` at the repo root):

- [x] TestService fixtures cover Math, Auth, CLI
- [x] Credentialed service + sibling session ride
- [ ] LB rig exercised by an automated test (currently manual)
- [ ] A fixture that emits events on a schedule (for the Events section)


:::details{summary="Why the project doc lives at the repo root"}
A doc attached to a service/module/method is written to that service's `specs/docs/` folder. A
**project-level** doc has no namespace to hang on, so the plugin puts it at `<cwd>/<projectCode>.md`
— shared by every service in the project, since they all run from the same working directory. See
:file[systemview-plugin/SystemViewModule.js].
:::


---

# The blocks, demonstrated

Everything below is running. Each part shows the markdown source, then what it renders as.

## Namespace links — `:ns[…]`

```markdown
The chain test lives in :ns[Math.chainUse], the error fixtures in :ns[Auth.throwError],
and the session ride in :ns[GatedSibling.Auth.getSession].
```

The chain test lives in :ns[Math.chainUse], the error fixtures in :ns[Auth.throwError], and the
session ride in :ns[GatedSibling.Auth.getSession].

Segment count decides how much you name — the rest comes from the document's own scope:

| Written | Means |
|---|---|
| `:ns[Math.add]` | `Math.add` on **this document's** service |
| `:ns[GatedService.Auth.getSession]` | a named service in this project |
| `:ns[systemview-test.TestService.Math.add]` | fully qualified |


They resolve against the **live connection tree** — the services actually connected right now, with
their modules and methods, the same tree the left nav draws. A name that isn't in it renders dashed
and says why, instead of looking fine and going nowhere:

```markdown
:ns[Ghost.vanished]
```

:ns[Ghost.vanished]

## File links — `:file[…]`

```markdown
The dispatch lives in :file[src/atoms/Markdown/Markdown.js#L20-46] and the vocabulary
in :file[src/atoms/Markdown/registry.js].
```

The block dispatch lives in :file[src/atoms/Markdown/Markdown.js#L20-46], the vocabulary in
:file[src/atoms/Markdown/registry.js], and the range grammar those links reuse is
:file[cli/stage.js#L43-52] — the same `parseFileSpec()` the story `--file` flag has always used.

Clicking one **points the navigator at it** — the Codebases lens expands to the file and highlights
it, without moving you off this document. ⌘-click opens it in the centre instead.

## Callouts — `:::callout{type=…}`

```markdown
:::callout{type=warn}
Percentiles stay all-time even under a time range.
:::
```

:::callout{type=info}
`info` — the default. Context the reader needs but didn't ask for.
:::

:::callout{type=warn}
`warn` — percentiles stay **all-time** even under a time range. That's the bounded-memory contract:
per-bucket histograms would grow without limit.
:::

:::callout{type=danger}
`danger` — a runnable block can do anything a saved test can. A document is not permission: every
runnable takes a click, and destructive calls confirm first.
:::

:::callout{type=success}
`success` — 56 of 57 green, the one red being the intentional demo.
:::

## Folds — `:::details{summary=…}`

:::details{summary="Why raw HTML stays off (click to open)"}
No `rehype-raw`. Directives are the **only** extension point, so a document pulled off disk — or
written by an agent — can only reach components deliberately registered in the block registry.

An unknown block renders visibly rather than vanishing, so a document written against a newer
version degrades honestly. This one doesn't exist — that's the point:

```markdown
::sparkline{of=everything}
```

::sparkline{of=everything}
:::

## Live charts — `::chart{…}`

```markdown
::chart{report=throughput range=1h}
::chart{report=errors range=4h}
```

::chart{report=throughput range=1h}

::chart{report=errors range=4h}

Same `LineChart` the Stats page draws — extracted to :file[src/organisms/Charts/LineChart.js] so it
isn't trapped on one page, which also means the page and the embed can't drift. Attributes:
`report` = `throughput` · `errors` · `latency`, plus `range`, `service`, `height`.

:::callout{type=info}
The chart follows the **document's** theme, not the app's. A document is explicitly light or dark, so
the theme tokens are re-declared inside the document scope — flip this pane's theme and the chart
follows it.
:::

## A runnable test — `::test[…]`

```markdown
::test[Math.chainUse]
```

::test[Math.chainUse]

The saved test itself, runnable here. Same component the story test panes render, so the test stays
the single source of truth — edit it in the Test Panel and every document embedding it follows.
`::test[Math.add:1]` pins one test by index.

## Tabs and columns

```markdown
::::tabs
:::tab{label="CLI"}
`node cli/index.js test systemview-test`
:::
:::tab{label="UI"}
Hit **Run** on the embedded test above.
:::
::::
```

::::tabs
:::tab{label="CLI"}
Run the whole suite from the terminal: `node cli/index.js test systemview-test`
:::
:::tab{label="UI"}
Or hit **Run** on the embedded test above — same specs, same engine, either way.
:::
::::

Note the colon count: a container nests by giving the **outer** block one more colon. `::::columns`
with `:::col` children works the same way.

## Carousel — `::::carousel` / `:::slide`

```markdown
::::carousel
:::slide{label="Throughput"}
::chart{report=throughput range=1h height=80}
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
::load{limit=6}
:::
:::slide{label="Topology"}
::topology
:::
::::

One at a time, arrows and dots. Only the **active** slide is mounted, so the off-screen charts aren't
quietly fetching this project's stats in the background.

## Runnables — `:::run` written here, `::run[name]` saved

The point is putting steps together **on the fly** against these fixtures — not replaying something
already saved. A step is a method call with as many arguments as the method really takes, and its
**assertions are a nested list** under it, so the run reports pass/fail instead of leaving you to
read a response body:

```markdown
:::run{title="Two-argument call, checked"}
- Math.combine({ "a": 2, "label": "first" }, { "b": 3, "label": "second" })
  - results.sum = 5
  - results.inputs.b.value = 3
:::
```

:::run{title="Two-argument call, checked"}
- Math.combine({ "a": 2, "label": "first" }, { "b": 3, "label": "second" })
  - results.sum = 5
  - results.inputs.a.label = "first"
  - results.inputs.b.value = 3
:::

Each nested bullet becomes a real **evaluation** — the same `{ path, comparison, expected }` a saved
test stores, so it runs through the same validators and shows the same green/red per step. `=`
compares by type (`5` is a number, `"first"` a string, `true` a boolean) and `~` is *is-like*. You
can write `expect` or `assert` in front of a bullet, or the `✓` you'll see in older examples — all
optional, all the same thing:

| Written | Means |
|---|---|
| `- results.sum = 5` | `results.sum` must equal the **number** 5 |
| `- expect results.label = "first"` | must equal the **string** `first` |
| `- results.ok = true` | must equal the **boolean** true |
| `- results.name ~ ser_` | must *look like* `ser_` |

There is **no Main here, and no Before/After** — an ad-hoc run isn't a test being saved under a
namespace, it's a list of steps, which is exactly what a shared action is. Its steps run in a section
called `steps`, and any `use:` action sits beside it as its own named section.

Which means the two mix freely. Here is a longer one: **two shared actions and three written steps**,
with `tv(…)` references reaching backwards both into an argument *and* into an assertion:

```markdown
:::run{title="Two shared actions, three written steps, references both ways"}
- use: seedSum
- use: warmupItems
- Math.multiply({ "a": tv(seedSum[0].results.sum), "b": 4 })
  - results.product = 20
- Math.describe("combine", 2, true, [1, 2, 3])
  - results.summary = "combine x2"
- Math.chainUse({ "base": tv(steps[0].results.product) })
  - results.base = tv(steps[0].results.product)
:::
```

:::run{title="Two shared actions, three written steps, references both ways"}
- use: seedSum
- use: warmupItems
- Math.multiply({ "a": tv(seedSum[0].results.sum), "b": 4 })
  - results.product = 20
- Math.describe("combine", 2, true, [1, 2, 3])
  - results.summary = "combine x2"
  - results.average = 2
  - results.scoreCount = 3
- Math.chainUse({ "base": tv(steps[0].results.product), "items": tv(warmupItems[0].results.total) })
  - results.chained = true
  - results.base = tv(steps[0].results.product)
  - results.items = tv(warmupItems[0].results.total)
:::

Read the references by **section name**: `steps[0]` is the first step written in this block,
`seedSum[0]` is the first step of that shared action, `warmupItems[0]` the other one's. A reference
works the same in an argument and in an assertion — the second is how you check that a value actually
travelled, instead of hoping it did.

:::callout{type=info}
The engine spells these `tv(test.steps[0]…)` because inside a saved test the whole thing *is* the
test. Here that word is noise, so it's optional — `tv(steps[0]…)` and `tv(test.steps[0]…)` are the
same reference. Nothing about a run block is "filed under" a test or a namespace.
:::

A reference can point at an earlier action's **argument**, not only its results — which is how you
check that a value you sent actually came back, without repeating the literal in two places and
hoping they stay in sync:

:::run{title="Referencing an argument, not a result"}
- Math.multiply({ "a": 7, "b": 6 })
  - results.product = 42
- Math.chainUse({ "echo": tv(steps[0].args[0].a) })
  - results.echo = 7
  - results.echo = tv(steps[0].args[0].a)
  - results.chained = true
:::

`steps[0].args[0].a` reads: the first step written here, its first argument, the `a` inside it. Change the `7` above and both the call and the assertion follow it.

Note the argument types in `Math.describe`: a string, a number, a boolean and an array, positional —
not one JSON object. A step takes what the method takes.

And the **saved** form, badged differently so you always know which one you're looking at:

```markdown
::run[seedSum]
```

::run[seedSum]

:::callout{type=danger}
A run does anything a saved test can, against the real fixture services. It **never auto-runs** — a
click is always required, because a document is not permission.



:::

## Files and diffs — `::file` / `::diff`

The two story-pane kinds a document was missing. Same atoms the panes render, so a file looks the
same in a story and in a document — the inline chip **points at** a file, the block **brings it in**:

```markdown
:file[cli/stage.js#L43-52]      ← a chip that reveals it in the nav
::file[cli/stage.js#L43-52]     ← the file itself, at that range
::diff[cli/runTests.js]         ← working copy vs git HEAD
```

::file[src/atoms/Markdown/registry.js#L20-46]

The header path is clickable: it reveals the file in the codebase tree, ⌘-click opens it. A `::diff`
is **read-only** here on purpose — scrolling past a diff shouldn't be a chance to edit a file by
accident; open it properly if you mean to change it.

## Logs — `::logs`

```markdown
::logs                     ← this document's namespace
::logs[Math.chainUse]      ← one method, resolved against the live tree
::logs[GatedService.Auth]  ← name the service
::logs[Math]{limit=25}     ← a readable tail instead of the whole ring buffer
```

Run something above — the embedded test, or either run block — then watch it land here. Same viewer
the **Logs** tab renders (field filters, the frequency dashboard, Monitor, Clear), scoped by the
block instead of by the nav:

::logs[Math]


## Inputs — `::question[…]`

```markdown
::question[Which fixture is this run against?]{options=TestService|GatedService|LoadBalancer}
```

:::thread{id=t1}
::question[Which fixture is this run against?]{options=TestService|GatedService|LoadBalancer answer=TestService}
:::



Answering writes `answer=…` back into this file — the same rule as the checklist above. **The
document is the state**; there is no second store to fall out of sync.

## Approvals — `:::approval{ask=…}`

A story's approve/reject verdict, as a wrapper. An agent proposes something and needs an answer it
can read back; the verdict is written **into the document**, so reading the document *is* reading the
decision — no second store, nothing to sync:

```markdown
:::approval{id=plan ask="Approve the migration plan?"}
Move the log store to per-service files.
:::
```

:::approval{id=demo ask="Approve this example?"}
Hit ✓ or ✗ — the choice lands in this file as `verdict=approved` / `verdict=rejected`. Click the same
one again to withdraw it, because "I take that back" has to be expressible.
:::

## Threads — `:::thread{id=…}`

Wrap anything worth talking about and it carries the **same reply thread a story pane has**: the 💬
in the corner, your replies and agent replies in distinct looks, ⌘↵ to post.

```markdown
:::thread{id=lb-rig}
The LB rig is still driven by hand.
::load{limit=6}
:::
```

:::thread{id=lb-rig}
The LB rig at :file[test/lb/index.js] is still exercised by hand — it's the unticked box in the
fixture checklist at the top. Hit the 💬 and leave a note about what an automated version should
assert; it saves beside the repo and comes back on reload.

::load{limit=6}
:::

- [x] first thing
- [x] second thing


`Math.subtract` fails on purpose so there's always one red row to look at. Reply here if that ever
stops being useful — the conversation stays with the paragraph it's about.

The wrapper is what makes this simple: the thread belongs to it, and it lives in the document, so it
travels with the content it's about — no anchoring to guess at, no orphaned comments when a
paragraph gets reworded. Replies go in a **sidecar** (`.systemview/comments.<key>.json`), not into
this file, so conversation stays out of your git diffs.

---

Full vocabulary with examples: :help[markdown] · plan and status:
:file[RFCs/RFC-025-interactive-markdown.md] · standalone showcase:
:file[docs/interactive-markdown.md]

