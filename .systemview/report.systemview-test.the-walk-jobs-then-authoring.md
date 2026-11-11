# The walk — jobs first, then the authoring skills they drive

::report{id="The walk — jobs, then authoring" as=planning retain=10d}

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

- [x] **`proactive-development`** :file[~/.autobot/jobs/proactive-development/job.md] · 441 lines · *do work for your own project, in a lane*

  **Two things.** First: the boundary you dictated — the board, gaps, dead runs, non-arc RFCs, and
  never an arc's queue — is stated at §43–52, ten paragraphs in. The AIM line, which is the only
  line `jobsList` shows and the only thing an agent reads before deciding to load the job, still
  says *"do work for your own project"* with no boundary in it at all. Second: at 393 lines it is
  the longest document in the system, and it is the one most likely to run with nobody watching.

- [x] **`chore-round`** :file[~/.claude/skills/chore-round/SKILL.md] · 116 lines · *work this agent's chore board*

  **The question:** a chore is a pointer, and `arc-development` requires inputs. A chore that cannot
  supply them is refused at fire time, every time, silently from your side. Does the round detect
  that, or does a misconfigured chore just never run?

- [x] **`job-authoring`** :file[~/.claude/skills/job-authoring/SKILL.md] · 278 lines · *author or repair a job*

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

- [x] **`arc-planning`** :file[~/.claude/skills/arc-planning/SKILL.md] · 425 lines · *the biggest document we own*

  **The question:** it was written before `rfc-execution` and `arc-development` existed. How much of
  it is now describing work those two own?

- [x] **`rfc-authoring`** :file[~/.claude/skills/rfc-authoring/SKILL.md] · 341 lines

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

- [x] **`rfc-execution`** :file[~/.claude/skills/rfc-execution/SKILL.md] · 193 lines

  **The question:** it is the newest of the three and the only one that has never run end to end.

- [x] **`report-authoring`** :file[~/.claude/skills/report-authoring/SKILL.md] · 155 lines · *the
  report that work leaves behind* — **REWRITTEN FROM NOTHING 2026-11-02, so it has never been
  walked.** Not the 99-line document retired earlier: that one described a report's shape, which is
  the chapter's job. This one opens on *report writing is about FORENSICS — you are writing for an
  investigator, not a reader* and carries only the ORDER and the irreversible bits, with a branch
  per kind and `as=spec` holding the receipt's claim procedure. Trigger eval: 3 passes, 20 queries,
  100%/100%, eight negatives going to the right neighbour. **No behaviour eval** — whether the body
  makes a report better than no skill at all is unmeasured, which is the first question to ask of it.

  **The question for the walk:** nine producers now point at it (§t5 item 5). Does any of them still
  describe a report's shape itself, and does the skill's §3 duplicate anything the claims chapter
  now owns?

  **The question is the one you just demonstrated.** The skill says both leaf attributes are
  required and that "everything else should carry a window" — and then gives **no numbers for any
  subtype**. So I picked `30d` for a planning report, which you called stupid and moved to `6h`.
  That is not me being careless about one number; it is the document declining to answer the only
  hard question it raises. An account outlives its run. A planning report lives as long as the
  planning does. None of that is written down anywhere.

::::thread{id=t3 sent=systemview-test:heor47}
**THE WINDOWS ARGUED HERE WERE LATER REFRAMED — t5 §2 HOLDS THEM AND THE REASONS.** This thread
settled that each window needs a REASON a stranger can act on, and that stands. What it got wrong is
the question the number answers: it asked how long a report is worth READING, and a report is
evidence, not reading. One table, in t5 §2, so nothing here can drift from it.

**THE FOUNDING RULE, AND EVERY ROW ANSWERS TO IT: a report is a document that GOES AWAY.** That is
what makes it free to write — *"we need to be able to plan, we need to be able to do this, but
those documents need to go away."* So a report that needs to live forever is a smell, not a
feature: if it has to persist, it was another kind of document wearing a report's leaf.

| when you are writing one | `as=` | what it carries beyond the basics |
|---|---|---|
| a design conversation, before there is a plan | `planning` | the argument, the choice made, what is most worth rejecting |
| an unattended job's sitting | `account` | what landed, what it could not verify, and the `::commit` records |
| a run that was **abandoned** | `account` | why it stopped, what the next person picks up from |
| a code or architecture audit | `audit` | the count, the method, the tree state it counted against, the command that regenerates it |
| work handed to another agent | `brief` | the problem, the constraints, the measured facts — no sketch |
| a spec with living proofs | `spec` | the claims written the receipt's way (t5 §9), and evidence that still runs |

**The windows are in t5 §2 and only there.**

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

**THE SPLIT: THE CHAPTER HOLDS THE DECISION, A SKILL HOLDS THE PROCEDURE.** Which kind to file and
why its window is that length is a LOOKUP — an agent mid-close needs a fact, not a procedure — so it
lives in the chapter and every producer points at it carrying the decision inline. But writing the
report is a PROCEDURE and it grew: attach the commits, attach what the kind owes, declare the
window, carry the pointer back. Ordered steps with a durable outcome, which is the test a lookup
fails.

**AND THE ARGUMENT THAT ONCE RETIRED IT WAS WRONG ON THE MECHANICS.** It was retired partly because
invoking a skill "opens a nested run at the moment an agent is trying to close one" — and
`skill-authoring` §8 says the opposite in plain words: *"A skill's run never collides with
anything… firing a skill mid-skill destroys nothing; the outer run's list stays exactly where it
stopped."* What survives is weaker and real: whether an agent mid-close will REACH for it. That is
a trigger problem, and the answer is that the producers name it in their own closing step rather
than hoping it fires.

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

- [x] the reports chapter in the `how-we-work` corpus — :file[docs/how-we-work/reports.md], 13 chunks, indexed and retrieved back. It holds the DECISION (which kind, why that window); the PROCEDURE is a skill again, t5 §11
- [x] every skill and job that files a report repointed — the decision inline, then the query
- [x] `spec-authoring`, with the three-way choice as its spine — :file[~/.claude/skills/spec-authoring/SKILL.md]
- [x] the card's spec field, all four halves: the hub door and `api/board.js` · the MCP tool's `report=` · the panel's pills at the foot of the card · `context-maintenance`'s sweep and `proactive-development` reading it

**A BRIEF CARRIES ENOUGH TO ACT ON** — a flag with nothing to act on is a chat line or a board
card. Its window is t5 §2's, and DIVERT is what handles the case that is still live.

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

These answered against the windows **as they stood at the measurement** — the retrieval is what
was being tested, not the numbers, and t5 §2 has since changed two of them. What the pass proves is
that the chapter is FINDABLE and its reasons are usable by somebody who was not in the room.

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

- [x] **`spec-authoring`** :file[~/.claude/skills/spec-authoring/SKILL.md] · 150 lines — written, briefly retired, and REWRITTEN on his ruling: it stays, because a spec is a runnable artifact and a report is the document that requires one. Its spine is now HOW to think — contract by shape, wrap it and name it `Test`, no gatekeeping on what counts

  **The question:** should it be a skill at all, or doctrine pointed at — and what does that
  doctrine actually say about cmds, wrappers and what counts as a spec?

::::thread{id=t4}
**THE ARGUMENT, 2026-11-02 — where it landed.** `spec-authoring` was written tonight; item 6 below
is where its fate was settled, and it STAYS. These are the things settled on the way.

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

The existing wrapper is **`Test`** (`systemview-test/service.json`), eight modules, six of
them from one commit — `9492667f`, the lifecycle work: `Claims`, `Runs`, `Retrieval`, `LiveWindow`,
`Proofs`, `Window`. The name reads like product, which is the lie: `Claims.js` and `Runs.js` say in
their own first lines that they are DOORS with **no assertions** — *"it may count items and read
states — that is transcription. It may not decide whether there are enough runs… the moment it
does, the evidence stops being readable from the document that asked."* So the discipline is
already written; only the name is missing. Cost of the rename, measured: 51 files, 41 markdown
mentions, 33 spec files — and the markdown ones are `::test{Test.X.y}` chips inside
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

**7 · WHAT A SPEC REPORT IS — the longest argument of the night. Its RAIL was argued here and
REVERSED in t5: a report reaches `retired` and nothing else.**

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

**THERE IS NO RAIL, AND THAT IS WHAT MAKES IT A REPORT.** The one state a report reaches is
**retired**. A spec report carries claims, and the claims carry their own states — `met`, `unmet`,
`unchecked` — but they do not elevate the document that holds them: it is a RECORD, kept so the
work can be followed back, and it only ever gets old.

The reason is what every other kind has and this one does not: a rail belongs to something that
SERVES something else. An objective serves an arc, a plan serves an objective, a gap serves a fix —
each settles when the thing it serves is satisfied. A report serves nothing. It *is* the record. So
claims inside one make it a better record and nothing more, and the question "has this settled" has
no referent to answer from.

**AND THAT IS WHY RETENTION STAYS A CLOCK.** A derived rail would have cost the one self-cleaning
mechanism in the system: an unmarked claim is honest and never a gate, so a report waiting on a
press to retire is a report that sits forever. The clock asks nobody for anything. Two things stay live and
neither is a rail: what QUESTION the number answers (how long could this be evidence, not how long
is it worth reading), and whether a consumed-by pointer could fire the retirement instead of the
clock.

The blocks still differ from every other report's, and that part holds: every other report is
consumed by being READ, which is why first-open starts its clock. A spec report's evidence is
consumed by being RUN, and the read tells you nothing about it.

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
subtype could derive its own RETIREMENT — never a rail, which a report cannot have, but the
TRIGGER: *"having a special case just proves you have a system."* What
stops four of the five today is one missing mechanism, not five: **a pointer from the thing that
CONSUMED a report back to the report.** A gap does not say which audit found it; an RFC does not
say which planning report produced it. Commits solved exactly this with the `Serves:` trailer.

## THE PLAN, in order — written down before any of it moves

1. **Rename `Test` → `Test`.** Mechanical: 51 files, 33 spec files, 41 markdown mentions
   (`::test{Test.X.y}` chips inside claims on approved RFCs — a change of FORM, not of
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
5. **The retirement TRIGGER — whether a consumed-by pointer can fire it instead of the clock.**
   The lifecycle itself needs nothing: a report reaches `retired` and nothing else, claims or no
   claims. What is left is one mechanism, and it is shared with the forensic argument.
6. **`spec-authoring` STAYS, and a report skill can never replace it.** His ruling, and it rests on
   a distinction worth keeping: **a spec is a runnable ARTIFACT** — a `::test` chip or a `:::run`
   block — and **a report is a DOCUMENT that requires one.** A report skill can demand a spec, name
   which shape to reach for, and refuse prose in its place; it cannot teach anybody to write the
   thing, because probing the method, asserting against the real shape, staying inside the operator
   grammar and checking it would FAIL on a regression are its own procedure with its own ways of
   being wrong. *"There's no way, in my mind, that a report writing skill can replace a spec
   writing skill."*

   **AND THE SKILL'S JOB IS HOW TO THINK, NOT WHAT COUNTS.** *"They need help in thinking about how
   to write. I'm not talking about when to write it… you're over here saying things like command
   line is not this and that. Who cares? I don't want them to hesitate."* The failure is not a
   loose vocabulary, it is NO SPEC — an agent deciding the thing was hard to check and writing a
   paragraph. Specs are expected to grow toward cmds and UI queries later, so a skill that polices
   the words today is a skill that teaches hesitation.

   **The model is buAPI, and it is neat because the assertion is cheap:** a path into the real
   response and the type it owes (`results.Tournaments[0] → object`). No assertion code, no mocks —
   `Before` builds the world with REAL calls, `Main` calls the method under test, `After` clears up.
   Test-side logic lives in a `Plugin` module via `systemview-plugin`, never in a door.

**AND THE COUNT THIS THREAD ASKED FOR IS MOOT, for a different reason than it looked.** It proposed
settling "skill or doctrine" by observing whether a spec gets SET OUT TO WRITE or OWED. A spec is
only ever owed — but what is owed is the ARTIFACT, and the skill that writes it is not the skill
that writes the document around it.
::::

::::thread{id=t5 sent=systemview-test:1waxp17}
**2026-11-02 — RETENTION IS AN EVIDENCE QUESTION, AND CLAIMS ARE NOT RFC FURNITURE.** Argued to a
landing across one conversation; t4's rail table was corrected in place by it. This thread is the
work order.

**1 · THE REFRAME, and it is his: a report's window answers "how long could this be EVIDENCE",
never "how long is this worth reading."** The old numbers were set on the reading question, which
assumed somebody reads every report — and that assumption is dead by design: *"if the system is
gonna move and automate, then I can't just really look at all reports. The reports are there for
when things go wrong, then we can look at the report, point them back to the commit, points back to
the report, you know exactly what we were doing."* A report is the forensic partner of a commit.
The diff survives forever; the REASONING survives nowhere else.

So the reframe changes two things and the second is the one that makes agents better at this: the
NUMBERS, and the REASONS under them. An agent choosing a window can weigh *"how long could this be
evidence"* against the work in front of it. It cannot weigh *"how long is this interesting."*

**2 · THE NUMBERS, proposed, each with the reason that justifies its own number.** The inversion
worth noticing: the report whose conclusions GRADUATE into a durable document can expire fast; the
report that is the only record of why something happened must last.

| subtype | now | proposed | why that number |
|---|---|---|---|
| `planning` | `24h` | `24h` | unchanged, and for the reason the chapter already gives: its conclusions leave it for an RFC or an arc, and those are permanent. Its successor carries it, so the table is furniture within a day |
| `account` | `24h` | `30d` | WRONG TODAY. Set on the reasoning that its durable facts are already in the commit — but a commit carries WHAT changed, and the account is the only artifact carrying WHY, what else was tried, and what went unverified. 30d is "long enough that a thing which goes bad can still be traced back through it" |
| `brief` | `6h` | `7d` | `6h` was read off the handover being live, and `3d` in the page data was already a second answer. Forensically a brief is the only record of why an agent was told THAT shape — which is what explains a lane that built the wrong thing. But it is superseded as evidence the moment the lane's own account exists, so it is the clearest case for a DERIVED retirement (§5) and the number is only a backstop for a lane that never came back |
| `audit` | `7d` | `7d` | unchanged, and it is the one case where letting go is cheap: it carries the command that REGENERATES it. A stale count re-runs; it does not need keeping |
| `spec` | `30d`–`permanent` | unchanged | already right, and the most load-bearing of the five — nothing else records why unscheduled work happened at all |

**3 · A REPORT HAS NO RAIL — see t4, corrected.** It reaches `retired` and nothing else, claims or
no claims. His words: *"that's why it's a report. So it can't have that life cycle. It can only go
to a retired. So even if it has its claims, it's just a record so we could follow it back."* A rail
belongs to something that SERVES something else; a report serves nothing, it IS the record. This is
also what saves the clock: an unmarked claim is honest and never a gate, so a report waiting on a
press to retire would sit forever.

**4 · `retain=` IS DOING TWO JOBS, which is why longer windows feel like they would bury him. HIS
TO SETTLE AT THE WINDOW, IN REAL TIME, WITH REPORTS IN FRONT OF HIM — not an item anybody builds
from this document.** It
says how long a report EXISTS *and* how much it wants his eyes — one dial. His problem, in his
words: *"I need reports to really stand out for me to have to look at."* Longer retention without
splitting those makes the window worse, not better. The system already holds half the answer: the
hub stamps `openedAt` (first open), so it already knows what he has never looked at.

**5 · THE CONSUMED-BY POINTER IS ONE MECHANISM SERVING THREE NEEDS.** The forensic walk-back
(commit names report, report names commit), the derived retirement trigger (an audit is over when
its findings LEFT), and the archive that needs no drawer row: *if the commit points at the report,
the report does not need to be FOUND by browsing* — reachable by address is enough. That dissolves
the filter problem: window long, visibility low, found by pointer. `Serves:` on commits is the
shape that already works.

**6 · CLAIMS — THE DEFINITION IS SCOPED WRONG, AND IT IS MEASURED, NOT ASSERTED.** Asked the store
the exact question an agent with no RFC would ask (*"I did work nobody scheduled and there is no
RFC — how do I write a claim"*): three of four hits came back under the breadcrumb `rfcs.md › RFCs
— a design you can check later`, and the top chunk opens *"A claim is one statement of something an
approved design committed to"* and *"Nothing is a claim before the verdict."* The agent that says
"there is no RFC" is told by the most authoritative chunk that what it has is not a claim.

**AND THE FIX IS A SCOPING FIX, FULL STOP — THE DEFINITION SAYS WHAT A CLAIM IS AND NOTHING ABOUT
WHEN ONE IS WRITTEN.** The procedures answer when: `rfc-authoring` and `rfc-execution` make sure an
RFC's claims exist, the report-writing skill makes sure a report's do. Any rule in the definition
phrased as a MOMENT is both misplaced and wrong on the facts — nothing freezes, because specs and
software adapt to each other on the owner's decision. The RFC's own "nothing before the verdict" is
a step in the RFC procedure, never a property of claims.

**OPEN, and his:** whether claims can live on ANY report or only on a spec. Not settled.

**7 · SO: NO `claim-authoring` SKILL.** His conclusion and mine, reached from opposite directions.
The doctrine comes OUT of `rfcs.md` into its own chapter with the widened definition; `rfcs.md`
keeps only what is genuinely RFC-specific — nothing before the verdict, the completeness press, the
claims list under the verdict, `STATUS`; and `rfc-authoring` §5 + `rfc-execution` point at the new
chapter with a query instead of carrying copies. Three places hold claim doctrine today, which is
the drift this system keeps paying for.

**And `spec-authoring` STAYS** — see t4's plan, item 6, which was overturned where it stood. A
spec is a runnable artifact and a report is the document that requires one, so `report-authoring`
REQUIRES a spec and points at `spec-authoring` to write it, the same way it points at the chapter
for which kind to file. Two artifacts, two procedures, one pointer between them.

**8 · AND A DRIFT FOUND WHILE CHECKING THE NUMBERS.** `notice` is alive in four places in
`src/organisms/HowWeWork/howWeWork.data.js` — the lifecycle card list, the subtype line, a
`retired` paragraph, and a full `retain: "2d"` row — after being cut from the chapter, `Report.js`
and `AGENTS.md`. *"Shouldn't exist anywhere then."* The same file carries a SECOND copy of the
retention table, already stale against the chapter: planning `7d`, account `14d`, audit `3d`, spec
`7d`. Whatever the numbers become, that is two places to write them, which is the argument for one
place and a pointer — the fix `AGENTS.md` already took.

**9 · A RECEIPT'S CLAIMS ARE A DIFFERENT PROCEDURE, AND HERE IS THE MECHANISM.** His: *"the way
RFC explains claims is for RFCs… when writing a spec report they need to write claims their way,
because it's different"* and *"there was never a planning section."* An RFC's claims come out of a
two-phase structure — argue, then build — and a receipt has no first phase, so the requirements are
not the same ones. One practical consequence worth naming, because a step answers it: the same agent
writes the work and then its claims, so the list can be fitted to whatever already passes. Step 5 is
what answers that.

The spine:

1. **Say what the work was FOR** — the one line no RFC existed to say, and nothing else records.
2. **Claim from the DIFF, not from memory** — memory selects for what worked.
3. **The forensic test, per claim:** if this breaks in 30 days, does this sentence tell somebody
   what it was SUPPOSED to do?
4. **Runnable evidence on every claim** — the reader cannot ask you and will not press anything, so
   an `experiential` claim here is near worthless unless it ships the screenshot with it.
5. **The anti-fitting move, already built and with no caller here:** a blind pass handed the diff
   ALONE and asked *what should this be claiming* — so the list is not quietly shrunk to what
   passes. `second-opinion.md` names this exact case.
6. **No approval and no completeness press.** There is no contract, so the document must not wear
   one: an RFC's completeness press exists because a missing claim is a behaviour we AGREED not to
   check, and a receipt completes no agreement. Its honesty comes from the proof.

**AND THE CONSEQUENCE OF NOBODY PRESSING IT:** on an RFC the MARK is the product — met/unmet is what
the document is for. On a receipt the mark may never come, so **the claim has to be useful
unmarked**: the value lives in the sentence plus something runnable, never in a state anybody sets.
Which is the same fact as "a spec report is consumed by being RUN".

**10 · A REPORT IS FOR WORK WITH NO DURABLE DOCUMENT BEHIND IT — which is most of why the other
kinds feel thin.** RFC execution has the RFC: `rfc-execution` §4 says *"Then the report, **in the
chat**"* — the reply, not a filed document — and the durable record is the STATUS heading, the
marked claims, and each slice's commit carrying `Serves:` back to it. Arc work has the arc; a gap
has the gap. None of them needs a receipt, and filing one would be a second copy of a record that
already exists. **Proactive and board-sized work has NOTHING** — no design, no objective, no gap,
only a commit, and a commit says what changed and never why. That is the whole reason the spec
report exists, and why forensics is the right frame for it and not for the others.

**11 · THE SEQUENCE, HIS — THE PRODUCER CHOOSES THE KIND, THE SKILL WRITES THE REPORT.** A producing
skill or job does not decide how to write a report; its closing step is two moves in order: (a)
CHOOSE the kind from corpus knowledge — `context("which report kind should I file, and why is its
window that length")`, which is a lookup and already measured — then (b) invoke the report-writing
skill to actually write it. Corpus first because the kind decides what the writing owes.

**AND THE SEAM THAT KEEPS IT FROM ROTTING:** the SKILL owns the ORDER and the irreversible bits —
attach before the write that closes the run, because `attach` is refused on a closed one — and says
*"attach what your kind owes"* with the query. The CORPUS owns the per-kind facts, beside the window
and the reason already living there. A table of what-attaches-what inside the skill would be a
second copy of something the chapter wants, which is tonight's `notice` and double-retention-table
lesson for the third time.

**12 · THE READER IS BUILT AND NOBODY WAS EVER TOLD TO WRITE THE RECORD.** `commitLinks` already
reads BOTH directions and reports only disagreement (claim 3 below, proven on 200 real commits), so
the mechanism is not missing. The INSTRUCTION is: `::commit` is named in five skills and a job, and
the reports chapter never mentions it once — its only commit-adjacent line is the `Serves:` trailer,
which is the commit pointing at the document. So the half a person actually walks when something
breaks at 30 days — open the report, follow it to the commit — depends on records nothing tells
anybody to write, read by a tool that has been waiting for them. That is why it belongs in the
chapter's per-kind table (item 1) and in the skill's steps (item 4), not in a new mechanism.

**AND THE MISS IS MINE, TWICE OVER.** Tonight's commits carry no `Serves:` trailer either —
`506c727`, `afe4dbb7`, `bf062a61` on top of the five already named below. Adding one to a commit
that exists is a history rewrite and his, so the honest fix is forward-only: every commit from here
carries it.

**THE FRAME FOR THE SKILL, HIS: *report writing is about forensics.*** Not which kind to choose
and not what-I-did — you are writing for an INVESTIGATOR, not a reader. Every requirement argued
tonight derives from that one line instead of carrying its own reason: attach the commits (the
walk-back), say plainly what you could NOT verify (an investigator needs to know where the evidence
stops), set the window by evidentiary life, state what the work was FOR (motive), and prefer
something runnable to prose (a transcript is not evidence). It is also why "here's what I did"
reports always read as worthless: that is a narrative, and forensics does not want one.

### THE WORK ORDER — EXECUTED 2026-11-02/03

Ordered by dependency: items 1–2 are the doctrine the rest points at, which is why they landed
first. **Every item carries what it produced**, so this section is both the plan and the index to
it — nothing about this work lives only in a chat that scrolls.

**1 · The reports chapter, rewritten on the EVIDENCE question.** `187e232a` · `d7d663f0`
:file[docs/how-we-work/reports.md] · :file[agents/AGENTS.md]

Every reason states its own number, because a chunk retrieves alone. `account` 24h→**30d** (the only
record of WHY a landing happened), `brief` 6h→**7d** (superseded by the account of the work it
commissioned), `audit` stays **7d** (it carries the command that regenerates it), `spec` stays
**30d–permanent**. `planning` is **7d** and it is the one window that is NOT about evidence: its
disposition is the thing still open, and the window is room for the people in it to decide —
promote it to permanent and link it to what it produced, extend it, or let it go. A day was a chore,
not a decision window. The chapter also gained what it never had: **what each kind ATTACHES**,
including the `::commit` records it never mentioned once.

**2 · The claims chapter — written, not lifted.** `ac3bbad4`
:file[docs/how-we-work/claims.md] *(new)* · :file[docs/how-we-work/rfcs.md] *(558 → 164 lines)*

The definition is new — *a sentence that makes something checkable by somebody who WASN'T THERE*,
every property derived from that, nothing about when. The craft and the whole proof doctrine MOVED
INTACT and then got de-scoped at six seams where they still assumed an RFC. `rfcs.md` keeps the two
things that are an RFC's alone. Three pointers out, no copies.

**3 · The receipt's own claim procedure.** `64c21549`
:file[docs/how-we-work/reports.md] *(§ Writing a spec report's claims)* ·
:file[docs/how-we-work/second-opinion.md]

Five requirements answering one problem: the same agent wrote the work and now writes its claims, so
the list can be fitted to whatever already passes. The fifth is a blind pass handed the DIFF ALONE.
`second-opinion.md` listed a report as never owed one, for two reasons false in exactly this case —
the exemption was narrowed and the caller added, both sides in one pass.

**4 · The skill.** `53b58789`
:file[~/.claude/skills/report-authoring/SKILL.md] *(new, 155 lines)* · :file[agents/tests.md]

Forensics is its opening. It owns the ORDER and the irreversible bits; the per-kind facts stay in the
corpus. Trigger eval: 3 passes, 20 queries, 100%/100%, eight negatives going to the right neighbour.
**No behaviour eval.** `report-authoring` REQUIRES a spec and points at `spec-authoring` to write
it. Two facts that existed ONLY in that skill were moved into `tests.md` while it was briefly being
retired, and they belong there regardless: a `:::run` block's grammar parses only `=`, `~`, `>=`,
`<=`, and a hang has no per-test deadline.

**5 · Nine producers wired to choose-then-invoke.** *(no commits — see the bound below)*
:file[~/.claude/skills/code-audit/SKILL.md] · :file[~/.claude/skills/system-audit/SKILL.md] ·
:file[~/.claude/skills/context-maintenance/SKILL.md] ·
:file[~/.claude/skills/codebase-refinement/SKILL.md] · :file[~/.claude/skills/assignment/SKILL.md] ·
:file[~/.claude/skills/doc-maintenance/SKILL.md] · :file[~/.autobot/jobs/arc-development/job.md] ·
:file[~/.autobot/jobs/proactive-development/job.md] ·
:file[~/.claude/skills/rfc-execution/SKILL.md] *(the EXEMPT one)*

Choose the kind from the corpus, then invoke the skill. `rfc-execution` is explicitly exempt and
says so where somebody would otherwise reach: an RFC execution has the RFC, and its account is the
chat reply.

**6 · The consumed-by pointer — WRITTEN AND AWAITING HIS PRESS.** `a09158cf`
:file[RFCs/RFC-077-a-document-says-which-report-it-came-out-of.md]

One attribute, `from=<source id>`, mirroring the relation `arc=` already is. The piece most worth
rejecting is §3.3 — whether consumption should affect retirement at all, or whether `from=` stays a
pure pointer. Claims come only after the verdict.

**ALSO TOUCHED, because one fact gets one home:** :file[docs/how-we-work/registration.md] — the
cross-repo `::commit{project=}` rule, filed beside the commit doctrine rather than in the reports
chapter.

#### What is NOT in the list, and what the list could not do

**The two-axis split (§4) is HIS**, deliberately off it: `retain=` conflating how long a report
exists with how much it wants his eyes is to be settled at the window, with real reports in front of
him. Nobody should design it from in here.

**HALF OF THIS HAS NO HISTORY.** Neither `~/.claude/skills` nor `~/.autobot` is a git repo, so item
4's skill and item 5's nine files sit on disk with nothing to revert to — which is also why
`spec-authoring` was never deleted during the hour it was considered retired, and that turned out to
matter: it was un-retired, and a deletion would have been unrecoverable.

**THE MEASUREMENT WORTH CARRYING FORWARD.** A `context()` search shows only the first **~450
characters** of a chunk, and the cap does not move with `limit`, `source=` or rephrasing. Three blind
subagents hit it on three different TABLES and all three answered correctly BY INFERENCE — which is
what makes it dangerous, because the eval reads as a pass. Three sections were rewritten to answer in
their opening prose.

**AND ONE ITEM WAS MARKED DONE WHEN IT WAS NOT.** The How-we-work page carries a second copy of the
retention table, and a test pinned it as *"the windows the agent guide tells agents to reach for"* —
so the page said planning 7d, account 14d, audit 3d, brief 3d, spec 7d while the guide said something
else, and the suite asserted the stale set. Closed in `d7d663f0`, and the 14-day ceiling that test
enforced moved to 30 with the reason it exists written down.

::::

- [x] **`gap-authoring`** :file[~/.claude/skills/gap-authoring/SKILL.md] · 94 lines

  **The question:** gaps are now in `proactive-development`'s queue. Does this skill know that?

## Group 3 — last, because they encode whatever we settle

- [x] **`skill-authoring`** :file[~/.claude/skills/skill-authoring/SKILL.md] · 409 lines — and its §8 is the open design question: the run law is
  PASTED into all 23 skills, which is how one wrong block became 22 wrong skills today. Paste, or a
  pointer and a retrieval query?
- [x] **`skill-maintenance`** :file[~/.claude/skills/skill-maintenance/SKILL.md] · 176 lines — the pass that finds the bad step. It reads the run
  records, so it cannot be judged until the jobs above are producing honest ones.
- [x] **`spec-maintenance`** :file[~/.claude/skills/spec-maintenance/SKILL.md] · 173 lines — **WRITTEN TONIGHT, so it is in this walk as a new
  document rather than a reviewed one.** The pass over the permanent specs at all three grains — an
  arc's objective against the claims its plans produced, a claim against the behaviour it names, a
  fold against the method it points at. Its spine is the AUTHORITY CALL: the pass does not update
  documents to match code, it decides per finding whether the design *moved by decision* (the spec
  and its prose adapt) or the code *moved by drift* (the claim is authoritative and the finding is a
  gap against the code), and the test that separates them is whether anybody ever agreed to the
  change. It is the only pass here that RUNS things — `runProofs` — so its findings arrive as results
  rather than readings, and its outputs mostly SUBTRACT: a claim whose spec is dead has its mark
  taken off with `mark(state=unmet)`, which is the valuable outcome and not the embarrassing one.

  **Trigger eval, 6 passes, 20 queries: 97% positives · 100% negatives.** All nine near-miss
  negatives went to the right neighbour by name — `spec-authoring` twice, `rfc-execution`,
  `gap-authoring`, `context-maintenance` twice, `skill-maintenance`, `rfc-authoring`,
  `doc-maintenance` — which is the half of this instrument that stays meaningful whatever the
  positives do. One positive came in weak at 4/6 (*"this claim on rfc-073 says met and i'm not
  convinced anything behind it still runs"*), and **the description was left alone deliberately**:
  4/6 is inside the ±15pp noise floor, the shipping bar is no positive missing on EVERY pass and no
  negative firing at all, and that query names ONE claim — a job small enough that a session reading
  it directly instead of opening a whole maintenance pass is defensible rather than wrong. Editing
  always-loaded characters to chase a number that cannot move is the trap §6 exists to name.

  **The questions:** its hardest step — *does the spec still test what the CLAIM says* — has no
  instrument and never will; it is a reader's judgment, which is the whole reason this is a
  procedure. It has **no behaviour eval**, so nothing yet says it makes an output better. And the near-settled queue it is built to drain does not exist as a surface: a document
  can say what state it is in and not how FAR it is from the next one, which is the piece of his
  idea with no mechanism behind it.

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
| | `report-authoring` | 155 | ✓ (rewritten 11-02, unwalked) |
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

- [x] **`how-we-work-tour`** :file[~/.claude/skills/how-we-work-tour/SKILL.md] · 168 lines — states that `::cue{call="…"}` is *"designed, NOT WIRED — renders
  honest, plays nothing."* **It is wired.** `cuePerform.js` imports `callCommand` and `AgentChat.js`
  executes it; `nav`, `act` and `refresh` all run from inside a sequence. A skill teaching that a
  live verb is dead costs the one thing cues were built for — a walk that does its own navigating
  and therefore replays from anywhere.

*(more as the walk turns them up)*

## What has landed against this report

**2026-11-01, the log stopped calling a fault a document update** — the night the walk's first
findings landed in code rather than in prose. A block whose render failed reported nothing after a
reload, and a fault row in his log was drawn in the delivery indigo, so the one row that needed to
catch the eye looked like traffic.

::commit{sha=17afd2c6 project=systemview-test}
::commit{sha=7a819b72 project=systemview-test}
::commit{sha=5d47fa58 project=systemview-test}

**2026-11-02, the reports layer's second night** — `notice` removed from the How-we-work page data,
three test fixtures and two comments (`afe4dbb7`); the registry loop closed so a document deleted by
the janitor loses its row (autobot `506c727`, `reapMissing` had no caller); corpus audience
re-verified live after his restart — withheld corpora are NAMED, `corpus:"<name>"` still reads any
of them, all sixteen audiences intact. **t5 is this night's argument and its work order.**

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

**2026-11-02, later the same evening — the definition work** — the chapter the walk kept needing
and did not have: what a claim IS as distinct from when one is written, the window as the answer to
how long something could still be evidence, and the run-block grammar's limit said out loud
including that a hang has no deadline.

::commit{sha=bc0b6c67 project=systemview-test}
::commit{sha=d2bf2d6c project=systemview-test}
::commit{sha=74697ca7 project=systemview-test}
::commit{sha=187e232a project=systemview-test}
::commit{sha=ac3bbad4 project=systemview-test}
::commit{sha=64c21549 project=systemview-test}
::commit{sha=53b58789 project=systemview-test}

Also landed, in the autobot repo, so outside this document's own git window: `588e0f5` (members
and objective owners on the registry row), `bba4b9a` (`rfc` and `gap` as attachment kinds),
`74dbce9` (a report registers wherever it is written), `2f6df6d` (the watcher says when it did not
start). Hub side: `0bfc583e` (the registry's member filter).

**2026-11-03, the wrapper service got its name and a claim got its obligation** — the longest of
the walk's nights. The test-side surface became `Test` with its `Plugin` module, two gap documents
carrying the old service name were brought along, `spec-authoring`'s retirement was overturned
where it stood rather than argued about elsewhere, and a claim learned to say which obligation it
is under and when it is unproved — which is what the walk had been circling for two days.

::commit{sha=d7d663f0 project=systemview-test}
::commit{sha=355c2c63 project=systemview-test}
::commit{sha=40e2e544 project=systemview-test}
::commit{sha=85da4ef3 project=systemview-test}
::commit{sha=1adb8328 project=systemview-test}
::commit{sha=b5c5a9e7 project=systemview-test}
::commit{sha=4edd9881 project=systemview-test}
::commit{sha=0df8eef2 project=systemview-test}
::commit{sha=7744d5f0 project=systemview-test}
::commit{sha=d20aba0c project=systemview-test}
::commit{sha=f4cc7cc5 project=systemview-test}
::commit{sha=0ab0f45f project=systemview-test}

**2026-11-04, the claim card and the ladder stop reading held** — the two surfaces that could say a
claim was defended when nothing defended it, plus the spec pass that finds the same disease in
documents nobody is looking at. Every commit carries `Serves: The walk — jobs, then authoring`.

::commit{sha=b277cb5e project=systemview-test}
::commit{sha=7e250584 project=systemview-test}
::commit{sha=e0fce8ea project=systemview-test}
::commit{sha=249ff06c project=systemview-test}

What those four changed, in order: the claim card's two kinds became distinct by hue instead of by a
fade that made both of them quiet; the card's green left edge now needs a real spec, because a
`:::cmd` proves `met` and never buys HELD — measured at 42 of RFC-076's 45 claims wearing a full
green edge directly above their own `no spec` chip; the RFC facilitation ladder names its spec debt
on the settled step and hands over no button while any of it stands, which is the one refusal in
that ladder and rests on a distinction worth keeping — **a claim's mark is his, and `settled` is not
his to press**, because no signature makes a missing spec exist; and the fourth undoes a
consolidation nobody asked for.

**`spec-maintenance` IS NOT IN ANY COMMIT**, and that is not an oversight: `~/.claude/skills` is not
a git repository, so every skill in this system lives outside version control and a skill edit has
no diff anywhere. The file is the only copy.

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
- **EIGHT COMMITS NOW CARRY NO `Serves:` TRAILER** — the five named above plus `506c727`,
  `afe4dbb7` and `bf062a61`. `commitLinks` reads this document as linking one way, which is the
  convention's first real miss and it is mine, compounding. Fixing a commit that exists is a history
  rewrite and his; the forward rule is that every commit from here carries the trailer.
- **The MCP's `report=` is live and proven end to end.** After his restart, a board `add` carrying
  `report=planning` came back with `"report": "planning"` from the hub — the parameter survives the
  MCP, the hub door and the file. The panel's pills write the same field.
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
