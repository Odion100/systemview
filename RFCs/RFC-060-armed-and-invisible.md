# RFC-060 — Armed and invisible: the other hook system

*2026-09-19 · design only. Nothing here is built.*

## The audit that made this urgent

The motivating case was described to me as history: buAPI carried a `Stop` hook demanding a
`wiki/log.md` line on every commit, enforcing a protocol retired months ago, discovered only
because an agent happened to mention it in conversation — and since pulled. That is true. buAPI's
`.claude/settings.json` is permissions and nothing else now, and its `hooks/` folder is empty.

It is also the smallest version of the story. I read every `.claude/settings*.json` on this
machine before writing a line of this RFC, because the file is the truth and the testimony —
including the testimony in my own brief — is not. What is armed **right now**:

| repo | hook | script | state |
| --- | --- | --- | --- |
| `~/BUApp` | `Stop` | `.claude/hooks/wiki-check.sh` | **live, blocks with `exit 2`** |
| `~/agentci` | `Stop` | `.claude/hooks/wiki-check.sh` | **live, blocks with `exit 2`** |
| `~/boxing-app` | `Stop` | `.claude/hooks/wiki-check.sh` | **live, blocks with `exit 2`** |
| `~/autobot` | `Stop` | `.claude/hooks/wiki-check.sh` | **live, blocks with `exit 2`** |
| `Systemly/systemview` | `Stop`, `UserPromptSubmit` | `wiki-check.sh`, `sv-inbox.sh` | neutered (`exit 0`), still armed |
| `Systemly/SystemLynx` | `Stop`, `UserPromptSubmit` | `sv-inbox.sh` | live, intended |
| `~/buAPI` | — | — | pulled |

One repo was fixed. Four still stop an agent's turn and hand it a demand it cannot satisfy —
*"append `INGEST YYYY-MM-DD …` to `wiki/log.md`"* — for a wiki that RFC-055 replaced with the
context store. **The harness repo itself is one of them.** A fifth, systemview, kept the wiring and
replaced the script's body with a comment that says RETIRED and `exit 0`: honest, and still a
process spawned on every Stop forever.

This is not an argument that something *might* go wrong invisibly. It is a count of how many
places it is going wrong invisibly, taken in four minutes by someone who knew where to look.

## Why it stayed invisible, precisely

Not neglect — structure. Three mechanisms each independently hide this file, and all three are
otherwise correct:

1. **`.claude/` is gitignored in every one of these repos.** I checked all seven. Zero tracked
   files in any of them. So a hook never appears in a diff, never appears in the git bar, and was
   never reviewed by anybody — it cannot have been, there was no diff to review. The thing that
   normally catches "a file is enforcing something dead" is the one thing structurally excluded.
2. **It has no reader.** The hub's file tree *would* serve it — `IGNORE_DIRS` is `.git`,
   `node_modules`, `dist` and friends; dotfolders are not filtered, so `.claude/settings.json` is
   already readable through `readFile` today. Nothing points at it. A file that is readable and
   unpointed-at is a file nobody reads.
3. **The only channel was testimony.** An agent noticed and said so. That is the weakest evidence
   this system accepts anywhere else — the `::branch` block reads git rather than believing a
   report, the lane row reads the run file rather than believing the session — and it was the
   *entire* detection mechanism here.

The fix follows from (2), not (1). Nothing needs to be un-ignored and nothing needs to be written.
Something needs to **look**.

## Two kinds of hook, cut by what firing does

Settled, and worth writing down because the temptation to cut it the wrong way is real and quiet.
The line is **what happens when the event fires**, not who wrote the file or where it lives:

- **Context hooks** (`~/.autobot/hooks/*.md`) point an event at a **skill**. They deliver a
  pointer, never a procedure. They run nothing. They are inert until an agent carries them —
  writing is the proposal, the carry is the approval (`agents/hooks.md`).
- **Command hooks** (`.claude/settings.json`, `Stop` / `PreToolUse` / `PostToolUse` / …)
  **execute a command**. They can block a tool call and inject text back into the agent's turn.
  Nobody approves them; they are armed by existing. The CLI's own documentation calls these
  simply "hooks"; this RFC calls them command hooks throughout.

**Ownership is orthogonal to the cut.** The command hooks that exist today are ones the CLI reads
out of `.claude/settings.json`. The ones coming — browser-side JavaScript wired to an event — will
be ours outright, authored here, and they are command hooks by the same test: firing executes
something. The family holds both.

They are not two implementations of one idea, and merging them would be a vocabulary decision
disguised as a refactor. One word meaning two things is how definitions drift apart quietly, and
the drift would be in the dangerous direction: the word "hook" would inherit the safety of the
inert one while covering the one that runs bash.

**What they share is the place the user looks — never the mechanism.** Two sections, two headings,
two sentences of hint saying plainly what each one is. Adjacency is the whole integration.

**The section carries disarm and delete**, because the case that motivated it is four repos
enforcing a retired protocol and the point of finding them is clearing them. Discovery and remedy
in the same breath — he never drops to a terminal for a flow this system claims end to end.

The list renders from the files on disk every time the profile is opened.

The rows take the shape of the section directly above them — ours carry `+ new hook`, an editor
and per-agent toggles; these carry *disarm* (the hook stays in the file, its entry removed) and
*delete* (the entry and, if nothing else references it, the script). Both sit behind a two-step
confirm that names what it is about to change before it changes it, and both are his press.

## Where it lives: the agent profile

**`AgentProfile`, as a section immediately below the existing `Hooks — context pushed by an
event`** — on the *Agents & context* page (`/context`, `/agents`), which is where the top nav's
**Agents** link already goes.

The profile is already the inventory of everything that reaches one agent, and it is already
sectioned by *how* a thing arrives: `Every agent` / `This agent` (loaded every turn),
`Always loaded — what every turn costs`, `Skills — docs loaded on demand`, `Hooks — context pushed
by an event`, tools, internal and external MCP, knowledge. The question this RFC answers — *what
else is wired into this agent that I did not put there* — is a sentence in that same list. The new
section is **`Command hooks — firing runs something`**, and the hint under it says the difference in
one line: *these do not point at a skill, they execute, and they can stop a turn.*

Adjacency is doing real work here. Two sections of the same shape on one page, and what separates
them is legible without reading either hint: one hands an agent a pointer, the other runs. Not who
owns the file — when we author browser-side command hooks they will land in this same section, and
the ones there today will simply be the ones whose file the CLI reads.

A repo hook belongs on the agent's profile because in this system the repo **is** the agent: one
agent owns one project, so repo scope and agent scope are the same scope. A hook armed in
`BUApp/.claude/` is BUApp's hook and BUApp's agent's hook in one breath. Nothing needs qualifying
with "applies to any agent working there" — no other agent works there.

One objection, answerable from what is already built. *"Nobody will open a profile to find a
problem they don't know they have."* Nobody opens it for that, and nobody needs to. The profile
is opened **routinely, for other reasons** — carrying a
skill, ticking a hook, reading the always-loaded bill. That is the test the placement has to pass:
not "would he go there to check," but "is it in front of him when he is already there." It is.

Rejected alternatives, briefly. **The project header** is about the codebase's identity and its
git state; a configuration audit rendered on a header that is on screen permanently is a standing
nag, and it cannot show the user-level half at all. **Its own panel**
fails the same way the file does: a panel nobody opens is a file nobody reads with extra steps.
RFC-057 drew the line for page-level surfaces — a thing gets its own place when it is *about the
system* (call statistics). This is about one agent's composition, which has a place already.

## Granularity: the command, verbatim

**The command string, in full, for every hook — plus the script's body one click away.**

A count is worthless here and the audit above shows exactly why. **"This repo carries 1 command
hook, on `Stop`"** is the true and complete summary of BUApp, agentci, boxing-app and autobot — the
four that are broken. It is also a fair summary of a healthy repo running `sv-inbox.sh` on `Stop`,
which is wanted and working. The two cases are *identical* at that granularity. A count-only view
would have been on screen the whole time and changed nothing, because the thing it renders is the
one thing the two cases agree on.

`bash .claude/hooks/wiki-check.sh` on `Stop` is a different object. The word `wiki` is the entire
diagnosis — the user knows the wiki was retired, sees the word, and is done. The command is the
smallest thing that carries the information, so it is the unit.

Each row: **event · matcher (when it is not empty) · the command · the script's state**.

The script's state is the one derived field, and it is derived from the file rather than asserted,
because I found three distinct states in one audit and the command string alone tells them apart
in none of them:

- **missing** — a hook armed at a script that is not there.
- **retired** — the body is a comment and an `exit 0`; still spawned every time, does nothing.
- **blocking** — the script can `exit 2`, which is the one that stops the agent's turn.

`blocking` is the honest headline, and it is a grep, not an analysis: a non-zero exit in a `Stop`
hook is how the CLI is *told* to block, so the file names its own capability. Clicking the row
opens the script in the panel that already opens files. No parsing, no interpretation — the view
says what the file says, and the user reads the bash.

## Two scopes, shown as two things

Per-repo `.claude/settings.json` (and `settings.local.json`) and user-level
`~/.claude/settings.json` both matter, and the user-level one is the dangerous one: it fires in
every repo, including repos whose agents have never heard of it, and it is the one you forget
because you set it once. Today it holds only model and permissions — which is exactly the state in
which a hook added to it would go unnoticed longest.

**The profile already has the idiom, and this RFC should not invent a second one.** Docs are split
into `Every agent` and `This agent`, two headed sections with a hint explaining the difference —
not one list with a scope column. Foreign hooks take the same shape, in the same order,
outermost-first:

```
Command hooks — firing runs something          the CLI reads these · disarm and delete are yours

  Every agent  ~/.claude/settings.json
    (nothing armed)

  This agent   systemview/.claude/settings.json
    Stop              bash .claude/hooks/wiki-check.sh     retired — exit 0, still spawned
    Stop              bash .claude/hooks/sv-inbox.sh
    UserPromptSubmit  bash .claude/hooks/sv-inbox.sh
```

Never merged into one list with a scope column. A column is a field you can miss; a heading is a
place you are standing. "This fires everywhere, forever, for every agent" and "this fires in this
repo" are different enough facts that they should not be two rows that look alike.

**An empty user-level section still renders, saying `(nothing armed)`.** Absence of a section reads
as "not checked"; a section saying nothing is armed reads as "checked, and clean." That distinction
is the same one the store panel already makes when it names the gap instead of showing a zero.

## Who reads the file: the hub, for both

**One reader. The hub.** This is the answer I did not expect to reach — the obvious design is
hub-for-the-repo and host-for-the-home-directory, and it is wrong.

**The repo file is the hub's** with no argument required; `api/index.js` already settled it in a
comment: *"THE HUB KNOWS EVERY PROJECT'S FOLDER. The shell only knows the projects that were added
through it… One owner, no fallback, no second path."* `rootOf(projectCode)` resolves a folder for
every project — including ones that arrived as service connections and that the shell has never
heard of — and `readFile` already serves `.claude/settings.json` today, since `IGNORE_DIRS` is
`.git`/`node_modules`/`dist` and dotfolders are not filtered. Reports and code-comments already
establish the pattern of a hub module reading a known JSON path under a project root and returning
it parsed.

**`~/.claude/settings.json` looks like it has to be the host's, and does not.** The case for the
host is `hostAgent.js`: listing transcripts is the host's job *"because `~/.claude` is outside
every project root and the files surface (correctly) refuses to read outside one."* True — and it
is about the **files surface**, the parameterised verbs, where `rel` arrives from a browser and
`inside()` exists because *"`../../` is how a file layer becomes a disk layer."* That guard must
not be widened, and nothing here widens it.

But the hub already reads a file in the user's home directory, today, by a different door:
`api/shellProjects.js` reads `~/.autobot/projects.json` through a **module-level constant** —
`path.join(os.homedir(), ".autobot", "projects.json")` — with a plain `fs.readFileSync`, no
parameter, read-only, and an empty object on any failure. No path comes from the browser, so
`inside()` has nothing to guard and is not involved. `~/.claude/settings.json` is exactly that
shape: one fixed absolute path, no parameter, empty answer on failure. A sibling module of thirty
lines.

**The write is the same door, and it takes no path either.** Disarm and delete remove a named
entry from a file the module already knows the location of — the verb takes *which hook*, never
*which file*, so the browser still supplies no path and the guard still has nothing to widen. It
reads, removes the entry, writes the whole object back, and touches nothing else in the file: a
`permissions` block in the same settings file must survive untouched, which is the one thing a
careless rewrite would take with it. The repo-level file is reached the same way the repo's other
files already are, through `rootOf`, with the hook name as the only argument.

The transcripts precedent does not transfer because transcripts are not one file — they are a
*directory scan keyed by a session's cwd*, which is the shell's knowledge, and the shell already
had it. That is a genuinely different problem, and reasoning from it to "the home directory is
the host's" would put a second owner on this feature for no gain. The hub's own rule applies to
this RFC as much as to files: **one owner, no fallback, no second path.**

**Read at view time, every time.** No cache, and this is not a performance note — it is the point
of the feature. A cached list of what is armed is a list that will be wrong exactly when it
matters, because the moment that matters is the moment somebody changed the file. Two JSON reads
and a handful of `existsSync` calls when a profile opens is not a cost worth being clever about.
Same rule the lane row learned in RFC-059 slice 2 and the `::branch` block learned before it:
**read the state, don't testify about it.**

## Does it alert? No — with one exception that is a receipt, not an alarm

The standing position is two things that pull opposite ways: nothing should run invisibly, and
preemptive rules and nagging are worse than the problem. They only conflict if "visible" is taken
to mean "interrupts."

**The section does not alert, does not badge, and does not count.** No number on the agent's face,
no sweep of every repo on startup, no notification when a settings file changes. Every one of
those fires constantly in the good case — `sv-inbox.sh` is armed in two repos on purpose, and a
badge cannot tell wanted from unwanted, so it would be permanently lit and permanently ignored
within a week. A warning that is always on is decoration. The four dead hooks in the table were
found by looking; the design is that looking becomes possible and routine, not that the system
develops an opinion.

**The one exception is a receipt for a firing that actually had a consequence.** A `Stop` hook that
exits non-zero *did something* — it stopped a turn and pushed text into the agent — and the system
already holds both the principle and the widget. `hook.fired` puts every context-hook firing into
the feed on the stated grounds that *"an unattended trigger is never silent"*, and that row is
already built: `feedRows.js` mints `kind: "hook"` and `Feed.js` draws `⇥ name · on <event> · →
skill`. A foreign hook that blocks a turn is more unattended than any context hook and currently
leaves no trace at all. It gets the same row with its own tail — `⇥ wiki-check.sh · on Stop ·
blocked` — in the feed where the turn is already being drawn. It fires only when something
happened, and it is zero-rate in the healthy case, which is the whole difference between a receipt
and a nag.

If that row exists, the call ledger (RFC-057) should get the same line, `kind: "hook"` — its
**Hooks** tab counts context-hook fires today and a foreign hook is invisible there too. That
turns "is this dead hook actually firing" from an inference into a number, which is the one
question the profile section genuinely cannot answer: the section says what is *armed*, and armed
is not fired.

That exception is **conditional on something I could not verify** (below). If the SDK does not
expose a foreign hook's firing to the host, the exception is dropped and the surface is purely
looked-at. It is not worth building a second observation path to recover.

## The related blindness: lanes across agents — a different surface, same principle

Lane rows read run files project-scoped, so one agent's delegation is visible only in that agent's
own room, and there is no view of what is running across all agents. Same diagnosis as this RFC:
the system knows and nothing gathers it.

**It does not share this surface, and the reason is structural rather than editorial.** The surface
designed here is a section of the *agent profile* — a per-agent inventory. A cross-agent view is
by definition not per-agent, so it cannot live in a per-agent panel without the panel ceasing to be
one. Beyond that they differ in every property that decides where a thing goes: **standing vs
transient** (an armed hook is true until someone edits a file; a lane is true for twenty minutes),
**what the affordances mean** (here they are removal only, never authoring, and each one is the
user's press; a lane row's tail is delete, land, switch), and **different readers** (settings files
vs run files). Two views that share
only a diagnosis should share a principle, not a panel.

What they should share is the principle: **the gathering is the feature, and it is usually cheaper
than it looks.** Worth recording here because the lane case is nearly free. In autobot,
`worklist.all()` already reads **every run file on the machine** in one pass; `laneRuns(projectCode)`
then filters that flat list with `r.session.startsWith('session:' + projectCode + ':')`. The
cross-agent answer is the un-filtered list — the data is gathered and then thrown away. And the
project is never *chosen*: `svPreload.cjs` exposes `laneRuns: () => invoke(…, key)` with the
transport's own session key, so the scope is inherited from whichever agent's panel happens to be
open. Nothing in `src/` calls `laneRuns` outside `useAgentSession`, which is one
`(projectCode, sessionId)` transport by construction — that, not a data limitation, is the whole
blindness.

The place to render it also already exists and is already cross-agent: **`AgentPanel`**, the
navigator's *Agents* tab, which lists live sessions and definitions machine-wide through
`liveSessions()` / `listDefs()` — neither of them project-scoped. So the cross-agent lane view is
a door that accepts "all" plus rows on a list that is already drawn. Its own RFC, with its own
argument about what a lane row means when it is not in its owner's room. Named here so the shape
is on the record, not designed here.

One aside from the same survey, because it is the *other* half of this RFC's subject: `AgentPanel`
shows each agent's skills, tools, MCP servers and subagents, and **no hooks at all** — neither
kind. The cross-agent question "which agents carry which hooks" has a surface with a hole in it
exactly where the answer goes.

## What I did not resolve

- **Whether these hooks fire for harness-spawned sessions, or only for terminal ones.** This is
  load-bearing for severity and I could not settle it from the files. Agents here are spawned
  through the Agent SDK with a chosen `cwd`; whether that path loads the repo's
  `.claude/settings.json` the way an interactive `claude` in that directory does is a question for
  the SDK, not for this audit. Circumstantial evidence says yes — systemview's
  `.claude/hooks/.last-stop-sha` was written on 2026-09-11, which means something ran the script —
  but that is one dated file, not a demonstration. **If the answer is no, the four live hooks bite
  only terminal sessions and the urgency drops; the blindness does not, because nothing in this
  system can currently tell you which answer it is.** Check this before ranking the work.
- **Whether a foreign hook's firing is observable at all.** The conditional exception above stands
  on the SDK surfacing `Stop`/`PreToolUse` hook execution — and its non-zero exits — to the host
  that spawned the session. I did not verify it. Read the SDK's message types before building the
  feed row; if it is not there, drop the exception rather than engineering around it.
- **`settings.local.json` vs `settings.json`.** Both exist and both can carry hooks — SystemLynx
  carries its hooks in `settings.local.json`, systemview in `settings.json`. I did not work out
  the CLI's real precedence or merge order between them, nor between repo and user level
  (additive? override?). The view must not imply a precedence it has not confirmed; until someone
  reads the actual resolution rules, show both files with their names, and let the rows be labelled
  by the file they came from.
- **Whether plugins arm hooks too.** `~/.claude/plugins/` exists and is populated. If a plugin can
  contribute a hook, this design has a third scope it does not show, and a view that claims
  completeness while missing one is worse than no view. Unchecked.
- **The four live hooks are not fixed by this RFC.** They are a finding, not a deliverable. Pulling
  `wiki-check.sh` from BUApp, agentci, boxing-app and autobot is four file edits in four repos this
  lane does not own, and it is the user's call whether they go now or wait for the surface that
  would have caught them.
- **What else lives in these files.** `agentci/.claude/settings.json` carries
  `permissions.deny: ["SendMessage"]` — an agent silently unable to message anyone, by a file
  nobody reads. Permissions are the same blindness with a different payload and they are out of
  scope here on purpose, but the surface being designed is one obvious row away from covering them
  and somebody should decide that deliberately rather than by omission.
