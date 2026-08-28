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

### Links — they reveal, they don't navigate

```markdown
:ns[Math.chainUse]                    a namespace chip — points the navigator at it
:file[src/atoms/Markdown/registry.js#L20-46]   a file, at a line range
:help[markdown]                       opens a help topic
```

Clicking one **reveals** the target in the navigator without moving the reader off the document.
⌘-click navigates for real. Both resolve against the LIVE connection tree, so a stale reference
renders dashed and says why instead of lying.

### Embeds — live things inside prose

```markdown
::chart{report=throughput range=1h}    throughput | errors | latency, + range, service, height
::topology                             the service call graph
::load{limit=8}                        load concentration
::logs[Math.chainUse]{limit=50}        the Logs viewer, scoped by the block
::test[Math.chainUse]                  a SAVED test, runnable in place
::test[Math.add]{ran=".systemview/runs/r1.json"}  the same block ALREADY RAN — hydrated from a
                                       recorded run file (CLI --json output + ranAt), steps
                                       colored, responses real, "recorded run" badge; play
                                       re-runs fresh (see agents/chat.md, the already-ran block)
::file[cli/stage.js#L43-52]            the file itself, in the document
::diff[cli/runTests.js]                working copy vs git HEAD (read-only here)
::commit{message="feat(nav): the lens"}  a commit message he PRESSES instead of copying
```

### `::commit` — the commit message as a button

A commit message written at the end of a report is a line someone has to copy into a terminal. This
makes it a button. **Write it when he asked for a commit message, or when the work in front of him
is genuinely ready to land — it is not a report footer, and stapling one to every report is noise.**

```markdown
::commit{message="feat(git): line-level staging"}
```

It renders the message (editable in place — it is HIS commit), two tabs, and the branch:

- **changes** — `staged` / `changes` / `untracked`, the same three groups the codebase panel shows,
  with `+` / `−` per file and per group. Staging happens in the block; you do not send him elsewhere.
- **log** — git's own output from what just ran, then the last fifteen commits. Committing flips to
  this tab by itself, so the result gets read.

Commit and Push are **two-step**: the first click arms (the button reads `confirm`), the second runs.
Push appears only when the branch is ahead. Both edges of the list drag to resize, and the height
lands back in the block as `height=` — same contract as `::::columns` and `split=`.

When it runs, the sha is written INTO the block, the way `::question` writes `answer=`:

```markdown
::commit{message="feat(git): line-level staging" sha=a4f81c2 ts=1786883000000}
```

The report that describes the work becomes the receipt for the commit it caused.

**THE RULE THIS BLOCK EXISTS UNDER: you can WRITE it, you cannot PRESS it.** There is deliberately no
`systemview commit` and no `systemview push` — the absence is the design, not an oversight. If you
want work committed, put the block in a document and let him decide.

### Runnables — steps written on the fly

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

### The document is the state

Blocks that take input write back **into the markdown** — there is no second store:

```markdown
- [ ] a task list that saves when you tick it
:ui[scratchpad]                             a REGION of the window — clicking points at it
::question[Which approach?]{options=a|b}     answer=… is written into the block
::question[Which?]{options="close the hole|show who is caught up"}   ← QUOTE multi-word values
                                             QUOTE values containing spaces: {options="plan a|plan b"}
                                             — an unquoted space kills the whole directive SILENTLY
                                             (it renders as literal text, same trap as {Math.chainUse})
:::approval{ask="Approve the plan?"} … :::   verdict=approved|rejected is written into the block
```

**`:::approval` is how you ask for a decision.** Wrap what you're proposing, and read the verdict back
off the document later — that is the entire handshake.

### Conversation

```markdown
:::thread{id=extraction}
Anything wrapped here carries a reply thread.
:::
```

Replies are `{ text, ts, author }`; write yours with `author: "agent"` and they render distinctly.
They live in a sidecar (`.systemview/comments.<key>.json`), not in the document.

### Structure

```markdown
:::callout{type=info|warn|danger|success} … :::
:::details{summary="Click to open"} … :::
::::tabs / :::tab{label="…"}
::::columns{split=55} / :::col          ← content side by side: a lead beside its evidence
::::carousel / :::slide{label="…"}
```

`::::columns` is the one to remember for layout — a claim on the left, the thing that proves it on
the right, in one document.

### Any block can name another project

**The hub is the middle of every project, not a window onto one.** By default a block resolves
against the project whose room the document is in — but `project=` overrides that, on every block
that reaches for data:

```markdown
::file[src/Pages/ResourcesPage.js#L101-L125]{project=BUApp}
::diff[api/index.js]{project=systemview-test}
::logs{project=buAPI service=Profiles limit=20}
::chart{project=buAPI report=throughput}
:file[cli/chat.js#L290-300]{project=systemview}     ← the inline chip, same attribute
```

This is what to reach for when you want to show someone a file that lives in another repo — point at
it where it is, no copy needed.

Two things worth knowing:

The path is relative to THAT project's root — the HUB reads it, resolved from the registry, so the pin works with that project's services down.
- **The project you name must be connected** (a registered folder is enough — no live service needed). If it isn't, the panel says so and
  names the project. It will never quietly read the same path out of a different repo — that made a
  correct path look like an author's mistake, with a stranger's `/Users/…` in the error.

A path that belongs to no project at all — something under `/tmp`, a file outside every repo — is
not an embed. Put its content in the show itself (`systemview show <pc> --file <path>` inlines what
it reads) or paste it in a fenced block.

### Unknown blocks

A block this version doesn't know renders as a visible chip rather than vanishing. A document written
against a newer vocabulary degrades honestly.

---


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

## Threads and replies — in the document

```markdown
::::thread{id=lb-rig}
The LB rig is still driven by hand.
:::reply{author=agent ts=1786180000000}
An automated version should assert three things: every member is seen, concentration sums to ~100%,
and a member going quiet drops out of the window.
:::
::::
```

- **Replies live IN the document**, as `:::reply{author=you|agent ts=…}` blocks inside the thread.
  Read the document and you have the conversation — there is nothing else to fetch.
- **`author=agent` renders in the agent look.** That is the whole API for answering someone: append a
  `:::reply` block inside the thread you're answering.
- **Fence lengths matter.** A container only nests when the OUTER fence is longer, so a thread that
  holds replies is `::::thread` with `:::reply` children. The UI widens `:::thread` to `::::` for you
  when it writes the first reply; if you're writing by hand, start with `::::thread`.
- Removing the thread wrapper keeps everything inside it, replies included.
- **Don't wrap content in an empty thread.** A thread is a conversation, not decoration — start one
  only when you're actually saying something (a `:::reply` goes in with it). The human starts their
  own threads from the right-click menu; pre-wrapping sections "in case" just adds noise they have
  to delete.
- **The exception:** surfaces with no file — the hub and help topics are JS constants — keep replies
  in a store at `.systemview/comments.<key>.json` (`{ threadId: [{ text, ts, author }] }`), because
  there is no document to write into. Replies written there before this change still render.

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
