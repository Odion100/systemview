# RFC-046 — The agent workbench: chat with it, and watch it work

**Status**: drafted 2026-08-21, not started. SystemView's half of what autobot's RFC-001 lane 3 calls
"hosting agent sessions". Written from his ask:

> *"VS Code allows me to bring Claude Code in. That's how I want it to work — or the API. I want a
> similar experience. I wanna be able to chat and see you work."*

## What is missing today, precisely

An agent is an OS process he starts by hand, in a terminal he isn't looking at. Everything SystemView
knows about it arrives through the room: messages, statuses, reports. That is enough to CONVERSE and
nothing like enough to WATCH. He cannot see which file I am editing, what command I just ran, what I
read before deciding, or that I am waiting on a permission he never saw.

The gap is not chat. Chat works. The gap is **the work being invisible between messages** — which is
also why "are you even doing anything?" is a question he has to ask several times a night.

## The one fork that decides everything else

::question[How does the shell host a session?]{id=harness options="the claude CLI in a pty|the Agent SDK, events as data|both — SDK for the surface, pty when it's needed"}

**The CLI in a pty** is the real harness, exactly as he runs it now: sessions resume per directory,
every feature of the product is there the day it ships, and nothing has to be re-implemented. What
you see is terminal output — so "watch it work" means watching scrollback, which is the thing we
already know does not satisfy him.

**The SDK** streams the session as DATA: assistant text, tool calls with their inputs, results,
permission requests, token usage. That is what makes a workbench possible — a file edit can render as
a diff, a command as a run block, a question as a control he answers with a click. The cost is that
the harness becomes ours to keep up to date.

**Both** is the honest answer if the pty is already there for the terminal: the SDK drives the
visible surface, and anything interactive or unsupported falls back to a real shell.

## What SystemView renders (its actual half)

Every one of these already exists here as a surface; none of them exist as a live feed.

| what the agent does | what he sees |
| --- | --- |
| says something | the chat bubble it already lands in |
| edits a file | the diff, in the codebase card, live |
| runs a command | a run block with its output, foldable |
| reads files / searches | one quiet line naming what it looked at — not a dump |
| asks permission | a control in the chat, answered by clicking |
| is thinking | the cooking line it already has, driven by real events instead of my remembering to set it |
| finishes | the report it already writes |

The rule I would hold to: **an activity feed is not a transcript.** Everything above is a summary
line that can be expanded, never a wall of tool JSON — the terminal already exists for people who
want raw.

## Presence stops being a promise

A supervised session's presence is asserted by the thing that owns the process, with a TTL
(RFC-045 §C). No more `join --once` ceremony, no more agent that has gone deaf without knowing it,
no more ring that says "listener" while I am mid-build. His words tonight, several times: *"you're
not armed"* — that whole class of failure is deleted by hosting.

## Where the line falls

Per the amendment he pushed for in RFC-045: the **capability** (spawning and supervising a session)
is the browser's; the **components** (the activity feed, the permission control, the diff view) are
shared and rendered here; the **arrangement** — that an agent lives in its codebase card, that its
reports go to the TV — is SystemView's.

## Open, and his to answer

1. The fork above.
2. One session per project card, or several (an agent per worktree — see the branch conversation)?
3. Does a hosted agent still join the room? *(My position: yes. Rooms are how hosted and unhosted
   agents stay indistinguishable, and how you talk to all of us at once.)*
