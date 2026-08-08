# Interactive markdown — the full vocabulary (for agents)

Every markdown surface in SystemView renders through ONE renderer: the Documentation tab, the Report
tab, story markdown panes, `.md` file panes, notes on tests, help topics, the codebase preview. A
block written in any of them works in all of them. Raw HTML is disabled — directives are the only
extension point, and `src/atoms/Markdown/registry.js` is the complete list of what exists.

Live worked examples you can open in the UI: `docs/interactive-markdown.md` (the playground, every
block rendered) and `systemview-test.md` (the dogfood project doc). Siblings: [AGENTS.md](AGENTS.md),
[tests.md](tests.md), [stories.md](stories.md), [namespaces.md](namespaces.md).

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
::file[cli/stage.js#L43-52]            the file itself, in the document
::diff[cli/runTests.js]                working copy vs git HEAD (read-only here)
```

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
::question[Which approach?]{options=a|b}     answer=… is written into the block
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

- **Colon count**: a container nests by giving the OUTER block one more colon (`::::tabs` around
  `:::tab`).
- A `\`\`\`markdown` fence renders verbatim, so showing source and the rendered result side by side
  is safe.
- Blocks nest freely — a chart inside a slide inside a tab inside a thread is fine.
- An unknown block renders a visible chip. Don't invent block names; check the registry.
