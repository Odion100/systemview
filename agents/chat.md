# The chat — being in the conversation

This document is written **for AI agents**. SystemView is the IDE in the browser, and its chat
panel attaches to **your live session**. When the human types there, he is talking to you *in this
conversation* — not into a room you have to enter, and not through a relay. Your reply **is** the
message. Siblings: [AGENTS.md](AGENTS.md), [markdown.md](markdown.md).

Everything here is **tools** — `mcp__systemview__*` for the window, the harness's own messaging for
other agents. The `systemview` CLI still exists for a human at a terminal and for CI; it is not how
you work, and an older version of this page that taught its verbs as your workflow is retired with
them.

## The model, in one paragraph

You are attached. His messages arrive in your context, pushed by the harness — there is no inbox to
drain, no hook to install, no polling. You answer by replying — plain text, markdown, and the
interactive blocks all render in the chat. The panel reads your cooking state straight off the
session, so there is no status to set for him and nothing to keep alive.

## What arrives

Every message carries the human's words **plus their vantage point at the moment they sent it**:

```json
{ "id": "m_…", "ts": 1786227000000, "from": "you",
  "text": "why would you do that?",
  "view": { "path": "/specs/systemview-test?tab=reports", "projectCode": "systemview-test",
            "namespace": { "serviceId": "TestService" }, "tab": "reports",
            "openFile": "cli/index.js" } }
```

**Use the view.** "That", "this", "here" refer to what the view shows — the open report, the
selected namespace, the file on screen. Never ask "which report?" when the view already says.

From the **Stats page** the view is stats-shaped — check `view.page` first:

```json
{ "view": { "path": "/reports/systemview-test?report=load&range=1h", "page": "stats",
            "projectCode": "systemview-test",
            "stats": { "project": "systemview-test", "report": "load",
                       "range": "1h", "service": null } } }
```

## Your reply is the message — and it renders

Markdown renders in the chat, including the interactive blocks. Showing him a file, a diff, a
commit offer, a question: write the block in your reply.

| what | write |
| --- | --- |
| bold / italic / strike | `**bold**` · `*italic*` · `~~struck~~` |
| inline code | `` `Math.add` `` |
| lists, quotes, headings, tables, fences | as usual — fences and tables scroll in their own box |
| a file, or lines of it | `::file[cli/index.js#L40-80]` |
| a diff | `::diff[api/index.js]` |
| a commit offer | `::commit{message="fix(chat): …"}` |
| a question with choices | `::question[Which one?]{options="a\|b"}` |
| a clickable reference | `:file[path#L10-20]` · `:ns[Math.add]` · `:report[.systemview/report.<pc>.<Name>.md]{title="…"}` · `:ui[nav]` |

Notes that matter:

- **Underscores are never italic** and `a * b` is never italic — identifiers and math stay literal.
- **Link the thing you're talking about.** "The report is ready" without a `:report` chip is a
  missed click. A report about a file opens with a `:file` chip.
- **Long content and choices go on the TV** (`mcp__systemview__show`), with one short line in the
  chat.
- **Never tell him to reload.** Tabs update themselves.

## Reaching another agent

Another agent is another session, and reaching one is the **harness's** messaging, not a SystemView
verb: `ListAgents` shows who is reachable, `SendMessage` speaks to one by name. The message lands
inside their conversation as a turn, attributed to you; replies arrive back in yours the same way —
pushed, never polled. The old room verbs (`message-agent`, `join`, `leave`, `kick`, `visitors`,
`read`, `inbox`, `status`) are retired for agents; [AGENTS.md](AGENTS.md)'s retirement table is the
record.

One rendering rule survives from the room era, because messages still render as documents in the
reader's chat: **blocks resolve against the READER's project.** A `::file` lifted from your repo
into someone else's session renders empty, which looks like a broken renderer. Use their paths, or
pin yours with `{project=<yourPc>}` — which works on the inline chip too, so
`:file[cli/index.js]{project=systemview-test}` points at YOUR file from anywhere.

## Driving the window — nav, highlight, refresh, act, show

A command moves the window the human is looking at, the moment it lands — he SEES it move and who
moved it.

```js
mcp__systemview__nav({ projectCode, namespace: "Math.add" })        // NAVIGATE (real selection)
mcp__systemview__nav({ projectCode, report: ".systemview/report.<pc>.<Name>.md" })
mcp__systemview__nav({ projectCode, file: "cli/index.js#L40-80" })  // open a file in the Code tab
mcp__systemview__nav({ projectCode, file: "~/.autobot/jobs/x/job.md" }) // a MACHINE file — any
                                                                    // absolute path opens (RFC-069)
mcp__systemview__nav({ projectCode, stats: "load" })                // the Stats page
mcp__systemview__highlight({ projectCode, namespace: "Math.add", say: "…" })  // POINT, don't navigate
mcp__systemview__refresh({ projectCode, scope: "docs" })            // panes re-read — never a reload
mcp__systemview__act({ projectCode, test: "Math.add", say: "…" })   // run where the human is LOOKING
mcp__systemview__show({ projectCode, text: "## Look\n::chart{report=throughput}" })  // the TV
mcp__systemview__show({ projectCode, reportPath: ".systemview/report.<pc>.<Name>.md" })
mcp__systemview__show({ projectCode, clear: true })
```

`nav` is **kind-explicit** — exactly one of `namespace`, `file`, `report`, `stats`, `agents` — and
it **resolves before it reports**: a path that exists nowhere comes back as the refusal, by name,
never as "pulled up". `say` rides `highlight` and `act` — it is what your bot says while standing
next to the thing; without it the trip is a receipt that says WHAT and never WHY.

Rules the live driving sessions taught:

- **Highlight and navigate are different.** Highlight points ("look at this"); nav selects ("go here").
- **Namespaces are validated against the live tree** — a file in the repo does not mean the module
  is mounted.
- **act routing — the run lands where the human is looking**: a doc block showing the target test
  claims the run; otherwise it runs in the saved-tests area. Target by title when ambiguous.
- **The live-edit loop**: edit on disk → `refresh` the scope → it's on their screen.
- **Every nav rides with a link in the chat.** The window moves once; the chip is the way back.
- **Never move the window as a surprise.**
- **Commands never come back to you** — only the human's messages do.
- **Their view stamp + the open doc = your eyes.** Use both before acting on "this"/"that".
- **TV first — reports only when the human asks for one.** Read his answers on the TV with
  `mcp__systemview__tv({ projectCode, show })` (`::question{… answer=…}`, `:::approval{verdict=…}`,
  `:::reply` in threads). His typed replies there are questions to YOU and sit silently until you
  look.

## Pointing — references in your sentence

A reference in a message points at the thing; the bot walks the things you named, in order, as the
message lands (up to three per message):

| reference | points at |
| --- | --- |
| `:file[path]` / `:file[path#L40-60]` | a file, or those lines |
| `:ns[Service.Module.method]` | a node in the tree (fuzzy — `add` works) |
| `:report[.systemview/report.…md]` | a document |
| `:ui[<region>]` | a REGION of the window — `nav` `center` `scratchpad` `story` `stage` `tv` `links` `chat` `bot` `reports` `docs` `code` `logs` `tests` `header` |

- **Never send coordinates.** You name a thing; where it is on screen changes with every window size.
- **Pointing is a gesture, not a decision** — drawn in the UI, never written to the document.
- **Off-screen means no gesture.** Navigate to it if it matters that they see it.
- **The human owns the volume** (off / subtle / full, per project). Write the same way regardless.

## Answering where he asked

- Short answers: your reply. Another agent's session: `SendMessage`.
- A note on the CODE gets its reply on the line it was left:
  `mcp__systemview__comments({ projectCode, path, at, replyText })`.
- His board: `mcp__systemview__board({ projectCode, at, replyText })` — pass the note's `id`, never
  its position; the list reorders the moment he adds a note.
- A document's thread: `mcp__systemview__reply({ projectCode, report, threadId, text })`, and
  anything about a document also as a `:::reply{author=agent}` there ([markdown.md](markdown.md)).
- **The human's message is the only trigger.** Clicks and comments accumulate silently — respond to
  what he SAID.

## Where your room lives — YOUR repo, not the hub's

```
<your project root>/.systemview/chats/<pc>.<chat>.jsonl        # the room, plain JSONL
<your project root>/.systemview/chats/<pc>.<chat>.ack.json     # drain cursors
```

Your service's plugin owns that file — the `SystemViewChat` module (`chatAppend` / `chatRead` /
`chatCursor` / `chatList` / `chatStat`) is the only writer. The hub holds connections, presence,
delivery and an in-memory mirror, and stays in sync through the plugin. A project whose service is
down or predates the module is buffered by the hub and handed over, by record id, when it comes back.

You can read and edit your own room — grep it, compact it, quote it.

## Compacting a chat (an instruction, not a feature)

**When your room passes ~300 records, compact it at the next quiet moment — without being asked.**
The panel shows a fullness meter against that mark.

1. Pick a QUIET moment (no messages in flight).
2. Read `.systemview/chats/<pc>.<chat>.jsonl` in your own project root.
3. Move everything except the recent tail (last ~50 records) to
   `.systemview/chats/archive/<pc>.<chat>.<YYYY-MM-DD>.jsonl`.
4. Rewrite the live file as ONE summary record + the tail:
   `{"id":"m_<unique>","ts":<now>,"from":"agent","text":"⟪compacted <date> — earlier: <a few
   sentences>. Full history: .systemview/chats/archive/…⟫"}`
5. Say nothing else — the summary bubble at the top of the thread IS the receipt.

Every cursor is timestamp-based, so a shorter file with the same recent timestamps is
indistinguishable from the long one; the hub notices the dropped count within one sweep and re-reads.
