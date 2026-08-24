# RFC-046 — The agent workbench: chat with it, and watch it work

**Status**: drafted 2026-08-21. **Answered by him 2026-08-23 in threads on the iteration report, and
revised here against those answers — the forks below are no longer open.** He said *"everyone can get
to work"*, so this is the shape being built, not a proposal. SystemView's half of what autobot's
RFC-001 lane 3 calls "hosting agent sessions" (autobot's own map is `RFCs/RFC-002-the-browser-is-the-harness.md`).
Written from his ask:

> *"VS Code allows me to bring Claude Code in. That's how I want it to work — or the API. I want a
> similar experience. I wanna be able to chat and see you work."*

## What is missing today, precisely

An agent is an OS process he starts by hand, in a terminal he isn't looking at. Everything SystemView
knows about it arrives through the room: messages, statuses, reports. That is enough to CONVERSE and
nothing like enough to WATCH. He cannot see which file I am editing, what command I just ran, what I
read before deciding, or that I am waiting on a permission he never saw.

The gap is not chat. Chat works. The gap is **the work being invisible between messages** — which is
also why "are you even doing anything?" is a question he has to ask several times a night.

## The centre of the iteration, in his words

> *"One of the main things we're solving is that connecting through the CLI is hacky. And you don't
> actually see the agents work in the conversations. So it's just about that experience of seeing the
> agent work and being able to see the agent thinking and interacting with files."*

That is the test for everything below. **If a piece of work does not move "watch it think and touch
files", it does not belong in this round.**

## The harness — ANSWERED: both

::question[How does the shell host a session?]{id=harness options="the claude CLI in a pty|the Agent SDK, events as data|both — SDK for the surface, pty when it's needed" answer="both — SDK for the surface, pty when it's needed"}

And the thing he wanted to know before committing, settled so it never gates anything again:
**neither path requires an API key.** The CLI route runs on his existing Claude Code subscription;
the SDK drives the same Claude Code underneath and can use the same login. A key only becomes
necessary for an agent that is **not** Claude Code — an agentci agent, an outside connector — which
is its own lane and its own decision. His framing: *"there's going to be multiple ways for an agent
to connect, not one"*, so cost is not on the critical path.

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

## Several agents, one project — it is a naming problem, not a queue problem

He asked directly: *"all these agents are running from different processes… show how this affects
your questions of concurrency and working tree."*

Separate processes are the easy part. The shared thing is **the working tree**, and there are only
two shapes:

- **One tree, many agents.** They serialise on writes, and every concurrent edit is a genuine
  conflict someone has to arbitrate. Cheap to build; gets worse with every agent added.
- **A worktree per agent, a branch per agent.** Which is what he already described wanting:
  *"I intend to be able to spawn multiple agents from the same directory on separate branches."*
  `git worktree` gives each session its own checkout of the same repository — no write contention at
  all — and reconciling is an ordinary branch merge, which is a thing he already knows how to read.

**Take the second.** It is barely more work, because git does the isolation.

What it forces on SystemView is the real cost, and it is a UI cost: **an agent must say which branch
and which tree it is on**, everywhere it appears — the card, the activity feed, and above all the
diff. Without that, two agents' changes are indistinguishable in the one surface he uses to review
them. So concurrency here is answered by naming, not by locking.

**AND NONE OF THAT IS THE BROWSER'S BUSINESS** — his correction, after I had asked autobot to carry
branch and worktree in its events:

> *"What the fuck does the browser care about branches? That's not the part the browser is concerned
> with. SystemView is the IDE that can use multiple agents, facilitated through the browser —
> because the browser lets you set up the API key or the Claude login."*

He is right, and the seam already supports it: `open()` takes a **`cwd`**. SystemView decides to make
a worktree, so SystemView hands the session the directory; the browser starts a session there and
never needs to know why. Branch, worktree, which agent owns which piece of work, and how many agents
a project has are all **IDE arrangement**. The browser's entire job with agents is: you are signed in
(or here is a key) — start a session, stream what it does. Anything we ask it to remember beyond that
is us putting IDE state in the wrong process.

## An agents section — a thing you look at, not a folder you open

**New in his 2026-08-23 answers, and it is not the activity feed:**

> *"You should actually set up a UI location where it's about the agents… you need to be able to see
> where an agent is defined, and like all its documents that it is using, skills and all that stuff,
> presented in a nice way in the UI where a user would actually sit there and see what the skills and
> stuff are instead of it just being files."*

Same argument as the codebase card: these are already files on disk (`CLAUDE.md`, `agents/*.md`,
skills, the room), and reading them as a file tree is not reading them. This is a **section**, sibling
to CODE and TERMINAL in the project card: who this agent is, what it was told, which skills it has,
which documents it reads. Worker agents running automation come later; being able to SEE the ones
that exist comes now.

## Permissions — built, and off by him

Answered `this-iteration` on the fork, but with his own use stated plainly: *"I typically work
without the permissions… but other people may use this."* So this is **permission modes, not a
permission wall** — the surface exists, renders a request as a control he clicks, and his own default
is off. It is not a completeness exercise; it is the thing that makes the workbench usable by anyone
who is not him.

## Presence stops being a promise

A supervised session's presence is asserted by the thing that owns the process, with a TTL
(RFC-045 §C). No more `join --once` ceremony, no more agent that has gone deaf without knowing it,
no more ring that says "listener" while I am mid-build. His words tonight, several times: *"you're
not armed"* — that whole class of failure is deleted by hosting.

## Where the line falls

Per the amendment he pushed for in RFC-045: the **capability** (spawning and supervising a session)
belongs to **the browser** — his word, not "the host", which he pushed back on: *"the agent's process
lives in the browser, Autobot browser, right? What did you say, host?"* The **components** (the
activity feed, the permission control, the diff view) are shared and rendered here; the
**arrangement** — that an agent lives in its codebase card, on its branch, with its reports on the
TV — is SystemView's.

And the part that keeps SystemView honest about which agents are whose: **a SystemView agent is per
project, per codebase, and runs in that directory.** It is attached to and represented by the
codebase. SystemView does not spawn it; it asks the browser for one and attaches it to the project it
belongs to.

## Answered, so nobody re-opens them

1. **The harness** — both. SDK for the surface, pty when it is needed. No key required for either.
2. **One session per card, or several** — several, one worktree and one branch each, with the branch
   named everywhere the agent appears.
3. **Does a hosted agent still join the room** — yes, and the CLI verbs become a **thin client over
   the same interface** (his answer on the `cli` fork), transitional rather than retired: *"a CLI is
   pretty helpful regardless."* It stays the door for anything running outside the browser.

## Still genuinely open

1. **How SystemView names its own sessions.** Not a browser question any more (see above): the
   browser is handed a `cwd` and a session id and asked to run. What SystemView still has to decide
   is where a worktree gets created, what the branch is called, and how the tab strip on the agent
   icon reflects both — his shape: *"the agent icon becomes tabs"*, with a `+` to add one. The trap
   already identified: **a tab is a workspace switch, not a chat switch** — picking one must move the
   file tree, the diff and the terminal's cwd with it, because each agent stands in a different tree.
