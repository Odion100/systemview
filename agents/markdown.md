# Interactive markdown — the full vocabulary (for agents)

Every markdown surface in SystemView renders through ONE renderer: the Documentation tab, the Report
tab, story markdown panes, `.md` file panes, notes on tests, help topics, the codebase preview. A
block written in any of them works in all of them. Raw HTML is disabled — directives are the only
extension point, and `src/atoms/Markdown/registry.js` is the complete list of what exists.

Live worked examples you can open in the UI: `docs/interactive-markdown.md` (the playground, every
block rendered) and `systemview-test.md` (the dogfood project doc). Siblings: [AGENTS.md](AGENTS.md),
[tests.md](tests.md), [namespaces.md](namespaces.md).

---

## The syntax

Directives, not HTML (raw HTML is disabled):

```
:name[label]{attrs}      inline
::name[label]{attrs}     block
:::name{attrs} … :::     container (wraps content; the outer one takes one MORE colon when nesting)
```

## `:ns[…]` — a namespace chip

```markdown
:ns[Math.chainUse]                              this document's service, from scope
:ns[GatedService.Auth.getSession]               a named service
:ns[systemview-test.TestService.Math.add]       fully qualified
```

Resolves against the **live connection tree** — the services connected right now. A name that isn't
in it renders dashed and says why instead of lying. Clicking opens what it points at and the
navigator expands to mark where you arrived.

## `:file[…]` and `::file[…]` — a file, linked or embedded

**One colon links. Two colons embed the whole file inline.**

```markdown
:file[src/atoms/Markdown/registry.js#L20-46]    a chip that opens the file at a line range
::file[cli/stage.js#L43-52]                     the file itself, in the document
:file[src/Pages/ResourcesPage.js]{project=BUApp}   a file in ANOTHER repo
```

**Cross-repo needs `project=`.** Without it the chip resolves against the current project and
silently points at nothing — it renders, it just goes nowhere.

`#L10-20` and `#L10-L20` are the same address. Hub-served by project code, so a file chip works with
every service down. A `::file` pointed at an image renders the image viewer.

## `:help[…]` — a help topic

```markdown
:help[markdown] :help[scratchpad] :help[navigator]
```

Opens that topic in the centre panel — the same channel every **?** icon uses. `:help` is the one
link that works the other way round: a click reveals its row in the nav, ⌘-click opens it.

## `:ui[…]` — point at a region of the window

```markdown
Your answer lands in :ui[chat]; the long version is on the :ui[tv].
```

A reference to a **region of the window** rather than to data — `chat`, `tv`, `center`,
`scratchpad`, `navigator`. Clicking points at it; nothing is written anywhere. This is what lets you
teach the layout on the fly instead of describing it. An unknown region renders dashed.

## `:report[…]` — link to a report

```markdown
:report[The agent face stops going through the CLI]
```

Opens a filed report by its title. Reports are markdown files in `.systemview/` — **title them by
SUBJECT, never by position** ("the next iteration" only works once). A report about a file should
open with a `:file` chip so the artifact is one click away.

## `::chart{…}` — a live chart

```markdown
::chart{report=throughput range=1h}      throughput | errors | latency
::chart{project=buAPI report=errors range=4h height=70}
```

Reads the same rollups the Stats page draws. Percentiles stay **all-time** even under a range —
that is the bounded-memory contract, not a bug.

## `::test[…]` — a saved test, runnable in place

```markdown
::test[Math.chainUse]                                    runnable here
::test[Math.add]{ran=".systemview/runs/r1.json"}         the same block ALREADY RAN
```

The `ran=` form hydrates from a recorded run — steps coloured, responses real, a "recorded run"
badge. Play re-runs it fresh.

## `::logs[…]` — the log viewer, scoped

```markdown
::logs[Math.chainUse]{limit=50}
::logs{project=buAPI service=Profiles limit=20}
```

## `::diff[…]` — working copy vs git HEAD

```markdown
::diff[cli/runTests.js]
::diff[api/index.js]{project=systemview-test}
```

Read-only in a document.

## `::image[path]{caption=…}` — an image

```markdown
::image[docs/shot.png]{caption="the corpora surface"}
```

An image is just another file kind — a block-form `::file` pointed at one renders the same viewer.

## `::topology` and `::load` — the rest of the Stats page

```markdown
::topology                the service call graph — who calls whom
::load{limit=8}           load concentration
```

## `:::run{title=…}` — steps written on the fly

The point is assembling steps **in the document**, for a human to press Run on:

```markdown
:::run{title="Seed and chain"}
- use: seedSum
- Math.multiply({ "a": tv(seedSum[0].results.sum), "b": 4 })
  - results.product = 20
- Math.describe("combine", 2, true, [1, 2, 3])
  - results.summary = "combine x2"
:::
```

- A step is a **method call with as many arguments as the method takes** — positional, comma
  separated. `Module.method { … }` is shorthand for one object argument.
- **Assertions are a nested list** under the step. `- path = value` (typed), `- path ~ text`
  (is-like). `expect`, `assert` or `✓` in front are optional synonyms.
- `use: <action>` pulls in a shared action as its own named section.
- The block's own section is `steps`; references read `tv(steps[0]…)`.
- `::run[seedSum]` replays a **saved** action instead, badged differently.
- **Never auto-runs.** A document is not permission.

## `- [ ]` — checklists that edit the document

An ordinary task list. Ticking one **writes back into the markdown** — there is no second store.

## `::question{…}` — the document asks *you* something

```markdown
::question[Which approach?]{options=a|b}
::question[Which?]{options="close the hole|show who is caught up"}
```

`answer=…` is written into the block, so the document carries the decision.

**QUOTE any value containing a space.** An unquoted space kills the whole directive **silently** —
it renders as literal text and nothing tells you why.

## `::ask[…]` — the one thing you need from them, made visible

```markdown
::ask[Should the corpus point at agents/ or docs/?]
::ask[Restart the shell — the origin fix is in electron/ and cached until then]
::ask[Which do you want first?]{why="both touch the same file, so the order matters"}
```

**Records nothing, offers nothing — it exists to be seen.** A thing buried in the fourth paragraph
of a long reply does not get acted on; it gets scrolled past, and the work continues on a guess.

**It is not always a question.** "Restart the shell" is the same kind of block — the one thing
needed from the human. The mark is inferred, so there is nothing to remember: text ending in `?`
renders as a question, anything else renders as a thing to do. `why=` is the one-line reason it
matters — what the answer changes. Optional.

**Not `::question`.** That one offers options and writes `answer=` back into the document, which
makes it a decision record. This is the opposite: one sentence to be looked at, nothing filed.
**One per message** — two is a list, and a list is the thing this exists to prevent.

## `:::approval{…}` — ask for a decision

```markdown
:::approval{ask="Approve the plan?"}
…what is being decided, in full…
:::
```

Wrap what you are proposing and read `verdict=approved|rejected` back off the document later. That
is the entire handshake — there is nowhere else to check.

## `::::thread{id=…}` and `:::reply{…}` — a conversation in the document

```markdown
::::thread{id=extraction}
Anything wrapped here carries a reply thread.
::::
```

**Replies live IN the document** as `:::reply{author=… ts=…}` blocks, so reading the document is
reading the whole exchange. (A sidecar remains only for surfaces with no file to write to — the help
hub and help topics.)

Three things that have each cost a real mistake:

- **Answer with the tool, never by hand-editing the markdown** —
  `mcp__systemview__reply({ projectCode, report, threadId, text })` inserts the block in the right
  thread. For a file's line-anchored comments it is `mcp__systemview__comments`.
- **Never use `##` headings inside a reply.** The text is inserted verbatim, so its headings join
  the host document's real outline — one RFC ended up with eight phantom sections.
- **A container nests by gaining colons.** A thread wrapping a `::::columns` block opens with
  **five**, and it closes on a line of the same fence.

`id=` is what makes a thread survive edits above it; without one it falls back to the source line.

- **`author=agent` renders in the agent look.** That is the whole API for answering: a `:::reply`
  block inside the thread you are answering.
- The UI widens `:::thread` to `::::` for you when it writes the first reply; writing by hand, start
  at `::::thread`.
- Removing the thread wrapper keeps everything inside it, replies included.
- **Don't wrap content in an empty thread.** A thread is a conversation, not decoration — start one
  only when you are actually saying something. The human starts their own from the right-click menu;
  pre-wrapping sections "in case" is noise they have to delete.
- **The exception:** surfaces with no file — the hub and help topics are JS constants — keep replies
  in `.systemview/comments.<key>.json`, because there is no document to write into.

## `::commit{message=…}` — a commit you press

A commit message written at the end of a report is a line someone has to copy into a terminal. This
makes it a button.

```markdown
::commit{message="feat(git): line-level staging"}
```

**The agent writes it. Only the human presses it.** There is no `systemview commit` and no
`systemview push` — that absence is deliberate, and it is what keeps the decision his.

**Offer it standalone, not buried mid-prose.** Twice a block embedded after a long paragraph did not
render, and a clean re-offer of just the block worked immediately. Put it in its own message, or
clearly on its own line at the top.

Write it when he asked for a commit message, or when the work in front of him is genuinely ready to
land — it is not a report footer, and stapling one to every report is noise. When it runs, the sha
lands in the block itself (`sha=a4f81c2 ts=…`), so the report that describes the work becomes the
receipt for the commit it caused.

## `::branch[name]` — a branch offered for review

The delivery block for work done on a branch — a refinement, a delegated lane, anything the human
should review before landing. It is a **live pointer, never a frozen patch**: the diff against the
repo's default branch is computed when the document is looked at, so it cannot go stale while the
report sits unread.

```markdown
::branch[refine/dead-code]

::branch[feature/live-scores]{project=buAPI base=develop}
```

Rendered, on this repo's own default branch:

::branch[main]

The header carries the project and the branch; the file rows unfold their patches; the button is
the human's — **switch to it** moves their real working tree onto the branch (two-step, and `git
switch` refusing over dirty files is shown, never stashed around), and once on it, **back to** the
branch they came from. Reading the diff never touches their tree; only the button does.

**Put it at the top of the report.** `::file` and `::diff` blocks read the working tree, so
switching first is what makes the rest of the document show the branch's actual code. The shape of
a delivery report: `::branch` up top → the walk-through → `::commit` at the bottom.

## `:::callout` — the one thing they need to know

```markdown
:::callout
Percentiles stay **all-time** even under a time range — that is the bounded-memory contract.
:::
```

Same band as `::ask`, one weight down: **`::ask` is what you need FROM them, a callout is what they
need to KNOW.** Both exist so a sentence that changes what someone does cannot be scrolled past
inside a paragraph.

**No types.** It had four — info, warn, danger, success — and nobody ever chose between them, so
the choice was only ever a chance to pick wrong. `type=` is still accepted and ignored, so older
documents keep rendering.

Reach for it when a caveat would change what the reader does next. Not for emphasis, and not for
every paragraph you think is important — a page of bands is a page with no bands.

## `:::details{summary=…}` — a fold

```markdown
:::details{summary="Why raw HTML stays off"}
…anything, including other blocks…
:::
```

Deliberately not `<details>` — the native element cannot be styled consistently across the light
document and the dark one.

## `::::tabs` and `:::tab{label=…}` — tabs

```markdown
::::tabs
:::tab{label="before"}
…
:::
:::tab{label="after"}
…
:::
::::
```

The container takes one MORE colon than its children. Reach for it when the same thing has two
forms worth comparing.

## `::::columns{split=…}` and `:::col` — side by side

```markdown
::::columns{split=55}
:::col
a claim
:::
:::col
the thing that proves it
:::
::::
```

**The one to remember for layout** — a claim on the left, its evidence on the right, in one
document. `split=` is the left column's percentage, and dragging the divider writes it back into
the block.

## `::::carousel` and `:::slide{label=…}` — a carousel

```markdown
::::carousel
:::slide{label="step one"}
…
:::
::::
```

One thing at a time, in order — a walkthrough rather than a comparison.

## `project=` — any block can name another project

**The hub is the middle of every project, not a window onto one.** By default a block resolves
against the project whose room the document is in; `project=` overrides that on every block that
reaches for data:

```markdown
::file[src/Pages/ResourcesPage.js#L101-L125]{project=BUApp}
::diff[api/index.js]{project=systemview-test}
::logs{project=buAPI service=Profiles limit=20}
:file[cli/chat.js#L290-300]{project=systemview}     ← the inline chip, same attribute
```

The path is relative to THAT project's root — the hub reads it from the registry, so the pin works
with that project's services down. **The project you name must be connected** (a registered folder
is enough, no live service needed); if it isn't, the panel says so and names the project rather than
quietly reading the same path out of a different repo.

A path that belongs to no project at all — something under `/tmp`, a file outside every repo — is
not an embed. Put its content in the show itself, or paste it in a fenced block.

## Unknown blocks

A block this version doesn't know renders as a visible chip rather than vanishing. A document
written against a newer vocabulary degrades honestly.

---

## Writing back — what an agent can read later

Three blocks put state INTO the document, which is the whole point: you read the document, so you
read the answer. There is no second store to consult.

| Block | Written into the source | Meaning |
| --- | --- | --- |
| task list | `- [x]` | done |
| `::question[…]{options=a\|b}` | `answer=a` | which one was chosen (absent = unanswered) |
| `:::approval{ask=…}` | `verdict=approved` / `verdict=rejected` | the decision (absent = undecided) |

Clicking a chosen answer or verdict again CLEARS it — the attribute is removed, not blanked. So
"absent" always means "not answered", never "answered with nothing".

## The document right-click menu (what a human has, so you know what they'll do)

- **Start a thread here** — wraps the block you aimed at.
- **Wrap this in** → approval · callout · fold.
- **Insert below** → question · checklist · runnable steps · saved test · logs · chart · file · diff.
  The ones with a `›` open a drawer that picks a real target from the live tree, so an inserted block
  works on the first render.
- **Remove** — a container unwraps (content survives); a leaf block asks first, then deletes.

## Rendering rules worth knowing before you write a document

- **A reference POINTS, and the pointing is not saved.** Clicking `:ns[…]`, `:file[…]` or `:ui[…]`
  reveals the thing and draws a box on it for a moment. That highlight lives in the UI only — it
  never edits the document and it's gone on refresh. Answers, verdicts and replies are decisions and
  do get written in; pointing is a gesture and never does. Don't reach for a block to "highlight"
  something permanently — there isn't one, on purpose.
- **Give a block an `id` when you might point at it.** `::question{id=pick}` can be targeted; an
  anonymous block among three of the same kind cannot be told apart.
- **Colon count**: a container nests by giving the OUTER block one more colon (`::::tabs` around
  `:::tab`).
- **QUOTE any attribute value containing a space** — `{options="close the hole|show who is caught up"}`,
  not `{options=close the hole|…}`. This is the sharpest trap in the whole syntax: an unquoted space
  does not merely drop that attribute, it makes the **entire directive fail to parse**, so the block
  renders as raw text in the middle of your document and looks like the feature is broken. Caught
  live — a question with multi-word options came out as literal `::question[…]` on the TV.
- A `\`\`\`markdown` fence renders verbatim, so showing source and the rendered result side by side
  is safe.
- Blocks nest freely — a chart inside a slide inside a tab inside a thread is fine.
- An unknown block renders a visible chip. Don't invent block names; check the registry.
