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

**`voice` reads the passage aloud — and it is HOW YOU READ ALOUD when asked.** "Read me this file",
"read that section" → reply with the chip carrying `voice`; never paste the text into your reply for
the speech engine to find. `::file[docs/notes.md#L40-70]{voice}` reads that slice **at its place in
your reply** — the recital follows the order on screen: your words before it, the passage, your
words after. Markdown goes through the spoken form; anything else reads as plain text. It reads when the reply ARRIVES and when the reply's Listen is PRESSED — never on a reload or a
re-render, and it reads even when ambient voice mode is off.
Whole documents are fine — generous cap, stoppable at any sentence.

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
::test[Math.chainUse]                                    Module.method — the service comes from scope
::test[GatedService.Auth.getSession]                     Service.Module.method — fully addressed
::test[Users]                                            a bare Module: ALL of its saved tests
::test[Math.add:1]                                       `:N` pins one test by index
::test[Profiles.Users.signUp]{project=buAPI}             another repo's spec
::test[Math.add]{ran=".systemview/runs/r1.json"}         the same block ALREADY RAN
```

**The label is a METHOD NAMESPACE, not a file path** — the same grammar `runTests({namespace})` and
the story `--test` flag take, resolved as `Service.Module.method` → `Module.method` (service from
the document's scope) → bare `Module` (every test on it).

**The test stays the single source of truth.** This block embeds the saved test; it never copies
it. Edit the test in the Test Panel and every document embedding it follows — which is what makes
`::test` the durable half of a claim's proof, and why a spec is never pasted into a fold.

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

Read-only in a document. **Not for reports** (his ruling, 2026-10-18): a `::file` embed already
carries the diff view and reads better — every `::diff` in a report makes him switch to the file
anyway. Reach for `::diff` only where the diff IS the subject and no file stands behind it.

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
- **`{title="…"}` on the end of a step labels it**, and the label is what a reader sees over the
  call. Without one the step wears its own call signature, which is honest and says nothing:
  `AutobotShell.Window.count({"selector":".md-claim"})` where a sentence belongs. In a multi-step
  block the labels read in sequence and become the explanation, which is what lets a run narrate
  itself when somebody presses it. (The object shorthand also ends in braces — they are told apart
  by `key=` versus `"key":`, so a JSON argument is never mistaken for a label.)
- **Assertions are a nested list** under the step. `- path = value` (typed), `- path ~ text`
  (is-like). `expect`, `assert` or `✓` in front are optional synonyms.
- `use: <action>` pulls in a shared action as its own named section.
- The block's own section is `steps`; references read `tv(steps[0]…)`.
- `::run[seedSum]` replays a **saved** action instead, badged differently.
- **Never auto-runs.** A document is not permission.

## `:::cmd{title=…}` — a shell command the document can run

Some commands get run periodically and have nowhere to live. The bundle rebuild is the example: it
is not an npm script, it is a specific invocation with env vars, so it survives as prose that
someone reads and retypes. This block makes the document that explains a command carry it.

```markdown
:::cmd{title="Rebuild the bundle"}
BUILD_PATH=build.next NODE_OPTIONS=--max-old-space-size=4096 ./node_modules/.bin/react-scripts build && rm -rf build && mv build.next build
:::
```

- **The body IS the command, verbatim.** No steps, no substitution, no variables — what you read and
  what runs are the same characters. Multi-line bodies run as written.
- **`:::cmd` is not `:::run`.** `run` is the SystemLynx test engine — a service method and its
  assertions. This is a process. They share no machinery and never will.
- **Opt-in only.** A ```` ```bash ```` fence stays inert forever. These documents are full of
  illustrative shell, and nobody may be one click from executing documentation. Only a block someone
  deliberately wrote as `:::cmd` runs.
- **Never auto-runs, and there is no agent-facing verb for it.** An agent writes the block; a human
  presses it — the same rule `::commit` works under.
- It runs in the project's own root, through the host's terminal. Output streams into the block,
  stdout and stderr interleaved exactly as a terminal shows them, and it ends with an **exit code**:
  `exit 0` is green, any other code is red, and a command that never reached a shell says "didn't
  run" in its own third face rather than pretending to have failed. A finished run can be
  **cleared** back to the untouched block — output gone, state honestly "not run".
- **In the chat, the result reports back to the agent automatically** — no attribute: a block in a
  reply is the agent asking, so the press is the answer. One line, spoken as `cmd` rather than as
  the human: `ran "…" — exit 7 · 41s`. Never the output — the full transcript is on disk in the
  host's session log (autobot: `~/.autobot/terminals/autobot-<project>_main.log`), and an agent
  that needs the error reads it there. Presses in documents report to nobody.
- `project=` sends it at another project, like any other block.
- `dir=` aims it at a machine path instead — `:::cmd{dir=~/Systemly/lanes}` runs anywhere on the
  machine, the way `::file[~/…]` embeds anywhere; the terminal prompt shows the folder. Prefer the
  project form in documents: a code survives the repo moving to a new folder, a path doesn't.
  (`~` expands host-side — arms with the autobot shell restart after 2026-10-18; absolute paths
  work on any host build.)
- A surface with no terminal host (a plain browser tab) renders it as a stated absence — no button.

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

**In the chat, a press QUEUES (RFC-073 §3.2).** Answering a block in a chat reply does not open a
turn: the answer sits in the conversation as a queued row (removable, *send now* beside it) and
rides his next message — one turn carrying every pressed answer. A block may carry `wake=now` to
land its press immediately; a commit's receipt always lands immediately, as a log line.

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

## `::rfc` · `::arc` · `::report` · `::gap` — the registration leaves

```markdown
::rfc{id=RFC-073 arc=ARC-004}
::arc{id=ARC-004 owner=systemview-test title="Arcs become trackable"}
::report{id=subscribe-and-registration}
::gap{id=G-12}
```

One line at the top makes the document a KIND — not its folder, not its filename (RFC-073). Saving
the file through any door the harness sees registers it: a row of identity (`id kind path project`)
plus derived state in `~/.autobot/documents.json`. `id` is the identity — a moved file updates its
row, never duplicates it. `arc=` on an RFC is the one relationship kept: "what is being built for
this arc" is a read. They render as a one-line header with nothing to press — carrying the
document's **lifecycle trail** (RFC-075): the kind's states with the current one lit, read from the
registry's derived state (rfc: draft → approved → built → settled → retired; arc: open → done →
retired; gap: open → resolved → retired; report: filed → retired). `settled=<date>` on an rfc leaf
declares the spec stopped moving — a declaration, never derived from quiet. A document with no
registry row shows no trail — absence stated, never invented.

A **gap** is a bug or missing feature you hit in ANOTHER project, written INTO THAT PROJECT'S repo
(one line of body is enough); it is done when its leaf carries `resolved=`, and the resolution fires
to the document's audience. An RFC is done at its `verdict=`, an arc when every objective is done, a
report never — it only ages out. Humans insert a leaf from the right-click menu (*Register this
document*); `show()` writes `::report` for a filed report by itself.

## `subscribe=` and `told=` — who hears a block, and the receipt

```markdown
:::approval{ask="Approve this?" subscribe=buapi}         ← buapi alone hears the verdict
::claim[x → y]{id=c4 subscribe=reviewer-x}               ← a non-member can be the audience
::::thread{id=t2 subscribe=buapi}                        ← everything in the thread goes to buapi
```

In a REGISTERED document, a block with an answer announces itself at parse: approval's `verdict=`,
question's `answer=`, an objective reaching `state=done`, a claim's mark, a gap's `resolved=`. The
audience ladder: the block's own `subscribe=` → the enclosing thread's `subscribe=` (a reply ALWAYS
takes the thread's; a thread still saying `members=` is read the same) → the document's `::members`.
Delivery stamps `told=<who>` onto the block's line — the receipt lives in the block, so the same
block parsed a hundred times delivers once, and removing `told=` by hand is how you re-announce.
Nobody named anywhere → no fire, no error. Result blocks (`::commit`, `:::cmd`, `::run`, `::test`,
`::branch`) write nothing — `subscribe=` on them routes the completion event the chat already shows.

## `::claim[…]{id=…}` — a statement somebody can check, and the mark

```markdown
::claim[Approve an approval on a document with members buapi|systemlynx → both receive one document.updated]{id=c9}
```

The claim an RFC used to end in as a numbered line, made pressable. The statement goes in the
brackets — *do this → this should happen* — and `id=` is its address (the number you see is derived
from its place in the document, so never write one into the text). A press marks it **met** or
**not met** — and on a claim somebody else already marked, the same press **countersigns**: `by=`
is a `|`-list and his agreement adds `you` to yours. Pressing a state you yourself signed takes
your signature off ("I take that back"); the mark stands while anyone else holds it. **A press
never erases the note** — withdrawal and flips keep the words; `edit` is the only door that
changes them. The mark is written INTO the line:

```markdown
::claim[…]{id=c9 state=met by=you at=1792956000000 note="pressed approve with two sessions up; both got document.updated"}
```

**A press in the window is its own evidence** — he looked — so ✓ writes `state= by=you at=` at
once, and the window offers no note box at all: a press is a signature, not an essay. The state
badge rides the claim's row; the stamp line under it carries one chip per signature (his wears the
accent), the date, and the note. **An agent's mark is not its own evidence.** An agent
marks by writing the attributes onto the line itself, `by=<projectCode>`, and **a mark without a
`note=` is no mark** — `met` must say what was done and seen, `unmet` what happens instead; the
word is only as good as what it rests on. An unmarked claim reads **unchecked** — visibly, and never
the same as met.

**A claim can declare its REVIEWERS** — `::claim[…]{id=c7 reviewers=buapi}` — who owe it a look.
The badge grammar is his: a **dashed badge with the check** (`✓ buapi`, dashed border) is the
INVITATION — "click this and you've checked it" — and signing **fills** it solid, in the state's
colour. The human is the one implicit reviewer — his badge is always offered and is the one a press
can fill (check met on an unchecked claim, countersign a marked one, step off again). Declare a
reviewer OTHER than the agent that built, where writer ≠ verifier matters. `reviewers=` JOINS the
claim's fire audience (unioned onto the subscribe/thread/members ladder): being named a reviewer is
an obligation, and an obligation nobody is told about is not one. And **a flip never eats
signatures**: switching met↔unmet stashes the outgoing state's signers (`metBy=`/`unmetBy=`) and
restores them when the state returns — a signature belongs to the state it signed.

**A claim can carry its PROOF** (RFC-075) — the same name grown a container, the check folded where
the mark will be doubted:

```markdown
:::claim[Save a registered document → its row's state is re-derived]{id=c36 state=met by=you at=…}
:::cmd
node -e "…read the registry row…"
:::
:::
```

Renders as the same one-line claim with a `proof ▸` fold; the children are ordinary result blocks
(`:::cmd`, `:::run`, `::test`) run in place. The sequence is **verify → mark → THEN the proof,
written for the human**; the mark is mandatory, the proof is earned (load-bearing marks, claims that
can rot); a proof passing is **evidence, never a mark** — no runner, no automation, two signatures
stay two. Humans grow one with right-click → *add a proof*; the statement never gets retyped. The
approach and shapes: `context("how do I leave a proof on a claim")`.

## `::claims` — the count, derived

```markdown
::claims
```

Recounts every `::claim` in the same document on each render: met / not met / unchecked, and a bar.
Stored nowhere, so it cannot disagree with the blocks under it — this is what replaces a typed
"claims 11/12 met" in an RFC's STATUS line. Unchecked is its own count, never folded into either side.

## `::::thread{id=…}` and `:::reply{…}` — a conversation in the document

```markdown
::::thread{id=extraction}
Anything wrapped here carries a reply thread.
::::
```

**Replies live IN the document** as `:::reply{author=… ts=…}` blocks, so reading the document is
reading the whole exchange. (A sidecar remains only for surfaces with no file to write to — the help
hub and help topics.) The thread's `id=` renders on its 💬 reply pill — it is the name deliveries
use ("thread t3 moved"), so the chat's words and the thread on screen match by eye.

Three things that have each cost a real mistake:

- **Answer with the tool, never by hand-editing the markdown** —
  `mcp__systemview__reply({ projectCode, report, threadId, text })` inserts the block in the right
  thread. For a file's line-anchored comments it is `mcp__systemview__comments`.
- **Never use `##` headings inside a reply.** The text is inserted verbatim, so its headings join
  the host document's real outline — one RFC ended up with eight phantom sections.
- **A container nests by gaining colons.** A thread wrapping a `::::columns` block opens with
  **five**, and it closes on a line of the same fence.

`id=` is what makes a thread survive edits above it; without one it falls back to the source line.

**A thread can carry its own members** — `::::thread{id=t3 members=buapi}` — which is a narrower
subscription than the document's, with its own dirtiness and its own auto list. See `::members`
below; the attributes live on the thread's opening line.

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

## `::members{who=…}` — who is on this document

```markdown
::members{who=buapi|systemlynx sent=buapi:1evgm2o auto=buapi}
```

One line at the top of a document naming the **project codes** that are on it. A member is a room,
not a person — the same code the commit block takes — because delivery already works in rooms, and a
chip aimed at a project that is not connected is refused at the press rather than sent to nobody.

**Membership lives in the markdown** for the same reason replies do: the document says who is on it,
it travels with the file, and you see it change in a diff. There is no second store to consult.

| attribute | what it is |
|---|---|
| `who` | the members, `\|` or `,` separated |
| `sent` | `code:hash` per member — the version each was last told about. Written by the surface |
| `auto` | the members told automatically once the document settles. A LIST, not a switch |

**Two levels.** This block is the document's subscription; `::::thread{id=t3 members=buapi}` is a
narrower one, carrying its own `sent=` and `auto=` on the thread's own opening line. A member can be
on both and be told about only one — that is the point of the split.

**Dirty means "has not heard about THIS version."** The document's hash deliberately ignores its own
`::members` line: sending rewrites that line, so hashing the whole file would make every send
instantly dirty again and the surface could never say anything else. A thread hashes **its own
body**, so a reply in `t3` makes `t3`'s members behind and leaves the document's alone. A member
with no hash has never been told, which is dirty by construction rather than exempt.

**What an agent writes, and what it must not.** Adding a member is a normal markdown edit — write or
extend `who=`. **Never hand-write `sent=`**: it is the receipt of a send that happened, and
inventing one silently marks somebody as told. Editing the body is how members become behind, and
that is correct.

On a surface with nothing to save to (the chat's renderer, a help topic) the block renders the chips
and says `read-only here` rather than pretending to save.

## The pinned update row — the only send, and the door to what moved

Nothing in the document sends. A pinned row sits at the **top-right of the document** whatever the
scroll position, holding one pill per subscription that has somebody behind: `all threads` (the
document level — it reaches everyone, which is why it stopped saying "document"), and
`💬 <thread id>` for each thread. Separate pills on purpose — the audiences differ, and one row of
mixed chips makes a press look like it tells everybody shown.

- **A chip** tells that one member and stamps that subscription's own line; `all N` tells everyone
  behind on that pill.
- **Pressing a THREAD pill anywhere else** goes to that thread and flashes it. The `all threads`
  pill is not a door — it is nowhere in particular, so it only sends.
- **The row disappears when nobody is behind**, which is also how a press confirms itself: tell
  `buapi` and `buapi`'s chip leaves.

Beside the membership itself there is only a **⚙**: who is `auto` at that level. Two levels, two
lists, because "every version of this plan" and "when this argument moves" are different
subscriptions.

**A reply does not announce itself.** It makes the thread's members behind; the `auto` ones are told
once it settles, everyone else waits for a press.

**Delivery needs no hook.** The window observes the press and the HOST emits an ambient
`document.updated`; every session whose project is named receives it as a turn, and the landing
renders as a row that opens. An IDLE session wakes on the spot; a session mid-turn never has the
delivery pushed into its queue — the harness holds it (the row shows ⧖ *held — wakes when this
turn ends*) and it starts its own turn the moment the agent yields. Several sends against one
document merge while held: one wake, carrying everything. See autobot's `hooks.md` — the event
exists for hooks to match on, but membership is the subscription on its own.

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

The delivery block for work done on a branch — a refinement, a lane, anything the human
should review before landing. It is a **live pointer, never a frozen patch**: the diff against the
repo's default branch is computed when the document is looked at, so it cannot go stale while the
report sits unread.

```markdown
::branch[refine/dead-code]

::branch[feature/live-scores]{project=buAPI base=develop}
```

Rendered, on this repo's own default branch:

::branch[main]

The header carries the project and the branch; the block lists the branch's **commits** (a lane is
one piece of work — landing means accepting exactly that commit, on screen like a `::commit`
block's message); the file rows unfold their patches. The verbs are the human's:

- **land onto \<current\>** — the accept: merges the branch onto whatever they are standing on,
  two-step, no switching, no CLI. A conflict is a refusal, shown and unwound — never forced.
- **switch to it** — the tour, for when they want to walk the branch itself (two-step, and `git
  switch` refusing over dirty files is shown, never stashed around); then **back to** the branch
  they came from. That return is written into the document: switching stamps `camefrom=<branch>`
  onto the block's own line (and taking the trip back clears it), so the way home survives a
  refresh and a page hop instead of degrading to `base` — which is often somewhere they never
  stood. A read-only document has nowhere to stamp, so there it still offers `base`.
- **fast-forward \<base\> to here** — the accept from ON the branch, after a walk: brings the base
  up without checking it out. Only clean when the base has not moved since the fork; a non-ff is
  shown as the refusal it is.
- **bring over as changes** — the review-first accept: the branch's work arrives UNCOMMITTED on
  the branch they are standing on (on the lane branch it is already committed — nothing shows as
  changes there). File list, per-file diffs, their own commit on top; a changes surface opens to
  meet it. Their commit replaces the lane's, so the lane branch still reads "not merged" — a
  warning theirs to override at cleanup.

Reading the diff never touches their tree; only the buttons do.

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

A path that belongs to no project at all — something under `/tmp`, a lane worktree, a file outside
every repo — is a **machine address** since RFC-069: `nav {file: "/abs/path"}` opens it, the tab
strip's `+` door opens it, and the pane renders it (no git, no comments — absent, with the pane
saying why). **Embeds take machine addresses too** (since the 14-lane land, e1c90bd): `:file[~/…]`
chips open them and `::file[~/…]` renders them inline through the machine door — no git halves, no
Diff button (nothing to diff against), and a report can embed its lane-worktree deliverables
directly. The address travels whole through one opener; a machine file never wears a project.

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
