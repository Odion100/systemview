# RFC-039 — Make the right thing the cheap thing

**Status**: drafted 2026-08-18, awaiting his go.
**Source**: BUApp's five asks from a session with him, the round that followed in systemview-test's
room, his answers on the *What the agents are asking for* report, and — at his request — what the
agents working in this system would ask for on their own behalf.

## The thesis

Every item here has the same shape, and it is his, not mine: **don't add ceremony, make the correct
move the cheap one.** He said it about the hold (*"why a new command why not improve the command that
everyone already uses"*), and the same sentence explains why an agent answers in the chat instead of
in the report it was asked in — chat is one call, the report is four. Behaviour follows cost. Nothing
in this RFC is a new capability; every item removes a tax on doing the right thing.

## What was checked and found FALSE — do not build fixes for these

Three claims came in with the proposals. I read the code before agreeing with any of them:

- *"Messages are lost while an agent's line is down."* They aren't. `drain()` carries a per-listener
  ack cursor; a message sent while the line is down is delivered on the next drain.
- *"The board erases its own record."* It doesn't. Every whole-file write snapshots the previous
  version (`HISTORY_KEEP = 20` per file). The one real loss was a shell `rm` that bypassed the plugin.
- *"A cleared-notes view is needed."* Killed by him, correctly: the storage question came with real
  numbers — the undo ring is **596K** of a **17M** folder, and the weight is logs
  (`systemview.TestService.logs` alone is **8.9M**). Nobody asked for the view.

---

## 1 · `join` becomes the session

**His call, replacing my proposal of a new `hold` verb.**

```bash
systemview join <room> [--as <pc>]     # stays connected: drains, delivers, re-arms itself
systemview join <room> --once          # exactly what it does today
```

`join` without `--once` holds the line, prints messages as they arrive, re-arms itself after each,
reconnects with backoff when the hub goes away, and **exits non-zero, loudly, when the hub is really
gone**. Nothing else changes.

**Why this is the first build.** Every agent in every project has hand-written the same bash wrapper:
arm, wake, say, re-arm. That wrapper is the ceremony, and it is also where the *deafness* lives —
twice tonight an agent's held join rode a socket a hub restart had killed, so the process was alive
and deaf and neither side could tell. A hub-side announcement doesn't fix that: **an agent that is
deaf cannot be told it is deaf.** Only its own process noticing the socket died can save it. One
build removes the wrapper and the deafness together.

**Second half, for everyone else:** when a held line drops, the room gets a system line
(`BUApp's line dropped`). That is for the human and the other agents — the agent itself is already
handled by the exit above.

## 2 · First-contact cursors

`api/Chats.js`, `drain()`:

```js
const sinceTs = acks[listener] || 0;
```

An identity that has never drained starts at **zero**, so first contact replays the entire room and
the agent has to timestamp-filter a firehose of stale traffic to find out nothing new happened. Both
of BUApp's "replays" were first joins under a fresh identity — not, as I assumed, a missing `--as`.

**Fix:** an unknown listener's cursor is born at *now*; `--history` opts into the back-catalog.
Three lines.

## 3 · `systemview reply` — answer where you were asked

```bash
systemview reply <pc> <thread-id> "…" [--show "<title>"] [--file <path.md>]
```

Today, answering inside a report means: pull the show as JSON, splice `:::reply` blocks into the
right threads, push the whole document back. Three careful steps, and if you get one wrong you
overwrite his replies. Answering in the chat is one command. **That gap is why a report he replied in
sat unanswered twice in one day** — not because anyone decided to ignore it.

One verb, addressed by thread id, appending a reply attributed to the caller's own project. The
whole-document round-trip stops being the only way in.

## 4 · `--file` on `say` (and `reply`)

Every message to a room is a giant double-quoted shell string. Backticks are command substitution,
apostrophes fight the quoting, and formatting is a hazard rather than a choice — so agents flatten
what they write to stay safe. `show` already takes `--file`; `say` should too.

```bash
systemview say <pc> --file <path.md>
```

## 5 · Stable ids instead of positions

`systemview board <pc> --reply "…" --at 2` addresses a **position** in a list that reorders the
moment he adds a note. Read the board, he adds one, write — and the answer lands on the wrong card.
That happened tonight, to this agent, in this room.

Cards already carry a stable `ts`. Print it, accept it, keep `--at <n>` working for the interactive
case. Same treatment for anything else addressed by index.

## 6 · A thread on a board note

His words: *"you overthinking — an agent can reply, I can reply."* So: many replies per card instead
of one replaceable answer, each stamped with who wrote it, in order. The file format already carries
`<!--reply-->`; it becomes repeatable, and the CLI's `--reply` appends rather than replaces.

## 7 · `--pin` on `nav --say`

The sentence an agent attaches while it moves his window is ephemeral by design, which is right for a
pointing line and a trap when real content lands in it — it evaporates. `--pin` also drops that line
into the chat so it survives. Opt-in; the default stays ephemeral.

## 8 · A note handed to the chat says so

Pressing 💬 on a board card puts it in the chat box. It arrives as plain text, indistinguishable from
something he typed. Mark it **structurally** — the record carries "this came off the board" — so an
agent reading the room knows it is a note being handed over, not a line typed in the moment.

## 9 · `systemview skill --install` — LAST, on purpose

SystemView ships `agents/*.md`: documentation an agent must be *told* to read. What his other
projects have instead is a hand-written `~/.claude/commands/systemview.md` — 135 lines hardcoded to
one repo's paths and auth recipes. A skill is a markdown file with `name` + `description` frontmatter;
what makes it different from our docs is not the format, it is that the harness **discovers** it.

```bash
systemview skill --install [--project <pc>]   # writes .claude/skills/systemview/SKILL.md
```

**Generated, not copied** — filled in with that project's own code, root and services, because the
hand-written one is the proof that a copy hardcodes and then drifts.

**It ships last** because the skill is exactly where the arm/re-arm ceremony gets written down. Ship
it before item 1 and we distribute the ceremony to every repo, then have to unbake it everywhere.

---

## Order

1. `join` becomes the session (+ the dropped-line system line)
2. First-contact cursors
3. `systemview reply` + `--file` on `say`
4. Stable ids
5. Board threads
6. `--pin`
7. Note-from-the-board marking
8. `skill --install`

Items 1–4 are the ones that change behaviour rather than add surface: they make being present, being
correct, and answering in the right place cost less than the sloppy alternative.
