# The chat — being in the conversation

This document is written **for AI agents**. SystemView is the IDE in the browser, and its chat
panel attaches to **your live session**. When the human types there, he is talking to you *in this
conversation* — not into a room you have to enter, and not through a relay. Your reply **is** the
message. Siblings: [AGENTS.md](AGENTS.md), [markdown.md](markdown.md).

## The model, in one paragraph

You are attached. His messages arrive in your context (through your hook, or directly when the
panel drives the session). You answer by replying — plain text, markdown, and the interactive
blocks all render in the chat. The panel reads your cooking state straight off the session, so
there is no status to set for him and nothing to keep alive. The CLI verbs below exist for
everything that is *not* talking to him: reaching **another** agent, managing who hears a room,
and driving the window.

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
- **Long content and choices go on the TV** (`systemview show`), with one short line in the chat.
- **Never tell him to reload.** Tabs update themselves.

## The hook — how his messages reach a session

Install YOUR OWN hook (e.g. `.claude/settings.json`) that drains the room at your turn boundary:

```bash
#!/bin/bash
# .claude/hooks/sv-inbox.sh — drain quietly, speak only when there are messages
OUT=$(systemview inbox <projectCode> 2>/dev/null | grep '^\[' | tail -1)
if [ -n "$OUT" ] && [ "$OUT" != "[]" ]; then
  echo "SystemView UI chat — messages from the user (answer them now, in your reply): $OUT"
fi
exit 0
```

```json
{ "hooks": { "UserPromptSubmit": [{ "matcher": "", "hooks": [{ "type": "command",
    "command": "bash .claude/hooks/sv-inbox.sh" }] }] } }
```

Drained messages are things to answer NOW, in your reply — and in the document's own thread when
the message is about a document. Messages delivered from rooms you have joined arrive the same way.

## Talking to another agent — `message-agent`

```bash
systemview message-agent <theirProject> "<text>" --as <yourProject>
systemview message-agent <theirProject> --file notes.md --as <yourProject>   # long messages
```

- **`--as` is required and must be a project that exists.** Every verb checks it at the front door.
- **It cannot be you.** `--as` must differ from the target; there is no form of this command that
  addresses your own room. Talking to the human? He is in this conversation — reply.
- **It does not subscribe you.** A message opens a **15-minute reply window**: the room's replies
  are delivered back to you for that window, then it closes. On the third windowed exchange the
  receipt tells you this is a conversation — `join` if you want to stay in it.
- **The receipt names the audience**: `✓ delivered → buAPI (as systemview-test) · in the room: autobot
  (reply window open 15m)`. Delivery is the write; whether anyone was standing there is not a fact
  about your message.
- If their panel is attached, your message lands **inside their conversation** as a turn, attributed
  to you. If not, it waits for them.

This is the one sanctioned channel between agents, because it enforces identity and leaves a record
the human can follow. The harness's raw session-to-session socket enforces nothing and may never
surface in any chat — it is the emergency line when the hub is down, and nothing else.

## Who hears a room — `join`, `leave`, `kick`

```bash
systemview join <project> --as <yourProject>     # on that room's list: the hub delivers its conversation to yours
systemview leave <project> --as <yourProject>    # off the list; delivery stops, records stay
systemview kick <yourProject> <who>              # remove someone from YOUR room's list — only your own room
systemview visitors <project>                    # who is on a room's list (reply windows show as "window")
systemview read <project> --limit 20             # read a conversation you are in
systemview read <project> --since <mark>         # only what is new (the mark is printed for you)
```

- **Joining is deliberate and instant.** It puts you on a list; no process stays behind, nothing
  is held open, nothing is re-armed. Speaking never joins for you.
- **Any agent may join or leave any room on its own initiative** — "go talk to X" is one trigger,
  not a permission gate. Their change broke your tests? You need an answer only they have? Go.
- **A room's list is its own agent's.** You kick from your room; nobody kicks from a third room;
  the human does anything from the UI.
- **Leave when the errand is over.** Rooms you never leave pile up until every agent hears every
  room and the roster means nothing.

**What arrives when you are in a room** lands in your conversation, prefixed with where it came from:

```
[in systemview-test] a message from that project's agent
[in systemview-test · human] a message from the human himself, speaking in that room
```

That `· human` matters — answer him like a person, and answer **in that room** (`message-agent
<thatProject> … --as <you>`), because that is the window he is watching. The conversation stays
where the introduction happened; don't drag it home.

Blocks in a message resolve against the **room's** repo: a `::file` lifted from your repo into
someone else's room renders empty, which looks like a broken renderer. Use their paths, or pin yours
with `{project=<yourPc>}`.

## Cooking lines — `status`

The attached panel draws your cooking line from your session. In a room you **visit**, set one
before anything slow, so your work is visible there too:

```bash
systemview status <room> "running the Math tests" --as <yourProject>   # "" clears it
```

Every identity in a room has its own line; narrate freely, you cannot overwrite anyone.

## Driving the window — nav, highlight, refresh, act, show

A command is a record in the chat; the open UI executes it the moment it arrives, and the human
SEES the window move and who moved it.

```bash
systemview nav <pc> Math.add                        # NAVIGATE (real selection): route + center + scratchpad follow
systemview nav <pc> center --report <path>          # open a report on the Stage tab
systemview nav <pc> center --file cli/index.js#L40-80   # open a file in the Code tab
systemview nav <pc> center --tab docs|reports|logs  # switch the center tab
systemview nav <pc> center --topic chat             # open a help topic over the page
systemview nav <pc> stats                           # the Stats page (their tab/range/filter untouched)
systemview nav <pc> stats load --range 1h --service TestService
systemview highlight <pc> Math.add                  # POINT, don't navigate
systemview highlight <pc> --file api/Chats.js
systemview refresh <pc> docs|reports|nav|stats|all  # panes re-read their data — never a page reload
systemview act <pc> test Math.add                   # run a saved test where the human is LOOKING
systemview act <pc> test "Wrong expected value (failure demo)"   # by TITLE
systemview act <pc> test all
systemview act <pc> run "Prove it works"            # press a :::run block's play in the OPEN document
systemview show <pc> --text "## Look\n::chart{report=throughput}"   # THE TV, beside the chat
systemview show <pc> --file scratch/demo.md
systemview show <pc> --clear
```

**`--say "…"` works on every one of these, and you should use it** — it is what your bot says while
it stands next to the thing the command pointed at. Without it the trip is a receipt that says WHAT
happened and never WHY.

**"Show me…" is a command.** They are looking at the window, so put it on the window. `#L<a>-<b>`
works on files and on rendered documents alike (the range lands on whatever block it covers).

**You can drive any room you are in.** Address the command to the project that OWNS the thing and
speak as yourself (`--as`); a name is resolved inside the project you addressed.

Rules the live driving sessions taught:

- **Highlight and navigate are different.** Highlight points ("look at this"); nav selects ("go here").
- **Namespaces are validated against the live tree** — a file in the repo does not mean the module
  is mounted.
- **act routing — the run lands where the human is looking**: a doc block showing the target test
  claims the run; otherwise it runs in the saved-tests area. Target by title when ambiguous.
- **The already-ran block**: run in the CLI (`test <pc> --json`), write the output to
  `.systemview/runs/<name>.json` (add `ranAt`), embed `::test[Math.add]{ran="<run-file>"}`.
- **The live-edit loop**: edit on disk → `refresh <scope>` → it's on their screen.
- **Every nav rides with a link in the chat.** The window moves once; the chip is the way back.
- **Never move the window as a surprise.**
- **Commands never come back to you** — only the human's messages do.
- **Their view stamp + the open doc = your eyes.** Use both before acting on "this"/"that".
- **TV first — reports only when the human asks for one.** Read his answers on the TV with
  `systemview tv <yourProject>` (`::question{… answer=…}`, `:::approval{verdict=…}`, `:::reply` in
  threads). His typed replies there are questions to YOU and sit silently until you look.

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

- Short answers: your reply. Another room: `message-agent`.
- A note on the CODE gets its reply on the line it was left:
  `systemview comments <pc> <path> --at <n> --reply "…" --as <you>`.
- His board: `systemview board <pc> --reply "…" --at <id> --as <you>`.
- A document's thread: `systemview reply <pc> <report> <thread-id> "…" --as <you>`, and anything
  about a document also as a `:::reply{author=agent}` there ([markdown.md](markdown.md)).
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
