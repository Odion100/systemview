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

## The clock measures his attention, not wall time

**It does not start until he first opens the report.** An unread report has spent none of its
window, so a job that finishes at 3am is still waiting whole at nine. The window answers *how long
is this interesting after it has been read*, never *how long does he have to get to it*.

Two consequences worth knowing before picking a number:

- **A short window is safe on unattended work.** `6h` on something filed overnight does not evaporate
  before anyone sees it.
- **DIVERT is the answer to "it is still live", not a bigger number.** Restarting the clock from now
  is one press and it is honest; widening the window declares the report more durable than it is.
  A planning report under active discussion gets diverted for days and still says `24h`, which is
  true: it is a backstop, not a lifetime.

## Which kind, and how long it lasts

`as=` and `retain=` are **one decision**. The kind of account this is already implies how long it
stays interesting, and picking them apart is how a report ends up `as=account retain=90d` — one
sitting's account on the drawer for three months.

**Both attributes are required.** A leaf missing either derives `state.invalid` — *no subtype* or
*no retention* — and says so on the row, in the drawer, and on the document itself.

| when you are writing one | `as=` | what it carries beyond the basics | `retain=` |
|---|---|---|---|
| a design conversation, before there is a plan | `planning` | the argument, the choice made, what is most worth rejecting | `24h` |
| an unattended job's sitting | `account` | what landed, what it could not verify | `24h` |
| a run that was **abandoned** | `account` | why it stopped, and what the next person picks up from | `6–12h` |
| a code or architecture audit | `audit` | the count, the method, the tree state it counted against | `7d` |
| work handed to another agent | `brief` | the problem, the constraints, the measured facts — no sketch | `6h` |
| a spec with living proofs | `spec` | the claims, and evidence that still runs | `30d`–`permanent` |

**The vocabulary is OPEN** (RFC-076 §2 — the picker carries a free field, so `as=` is a vocabulary
rather than an enum). A scenario that is genuinely none of these takes a new word and the report says
why in its own first screen. What the openness is not is licence to invent a synonym for a row that
already exists.

**`notice` was cut, and the reason is the one that matters here.** A brief sits ABOVE a notice and
captures it: anything a notice could carry, a brief carries with the context that makes it
actionable. A flag with nothing to act on is a chat line or a board card, and both are cheaper than
a file somebody then has to retire.

## Why each window is the length it is

The numbers are his. The reasoning is what makes them pickable by somebody who was not in the
conversation — and each one is written to **arbitrate**, because a reason that cannot choose between
two defensible actions is decoration.

### Why a planning report is 24h

**It dies when its conclusions LEAVE it.** It is finished when it became an arc, a
plan or a spec — not when it is well written. So `24h` is a backstop and DIVERT is the instrument:
while the planning is live, restart the clock; when the conclusions land somewhere durable, let it
go. The thing this rules out is widening the window because the discussion is taking longer than
expected.

### Why a sitting's account is 24h

**Its durable facts are already elsewhere.** The objective
carries its own state on its own block, each commit carries the `Serves:` trailer naming what it
served, and the links can be re-derived at any time. A day later the report is a second copy of
facts the documents hold better — and a job firing nightly on a longer window grows a folder nobody
reads.

### Why an abandoned run's account is SHORTER, not longer

This reads backwards until you ask what the account is FOR. It is a live blocker: urgent today, worthless
by Friday, because by then somebody picked the work up or the ground moved under it. A week-old
*"stopped, waiting on his press"* is noise on a surface whose whole value is that everything on it
is outstanding.

### Why an audit is 7d, and what it owes inside that

**An audit is a count, and a count is stale the moment anybody commits.** `7d` is generous for the
number and it is not the point: the point is that the FINDINGS have to leave inside that window.
An audit whose findings exist only inside the audit is a run of work that expires. So an audit's
own procedure owes a step that empties it — into gaps, cards, or an RFC.

### Why a brief is 6h

**It exists for work in flight.** Work handed over either starts within the
hour or the brief was wrong about what mattered. It is also the window with the most legitimate
DIVERT: while the lane stands, the brief is live.

### Why a spec outlives everything else

**It is the special one and it earns the length.** It is the structure added to loosely-scoped
work so the work can be VALIDATED instead of asserted — *"come back, you say this was done, I get to
run the specs."* That is why it outlives the sitting that produced it, and why it is the one kind
where `permanent` is not automatically a smell: the proofs still run, so the document is still
doing work rather than describing a moment that has passed.

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

```markdown
::report{id="<Title>" as=<subtype> retain=<window|permanent>}
```

**Then attach it to the run that produced it** — `attach({kind: "report", ref: "<the report's
name>"})`, by address and never a path, before the write that closes the run. A document on disk
with nothing pointing at it reads as work with no account.

**Navigating to it is separate and optional.** `nav({projectCode, report})` puts it in front of a
person who is there; an unattended job at 3am writes the file and leaves it, because taking his
screen for a report nobody asked to see is the one thing unattended work must never do.

## Nobody re-describes this

A report is almost never the thing anybody set out to do — it is the TAIL of something else: a job's
handover, an audit's output, a planning session's conclusion, an abandoned run's account. So the
skills and jobs that produce reports **point here**, carrying only the decision they have already
made (*"it is an `account` at `24h`"*) so the agent acts correctly without looking anything up, plus
the query so the depth is one call away.

What they must not do is restate the table. Two copies of a lifecycle drift, and the copy in the
document nobody runs is the one that goes wrong quietly.
