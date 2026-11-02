# The walk — jobs first, then the authoring skills they drive

::report{id="The walk — jobs, then authoring" as=planning retain=4d}

**Eleven documents, not twenty-six.** Three jobs and twenty-three skills exist; most of them have
nothing to do with automation and org execution, so walking all of them would spend your attention
on presentation skills and incident response. The cut is named in full below — including what I left
out and why — because a silent omission reads as coverage.

**The order is yours**: the two jobs first, then the authoring skills, then the meta layer last,
because whatever we settle in the jobs is what the authoring skills have to produce.

**A TICK MEANS REVIEWED AND REFINED — both.** Not "we discussed it", not "I read it to you". The
box goes black when you have been through the document and the changes it needed are IN it. A line
we talked about and left alone stays open, because an unticked box is the only thing that can tell
us where this pass actually got to. The checklist is the state of the pass; there is no second list
I keep somewhere else and report on.

---


::members{who=systemview-test sent=systemview-test:va95r9}
## Group 1 — what actually runs unattended

These are the documents a chore fires into. Nothing downstream matters if these are wrong.

- [x] **`arc-development`** :file[~/.autobot/jobs/arc-development/job.md] · 352 lines · *drive one arc forward, in a lane, moving the arc document as you go*

::::thread{id=t1 sent=systemview-test:138thof}
**Notes from the read-through, 2026-11-01.**

**§3.1 addresses the arc by PATH, and that is the wrong source.** It opens with
`RFCs/arcs/ARC-<nnn>-*.md in the given project` — a folder and a filename convention. **The
registry is where work comes from**, for every kind of document, and RFC-073 already retired the
folder as a meaning. A job whose first instruction is a glob is reading the one source that can
disagree with the system.

**And the fix needs a DOOR before it needs a sentence.** `documentsRegistry({projectCode, kind,
arc})` exists in the hub and has exactly one consumer — the window. No MCP tool exposes it, so an
agent cannot ask which arcs exist or where `ARC-004` is. Pointing this job at the registry today
would teach a call that does not exist, which is the same failure as `show()` and `highlight`.
So: build the verb, then rewrite §3.1 and §2 onto it.

**It is four places, not one** — `arc-development` §2 and §3.1, `arc-planning`, and `rfc-authoring`
§1 (that last one may be a legitimate folder question: it wants the next free NUMBER).

**The firing question, still open.** `requires: ["project", "arc"]` means the arc is always given
and never picked — so a standing chore names one FIXED arc forever, and the morning that arc
settles the hook keeps firing a job whose subject is finished. Nothing in the document says to
stop.

**§3.4 — a run can say which ARC and which PROJECT, and cannot say which RFC.** The claim line
already carries two of the three: `attach({kind: "arc", ref: "ARC-004-O2", project: "<repo>"})`.
But `ATTACH_KINDS` is `report · branch · document · arc · card · link` — **there is no `rfc`**, so
the plan has to be filed as a generic `document` and nothing downstream can tell it apart from any
other document on the run.

That is backwards from what the work actually is. The arc names the objective; **the RFC is the
thing being executed** — the slices, the claims, the contract the result is judged against. So the
run that built it cannot answer the first question anybody asks of it: which plan was this?

**A LANE IS A TOOL, NOT A REQUIREMENT — his correction, and it reaches the aim line.** §3.4 says
*"Build it in a lane"* as a mandate with two obligatory steps, and the job's opening sentence bakes
it in harder: *"in a lane, handed over discardable."* That is wrong. A lane is something an agent
reaches for when the work needs it — parallel work, something discardable, something he should be
able to watch or throw away — and plenty of arc work needs none of that.

Written as a requirement it costs twice: a worktree and a branch for a two-line change, and an
agent that reads the one true path and will not deviate when the path does not fit. The fix is not
a caveat bolted on; the sentence becomes a choice with the condition attached, and the AIM line
stops asserting it. `proactive-development` carries the same phrase and needs the same edit.

**AND THE LANE DOCTRINE IS OLD MENTALITY — this is the cause under the note above.** The lane
was built for a world where an agent could not commit: work had to be parked somewhere he could
inspect and throw away, because the commit was his alone. That is no longer true. Agents commit
their own work now, so the lane's reason for being default has gone with it, and what is left is a
genuine tool for genuine cases — parallel work, something discardable, something he wants to watch.
Both jobs still describe the old world as the only world.

**Where a commit belongs instead: ON THE CLAIM.** If the work commits itself, the commit is the
evidence a claim was met — so the `::commit{sha=}` record wants to live inside the claim's body,
next to the proof, rather than floating in a log. Open question he raised and did not settle: can a
commit block be attached INSIDE a claim today, or does it have to sit beside it?

**§3.5 VERIFIED TRUE — read end to end, not taken on its word.** `FIRING.objective` is
`{answer: "state", done: "done"}`, so writing `state=done` really is the fire. `fires.cjs` resolves
the audience down the ladder (the block's `subscribe=`, then the enclosing thread, then the
document's `::members`), subtracts `told=`, `buildUpdate` makes the `document.updated`, it is
emitted, and the union of who was ACTUALLY reached is stamped back on the line. Nobody reached
means nothing stamped and the next session's sweep carries it. Every sentence in the section holds.

**Two narrow holes, both inside "any write the harness can see".** The announce has two triggers —
the SCHEMA half (a tool whose schema names the path: Edit, Write) and the WATCHER half
(`fs.watch`, which is what catches a bash heredoc or a `sed`). The watcher is scoped to the
session's own `cwd`. But §5 says cross-repo is expected — so an arc in ANOTHER project's repo,
moved by a heredoc, is seen by neither half: outside the watcher, named by no schema. It goes
silent, and the job's own words invite exactly that write.

Second: the recursive watch is wrapped in a bare `catch {}`. Where it is unavailable the whole
watcher half disappears with no signal at all — the system quietly drops to Edit/Write-only and
nothing says so.

**THE HANDOVER NEEDS THE COMMITS IN IT.** All three of its checkable things are about documents
and branches: the arc moved, a registered lane standing, a report filed. **The commits are not one
of them** — the only mention is "the branch holds the commits", in passing, inside the lane item.
So the actual work is the one thing the handover does not ask you to account for, and once the lane
stops being mandatory that passing mention is all that is left of it.

Commits are made where we already expect them to be made, and the handover is where they get
declared: which commits, pointing at what they served. It is the same thing as the parsable
pointer below — the handover is the moment that link is owed.

**AND A COMMIT MUST POINT AT THE WORK, PARSABLY — this is the big one, and nothing supports it
today.** Every commit serves something: a claim, a gap, or a spec/report. That pointer has to be
written in a form a machine can read, so later we can parse the commits, parse the documents, and
check that **both directions agree** — the commit names the document it served, and the document
names the commit that served it.

Measured just now: **neither direction exists.** On the commit side, `RFC-072`, `ARC-004` and claim
ids appear in bodies as PROSE only — no trailer, no field, nothing a parser could pick up. On the
document side, `::commit{sha=}` appears in exactly **two files** in this entire repo. So there is
no link to check, in either direction, anywhere.

**And this is the thing that makes the rest safe.** Agents working freely is only tolerable if
everything they do is traceable without anyone remembering it — which is exactly what a two-way
parsable link buys, and exactly what the lane was standing in for while it did not exist.

**AN AGENT SHOULD BE ABLE TO ASK "WHICH ARCS AM I ON" — ACROSS PROJECTS.** Where the arc is
stored does not matter and should not have to be known; it can live in another project entirely.
Membership is the address. And objectives are owned by a named agent, so the chain is already
straightforward: find the arcs you are a member of, read the objectives that are yours, follow them
to their RFCs, and work them.

**That query does not exist.** `documentsRegistry({projectCode, kind, arc})` is project-scoped and
has no member filter. `documents({projectCode, member})` has the member filter but still demands a
projectCode. So "which arcs am I on" can only be asked one project at a time, by an agent that
already knows which projects to ask — which is the knowledge the question was supposed to supply.

This folds into the registry door above: one verb, member-aware, not project-bound.

**§5 FORBIDS THE THING WE NOW DO — three of its eight bullets are the pre-auto-commit world.**

- *"Commit or stage in the owner's tree, or leave anything behind in it… his tree has to end as you
  found it."* Agents commit their own work in his tree now. This bullet says the opposite, in the
  section whose whole job is to be obeyed without thinking.
- *"Bring the lane in. It waits on its branch until he says yes."* That was the handover ritual
  when the commit was his alone.
- *"Mark an objective `done` whose work sits unmerged on a branch."* The reasoning is still right —
  `needs` means done and the next agent starts on that word — but it is written assuming the work
  is always on a branch waiting to merge, which is no longer the normal case.

Same root as the lane note: these bounds were correct when an agent could not commit. What they
should say now is about the LINK, not the location — the work is committed, and the commit points
at what it served.

::::

- [ ] **`proactive-development`** :file[~/.autobot/jobs/proactive-development/job.md] · 441 lines · *do work for your own project, in a lane*

  **Two things.** First: the boundary you dictated — the board, gaps, dead runs, non-arc RFCs, and
  never an arc's queue — is stated at §43–52, ten paragraphs in. The AIM line, which is the only
  line `jobsList` shows and the only thing an agent reads before deciding to load the job, still
  says *"do work for your own project"* with no boundary in it at all. Second: at 393 lines it is
  the longest document in the system, and it is the one most likely to run with nobody watching.

- [ ] **`chore-round`** :file[~/.claude/skills/chore-round/SKILL.md] · 116 lines · *work this agent's chore board*

  **The question:** a chore is a pointer, and `arc-development` requires inputs. A chore that cannot
  supply them is refused at fire time, every time, silently from your side. Does the round detect
  that, or does a misconfigured chore just never run?

- [ ] **`job-authoring`** :file[~/.claude/skills/job-authoring/SKILL.md] · 278 lines · *author or repair a job*

  **The question I had was wrong, and the document answers it.** I wrote that nothing compares a
  job's `requires:` against a hook's `with:` until it refuses at 3am. It does, at AUTHORING time:
  `hooks.save()` calls `jobs.check()` and throws naming every missing input — *"a hook that cannot
  supply what a job requires would refuse on every match."* Checked in
  `electron/agents/hooks.cjs`. The one gap is deliberate and documented: a hook written BEFORE its
  job exists is allowed through, because refusing would make the two authoring orders behave
  differently.

  **What is actually worth walking here:** a job should NAME the skill that owns its work instead
  of re-describing it, which neither job did — fixed in both, and the rule written into this
  skill. The rest is the usual: is the six-part shape still right, and have the behaviour evals
  ever been run.

## Group 2 — the authoring skills the jobs drive into

- [ ] **`arc-planning`** :file[~/.claude/skills/arc-planning/SKILL.md] · 425 lines · *the biggest document we own*

  **The question:** it was written before `rfc-execution` and `arc-development` existed. How much of
  it is now describing work those two own?

- [ ] **`rfc-authoring`** :file[~/.claude/skills/rfc-authoring/SKILL.md] · 341 lines

::::thread{id=t2}
**CLAIMS GO AROUND THE WORDS, NOT IN A LIST AT THE END — his correction, 2026-11-01.** The skill
today says to append them after the verdict block into one `## Claims` section, grouped by where
somebody stands to check. That makes the contract a appendix: a reader finishes the design, then
starts the document again from the top to work out which claim belongs to which paragraph, and the
author writes them having already left the section they are about.

Organised around the text, each claim sits next to the words it is a claim ABOUT — so the design
and its contract are read once, together, and a section with no claim under it is visibly a section
nobody agreed to check. The `::claims` recount still gives the document one number at the top; what
moves is where the blocks live.

**What this collides with, and has to be answered:** the completeness press. Today it works because
the list is in one place and you can read it in one breath — *"what is NOT here"*. Spread through
the document, completeness is no longer visible at a glance, so either the press moves to a
rendered roll-up of every claim in the file, or it stops being cheap to judge.

**Still open from the inventory:** RFC-072's **73 numbered claims** cannot be marked at all, so that
document cannot say whether it was built. Migration step, or do the pre-block RFCs stay unmarkable?
::::

- [ ] **`rfc-execution`** :file[~/.claude/skills/rfc-execution/SKILL.md] · 193 lines

  **The question:** it is the newest of the three and the only one that has never run end to end.

- [x] **`report-authoring`** :file[~/.claude/skills/report-authoring/SKILL.md] · 99 lines

  **The question is the one you just demonstrated.** The skill says both leaf attributes are
  required and that "everything else should carry a window" — and then gives **no numbers for any
  subtype**. So I picked `30d` for a planning report, which you called stupid and moved to `6h`.
  That is not me being careless about one number; it is the document declining to answer the only
  hard question it raises. A notice is hours. An account outlives its run. A planning report lives
  as long as the planning does. None of that is written down anywhere.

::::thread{id=t3 sent=systemview-test:heor47}
**SETTLED IN DISCUSSION, 2026-11-02.** The windows are his; the reasoning is what makes them
pickable by somebody who was not in the conversation.

**THE FOUNDING RULE, AND EVERY ROW ANSWERS TO IT: a report is a document that GOES AWAY.** That is
what makes it free to write — *"we need to be able to plan, we need to be able to do this, but
those documents need to go away."* So a report that needs to live forever is a smell, not a
feature: if it has to persist, it was another kind of document wearing a report's leaf.

| when you are writing one | `as=` | what it carries beyond the basics | `retain=` |
|---|---|---|---|
| a design conversation, before there is a plan | `planning` | the argument, the choice made, what is most worth rejecting | `24h` |
| an unattended job's sitting | `account` | what landed, what it could not verify | `24h` |
| a run that was **abandoned** | `account` | why it stopped, what the next person picks up from | `6–12h` |
| a code or architecture audit | `audit` | the count, the method, the tree state it counted against | `7d` |
| work handed to another agent | `brief` | the problem, the constraints, the measured facts — no sketch | `6h` |
| a spec with living proofs | `spec` | the claims, and evidence that still runs | `30d → permanent` |

**`notice` is CUT.** Not for lack of use — we are mid-build and nothing is used. On the vocabulary
alone a brief is more of a report than a notice is, and **a brief sits above a notice and captures
it**: anything a notice could carry, a brief carries with the context that makes it actionable.

**A PLANNING REPORT DIES WHEN ITS CONCLUSIONS LEAVE IT** — when it became an arc, a plan or a spec.
`24h` is a backstop, not a lifetime, and while the planning is live the move is to DIVERT the clock
rather than widen it. This document is the live example.

**AN ABANDONED RUN'S ACCOUNT IS SHORTER THAN A SUCCESSFUL ONE'S, NOT LONGER** — his correction, and
the reason is what the account is FOR. It is a live blocker: urgent today, worthless by Friday,
because by then somebody picked it up or the ground moved. A week-old *"stopped, waiting on his
press"* is noise on the drawer.

**AN AUDIT IS A COUNT, AND A COUNT IS STALE THE MOMENT ANYBODY COMMITS.** `7d`, and the FINDINGS
have to leave it inside that window — into gaps, board cards or an RFC. An audit whose findings
exist only inside the audit is a run of work that expires.

**A SPEC IS THE SPECIAL ONE AND IT EARNS THE LENGTH.** It is the structure added to loosely-scoped
work so the work can be VALIDATED rather than asserted: *"come back, you say this was done — I get
to run the specs."* That is why it outlives the sitting that produced it.

---

**`report-authoring` RETIRES INTO A CORPUS CHAPTER — his order.** A report is almost never the thing
anybody set out to do; it is the TAIL of something else — a job's handover, an audit's output, a
planning session's conclusion, an abandoned run's account. A skill models *"I set out to do X"*; a
corpus models *"I am doing X and need to know how to do part of it."* Worse, invoking a skill opens
a nested run at the exact moment an agent is trying to close another one, and what it needs there is
a lookup, not a procedure.

So: a reports chapter in `how-we-work`, and every skill and job that produces one points at it —
carrying the DECISION inline (*"it is an `account` at `24h`"*) plus the retrieval query, so nobody
re-describes it and nobody has to go and look in order to act correctly. That replaces
`proactive-development`'s whole §6.

**A SPEC-AUTHORING SKILL SHOULD EXIST, and it is the opposite case.** Writing a spec IS the primary
work when you sit down to do it, and it carries a real decision with nothing written on it anywhere:
reuse or modify an existing test · write a new one and grow the suite · put a `:::run` block in the
document. When and why for each. Today the only thing on the subject is `agents/tests.md`, 272 lines
of reference and not a procedure, and `proof-authoring` is another project's rendered-pixel thing.

**THE SPEC DECISION IS MADE AHEAD OF THE WORK, ON THE CARD.** An agent deciding at the end whether
its own work needed a spec is the party with an interest — the same self-interest `rfc-authoring`
already handles by making `kind=experiential` a declaration at authoring time, *"while nobody yet
knows which proof is inconvenient."* So the board card carries it: a field, NOT required, with pills
in the panel so he can click the kind without typing. Agents keep adding cards on the fly without
choosing; `context-maintenance`'s board pass sweeps for the ones that never declared, which is what
guarantees the decision gets made. Then `proactive-development` stops deciding and READS it —
preferring, and possibly only taking, cards whose spec requirement is settled.

**The work that falls out:**

- [x] the reports chapter in the `how-we-work` corpus, and `report-authoring` retired into it — :file[docs/how-we-work/reports.md], 13 chunks, indexed and retrieved back
- [x] every skill and job that files a report repointed — the decision inline, then the query
- [x] `spec-authoring`, with the three-way choice as its spine — :file[~/.claude/skills/spec-authoring/SKILL.md]
- [x] the card's spec field, all four halves: the hub door and `api/board.js` · the MCP tool's `report=` · the panel's pills at the foot of the card · `context-maintenance`'s sweep and `proactive-development` reading it

**A BRIEF CARRIES ENOUGH TO ACT ON** — a flag with nothing to act on is a chat line or a board
card. `6h`: a brief exists for work in flight, and work in flight either started within the hour or
the brief was wrong about what mattered. Arbitrary at the edges, like every window here — the
number is a backstop, DIVERT is what handles the case that is still live.

---

**THE DURATION IS THE CHOOSING INSTRUMENT — his reading, 2026-11-02, and it is better than mine.**
*"The reasoning for which one to choose is very much tied to the duration… if you think about the
duration and then you reflect on your work, you'll say, oh okay, I should choose this because I
need to blah blah."* So `Why each window is the length it is` stays exactly as it is, and it is the
section that should come back when somebody asks WHICH KIND — not the table. Asking *how long will
this still be worth reading* makes you weigh the work; asking *what is this* invites you to pick
the label that sounds like what you just did.

**What is broken is retrieval, not the prose.** Measured against the live index:

| the question | what came back |
|---|---|
| "which report do I file and how long should it last" — the query the skills point with | the table at 0.68, the opening rule at 0.66. **Not one of the six `###` reasoning sections.** |
| "why would I choose a brief instead of an account" | the table at 0.65, then two **Blink accounting** chapters at 0.63 and 0.61 |
| "how long does a brief stay before it retires" | "Why a brief is 6h" finally appears — at 0.56, still under the table |

A chunk is embedded under its HEADING PATH, and `Why each window is the length it is` promises
duration, so no choosing question matches it. The fix is the heading and the section's opening
sentence carrying the choosing frame — not a rewrite of the six reasons.

**SIX BLIND SUBAGENTS, SIX SITUATIONS, 6/6 RIGHT.** Each one was given only the situation — never
the chapter, never the query — and asked what it would write on the leaf:

| the situation | filed | right |
|---|---|---|
| an unattended job's sitting | `account` `24h` | ✅ |
| a run stopped, waiting on his press | `account` `12h` | ✅ |
| a settled design conversation, no plan yet | `planning` `24h` | ✅ |
| 41 convention violations counted | `audit` `7d` | ✅ |
| a slice handed to another agent's lane | `brief` `6h` | ✅ |
| a document whose proofs still run | `spec` `permanent` | ✅ at the edge |

**NONE OF THEM USED THE POINTER QUERY** — they asked in their own words (*"unattended job report —
what subtype does a job sitting file"*) and landed on the chapter anyway, which is the stronger
result: the chapter retrieves on its SUBJECT, not on one magic phrasing.

**The one soft spot the evals found:** the spec row allowed `30d`–`permanent` and the agent took
the longer end with no reason to. The chapter now says which to reach for — `30d` unless the spec
is a project artifact in `RFCs/` — because the instruction *reach for the short window* was
everywhere except the one row where both ends were legal.

**AND THE SECOND FINDING IS NOT ABOUT THIS CHAPTER AT ALL.** Two accounting chapters from another
project outranked this chapter's own reasoning on a question about reports. A search that names no
corpus reads every PERMANENT corpus — sixteen of them, ~1,500 chunks — ranked on cosine alone, so a
word like *account* collides across domains and the noise grows with every corpus anybody adds.
**Corpora need to be scoped to agents** (his call): an expert carries the corpora its work needs,
the way a hook exists for everybody and fires for nobody until somebody carries it. Permanent vs
working is a lifecycle axis and it was never an audience axis.

**BUILT.** `agents` is a field on the corpus — `"everyone"` or a list of slots; absent reads as
everyone so nothing indexed before this disappears by silence. A new PERMANENT corpus belongs to
the agent that made it, because publishing to every agent is a decision and saying nothing must not
make it. An unscoped search reads what you carry; **naming a corpus reads it regardless**, and the
answer NAMES what it held back with a count and a score, because an agent cannot ask for a corpus
it has never heard of. The sixteen existing corpora are backfilled: `how-we-work` and
`systemview-docs` to everyone, the BU corpora to their own agents, `blink-accounting` to `blink`.

**The pointer query was chosen by MEASUREMENT, not taste.** `which report kind should I file, and
why is its window that length` returns the choosing section at **0.78**; the two phrasings that had
been in use returned the table (0.71) or my own pointer paragraph in AGENTS.md (0.68). That one
phrasing now stands in all nine skills, jobs and docs, plus the MCP tool's description.
::::

- [ ] **`spec-authoring`** :file[~/.claude/skills/spec-authoring/SKILL.md] — written tonight, and the one we may yet remove

  **The question:** should it be a skill at all, or doctrine pointed at — and what does that
  doctrine actually say about cmds, wrappers and what counts as a spec?

::::thread{id=t4}
**THE ARGUMENT, 2026-11-02 — where it landed and what is still open.** `spec-authoring` exists and
was written tonight; the skill may yet be removed. These are the things settled on the way.

**1 · A cmd counts as PROOF, never as a SPEC — and the line is WHO RUNS IT.** The code already
draws it: `PROOF_KINDS.spec` is `["test","run","cmd"]` and satisfies a claim; `SPECS` is
`["test","run"]` and is what the headless collector re-runs, because collecting a cmd would execute
shell nobody pressed and report it as a pass. I argued a cmd "expires" and he killed that: **a
command line can run the SystemLynx spec**, so a cmd is a POINTER to a check and its durability is
whatever it points at. Nothing else about the block decides anything.

**2 · A cmd going RED is the point.** His, pressing the seven on the runs report: they failed, and
that is a test surface doing its job — revealing bad testing or something genuinely broken. A block
that cannot go red is the one to distrust.

**3 · The wrapper service is called `Test`, and the first one needs correcting.** A spec resolves
`Service.Module.method`, so code with no service has no door. SystemLynx wraps anything cheaply —
so wrap it, and **name it so the pile can be counted**: `Test.<Module>.<method>` means *no door
existed, so I made one*, and the number of them is the measure of how much of the system has no
front door. `Test` rather than `Spec` because `spec` is already the artifact on the CALLING side —
a claim owes a living spec — and a `Specs.*` namespace makes the spec call the spec.

The existing wrapper is **`SystemViewCore`** (`systemview-test/service.json`), eight modules, six of
them from one commit — `9492667f`, the lifecycle work: `Claims`, `Runs`, `Retrieval`, `LiveWindow`,
`Proofs`, `Window`. The name reads like product, which is the lie: `Claims.js` and `Runs.js` say in
their own first lines that they are DOORS with **no assertions** — *"it may count items and read
states — that is transcription. It may not decide whether there are enough runs… the moment it
does, the evidence stops being readable from the document that asked."* So the discipline is
already written; only the name is missing. Cost of the rename, measured: 51 files, 41 markdown
mentions, 33 spec files — and the markdown ones are `::test{SystemViewCore.X.y}` chips inside
claims on approved RFCs, a change of FORM not of contract.

**4 · `Plugin` is a MODULE, not a service — and I had this wrong.** `systemview-plugin` is a
REQUIREMENT, the thing that connects a service to SystemView at all; this whole project began as
only that plugin. The module is PASSED IN as a plugin so it is clearly separate from the service's
real work, which is exactly the separation wanted here: on a `Test` service, test-side LOGIC —
setup, fixtures, seeding — is `Test.Plugin.*`, and the doors stay transcription. buAPI does it
neatly: `Profiles.Plugin.createMockUsers` builds ten real users, then the spec calls the REAL
`Profiles.Users.signIn` for everything it asserts.

**And buAPI is neat for a reason that is a verdict on us:** its specs barely need doors because its
product IS services. We needed eight because half the logic is unreachable. A door that finds
itself wanting to DO something — seed, build a fixture, run a sequence — has found work that
belongs in a Plugin module on a real service, and the absence of that service is the finding.

**5 · The hub is already SystemLynx**, so it can be tested directly. Which is the shape of the
answer generally: *"I don't know how you could build it and not build on SystemLynx when it's made
for SystemLynx."* The architecture push is NOT a question for this thread — it arrives as an arc
out of code review, and it will facilitate this rather than block it.

**6 · Enforcement, unbuilt:** `as=spec` with no proof block in the document should derive
`invalid — no spec`, the way a missing `retain=` already does. The registry row already carries the
per-document spec inventory, so the rule reads a number that exists.

**7 · WHAT A SPEC REPORT IS, AND ITS RAIL — the longest argument of the night, settled.**

**It is a RECEIPT for work nobody scheduled.** His framing: you are not always in an arc or an RFC.
Most work is either planned there, or it is small and goes on the board — *"oh shit, the colour is
not showing right, I'm busy, throw it on the board."* Most of that needs no spec at all. The spec
report exists for the subset where *"I fixed this"* or *"I added this"* deserves to be CHECKABLE
rather than taken on the word of the agent that did it.

Its blocks are one of two things, and both are legitimate: a `::test` chip pointing at an EXISTING
saved test (possibly one this work modified — that test lives in the suite and outlives the
document), or a `:::run` block where **the check exists only in the document**. If a check must
outlive the receipt, it MOVES OUT into the suite — that is a side-door before retirement, never a
state, because the document was never the home for a permanent test. It was the home for *"this
was true when I handed it to you."*

**THE RAIL, and the event that drives it is not the one every other report uses.** Every other
report is consumed by being READ, which is why first-open starts its clock. A spec report is
consumed by being RUN; the read tells you nothing.

| state | the arrival |
|---|---|
| **filed** | the work is done and the blocks are in — pointing at a saved test, or carrying the run block |
| **settled** | somebody RAN it green who is not the author. The author running their own proof is a statement, not a confirmation — the same category as an agent marking its own claim met. The runner already records who ran what, so this is DERIVED, never typed |
| **retired** | confirmed, so the receipt's job is over and it goes — after the check graduates to the suite, if it needed to |

**WHAT I HAD WRONG, and it is the generalisable part:** I kept looking for a spec's state INSIDE
the document — does it run, is it green, is it on the loop — when every state in this system is
derived from a RELATIONSHIP. An objective's state comes from its plans, a claim's from its proof, a
gap's from its fix. The spec's comes from who ran it and whether anything is bound to it. Running
is not a state at all: `specsOf` collects `test`/`run` blocks out of ANY registered document and
the runner executes them, so "can it be re-run" is a property of having a leaf.

**AND THE WINDOWS WERE ALWAYS PROXIES FOR RAILS.** Every retention number argued tonight is a
clock standing in for a state the system could derive: an audit is settled when its findings LEFT
(gaps, cards), a brief when its lane came back, a planning report when its conclusions landed in an
arc or an RFC, an account when it was read. His point, and he had to make it three times: each
subtype could have its own rail — *"having a special case just proves you have a system."* What
stops four of the five today is one missing mechanism, not five: **a pointer from the thing that
CONSUMED a report back to the report.** A gap does not say which audit found it; an RFC does not
say which planning report produced it. Commits solved exactly this with the `Serves:` trailer.

## THE PLAN, in order — written down before any of it moves

1. **Rename `SystemViewCore` → `Test`.** Mechanical: 51 files, 33 spec files, 41 markdown mentions
   (`::test{SystemViewCore.X.y}` chips inside claims on approved RFCs — a change of FORM, not of
   contract). FIRST, because every later door wants to join it and each one landing under the old
   name is another thing to migrate.
2. **Give the `Test` service its `Plugin` module**, passed in through `systemview-plugin` the way
   `Profiles` does. Nothing moves into it yet — it exists so the next door that wants to DO
   something has an honest home, and the doors stay transcription.
3. **`as=spec` with no proof block derives `invalid — no spec`**, the way a missing `retain=`
   already does. The enforcement he asked for, and the thing that stops another spec report that
   is only cmds.
4. **Then the doctrine into the `how-we-work` chapter** — cmd is proof and never a spec, the line
   is who runs it, a door is transcription, logic goes in Plugin, `Test.*` means no door existed.
   After 1–3, because doctrine describing a convention that is not built yet is the recurring way
   this goes wrong.
5. **Settle the spec lifecycle (7).** Needs a decision, not a build.
6. **Leave `spec-authoring`'s fate standing** until the count answers it — did somebody SET OUT to
   write a spec, or was one OWED.

**STILL OPEN — the one this thread was started for:** should `spec-authoring` be a SKILL, or
doctrine pointed at? A spec is primary work when you sit down to write one, which argues for a
skill. But a spec is also the TAIL of other work — a claim needs proving, a card declared one, a
run is closing and owes evidence — and that is the exact shape that sent `report-authoring` into a
chapter, because invoking a skill opens a nested run at the moment an agent is trying to close one.
Both of tonight's specs were the tail shape. **What would settle it is a count, not an argument:**
over the next few real runs, did somebody SET OUT to write a spec, or was one OWED.
::::

- [ ] **`gap-authoring`** :file[~/.claude/skills/gap-authoring/SKILL.md] · 94 lines

  **The question:** gaps are now in `proactive-development`'s queue. Does this skill know that?

## Group 3 — last, because they encode whatever we settle

- [ ] **`skill-authoring`** :file[~/.claude/skills/skill-authoring/SKILL.md] · 409 lines — and its §8 is the open design question: the run law is
  PASTED into all 23 skills, which is how one wrong block became 22 wrong skills today. Paste, or a
  pointer and a retrieval query?
- [ ] **`skill-maintenance`** :file[~/.claude/skills/skill-maintenance/SKILL.md] · 176 lines — the pass that finds the bad step. It reads the run
  records, so it cannot be judged until the jobs above are producing honest ones.

---

## Every document, by category

Twenty-six documents — three jobs and twenty-three skills — and this is the taxonomy, which is a
different cut from the walk order above. The walk is an agenda; this is what we actually own.
**✓ = in this walk.**

| category — what it is for | documents | lines | in walk |
|---|---|---|---|
| **Execution** — runs unattended, fired by a chore | `proactive-development` | 393 | ✓ |
| | `arc-development` | 259 | ✓ |
| | `jobs-path-check` | 127 | — |
| | `chore-round` | 116 | ✓ |
| **Document authoring** — the documents work is tracked in | `arc-planning` | 418 | ✓ |
| | `rfc-authoring` | 307 | ✓ |
| | `rfc-execution` | 193 | ✓ |
| | `report-authoring` | 99 | ✓ |
| | `gap-authoring` | 94 | ✓ |
| **System authoring** — the system writing itself | `skill-authoring` | 345 | ✓ |
| | `job-authoring` | 237 | ✓ |
| | `agent-authoring` | 182 | — |
| | `skill-maintenance` | 162 | ✓ |
| **Context** — what reaches an agent, and when | `context-maintenance` | 327 | — |
| | `doc-maintenance` | 214 | — |
| | `study` | 165 | — |
| | `context-retrieval` | 120 | — |
| **Handing work over** | `delegation` | 174 | — |
| | `assignment` | 152 | — |
| **Audit** — produces findings, not owned work | `system-audit` | 155 | — |
| | `code-audit` | 122 | — |
| | `codebase-refinement` | 108 | — |
| **Presentation** — shows the system, does not execute in it | `how-we-work-tour` | 159 | — |
| | `walkthrough` | 157 | — |
| **Incident** — fires on a measurement | `perf-triage` | 103 | — |
| **Another project's surface** | `proof-authoring` | 77 | — |

**The shape of it, worth saying out loud:** execution is 895 lines across four documents and
document-authoring is 1,111 across five — so the half that RUNS is smaller than the half that
writes things down. Context is 826 lines for four documents nothing fires automatically yet.

### Why each category is out

- **Context** — walked in tonight's first pass, and not what a chore turns on first.
- **Handing work over** — `assignment` and `delegation` describe moving work between you, me and
  subagents. They come after the jobs settle, if at all.
- **Audit** — they find things. Nothing in them creates owned work, which is the thing we are
  wiring.
- **Presentation, incident, another project's surface** — unrelated to org execution. `proof-authoring`
  is BUStudio's rendered-pixel documents and does not belong in this conversation at all.
- **`agent-authoring`** — who an agent IS, not how work executes. It changes if the jobs change what
  an agent is expected to do, so it may come back at the end.
- **`jobs-path-check`** — it proves the jobs path works on this machine. If the walk turns up a
  jobs-path problem, that is the document that should have caught it.

## MOUNT OLYMPUS — the thing above all the arcs, and the last piece

> *Someone once asked Aristotle how you get to Mount Olympus. His response was instructive: make
> sure every step you take is towards Mount Olympus.*

- [ ] **A vision document, above every arc.** One place holding the whole of the current mission —
  not a plan, not an arc, the thing arcs are FOR. Every arc points up at it.

  **And the skills point at it.** The rule it creates is the one worth having: *if you are ever
  unsure what to do, climb the ladder.* The step serves an objective; the objective serves an arc;
  the arc serves the mission. An agent that cannot answer "why am I doing this" at any rung has
  found a real problem — either the rung is wrong or the work is.

  **Why this is last and not first:** it is the thing every other document defers to, so it has to
  be written once the layers under it stop contradicting each other. Writing it while
  `arc-development` still forbids committing would just add a fourth voice.

  **What it needs decided:** where it lives and what registers it — a fifth leaf kind, or a report
  with a subtype of its own; whether an arc names it the way an RFC names an objective (`arc=`), so
  "which arcs serve the mission" is the same query as everything else; and which skills carry the
  climb-the-ladder instruction, because pasting it into all 23 is the mistake we just spent a day
  undoing.

## Group 4 — the deferred ones, walked LAST, with their findings kept here as we hit them

Out of the walk is not out of the record. A false statement found in a skill we are not reviewing
tonight is still a false statement, and the place it must not live is only in my head — so findings
against the deferred documents land on this list as they turn up, and the list is what we work
through at the end.

- [ ] **`how-we-work-tour`** :file[~/.claude/skills/how-we-work-tour/SKILL.md] · 168 lines — states that `::cue{call="…"}` is *"designed, NOT WIRED — renders
  honest, plays nothing."* **It is wired.** `cuePerform.js` imports `callCommand` and `AgentChat.js`
  executes it; `nav`, `act` and `refresh` all run from inside a sequence. A skill teaching that a
  live verb is dead costs the one thing cues were built for — a walk that does its own navigating
  and therefore replays from anywhere.

*(more as the walk turns them up)*

## What has landed against this report

The other half of the link. Each of these commits carries `Serves: The walk — jobs, then
authoring` in its trailer, and each is named back here — which is the whole convention, doing its
first real lap.

::commit{sha=a025603a told=systemview-test}
::commit{sha=95b7e036 told=systemview-test height=269}
::commit{sha=7a5dfdf6 told=systemview-test}
::commit{sha=e143a167 told=systemview-test}
::commit{sha=ab5ff783 told=systemview-test}
::commit{sha=3f4c6cbc told=systemview-test}
::commit{sha=9e44f264 told=systemview-test}
::commit{sha=fe4cdfdb told=systemview-test}
::commit{sha=dd4f9bac told=systemview-test}
::commit{sha=50494456 told=systemview-test}
::commit{sha=3190a196 told=systemview-test}
::commit{sha=2b61289b told=systemview-test}
::commit{sha=66037f4a told=systemview-test}
::commit{sha=91bc5a7e told=systemview-test}
::commit{sha=02817ace told=systemview-test}

**The reports layer, landed 2026-11-02** — the janitor's cadence and `permanent` in plain words,
the chapter itself, the renderer correction, and the card's declaration with its pills:

::commit{sha=77925dc8 project=systemview-test}
::commit{sha=71795594 project=systemview-test}
::commit{sha=570c0484 project=systemview-test}
::commit{sha=390c1b05 project=systemview-test}
::commit{sha=f7f59b3 project=autobot}

Also landed, in the autobot repo, so outside this document's own git window: `588e0f5` (members
and objective owners on the registry row), `bba4b9a` (`rfc` and `gap` as attachment kinds),
`74dbce9` (a report registers wherever it is written), `2f6df6d` (the watcher says when it did not
start). Hub side: `0bfc583e` (the registry's member filter).

## What the assignment landed

Doors first, because six document edits named verbs that did not exist.

| # | what | where |
|---|---|---|
| 1 | **An agent can ask the registry what exists and what it is on** — members and objective owners recorded on the row, an exact-match `member` filter, `projectCode` genuinely optional so "which arcs am I on" works across projects | `588e0f5` · `0bfc583e` · `mcp__systemview__registry` |
| 2 | **`rfc` and `gap` are attachment kinds** — a run can name the plan it executed, not only the objective. The attachable kinds now cover all four registered document kinds | `bba4b9a` |
| 3 | **A commit says what it served** — a `Serves: <leaf id>` git trailer, final-block-only, one id per line; `commitLinks` reads both directions and reports only disagreement | `a025603a` · `mcp__systemview__commitLinks` |
| — | **Found while proving 3: a report written as a plain file registered NOWHERE.** `.systemview` was in the watcher's ignore list and `show()` is retired, so the folder reports live in was the one place a leaf could not be heard. Two of mine were missing from the registry | `74dbce9` |
| 4 | **A thread is addressable** — `data-thread` / `data-thread-body` reach the DOM, so a cue, a link or a hook can point at one conversation instead of counting children | `95b7e036` |
| 5 | **The watcher says when it did not start**, and the cross-repo bound is written where somebody meets it | `2f6df6d` |

**Verified on real data, not fixtures.** 200 commits read, the two reports registered through the
shell's own parse, the `::commit` blocks added above — `agreed: true`, nothing one-way, nothing
dangling. The convention has done one real lap.

Then the documents. **`arc-development`**: §2 and §3.1 ask the registry instead of globbing
`RFCs/arcs/`, and §2 answers the settled-arc question — the job says `settled` and stops rather
than finding adjacent work, because a chore pointed at a finished arc is a finding, not a gap to
fill. §3.4 attaches the plan as well as the objective, commits as it goes with a trailer, and the
lane became a tool with its condition stated. The aim line stopped asserting it. §4's handover is
four things now, and the second is the commits. §5's three stale bounds are rewritten — what is
forbidden is a commit that says nothing, not a commit. **`proactive-development`**: the boundary
moved into the aim line where `jobsList` shows it; the lane kept its real reason (his tree is
dirty, so a lane is the only place a suite result means anything) and lost "always".
**`rfc-authoring`**: claims go beside the design they check, the completeness press gains the
thing it now owes, and a pre-block RFC is migrated rather than left — RFC-072's 73 numbered claims
are a change of form, not of contract. **`arc-planning`** and **`planning.md`**: the folder is
where you write one, the registry is how anybody finds it.

## What I have not verified

- **NOTHING FROM DOORS 1–5 IS LIVE IN HIS SESSION YET.** The MCP tools (`registry`,
  `commitLinks`) and the watcher fix are in `autobot/electron/` — Node has the old files cached, so
  they arm on a SHELL restart. The hub half (`commitLinks`, the registry's `member` filter) arms on
  a HUB restart. Both are harness-managed and neither is mine to do. Everything is tested and
  committed; none of it has been exercised through the MCP door it will eventually be called
  through — the proofs above went through the modules directly.
- **TONIGHT'S FIVE COMMITS CARRY NO `Serves:` TRAILER.** I named them above and did not write the
  trailer when I made them, so `commitLinks` will read this document as linking one way until
  somebody fixes it — the convention's first real miss, and it is mine.
- **The MCP's `report=` is not callable in a live session yet.** It is in
  `autobot/electron/agents/systemview.cjs` and its tests are green, but Node holds the old file:
  it arms on a SHELL restart, which is not mine to do. The PANEL's pills work now — they write the
  same field through the hub.
- **The rewritten jobs have not been RUN.** They are read-and-reasoned, not executed. The first
  real `arc-development` run against the registry is the thing that will find what I got wrong.
- **`tests/worklist.js` in autobot hangs** — checked against a clean checkout, it hangs there too,
  so it is pre-existing and not from this work. It is also a suite nobody can currently green.
- **Not one of the eleven has been run as a measured eval.** Trigger evals exist as a harness and
  have been run on one skill; behaviour evals on none. So "does this skill match the
  infrastructure" is a reading, not a measurement, for every line above.
- **`jobs-path-check`** is a third job and I have left it off entirely — it proves the jobs path
  works on this machine. If the walk turns up a jobs-path problem, that is the document that should
  have caught it.
- **I have not re-read all 393 lines of `proactive-development`** for this plan. The aim-line
  finding and the §43–52 location are read off the file; the rest of my question about its length
  is a size, not a judgment.
