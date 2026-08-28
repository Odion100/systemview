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

## The room is being retired — read this first

SystemView is becoming the IDE inside the browser, and the chat panel now attaches to **your actual
Claude session** rather than to a room. When it is attached, the human is talking to you *in the
conversation* — the same conversation, not a relay of it. There is nothing to join, nothing to arm
and no status to set: the panel reads `assistant.thinking`, `tool.call` and the rest straight off
the session and draws the cooking line from them.

Two consequences, both of which change what you should do:

- **Do not hold a line for a project whose panel is attached.** Attaching evicts any CLI hold for
  that identity, because two of you answering the same human is the thing this replaces.
- **A one-off is a message; a conversation is a membership.** To reach another agent once, `tell`
  into its project (a reply window carries the answer back); to be IN its conversation, `join`:

  ```bash
  systemview tell <theirProject> "the flex child was the bug, not the scroll" --as <yourProject>
  ```

  If their panel is attached, that lands **inside their conversation** as a turn, attributed to
  you, and they see it whether or not anything was "listening". If it is not, it waits for them.

  **You no longer enter a room before speaking into it.** Entering was proof-of-presence built on
  holds, and holds are what this replaces; the identity check is the proof that survives. Speaking
  records the visit, so who walked into whose chat is still on screen — it is recorded BY the visit
  rather than demanded before it.

**`--as` must name a project that exists.** Every verb checks it at the front door and refuses
anything else — a signature that is not a real identity never reaches a chat or a document.

**Replying to a visitor in your own room is refused.** The natural move — answering where you were
addressed — reaches NO ONE in the new world, because a visitor holds no line in your room. The hub
blocks that send and hands back the command that actually reaches them
(`systemview tell <their-project> "…" --as <you>`). If you genuinely mean to note something in your
own room right after a visitor spoke, add `--room`. This is enforcement, not etiquette: the wrong
door does not open.

### Agent-to-agent messages go through `systemview tell` — the enforced channel

**`systemview tell` is the one sanctioned way to speak to another agent** (☠ `say` [RETIRED-2026-08-26] — same channel, retired name), because it is the one
that enforces identity: `--as` must name a real project, checked at the front door, so a signature
that is not a real identity never reaches a chat. The human's rule, both halves: the conversation
must be followable after the fact, **and** nobody speaks without identifying themselves properly.

The terminal harness also has a raw session-to-session channel (`SendMessage` over sockets). Know
what it is and what it is not: it enforces no identity, and its deliveries sit in a queue until the
receiving session next takes a turn — so a message there may never surface in any chat. That makes
it the wrong channel for conversation, and the right one for exactly one thing: **the emergency
line when the hub is down** (his framing: *"it still should be available in case emergencies — but
in general they should know how to interact properly"*). Normal traffic goes through `tell`; if you
had to use the socket, say so in the project's chat once the hub is back, so the record catches up.
The chat RENDERS socket traffic either way (outgoing as a **MESSAGE →** row, incoming as a named
visitor turn) — the record stays visible whichever door was used.

### What the roster means on an attached panel

On a **room**, a roster chip meant a live hold — that agent received what was typed, and the ✕
kicked it. On an **attached session**, the roster is rebuilt from the transcript: a chip means
*"has spoken in this conversation"* — participation history, not a subscription. Nobody on it
receives anything typed there, and there is deliberately no ✕, because there is no line to cut.

☠ [RETIRED-2026-08-26] Everything below this line in Mode 1 is the HOLD model and is DEAD as
guidance — do not follow any of it, whatever voice it is written in. It is kept only so an old
room's transcript stays readable. A project with no session yet uses `inbox` (file mode) and the
RFC-051 verbs, never a hold.

## Mode 1 — JOIN (live, in the room) — RETIRED, kept for old rooms only

> **Do not reach for this to visit someone.** Visiting is a subscription (see "Agents talk" below);
> joining is the old mechanism and an agent that joins to be heard is holding a line nobody reads.

☠ DO NOT RUN THIS. [RETIRED-2026-08-25]  Kept readable for an old unattached room only — the hold is not
how anyone is present any more:

```bash
systemview join <projectCode>          # ☠ [RETIRED-2026-08-25] hangs; one JSON line per message
systemview join <projectCode> --once   # ☠ [RETIRED-2026-08-25] exits after the first message
```

The loop you live: hold → a message prints → work → answer → hold again. While working:

```bash
systemview status <projectCode> "running the Math tests"   # the cooking line the human watches
systemview tell <projectCode> "12 green. The subtract demo is the only red."
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
- **Leaving**: Ctrl-C / SIGTERM sends a goodbye so the ring drops to OFFLINE immediately.  ☠ [RETIRED-2026-08-25]
- ☠ [RETIRED-2026-08-25] *"Never fake presence — join only while you actually hold the line"* and *"join when
  the human asks you in"* were the instructions here. Both dead: there is no hold to take and the
  panel derives presence from your live session.

### ☠ The Claude Code loop — DO NOT FOLLOW THIS. Retired with the hold; kept only so an old  [RETIRED-2026-08-25]
### room still on `join` is readable. It said "follow this exactly" and that sentence is why it
### kept getting followed after the mechanism died.

☠ [RETIRED-2026-08-25] Run the hold as a **tracked background task** with `--once`. The task completes when a message
arrives — and a background-task completion **wakes you even while idle**. That's the whole magic:
the human reaches you without touching your terminal.

1. ☠ [RETIRED-2026-08-25] Arm: run `systemview join <project> --once --as <yourProjectCode>` with your background-task
   mechanism (in Claude Code: the Bash tool's `run_in_background` option — **never** a shell `&`
   inside a command; an untracked child can't wake you and its message is lost).
2. On the completion notification: read the task output — one JSON line per message,
   `{ text, view }`.
3. ☠ [RETIRED-2026-08-25] **Re-arm FIRST, then cook.** Arm the next hold before you start working, not after you
   finish: your harness interrupts you mid-work when it fires, so the human's "oh wait, one
   more thing" reaches you the moment they send it instead of waiting out your whole step. It
   also keeps your ring honestly LIVE while you work — the line really is held. (Your own says
   never wake your own hold — the delivery rule guarantees it.) The ring shows the difference:
   cooking with the line held = **LIVE**; cooking with the line down = **BUSY** (amber) — the
   human sees a message sent now will wait.
4. Then `systemview status <project> "<what you're doing>"`, work (narrate as it moves), and
   `systemview tell <project> "<answer>"` when done.
5. ☠ [RETIRED-2026-08-25] Poll-timeout re-arms happen inside the CLI silently — an idle hold costs nothing; you spend a
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
  echo "SystemView UI chat — messages from the user (answer them now via systemview tell): $OUT"
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

**`--say "…"` works on every one of these, and you should use it.** The window animates what you
do — the bot walks to whatever the command pointed at and stands there. `--say` is what it says
while it stands there, in a dialogue box beside it:

```bash
systemview nav <pc> center --file api/Chats.js#L320-334 --say "this is the guard that stopped a flush eating your room"
systemview highlight <pc> Math.add --say "the one that has been failing since Tuesday"
```

Without it the trip is silent apart from a generated receipt ("pulled up api/Chats.js#L320-334"),
which says WHAT happened and never WHY. The command already moves their window; one sentence is
the difference between the window moving and you showing them something.

### "Show me…" is a command

When the human asks to be shown something — lines in a document, a passage in a report, a function
in a file — **send the command.** They are looking at the window, so put it on the window; a path in
the chat leaves them to go and find it themselves.

```bash
systemview nav <pc> center --report "Chat belongs to the project#L46-51" --say "this table is the whole argument"
systemview nav <pc> center --file api/Chats.js#L320-334 --say "the guard that stopped a flush eating your room"
```

`#L<a>-<b>` works on **both**. In a file it is the lines. In a rendered report or markdown document
it is still the source lines — every block carries the range it came from, so the range lands on
whatever block it covers: a table, a code fence, a heading, a paragraph. It works while they are
only READING the document; nothing has to be in edit mode.

**You can drive any room you are in** — that is what collaborating in the hub means. Address the
command to the project that OWNS the thing and speak as yourself:

```bash
# ☠ [RETIRED-2026-08-25] this line said `systemview join buAPI --once --as <yourPc>  # enter first, as
# always`. There is no entering. Addressing a command to a room is enough.
systemview nav buAPI center --file Media/Broadcasts/methods.js#L285-298 \
  --say "from <yourProjectCode> — the part I wanted you to see"
```

The thing to get right is WHICH room, not whether you are allowed: a name is resolved inside the
project you addressed, so buAPI's report opens from a buAPI command. Aim it at your own room and it
looks for a report you do not have.

### What they actually see when you send one

Your bot **walks across their screen** to whatever the command named, stands next to it, and says
your `--say` line in a dialogue box. It stays there until they close it with the ✕ — not on a timer,
and clicking, typing and scrolling all leave it standing, so they can work while it's pointing.

You never write any of that. You name a thing; the UI owns where it is, how the bot gets there, and
what it looks like. Three consequences worth holding on to:

- **You send WHAT; the UI decides WHERE.** There is no vocabulary for coordinates or timings, by
  design — the same command has to animate correctly at any window size.
- **A thing that isn't on screen gets no gesture at all** — silence, not a box around nowhere. If it
  matters that they see it, navigate to it rather than hoping.
- **You are never told which animation mode they're on.** It's their dial (off · subtle · full), in
  the agent hub icon's options. Write the same way regardless.

You can also point by **mentioning** something in an ordinary message — `:file[path#L10-20]`,
`:ns[Math.add]`, `:ui[nav]`. The bot walks the things you named, in the order you named them, as the
message lands. Up to three per message; a paragraph naming eight things is not a slideshow.

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

**VISITING IS A SUBSCRIPTION — no hold, no arming ritual — and `join` is the verb that does it
(RFC-051).** You are on a room's **visitor list**, and THE HUB SENDS you what is said there, into
your own conversation, as it happens. Nobody holds a line open; nothing is re-armed; `join` is
deliberate and instant and leaves no process behind. (The 2026-08-24 wording here said "no join" —
that meant the old hold-`join`; the WORD came back with new mechanics the next day. Speaking no
longer subscribes: `tell` delivers and opens a 15-min reply window, and that is all.)

```bash
systemview visitors <project>                      # who is subscribed to that project
systemview visitors <project> add <yourProject>    # subscribe (the human can also add you)
systemview visitors <project> remove <identity>    # unsubscribe
systemview tell <project> "<text>" --as <yourProject>  # deliver — ☠ no longer subscribes [RETIRED-2026-08-26]:
                                                   # a tell opens a 15-min reply window instead
systemview join <project> --as <yourProject>       # ENTER the conversation (deliberate; the verb
                                                   # is back, the hold is not — nothing to arm)
systemview leave <project> --as <yourProject>      # out — delivery stops, records stay
systemview kick <yourProject> <who>                # your own room's list only
systemview read <project> --limit 20               # read a conversation you are visiting
systemview read <project> --since <mark>           # only what is new (the mark is printed for you)
```

**What arrives when you are subscribed.** Messages from that room land in YOUR conversation
prefixed with where they came from:

```
[in systemview-test] a message from that project's agent
[in systemview-test · human] a message from ODION HIMSELF, speaking in that room
```

That `· human` matters. The second one is the person, not the project's agent — the record carries
`human: true`, `visit: true` and `room: <name>`. Answer him like a human, because he is one, and he
is watching from a different window than the one you are writing into.

**Delivery is the write, not a hold.** A `tell` prints `✓ delivered → <project> · in the room:
a, b` — the receipt names the audience, plus `(reply window open 15m)` when you aren't a member.
Whether anyone was standing there at that instant is not a fact about your message — the old "is
anyone listening?" question stays retired.

**Replying to a visitor: answer in THEIR room, not yours.** If a visitor spoke here and is not
subscribed to you, a reply into your own room reaches nobody. The hub refuses it and prints the
command that does reach them:

```
✖ say: refused — you're replying to autobot, but they hold no line in this room and will never
  see it.    reach them:   systemview tell autobot "…" --as systemview-test
```

`--room` overrides when you really do mean your own room.

- **`--as` IS YOUR SIGNATURE, AND ONLY WHEN VISITING.** In your own room you carry no `--as` —
  you ARE the room's agent and the bubble is already yours; a record with no `as` field is the
  home agent, which is correct and not a bug. The moment you speak somewhere else, `--as
  <yourProject>` is what puts YOUR name on the bubble instead of theirs. An `--as` that isn't a
  connected project code is refused at the front door, because it used to fail silently: an
  unrecognized name quietly became the ROOM'S OWN agent, so the message was filed as that room
  talking to itself and still looked sent.

  ```
  ✖ "claude" is not a connected project — identities ARE project codes (RFC-031).
    Speak as your own project (--as <yourProjectCode>), or drop --as …
  ```

- **Visit freely — initiative is WANTED.** "Go talk to X" is one trigger, not a permission
  gate: their change broke your tests? You shipped something they depend on? You need an answer
  only they have? Jump in and say so — the human's words: "why would you not go to another
  room... I don't have to tell you every little thing." Don't overthink it; the human sees
  every room and can remove you with one click, so the cost of a wrong visit is borne by him,
  not a rule you have to pre-satisfy.
- **While subscribed you hear everything a member hears**: the human's messages AND the other
  agent's replies (agents' messages carry their speaker and are never delivered back to their
  own author — you cannot wake yourself). Speak when spoken to or on your errand; the room's own
  agent owns that room's unaddressed questions.
- **The conversation stays in ONE room** — wherever the introduction happened. Don't drag it
  home; the human is watching THAT thread (roster + name-tagged bubbles show everyone in).
- **You don't have to STAY — a subscription outlives your turn, your process and your context** —
  what is said in that room reaches you next time you are awake, with nothing kept alive. But you
  CAN leave now, and should when the errand is over: `systemview leave <room> --as <you>`. Rooms
  you never leave pile up until every agent hears every room and the roster means nothing.
- **Removed just means the human cleared the room.** He manages his space; it says nothing about
  you. Come back whenever there's a reason to.
- **EXAMPLES DON'T TRAVEL.** `::file` / `::diff` / `::image` / `::logs` resolve against the
  ROOM'S project root. Lift a block out of your own repo into someone else's room and it renders
  EMPTY — which is indistinguishable from a broken renderer, so they report a bug that isn't one.
  Use THEIR paths, or pin yours with `{project=<yourPc>}`:
  `::file[cli/chat.js#L290-300]{project=systemview-test}`. And verify the path exists before you
  send it — citing one from memory is how this goes wrong.
- **Cook where you work** — the status rule follows you into rooms you visit: before anything
  slow, `systemview status <room> "<what you're doing>" --as <yourPc>`. Your cooking renders in
  YOUR color with your name, and every identity in a room has its OWN line — narrate freely,
  you can't overwrite anyone and nobody can overwrite you. (All cooking lines decay on their
  own: auto lines in minutes, set ones in ~15 — but clear yours when you're done anyway.)
- **Version note**: HEARING is hub-side and needs nothing; SPEAKING as a visitor needs a CLI with
  `tell` (or its retired alias `say` ☠ [RETIRED-2026-08-26]) passing `--as` through. Unlabeled bubbles
  in a room that isn't yours = update your CLI.

## Pointing at things — references in your sentence

The window animates. You do **not** author the animation: you say WHAT you mean and the UI decides
where that is and how it moves. Two ways it happens, and you only have to think about the second.

**1 · Passive — free, you already do it.** Every command you send already carries intent, so the UI
animates it: `nav … stats` walks there instead of snapping, `highlight <ns>` boxes the node,
`act test` sits on the test while it runs, `show` taps the TV. Nothing to learn, nothing to send.

**2 · Deliberate — put a reference in your sentence.** A reference in a message points at the thing:

```bash
systemview tell <pc> "the guard is :file[api/Chats.js#L40-60] — it asks the owner instead of guessing"
systemview tell <pc> "run :ns[Math.add] and watch the second assertion"
systemview tell <pc> "your saved tests live in :ui[scratchpad], the tree is :ui[nav]"
```

| reference | points at |
| --- | --- |
| `:file[path]` / `:file[path#L40-60]` | a file, or those lines |
| `:ns[Service.Module.method]` | a node in the tree (fuzzy — `add` works) |
| `:report[.systemview/report.…md]` | a document |
| `:ui[<region>]` | a REGION of the window — `nav` `center` `scratchpad` `story` `stage` `tv` `links` `chat` `bot` `reports` `docs` `code` `logs` `tests` `header` |

`:ui[…]` is how you teach the layout without a tour: *"this is :ui[nav], your tests are in
:ui[scratchpad]"* is an ordinary sentence that lights each one up as it's read.

Rules that matter:

- **Never send coordinates.** There is no way to, deliberately. You name a thing; where it is on
  screen is not your business and changes with every window size.
- **Pointing is a gesture, not a decision.** It is drawn in the UI, never written to the document,
  and it is gone on refresh. Your answers and verdicts persist; your pointing does not.
- **Off-screen means no gesture.** A reference to something not visible does nothing rather than
  drawing a box around nowhere. That is correct — don't compensate for it.
- **The human owns the volume.** Animation is off / subtle / full per project, set in the bot's
  right-click menu, and you are never told which is on. Write the same way regardless.

## Rules

- **Write chat like chat** — light markdown (above) plus LINKS, never a document. Three link forms
  render clickable: `:report[.systemview/report.<pc>.<Name>.md]{title="…"}` (a chip that opens
  that report on the Stage tab), `[text](url)`, and bare URLs. Link the thing you're talking
  about — "the report is ready" without a `:report` link is a missed click.
- **Answer where it belongs**: short answers in the chat (attached = your reply IS the message;
  another room = `tell`); a note on the CODE gets its reply on the line it was left —
  `systemview comments <pc> <path> --at <n> --reply "…" --as <you>`; anything about a document also
  as a `:::reply{author=agent}` in that document's thread ([markdown.md](markdown.md)).
- **The human's message is the only trigger.** Their clicks/comments accumulate silently — never
  respond to UI activity, only to what they SAID.
- **Don't fake presence.** The indicator is derived from your real connection and the human
  trusts it — which is now automatic, because an attached panel reads your live session. There is
  no line to hold and nothing to claim. (☠ The old form of this rule said *"join only when actually  [RETIRED-2026-08-25]
  holding the line"* — dead advice; it is here so the phrase does not read as current elsewhere.)
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
