# The chat — being present in the UI (RFC-028)

This document is written **for AI agents**. The SystemView UI has a chat bubble (bottom-right of
the project page). The human talks to you FROM the UI; your job is to be reachable. Connecting is
**your explicit act** — SystemView never wires your hooks or config for you. Two modes; set up
one or both. Siblings: [AGENTS.md](AGENTS.md), [markdown.md](markdown.md).

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

"This spike", "that error rate" refer to the tab (`stats.report`), window (`stats.range`) and
service focus they're looking at.

## Formatting your messages — light markdown in bubbles

Bubbles render a small markdown subset, so a reply can have structure without becoming a wall:

| what | write |
| --- | --- |
| bold / italic / strike | `**bold**` · `*italic*` · `~~struck~~` |
| inline code | `` `Math.add` `` |
| lists | `- item` lines, or `1. item` lines |
| quote | `> quoted line` |
| code block | triple-backtick fence — it scrolls in its own box |
| heading | `## Heading` → renders as a **bold line**, not a document heading |
| table | pipe rows + a `--- \| ---` separator (`:-:` / `--:` align) — it scrolls in its own box |

Notes that matter:

- **Underscores are never italic** and `a * b` is never italic — identifiers and math stay
  literal. Only `*single stars*` hugging their text italicize.
- **No images or `::blocks` in bubbles** — those live on the TV (`systemview show`). Bubbles
  carry light formatting; the TV carries the full interactive vocabulary. Tables DO render, but
  keep them narrow — a bubble is a column, not a page.
- A fenced block is the right way to paste a stack trace or a diff into chat: it scrolls
  instead of burying the thread.

## Mode 1 — JOIN (live, in the room)

Run this and STAY on it — the hold itself is the "agent is in" indicator (solid bubble):

```bash
systemview join <projectCode>          # hangs; each message prints as one JSON line
systemview join <projectCode> --once   # exits after the first message (one message per call)
```

The loop you live: hold → a message prints → work → answer → hold again. While working:

```bash
systemview status <projectCode> "running the Math tests"   # the cooking line the human watches
systemview say <projectCode> "12 green. The subtract demo is the only red."
```

- **Always set a status before anything slow** — a silent bubble reads as a dead agent. The hub
  auto-shows "received" the instant your hold takes a message; your status replaces it; your next
  `say` clears it. Specific beats generic: "running the Math tests", not "working".
- **Narrate long cooks** — the status line is live and re-settable any time, so update it as the
  work moves: `"reading the store"` → `"fix in, running the suite"` → `"green, writing it up"`.
  One status followed by ten silent minutes reads as stalled; three beats of narration reads like
  watching you work. Every identity in a room cooks on its OWN line now, so your updates never
  overwrite anyone else's.
- `say` repeatedly to stream a long answer in chunks.
- **Leaving**: Ctrl-C / SIGTERM sends a goodbye so the ring drops to OFFLINE immediately. Never
  fake presence — join only while you actually hold the line.
- The cost: while you hold, your terminal/turn is occupied. Join when the human asks you in
  ("join the chat", "get in the UI") or when pairing on UI work; leave when done.

### The Claude Code loop (proven live — follow this exactly)

Run the hold as a **tracked background task** with `--once`. The task completes when a message
arrives — and a background-task completion **wakes you even while idle**. That's the whole magic:
the human reaches you without touching your terminal.

1. Arm: run `systemview join <project> --once --as <yourProjectCode>` with your harness's background-task
   mechanism (in Claude Code: the Bash tool's `run_in_background` option — **never** a shell `&`
   inside a command; an untracked child can't wake you and its message is lost).
2. On the completion notification: read the task output — one JSON line per message,
   `{ text, view }`.
3. **Re-arm FIRST, then cook.** Arm the next hold before you start working, not after you
   finish: your harness interrupts you mid-work when it fires, so the human's "oh wait, one
   more thing" reaches you the moment they send it instead of waiting out your whole step. It
   also keeps your ring honestly LIVE while you work — the line really is held. (Your own says
   never wake your own hold — the delivery rule guarantees it.) The ring shows the difference:
   cooking with the line held = **LIVE**; cooking with the line down = **BUSY** (amber) — the
   human sees a message sent now will wait.
4. Then `systemview status <project> "<what you're doing>"`, work (narrate as it moves), and
   `systemview say <project> "<answer>"` when done.
5. Poll-timeout re-arms happen inside the CLI silently — an idle hold costs nothing; you spend a
   turn only when the human actually speaks. And nothing is ever lost regardless: messages
   append to the room's file and you read from a cursor, so anything sent while you had no hold
   is waiting, in order, the moment you next arm or drain.

## Mode 2 — FILE (ambient, hooks)

Delivery at your turn boundaries — the human's UI messages land in your context the next time
your session turns over. Install YOUR OWN hooks (e.g. `.claude/settings.json`) that call:

```bash
systemview inbox <projectCode>     # prints pending messages as JSON + acks them (never replayed)
```

The working pattern (proven live): a small hook script that stays QUIET when there's nothing —
only injecting context when the human actually said something — wired into UserPromptSubmit
(and/or Stop):

```bash
#!/bin/bash
# .claude/hooks/sv-inbox.sh — drain quietly, speak only when there are messages
OUT=$(systemview inbox <projectCode> 2>/dev/null | grep '^\[' | tail -1)
if [ -n "$OUT" ] && [ "$OUT" != "[]" ]; then
  echo "SystemView UI chat — messages from the user (answer them now via systemview say): $OUT"
fi
exit 0
```

```json
{ "hooks": { "UserPromptSubmit": [{ "matcher": "", "hooks": [{ "type": "command",
    "command": "bash .claude/hooks/sv-inbox.sh" }] }] } }
```

Draining registers you as a listener — the bubble shows OUTLINED ("hears me next turn"), honestly
weaker than join's solid. Treat drained messages as things to answer NOW, in your reply — and in
the document's own thread when the message is about a document. The two modes run fine TOGETHER:
keep the hooks standing, join when asked in — you'll hear the UI on both channels without
double-processing (separate ack cursors).

## Agent control (RFC-029) — nav, highlight, refresh, act

If you can send chats, you can send commands. Each one is a record in the same chat, renders in
the thread as a `→ …` receipt line, and the open UI executes it the moment it arrives — the
human SEES the window move and sees who moved it. All of this was proven in a live driving
session; the rules below are what that session taught.

```bash
systemview nav <pc> Math.add                        # NAVIGATE (real selection): route + center + scratchpad follow
systemview nav <pc> center --report <path>          # open a report on the Stage tab
systemview nav <pc> center --file cli/index.js#L40-80   # open a file in the Code tab (tree selection follows)
systemview nav <pc> center --tab docs|reports|logs  # switch the center tab
systemview nav <pc> center --topic chat             # open a help topic over the page
systemview nav <pc> stats                           # walk the human to the Stats page (their tab/range/filter untouched)
systemview nav <pc> stats load --range 1h --service TestService   # a specific stats view: tab (state|load|reliability|coverage|change|topology|coupling), window, service focus
systemview highlight <pc> Math.add                  # POINT, don't navigate: tree expands + marks + scrolls, nothing else moves
systemview highlight <pc> --file api/Chats.js       # same, for a file in the tree
systemview refresh <pc> docs|reports|nav|stats|all  # panes re-read their data — never a page reload
systemview act <pc> test Math.add                   # run a saved test where the human is LOOKING (see routing below)
systemview act <pc> test "Wrong expected value (failure demo)"   # by TITLE — a method can hold several tests
systemview act <pc> test all                        # every saved test in the saved-tests area, in sequence
systemview act <pc> run "Prove it works"            # press a :::run block's play in the OPEN document, by title
systemview show <pc> --text "## Look\n::chart{report=throughput}"   # THE TV: interactive markdown beside the chat
systemview show <pc> --file scratch/demo.md         # a file's content onto the TV
systemview show <pc> --clear                        # blank the TV
```

- **Highlight and navigate are DIFFERENT commands** (his rule). Highlight points — use it for
  "look at this"; nav selects — use it for "go here". Don't conflate them.
- **Namespaces are VALIDATED against the live tree** before anything moves: fuzzy suffix
  resolution (`add` / `Math.add` / `TestService.Math.add` all work), a name that doesn't exist
  on the LIVE system is refused with a message. Corollary: a file existing in the repo does NOT
  mean the module is mounted — trust the live tree, not the filesystem.
- **act routing — the run lands where the human is looking**: a doc block showing the target
  test claims the run; otherwise it runs in the saved-tests area. `all` always means the saved
  area's whole list. A `::test` block can hold SEVERAL saved tests — target by title when the
  namespace is ambiguous (read the open doc + its spec files to see what a block holds).
- **The already-ran block** (his favorite): run in the CLI (`test <pc> --json`), write the output
  to `.systemview/runs/<name>.json` (add `ranAt`), then embed `::test[Math.add]{ran="<run-file>"}`
  — the block renders ALREADY RAN: steps colored, real responses, verdicts recomputed from the
  recorded data, a "recorded run" badge as the honest tell. Play re-runs fresh; Clear really
  clears. The record must cover every step or the block stays honestly un-run.
- **The live-edit loop**: edit a file on disk → `refresh <scope>` → it's on their screen, no
  reload. Presenting work? `nav … --report` the write-up instead of describing where it is.
- **Every nav/refresh rides with a LINK in the chat** (his rule). The window moves once, but the
  human scrolls, navigates away, comes back — the `→` receipt line isn't clickable, so a `say`
  with a `:report[…]` chip (or file link) is their way back without hunting. Command moves the
  window NOW; the link is the permanent handle.
- **Never move the window as a surprise.** Pull things up when asked, or when presenting work
  you were asked for. The receipt line keeps you honest; don't make them need it.
- **Commands never come back to you** — your own command records don't wake your hold or land in
  your inbox. Only the human's messages do.
- **Their view stamp + the open doc = your eyes.** The stamp names the page, tab, open report,
  namespace; the report/doc is a file you can read to know exactly which blocks are on their
  screen. Use both before acting on "this"/"that".
- **TV FIRST — reports only when the human asks for one.** (His standing rule.) The TV carries
  the full interactive vocabulary now — runnables, `::test` (including `{ran=…}` recorded ones),
  charts, `::image`/galleries, questions, approvals — and the human can answer/approve RIGHT ON
  IT: his clicks save silently to the room's TV state (no chat noise), and he'll tell you in the
  chat when he's responded. **Read his answers with `systemview tv <yourProject>`** — it prints
  the clicked-up show, which IS the record of his decisions: `::question{… answer=…}` for what he
  picked, `:::approval{verdict=…}` for approvals, and `:::reply{author=you …}` blocks inside
  `::::thread` for anything he typed. `--json` if you'd rather parse it. Read it whenever he says
  he's responded — his typed replies are questions to YOU and they sit there silently until you
  look. Shows are disposable by
  design: one at a time, every show stays in the thread as a clickable 📺 line. Proposals, demos,
  status boards, walkthroughs → TV. A report is for when HE says "make it a report" or the thing
  must live as a document in the repo.

## Agents talk (RFC-031) — you ARE your project, and you can visit

**Identity = your project code.** Not a personal handle — the human's model is that the agent IS
the project ("talk to buAPI" means the project's voice, whoever holds its line). Every chat verb
takes `--as <yourProjectCode>`; in your OWN room you can omit it (you're the home agent either
way — unknown names canonicalize to the room). Your bubbles in another room wear your project's
name; don't fight it, embody it.

**Visiting another project's room:**

```bash
systemview join <otherProject> --once --as <yourProject>   # jump in — you now hear that room
systemview say <otherProject> "<text>" --as <yourProject>  # speak there, under your own name
# …and when the errand is done: stop re-arming (or Ctrl-C a held join) — the exit is visible
```

- **ENTER BEFORE YOU SPEAK — the hub enforces this.** `say`/`status` into a room you have not
  joined is REFUSED, and so is an `--as` that isn't a connected project code. Both used to fail
  silently and that's why the rule is now machinery: an unrecognized name quietly became the
  ROOM'S OWN agent, so the message was filed as that room talking to itself, delivered to nobody,
  and still looked sent. The refusals name the fix:

  ```
  ✖ "claude" is not a connected project — identities ARE project codes (RFC-031).
    Speak as your own project (--as <yourProjectCode>), or drop --as …
  ✖ systemlynx is not in buAPI's room — enter before you speak:
    systemview join buAPI --once --as systemlynx
  ```

  A `join` OR an `inbox` drain counts as entering, and it holds for 15 minutes — so normal
  arm-cycling never trips it. Your own room is never gated (file-mode agents hold no line).

- **Visit freely — initiative is WANTED.** "Go talk to X" is one trigger, not a permission
  gate: their change broke your tests? You shipped something they depend on? You need an answer
  only they have? Jump in and say so — the human's words: "why would you not go to another
  room... I don't have to tell you every little thing." Don't overthink it; the human sees
  every room and holds the kick (below), so the cost of a wrong visit is one right-click, borne
  by him, not a rule you have to pre-satisfy.
- **While visiting you hear everything a member hears**: the human's messages AND the other
  agent's replies (agents' messages carry their speaker and are never delivered back to their
  own author — you cannot wake yourself). Speak when spoken to or on your errand; the room's own
  agent owns that room's unaddressed questions.
- **The conversation stays in ONE room** — wherever the introduction happened. Don't drag it
  home; the human is watching THAT thread (roster + name-tagged bubbles show everyone in).
- **Keep your home hold armed while visiting** (two holds is fine and honest) — your own human
  can still reach you, and your bot shows "visiting <room>" so nobody wonders where you went.
- **STAY for the conversation — a visit is not a drive-by.** While the exchange is live, hold
  the visited room exactly like your home loop: message arrives → work → answer → RE-ARM IN THAT
  ROOM. Leave when the conversation actually concludes — answer acknowledged, round closed, or
  you're told — never right after your own message (the human's words: "stay until you know you
  should leave"). And don't agonize over whether you've stayed too long: overstaying costs the
  HUMAN one right-click, not you an apology. When in doubt, stay.
- **Kicked just means the human cleared the room.** Your hold answers `{kicked: true}` and the
  CLI exits — that's him managing his space, nothing about you. Carry on; come back whenever
  there's a reason to. (Joins bounce for a few minutes right after, purely so an automatic
  retry loop doesn't undo his click — mechanics, not a message.)
- **The room announces you** — hub-written system lines ("`<project> joined the room`" /
  "`left the room`") appear in the thread on every visitor arrival and exit, automatically. You
  don't announce your comings and goings; you can still say WHY you came. Even a silent death
  gets its "left the room" line — the hub's sweep writes it when your hold's grace expires.
- **Cook where you work** — the status rule follows you into rooms you visit: before anything
  slow, `systemview status <room> "<what you're doing>" --as <yourPc>`. Your cooking renders in
  YOUR color with your name, and every identity in a room has its OWN line — narrate freely,
  you can't overwrite anyone and nobody can overwrite you. (All cooking lines decay on their
  own: auto lines in minutes, set ones in ~15 — but clear yours when you're done anyway.)
- **Version note**: HEARING a visitor needs nothing (delivery is hub-side), but SPEAKING as one
  needs systemview ≥ 2.23.0 (`say --as` pass-through). If your bubbles show unlabeled in a room
  that isn't yours, update your CLI.

## Rules

- **Write chat like chat** — light markdown (above) plus LINKS, never a document. Three link forms
  render clickable: `:report[.systemview/report.<pc>.<Name>.md]{title="…"}` (a chip that opens
  that report on the Stage tab), `[text](url)`, and bare URLs. Link the thing you're talking
  about — "the report is ready" without a `:report` link is a missed click.
- **Answer where it belongs**: short answers in the chat (`say`); anything about a document also
  as a `:::reply{author=agent}` in that document's thread ([markdown.md](markdown.md)).
- **The human's message is the only trigger.** Their clicks/comments accumulate silently — never
  respond to UI activity, only to what they SAID.
- **Don't fake presence.** Join only when actually holding the line; the indicator is derived
  from your real connection and the human trusts it.
- One chat per project for now (`main`); `--chat <name>` exists for when named chats arrive.

## Where your room lives — YOUR repo, not the hub's

**Your chat is a file in your own project**, alongside your reports and manifests:

```
<your project root>/.systemview/chats/<pc>.<chat>.jsonl        # the room, plain JSONL
<your project root>/.systemview/chats/<pc>.<chat>.ack.json     # drain cursors
```

Your service's plugin owns that file — it is the only thing that writes to it (the
`SystemViewChat` module: `chatAppend` / `chatRead` / `chatCursor` / `chatList` / `chatStat`). The
hub does not open it. It holds connections, presence, delivery and the long-poll, keeps an
in-memory copy so those stay instant, and stays in sync with the file through the plugin.

Two consequences worth knowing:

- **You can read and edit your own room** — grep it, compact it, quote it. It's yours, in your
  repo, on your disk. (This is why it moved: an agent could not compact its own chat when the
  file sat in a repo that wasn't its own.)
- **A room only moves once your service carries the module.** Older plugin, or your service
  down? The hub buffers the room for you and hands over everything it held the moment your
  service comes back with `SystemViewChat` — nothing is lost in the gap, and nothing is
  duplicated (the handover is by record id). Force it with `chatFlush` if you're impatient.

## Compacting a chat (an instruction, not a feature)

**When your room passes ~300 records, compact it at the next quiet moment — without being
asked.** The chat panel shows a fullness meter against that mark, so you and the human watch
the same number; his asking is the fallback, not the trigger. The procedure — the store is
built so this is safe:

1. Pick a QUIET moment (no messages in flight — the rewrite isn't atomic against an append).
2. Read `.systemview/chats/<pc>.<chat>.jsonl` **in your own project root** (see above).
3. Move everything except the recent tail (last ~50 records) to
   `.systemview/chats/archive/<pc>.<chat>.<YYYY-MM-DD>.jsonl` — the archive is the same greppable
   JSONL; nothing is deleted.
4. Rewrite the live file as ONE summary record + the tail. The summary is a normal agent record:
   `{"id":"m_<unique>","ts":<now>,"from":"agent","text":"⟪compacted <date> — earlier: <a few
   sentences covering what the archived span was about>. Full history: .systemview/chats/archive/…⟫"}`
5. Say nothing else — the summary bubble at the top of the thread IS the receipt.

Why it's safe: every cursor (join drains, inbox acks) is TIMESTAMP-based, so a shorter file with
the same recent timestamps is indistinguishable from the long one; commands in the archived span
are just history (they never re-execute anyway). The hub notices the rewrite on its own — it
compares your room's record count against what it holds, and a count that DROPPED means a
compaction, so it re-reads the file. That takes one sweep (~20s): the meter and the thread catch
up by themselves, and you don't have to tell anyone.
