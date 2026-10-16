# RFC-067 — Jobs

**Status:** built, proven end to end, and visible. `npm run smoke:jobpath` (autobot) is the whole
sentence: a hook fires, the job is given, a run opens, it closes, the line checks itself off. The
surfaces landed 2026-10-08. **What is left is the first job document (§8.7), which is written with
him.** Nothing is committed.
**Owner:** systemview-test. The engine and the Workers surface are autobot's.

---

## 1 · The model

**A skill is the primitive.** A document with a procedure. It is **injected** — its description rides
in the system prompt, because a skill has to be discoverable and the description *is* the trigger.

**A job is a skill with the job parts, and it is not injected.** A skill is advertised because it must
be CHOSEN; a job is GIVEN, so it carries no description doing trigger work and loads only when
something names it. Two things follow:

- a job may point at **one or more skills, or other jobs**. One is as valid as five, and a job whose
  procedure is entirely its own is still a job.
- *"I don't want this loaded every time"* is on its own a sufficient reason to make something a job.
  Injecting a job would also be a side door around being given one — an agent could run work nobody
  handed it.

**Chores are a bulletin board.** A per-agent list of lines, each pointing at a skill or a job, each
with a period. The list is the only artifact a chore has, which is why it lives on the agent definition
beside the agent doc. **"Chores" is the name of that list — not of a procedure**, so there is no runner
and nothing called `chores` to invoke.

**Lines get checked off, and the worklist is how the board knows.** A run closes when every item is
done, and the record carries its source and the time — so the line checks itself off. Nobody marks it.

| term | what it is |
|---|---|
| **skill** | the primitive artifact — a document with a procedure. Injected, discoverable, general, reusable |
| **work** | the execution of a job. A word for the act; nothing stores it and nothing shows it |
| **job** | a skill with the job parts. Not injected; given, and loaded by name |
| **deliverable** | what a job hands over — a report, a branch, a patch, a filled-in form |
| **chore** | a line on an agent's board: a skill or job that must be kept current, with a period |
| **the board** | the per-agent list of chore lines, each reading done or not done for this period |

## 2 · The job parts

A part belongs if **its absence makes the job un-assignable or its result un-checkable.**

### In the document — what `job-authoring` writes

| part | what it says |
|---|---|
| **1 · the aim** | what this job is for, in a sentence, and what kind of target it takes |
| **2 · what it must be given** | the inputs and required assets, named. A missing input is a refusal, not a guess |
| **3 · the procedure** | its own steps; it may point at one or more skills or jobs by name |
| **4 · the handover** | what comes out and exactly where it lands. Its existence is "done" — not the agent's word that it finished |
| **5 · the bounds** | **never** (what it must not do unasked) and **when unsure** (who it asks, or what it defaults to) |
| **6 · the report** | fluid, per job. Once the five above are clear, the report is what happened |

Plus the **worklist section** every skill here carries, which is what proves the job was executed
rather than merely chosen, and where it died if it did.

**The handover is where jobs differ, and it is not systematised.** Each job says its own, concretely —
*put the invoices exactly here*, *the work is in a REGISTERED lane on a separate branch — a row he can discard*. An enum of handover
kinds would be a parallel list of every way work can land, and it would rot the first time something
landed a new way.

**And the report has a home — the one every report has.** Settled by RFC-066 §5's retraction rather
than by anything new: *"a report already has a home. `show` files one into the reports panel,
`nav({report})` opens it, `comments`/`reply` thread on it — the surface he actually reads reports
in."* So a job files its account with `show` like anything else, and **the run POINTS at it** — a path
and a label on the run record, never a copy of the prose. The stamp is the host's, not the agent's:
the session knows which document was just filed and whether a job's run is open, so there is no verb
to remember and nothing an agent can claim. The pointer exists because a document really exists.

**The report needs no fixed shape.** Parts 1–4 already say what was given, what was done and what came
out. The one clause carried as a default is *what I could not do or verify* — a job may drop it by
saying so.

**The bounds matter most for work that runs unattended.** A skill you invoke has the human in the
room; a job may not, and this is the part with teeth the moment one touches a real account.

### Not in the document — what the caller supplies

| | who supplies it |
|---|---|
| **who runs it** | whoever carries the hook that names it, or whoever asks |
| **when it runs** | the hook's condition and rate, or the moment someone asks |
| **the aim's actual value** | the caller. The document says it takes a target; which target is this call's |

**Deliberately not parts:** the **rating** (a job with no rating is still assignable and checkable),
the **handover's store** (downstream of part 4, not something anyone authors), and the **schedule**
(the hook's).

## 3 · Triggering

**A job is triggered exactly as a skill is.** A hook's `do` names a skill today; it names a job the
same way. There is nothing to design here.

**A hook already carries who, when and what:** it is carried per agent — the human's tick — it has a
condition and a rate, and its `do` points at what to run. That is everything needed to hand a job to an
agent, so nothing else sits between the two.

**The one thing a hook cannot carry is a job's inputs.** `when` matches the event payload; nothing says
*run this WITH these*. So one field, on a mechanism that already exists:

> `do: job:<name>` · **`with: { … }`** — the inputs the job declared in part 2.

**Per-agent inputs come from duplicating the hook**, which is already load-bearing rather than a
nicety: per-agent *rates* need it too, so one hook per agent carrying its own `with:` is the answer
already on the list, not a new one.

**No bulk apply exists today**, for hooks either: `scope: every-agent` only suggests, and the carry is
still one tick per agent. Whatever control fixes that serves both.

### How a job reaches an agent

**Two verbs and one injection. That is the whole answer:**

| | what it does | status |
|---|---|---|
| **`jobsList`** | names and aims | **needed.** He talks in names — *"go do this job right now"*, *"do the accounting one"*, *"what jobs do I have?"* — and a partial name cannot be resolved against nothing |
| **`jobsLoad`** | the body, by name | **needed.** `Skill` resolves only the four `skillDirs()` patterns and none reach `~/.autobot/jobs`, so nothing else can load a job |
| **`chores`** | the agent's own lines and whether each is done this period | **needed, and it is a VERB — not an injection.** The board costs nothing until an agent is actually considering chores, which is the same rule that keeps a job out of the system prompt |

Both verbs go in the **context MCP beside `hooksList` / `hooksWrite` / `hooksDrop`**. Jobs are the same
kind of system-level definition, and a second MCP for one family would be a second place to look.

The human's surfaces need nothing from this: SystemView and Workers read the folder server-side.

#### Not injected is not the same as not findable

The thing jobs avoid is the **always-loaded description**, which costs every turn of every session
whether or not it is ever used, and exists to make the model reach for something unprompted. A list
verb costs nothing until it is called and exists to resolve a name somebody already said.

An ad, versus a directory. Refusing the ad does not mean refusing the directory — and none of the three
cases above is an agent choosing work on its own. Each one is an agent answering him.

#### A job's description is a label, not an ad

A skill's description sells: *use when…*, pushy, with a `Do NOT` clause to stop it stealing a
neighbour's turn. **A job's exists so a name can be resolved** — it answers *which one is this?*, never
*when should you reach for this?*

So it is not a separate field: **the aim is it** (§2, part 1). One sentence, two readers — the
document's opening line and the label in `jobsList`. `job-authoring` writes no trigger language at all.

And that removes one of §8's unlisting candidates: *"no `description`"* cannot be the mechanism, because
a job needs one. Unlisting is the frontmatter flag or the folder.

## 4 · Chores — the board

**A running checklist, per agent.** Each line names a skill or a job and a period. It lives on the
agent definition — the list is the whole artifact.

**An agent CALLS for it; it is not loaded.** `chores` returns the lines and whether each is done for
this period. Nothing about the board sits in context, because an agent only needs it at the moment it
is considering chores — `proactive-work` names that step, so the board does not have to advertise
itself to be found. Same rule as a job: not injected, findable on demand.

**"Chores" names data, not a procedure.** There is no runner to write and nothing called `chores` to
invoke: a board is read, and an unchecked line is worked by running the thing it points at. **A chore
contributes the knowledge that something is due, and nothing else** — no wrapper, no preamble, no chore
mode. `doc-maintenance` off the board is byte-for-byte `doc-maintenance` when he asks for it.

The one mechanical detail: a line checks off a **closed** run, so a procedure abandoned halfway leaves it
unchecked — which is correct.

**It does not stay checked.** A line checked this week is unchecked next week, which is the point: the
board answers *did I do this in this period*, and an agent with no memory has no other way to know it
already did.

**The check is a QUERY, not a stored tick:** did a run with this line's source close inside the current
period? `allDone` already closes runs; the record already carries source and timestamp. Nothing is
written, so nothing can disagree with what happened — and nothing can be forgotten while the work still
gets done, which is the one failure a hand-written tick has.

**Checked / unchecked is presentation.** Done and not done, or whatever reads best to the agent looking
at it.

**One real cost, and it was the only build here — now answered by the stamp.** `pruneRuns` sweeps
closed runs after 14 days, so a monthly line would have no run left to find and would read *"never"*
when it meant *"42 days ago"* — wrong in exactly the case the board exists for. The janitor was left
alone: `.chore-stamps.json` keeps one **monotone** stamp per source, written at a run's close in the
one place run files are written, so a run cannot close without leaving its residue. Where the record
still exists both are read and the **newest wins** — they can only ever agree, or the record can only
ever be fresher. (The other branch, teaching `pruneRuns` an exception for sourced runs, was rejected:
it makes the janitor read agent definitions, and keeping every sourced run forever is 365 files a year
for a daily line.)

The lines today: `context-maintenance`, `doc-maintenance`, `skill-maintenance`.

## 5 · Proactive work

A job — **and as of 2026-10-08 it is one, and the skill is gone.** The skill was not left standing
for the job to point at: its description was injected, so the work could still be *chosen* by any
agent in any session, which is the side door §1 closes. One artifact. The job carries the procedure,
`~/.claude/skills/proactive-work/` is deleted, and the idle hook now reads `do: job:proactive-work`
with `with: { project }`. Its deliverable is a proposal — a registered lane and the argument for it; the branch alone is not the deliverable, because a branch with no run against it has no row and nobody is watching it. It is triggered by a hook at idle, and **its first move is to
read the board**: if a line is unchecked, that is the work; if everything is checked, the open evidence
set is judged on merit. A precondition, not a ranking.

## 6 · Where jobs live

**`~/.autobot/jobs/<id>/`, which already exists** — `job.md` is the document and `job.json` is a
projection of it, not a substitute (`jobs.cjs` enforces that: saving without a document throws). That is
adjacent to where skills are going: `skillSources.cjs` already records that `~/.claude/skills` is the
vendor's layout baked into our code, and RFC-064 moves ours to `~/.autobot/skills`.

**And the folder IS the unlisting mechanism — no flag needed.** `skillDirs()` resolves four patterns
(`~/.claude/skills`, `<cwd>/.claude/skills`, the synced folder, the CLI's bundled temp dir). None of them
reach `~/.autobot/jobs`, so a job is invisible to the `Skill` tool by location alone. Which also settles
the other half: **`jobsLoad` is needed**, because `Skill` cannot reach a job at all.

A job belongs to no application — *a job that lives inside an application is a job that dies with it.*

**The chat shows a job being absorbed exactly as it shows a skill**, so a job loading is visible
rather than silent.

## 7 · The surfaces

| surface | its claim | owner |
|---|---|---|
| **the engine** | the store, the matcher, the runner, `rateRun`. Knows nothing about any app | autobot |
| **SystemView** | everything: define, edit, assign, set when and how a job runs. The technical view | systemview-test |
| **Workers** | the same store, less technical | autobot |

Neither surface owns the store, which is what makes two of them safe. **The seam test:** a surface
must be deletable without the engine changing.

The UI shape, smallest first: **the board on the agent profile**, where hooks and skills are already
carried and the control already exists — then **a jobs page beside Agents** once there are enough jobs
to need a list. One job does not need a page.

## 8 · What gets built, in order

1. **The runner** — built, and through a different door than this step assumed. The entry point is
   `hooks.fire()`, not `jobs.due()`: `check` → `given` → `startRun` → `finishRun`, where
   **`jobs.given` is the only door that opens a run**, so a run cannot exist for a job that was given
   too little.
2. ~~A read: what makes a procedure unlisted.~~ **Answered:** the folder does it. `skillDirs()` never
   reaches `~/.autobot/jobs`, so no flag and no `description` trick is involved.
3. **`job-authoring`** — built. Writes the six parts, points at `skill-authoring` for the procedure,
   100% on both eval sets over three passes.
4. **`with:` on a hook** — built, *and then given a door.* The engine had carried it since the
   runner landed while `hooksWrite` refused every pointer that was not `skill:` — so the one
   agent-facing door could not write the thing the engine fires. The tool now writes a job pointer,
   carries `with:`, and refuses a hook that cannot supply what the job declares. (The tool also still
   called the rate `guard`; that is now `rate`, which is what it is.)
5. **The board** — built. `normalize()` learned `chores`; `boardFor(slot)` reads each line's state off
   the run records; `chores` is the verb that renders it.
6. **The 14-day problem** — answered with **the stamp, not a prune exception.** `pruneRuns` is
   untouched; `.chore-stamps.json` keeps one monotone stamp per source, written at a run's close, and
   where the run record survives both are read and the newest wins — so they can only ever agree, or
   the record can only ever be fresher.
7. **The first real job documents** — **written 2026-10-08**, through `job-authoring`:
   - **`proactive-work`** (`requires: ["project"]`) — the skill, retired into a job.
   - **`jobs-path-check`** (`requires: ["project", "label"]`) — disposable, and the thing that
     exercises this whole plan on a live machine: every step records what it *saw*, and its bounds
     forbid it from touching the mechanism it is testing.

   And the door they needed: **`jobsWrite`**, beside `jobsList`/`jobsLoad`. Nothing could create a
   job at all before it — `jobs.save` had no caller but the suites and an IPC handler the window
   never called — so `job-authoring` could write a document and had nowhere to put it but the hand.

   **The behaviour evals found three defects nothing else had:** a conflicting worklist source in the
   document; a job named *in conversation* rather than by a hook leaving no run record, so the report
   pointer and the finished status landed nowhere, silently; and `finishRun`'s *"the worklist as it
   stood"* snapshot reading owner `job:<id>` while every item is written under `run:<runId>` — `[]`
   on every job that ever closed, green the whole time because the suite asserted `status`,
   `finishedAt` and `why` and never that field.
8. **The surfaces**, profile first — **built 2026-10-08**, in the order §7 named:
   - **The board on the agent profile.** The lines are editable (a skill or a job, and a period);
     the state beside each one is not, because done/not-done is a query. `agent:board` is the read
     door — `boardFor` had exactly one caller before it, the agent's own `chores` verb.
   - **The `do` picker offers jobs**, and when one is picked the form asks for **one input per name
     in that job's own `requires:`** — nothing typed from memory. Blanks are dropped rather than
     sent, because an empty value is a *missing* value to the gate.
   - **`kind` stopped being a question.** It had no behaviour anywhere — one CSS class — while
     reading like the skill/job switch that `do` actually is. It is derived from the pointer now, so
     the loud label is finally true: the loud rows are the jobs.
   - **The hook row in the chat opens.** It carries the pointer text verbatim, the condition, the
     rate, the inputs and the run id — and it **leads with GIVEN or REFUSED**, because a job refused
     for a missing input used to draw the identical row to one that ran.
   - **A job's run has its own card**, not a `WorkList` with a label: why it fired, its state, and
     when it finishes, **the report waiting with the rating beside it**. The card reads the run
     RECORD through `window.systemview.jobs` — a bridge exposed since RFC-005 §10 that nothing in
     the window had ever called — so it shows what happened to the job rather than the agent's
     account of itself.

   Still not built, and smaller than it looks: `electron/apps/jobs-host.cjs` exposes
   `jobs:list/get/runs/events/save/remove/rate` but **no `check`/`given`/`done`**, so a surface that
   tried to *drive* a job would walk past the gate. Reading one is covered; giving one from a surface
   is three verbs on a host that already exists.

### What a job does NOT carry — settled 2026-10-07

**One trigger path, and the other one is gone.** A job used to carry its own `trigger: {on, when}`
and `onMissed`, validated on save and matched by a `due()` nothing ever called — the pre-RFC design,
from before a job was *a skill with the job parts*. It was **removed rather than wired**, because it
could not be wired: `given()` refuses without a session and an event carries none, so the field could
arm and never run. The hook answers *who* by its carry, which is the whole of §3.

The one surface that used it — the right-click **"Run job: …"** on a watched page value — now writes a
hook pointing at the job, and says *"hook written, nobody carries it yet"* until somebody ticks it.
Its old comment claimed this "needs no new wiring: a job already carries its own trigger." It needed
exactly one thing: something to fire it.

## 9 · Considerations

- **Where the gate lives.** Register anything; assigning something without its contract is what to
  refuse. Either the assign control refuses and names the missing parts, or `job-authoring` refuses to
  finish writing one. A consideration, not an impediment.
- **Whether `rateRun` applies to a job whose deliverable is currency.** Rating an artifact makes
  sense; rating *"it is current"* may not.
- **The vendor-named skills folder.** Skills live under `~/.claude/`, a vendor name on a system built
  to be agnostic. Jobs sitting adjacent inherit the problem. Worth fixing, and bigger than this plan.
- **Which agents carry which hooks, and which lines are on whose board.** Not all of them, and not at once.

