# Reports

## A report is a document that goes away

That is the whole of it, and every other rule here answers to it. Reports exist so work can be
written down **freely** — a plan argued out, an audit counted, a job's night accounted for — without
any of it becoming a commitment somebody has to maintain. His framing, and the reason the kind
exists at all: *"we need to be able to plan, we need to be able to do this, but those documents need
to go away."*

So a report is a **view**: it describes a moment, it only gets older, and the system retires it. The
freedom and the expiry are the same fact. A report nobody has to keep is a report anybody can write.

**Which makes a report that needs to live forever a smell, not a feature.** If it has to persist, it
was another kind of document wearing a report's leaf — a decision belongs in an RFC, a body of work
in an arc, a bug in another repo in a gap, a durable fact in a note or a handbook. Writing it as a
report and then fighting the clock is the failure mode, and the fix is never a longer window.

**Anything durable inside a report has to be written somewhere durable before the window closes.**
That is a step, not a hope: the audit's findings become gaps or board cards, the planning report's
conclusions become an arc or a plan, the lesson becomes a note. What is left in the report is the
account of the moment, which is what expires harmlessly.

## The window answers how long this could be EVIDENCE

**Not how long it is worth reading.** That distinction decides every number below, and it exists
because most reports are never read: the system runs unattended, nobody can read all of it, and a
report's real job is to be there when something goes wrong. Then you open the report, it points at
the commit, the commit points back at the report, and you know exactly what was being done.

So a report is the forensic partner of a commit. **The diff survives forever; the reasoning survives
nowhere else** — a commit message says WHAT changed, and what else was tried, what was ruled out and
what went unverified exists only in the account. Ask *how long could somebody need this as evidence*
and the number falls out of the work. Ask *how long is this interesting* and you will pick something
too short, because prose stops being interesting long before it stops being evidence.

**This does not soften the rule above it.** A report still goes away, and a report that must live
forever is still another kind of document wearing a report's leaf — evidence has a finite useful
life, and a trace nobody maintains is not a commitment. Findings still have to leave for gaps and
cards, conclusions still have to land in an arc or a plan. What stays behind is the account, and it
expires harmlessly a month later rather than a day later.

**The clock still measures his attention, not wall time.** It does not start until he first opens the
report, so an unread one has spent none of its window and a job that finishes at 3am is still waiting
whole at nine.

Two consequences worth knowing before picking a number:

- **A short window is safe on unattended work.** `6h` on something filed overnight does not evaporate
  before anyone sees it.
- **DIVERT is the answer to "it is still live", not a bigger number.** Restarting the clock from now
  is one press and it is honest; widening the window declares the report more durable than it is.
  A planning report whose argument is still running gets diverted and still says `7d`, which is
  true: it is a backstop, not a lifetime.

## The five kinds, and the window each one takes

`as=` and `retain=` are **one decision**. The kind of account this is already implies how long it
stays interesting, and picking them apart is how a report ends up `as=account retain=90d` — one
sitting's account on the drawer for three months.

**Both attributes are required.** A leaf missing either derives `state.invalid` — *no subtype* or
*no retention* — and says so on the row, in the drawer, and on the document itself.

| when you are writing one | `as=` | what it carries beyond the basics | `retain=` |
|---|---|---|---|
| a design conversation, before there is a plan | `planning` | the argument, the choice made, what is most worth rejecting | `7d` |
| an unattended job's sitting | `account` | what landed, what it could not verify, and a `::commit` record per commit | `30d` |
| a run that was **abandoned** | `account` | why it stopped, and what the next person picks up from | `6–12h` |
| a code or architecture audit | `audit` | the count, the method, the tree state it counted against | `7d` |
| work handed to another agent | `brief` | the problem, the constraints, the measured facts — no sketch | `7d` |
| a spec with living proofs | `spec` | the claims, the evidence that still runs, and a `::commit` record per commit | `30d`–`permanent` |

**The vocabulary is OPEN** (RFC-076 §2 — the picker carries a free field, so `as=` is a vocabulary
rather than an enum). A scenario that is genuinely none of these takes a new word and the report says
why in its own first screen. What the openness is not is licence to invent a synonym for a row that
already exists.

**AN ACCOUNT CARRIES NO `::claim` BLOCKS.** His ruling, 2026-11-07, after three accounts in one
night carried them: a claim is a CONTRACT — an id, a state, co-signatures, a bar that counts it —
and nobody is a party to a sitting's account. What an account owes is a statement of what ran and
what it said, which is a table and the command that reproduces it. Claims belong to the documents
that make commitments: an RFC, a spec report, a gap's resolution.

**A flag with nothing to act on is not a report.** If all it does is tell him something happened, it
is a line in the chat or a card on the board — both reach him sooner and neither has to be retired
afterwards. What makes a file worth writing is that it carries enough to ACT on, and that is a
`brief`.

## Which kind to choose — why each window is the length it is

**The best way to know which kind to file is to consider why each window is the length it is.** Ask
how long what you just did could still be needed as EVIDENCE, and the kind falls out of the answer —
a question about the WORK, which you can weigh. Asking "what is this" instead invites the label that
sounds like what you wrote.

The numbers are his. The reasoning is what makes them pickable by somebody who was not in the
conversation — and each one is written to **arbitrate**, because a reason that cannot choose between
two defensible actions is decoration.

### Why a planning report is 7d — the window is the DECIDING

**It is the only kind whose DISPOSITION is still open, and the window measures how long the people
in it have to decide what becomes of it.** Planning is potential: it has not become anything yet,
and the legitimate endings are several — promote it to `permanent` and link it to what it produced,
extend it because the argument is still running, or let it go because the conclusions landed in an
arc or a plan. `7d` is room for that decision.

A day is not a decision window, it is a chore: it forces a press on every live argument, which
teaches people that divert is maintenance rather than an instrument.

**It is evidence too, and that is not what sets the number.** A planning report holds the argument —
what else was considered, what was rejected, why the shape is the shape — and the plan it became
holds only the conclusion. So when a design turns out wrong months later, *"what did we look at and
turn down"* is answerable here and nowhere else. That makes the window a genuine question rather
than a formality, and it is still not the thing the number measures: for the other four, how long
something could be EVIDENCE is what sets the window. Here, what sets it is how long the deciding
takes.

**It is still finished when its conclusions LEAVE it** — when it became an arc, a plan or a spec and
carries the pointer to what it produced. That is the condition; `7d` is the backstop under it, and
DIVERT is what handles the case where the deciding is taking longer than a week. What this rules out
is a planning report sitting for a month because nobody looked at it: the decision is the work, and
a window that never pressures it never gets one.

### Why a sitting's account is 30d

**It is the only record of WHY, and `30d` is how long a landing can still be the suspect.** The
account's facts are not already elsewhere, which is the thing that looks true and is not: the
objective carries its state, each commit carries `Serves:` and its diff — and none of them carries
what else was tried, what was ruled out, or what the run could not verify. When something goes bad
three weeks later, that is exactly what you need, and the walk is report → commit → report.

So the arbitration this settles: a nightly job's account is NOT the same category as a chat summary.
`30d` rather than `24h` because a day is shorter than the time it takes for a bad landing to show
itself, and NOT `permanent` because after a month the code has moved and the account is describing a
tree that no longer exists. If the folder growing worries you, that is the janitor's job and not the
window's.

### Why an abandoned run's account is SHORTER, not longer

This reads backwards until you ask what the account is FOR. `6–12h`, against the sitting's `30d`:
it is a live blocker, urgent today and worthless by Friday, because by then somebody picked the work
up or the ground moved under it. A week-old *"stopped, waiting on his press"* is noise on a surface
whose whole value is that everything on it is outstanding.

**And the evidence argument does not reach it**, which is what keeps `6–12h` honest next to a
sitting's `30d`: an abandoned run landed nothing, so there is no commit anybody will ever
investigate and nothing to walk back from. It is a request, not a trace. The moment it DID land
something, it is a sitting's account and takes that window instead.

### Why an audit is 7d, and what it owes inside that

**An audit is a count, and a count is stale the moment anybody commits.** `7d` is generous for the
number and it is not the point: the point is that the FINDINGS have to leave inside that window.
An audit whose findings exist only inside the audit is a run of work that expires. So an audit's
own procedure owes a step that empties it — into gaps, cards, or an RFC.

**The evidence question leaves `7d` where it is, and this is the one case where letting go is
cheap:** an audit carries the command that REGENERATES it. A stale count is not lost evidence, it is
one re-run — so there is nothing to preserve that the tree will not answer again on demand. Compare
an account, where the reasoning exists nowhere but the file.

### Why a brief is 7d

**It is superseded by the account of the work it commissioned, and `7d` is a backstop for the lane
that never came back.** As a reading document it outlives the handover by nothing — work handed over
either starts within the hour or the brief was wrong about what mattered. As EVIDENCE it has one job
the account cannot do: it is the only record of what an agent was ASKED for, which is what explains
a lane that built the wrong thing.

That makes it the clearest case in this chapter where the clock is standing in for a state the system
could derive — a brief is finished when its lane's account exists. Until that pointer exists, `7d`:
long enough for a lane to come back and be compared against what it was told, short enough that a
brief for work nobody ever started does not sit for a month. DIVERT is still the answer while the
lane stands.

### Why a spec outlives everything else

**It is the special one and it earns the length.** It is the structure added to loosely-scoped
work so the work can be VALIDATED instead of asserted — *"come back, you say this was done, I get to
run the specs."* That is why it outlives the sitting that produced it, and why it is the one kind
where `permanent` is not automatically a smell: the proofs still run, so the document is still
doing work rather than describing a moment that has passed.

**And it is the most load-bearing of the five on the evidence question**, which is worth saying
plainly because it is not obvious: a spec report is a receipt for work NOBODY SCHEDULED. There is no
design, no objective and no gap behind it — so unlike every other kind, nothing else in the system
records why that work happened at all. Lose it and the only trace is a commit, which says what
changed and never why.

**Reach for `30d` anyway, and keep `permanent` for the spec that is a project artifact** — one that
lives in `RFCs/` and is pressed by people who were not there. A spec written for one piece of work
is still a report, and a report that never expires is furniture with a proof attached. The short
window costs nothing: the clock starts at the first open, and DIVERT restarts it from now.

## What each kind attaches — the records that let somebody trace the work back

**EVERY REPORT OVER WORK THAT LANDED ATTACHES ITS COMMITS — a `::commit{sha=}` record each** (an
`account` and a `spec` always; a `planning` report attaches the arc or RFC its conclusions became, an
`audit` the command that regenerates its count, a `brief` its lane's branch). A report that names no
commit cannot be walked back to, which is most of what a report is for.

The two-pointer convention is not this chapter's — a commit carries a `Serves:` trailer, the document
says it back with a `::commit{sha=}` block, and `commitLinks` checks the two against each other:
`context("how does a commit say what it served, and how does the document say it back")`. What is
this chapter's is WHICH report owes which attachment.

| `as=` | what it attaches |
|---|---|
| `planning` | the arc or RFC its conclusions became — the report is finished when that pointer exists |
| `account` | a `::commit` record per commit, plus `::file` chips for what was touched and what could not be verified |
| `audit` | the `:::cmd` that regenerates the count, and the gaps or cards its findings left for |
| `brief` | the lane's branch (`::branch`), so the brief and the work it commissioned are one press apart |
| `spec` | a `::commit` record per commit, and the proof on each claim — a `::test` chip or a `:::run` block |

**The skipped half is always the same one.** The trailer gets written because it rides the commit you
are already making; the record in the report gets forgotten because by then the work feels done. Say
it as the walk it enables: *something breaks weeks later, you open the report, follow its commit
records into the diff.* A report with prose and no shas makes a reader start over in `git log`.

## Writing a spec report's claims — the receipt's way, not the plan's

**A spec report carries claims, and they are not written the way a plan's are.** The craft is shared
and lives in one place — `context("what is a claim and what does its proof owe")` — but a plan's
claims come out of a two-phase structure, argue then build, and a receipt has no first phase. The
work already happened. Which produces one practical problem and five requirements that answer it.

**THE PROBLEM: the same agent wrote the work and now writes its claims, looking at what it built.**
So the list can be fitted to whatever already passes — not by dishonesty, just by writing down the
parts you happen to have checked. Nothing about the form prevents it, so a step has to.

1. **Say what the work was FOR, in one line.** No design and no objective exists to say it, and the
   commit says what changed and never why. If the report says nothing else useful, it says this.
2. **Claim from the DIFF, not from memory.** Read what you actually changed and state what it should
   now do. Memory selects for what worked.
3. **Per claim, the forensic test:** *if this breaks in thirty days, does this sentence tell somebody
   what it was supposed to do?* That is the question the whole document exists to answer, and a claim
   that fails it is a claim about your afternoon rather than about the system.
4. **Runnable evidence on every claim.** The reader cannot ask you and will not press anything, so
   `kind=experiential` is close to worthless here unless it ships the screenshot with it — on a plan,
   experiential works because the human was in the conversation and will look.
5. **One blind pass, handed the DIFF alone**, asked *what should this be claiming?* — then reconcile
   against your own list, visibly. This is the step that answers the problem above, and it is the
   case `second-opinion.md` already names: a judgment where one of the answers serves the agent
   making it. `context("when is a second opinion owed and how do I ask for one blind")`.

**NO APPROVAL AND NO COMPLETENESS PRESS.** An RFC's completeness press exists because a missing claim
is a behaviour both parties AGREED not to check; a receipt completes no agreement, so a press there
would be theatre. Its honesty comes from the proof.

**AND THE CLAIM HAS TO BE USEFUL UNMARKED.** On a plan the mark is the product — met or not met is
what the document is for. On a receipt the mark may never come, because nobody reads most reports. So
the value sits in the sentence plus something runnable, never in a state somebody sets. Which is the
same fact as: a spec report is consumed by being RUN, where every other kind is consumed by being
read.

## What every report carries, whatever kind it is

- **The answer first.** The finding, the outcome, the number — in the first screen. Method and
  evidence follow it, so a reader who stops early still leaves with the truth.
- **Evidence, not testimony.** `::file` chips to what was touched, `::test` and `:::cmd` blocks a
  reader can press, the measured number beside the claim. A sentence that cannot point at anything
  is the weakest line in the document.
- **What was NOT done or verified**, named. Being exact there is what makes the rest believable;
  a report that omits is a report that lies.
- **A decision that is his at the TOP**, never the last paragraph, where it gets made by default.
  `::question` or `:::approval` where his answer is the next step.

## The file, the leaf, and the pointer

The file IS the report. There is no filing verb: writing the document with its leaf is what registers
it, and the registry finds it by that leaf wherever it lives — beside the work, with the arc, in
`.systemview/`.

```
.systemview/report.<projectCode>.<slug>.md
```

**AND IT IS COMMITTED, like any other document in the repo.** Reports used to be kept out of git on
the reasoning that a thing which expires should not be in history — which had it backwards: a
report is the account of work that happened in that repo, and the repo is where somebody looks for
it. What made keeping them out feel necessary was the fear of a folder growing forever, and that
fear is answered by the janitor rather than by `.gitignore`: it sweeps any registered document
whose leaf says `retired=`, so a report deletes ITSELF and the deletion is a change to commit like
any other.

So the ignore rule is narrow — the reports are in, the machine state around them (chats, history,
manifests, comment sidecars, and his board, which is his) stays out.

```markdown
::report{id="<Title>" as=<subtype> retain=<window|permanent>}
```

**Then attach it to the run that produced it** — `attach({kind: "report", ref: "<the report's
name>"})`, by address and never a path, before the write that closes the run. A document on disk
with nothing pointing at it reads as work with no account.

**Navigating to it is separate and optional.** `nav({projectCode, file})` puts it in front of a
person who is there; an unattended job at 3am writes the file and leaves it, because taking his
screen for a report nobody asked to see is the one thing unattended work must never do.

## Nobody re-describes this — and the two moves that replace it

A report is almost never the thing anybody set out to do — it is the TAIL of something else: a job's
handover, an audit's output, a planning session's conclusion, a receipt for work nobody scheduled. So
a producing skill or job does not carry its own account of how to write one. Its closing step is two
moves, in this order:

1. **CHOOSE the kind, from here.** `context("which report kind should I file, and why is its window
   that length")` — one phrasing, everywhere, chosen by measuring: it returns the choosing section at
   0.78 where phrasings that read just as well return the table, or the pointer that points here. A
   producer may carry the decision it has already made inline (*"it is an `account` at `30d`"*) so the
   agent acts correctly without looking anything up.
2. **Then WRITE it** — the report-writing skill, which owns the order and the irreversible bits
   (attach before the write that closes the run) and branches on the kind you just chose.

**Corpus first, because the kind decides what the writing owes.** An agent that reaches for the
procedure before the decision has to be told the per-kind facts twice, and a table that lives in a
skill as well as here is two copies drifting — the copy in the document nobody runs is the one that
goes wrong quietly. So the division is fixed: **the facts are here, the order is in the skill.**
