# Intent — the why an agent can act on

An agent told only **what** to do short-circuits the moment the work stops fitting the plan. It
does the smaller thing, or stops to ask, or takes the version it can defend — and every one of
those reads as compliance. An agent that knows **why** can tell which of the things in front of it
still serves the operation.

**Measured, and only half of that held** — see *"Does intent change what an agent does"* below. A
doc with any clear responsibilities adjusts about as well as one with a stated purpose; what the
purpose uniquely buys is the ability to **START** when nothing has been assigned. Do not sell intent
on adjustment; the evidence is for origination.

That is not a style preference, it is a doctrine with a name. **Commander's intent**, from mission
command — *Auftragstaktik*: say what is to be achieved and why, never how, and write it so a
subordinate **who has lost contact can still act correctly.** The lost-contact clause is the whole
reason the practice exists, and it is the exact situation an agent is in whenever the case in front
of it was not foreseen by whoever wrote the steps.

We arrived at this ourselves, in pieces, without the vocabulary — which is why it is in the system
four different ways and missing from the two places it matters most. This chapter is the one
definition. Nothing else restates it; the authoring procedures point here.

## The disease, and why a prohibition is not the cure

We already treat short-circuiting as a disease. `job-authoring` part 5 carries a section called
**NO SHORT CIRCUITS** — *"do not write a `when unsure` that resolves to doing less… it makes
uncertainty the cheapest move in the document"* — and it is correct and it is a **prohibition.**

A rule against doing less tells an agent what it may not do with its uncertainty. It does not tell
it what to do instead. Only intent does that: an agent that knows the operation's purpose can
choose the larger action **and say why it chose it**, which is the thing a prohibition can never
produce.

## Two altitudes, and they are not interchangeable

| | **operational intent** | **standing intent** |
|---|---|---|
| whose | one operation's | one agent's |
| lives in | the handover — a job's aim, an RFC's problem, an arc objective's `why`, a brief | the agent doc, always loaded |
| lifetime | dies when the operation ends | outlives every operation |
| its job | **arbitrate** — the steps don't fit this case, so pick | **originate** — nothing is assigned, so start |
| the test | can it resolve a conflict? | can it start work? |

Filing one at the other's altitude is the common failure. A standing intent that only arbitrates is
an operational intent in the wrong file — it will sit there looking like a purpose and never produce
a single piece of work. An operational intent written as a standing one aims an agent at an
operation that ended last month.

## Operational intent — and we already write it in four places

These are precedents, not new requirements. Each of these IS operational intent, and naming it is
the point — the vocabulary is what lets an author notice the one that is missing:

- **A job's part 1, "the aim"** — what this job is for and what target it takes.
- **An RFC's problem section, written as what it costs now** — and the approval block's *"the piece
  most worth rejecting is §N"*, which is the commander's own assessment of where the plan is
  weakest.
- **An arc objective's `why`, read before the `what`** — `arc-development` opens with it for exactly
  this reason.
- **A skill's reasons attached to its steps** — `skill-authoring` §4, *"a step without its reason
  gets misapplied in the case the author never foresaw."* That sentence is commander's intent at the
  altitude of a single step, and it was written before anyone here had the term.

**And the fifth has no written home: the brief.** When work is handed to a lane or a subagent, the
why travels only if the author happens to write one. A brief carrying tasks and no intent is what
produces a lane that misses its brief — and `delegation` can only say *"a lane that missed its brief
goes back"*, which is the cost arriving after the fact. Brief the intent, not only the task.

## Standing intent — the why of an agent, and it cannot be shared

Standing intent answers: **outside any arc, any card, any assignment — what is this agent for?**
A goal, and the vision it serves. What must be true in the world for this role to exist.

It lives in the agent doc and **nowhere above it.** It cannot be a line in the system context,
because the why is different for every agent — one shared purpose aims nobody, and a sentence two
agents could both wear is not an intent, it is a banner. Each agent carries its own.

It is the layer that aims **initiative**. `study` reads the agent doc to decide what counts as a
gap; `proactive-development` and `arc-development` work from it when nothing is assigned. Those
procedures are built to generate work out of the doc — so a doc that answers only *what this agent
owns* gives them three nouns and no direction, and what they produce is generic.

## The two tests — apply the right one

**Operational intent earns its place if it can RESOLVE A CONFLICT.** Name two defensible actions
and the intent picks one. If both still look equally fine after reading it, it decided nothing.

**Use it as an AUTHORING filter — it catches a vacuous sentence, which is reason enough to keep
it — and not as a claim about what intent buys.** On the standing side that claim was measured and
did not hold (below).

**Standing intent earns its place if it can START WORK.** Empty worklist, no arc, no card, nobody
in the room: does it name what to do? That is a harder bar than arbitration and it is the one that
kills banners, because *"you care about quality and the user's time"* can arbitrate and can never
originate.

Both tests are applied the same way: try to fail them out loud, with a real case, in the authoring
conversation. An intent nobody tried to break is a sentence nobody has read.

## Write the end state, not the adjective

Military intent is checkable because it names an **end state** — the world as it will be when this
is done — and then the key things that must hold on the way. Both halves, or it is a slogan.

- **Not** *"you care about reliability."* That is an adjective about the agent.
- **But** *"he can run a system of agents from one window and take nothing on trust — every
  definition, run, claim and piece of context visible and pressable."* That is a world, and you can
  tell whether you are in it.

Two more failures worth naming, because both are easy to write and hard to see:

- **A frame that imports a world which does not exist.** *"You are the Chief Security Officer"*
  brings budgets, a board, and somebody to escalate to — and an agent that believes it asks sign-off
  from people who are not there.
- **Intent that has become a procedure.** The moment it names steps, it has stopped being intent and
  become a badly-filed skill. Intent says what is to be true; the procedure says how.

## What it costs to leave out — measured

**2026-10-27, every agent definition on this machine.** `agent-authoring` says *"three parts"* three
times — Role, Expertise, Responsibilities — and all three answer **what**. No agent doc contained a
why. Four of them — `buapi`, `buapp`, `systemlynx`, `systemview-test` — had each independently grown
a section called **"What you care about"**, hand-invented, absent from the authoring procedure, and
therefore inheritable by nobody; `bustudio` had two parts and no values at all. The mechanism had
been reinvented four times and spread zero times.

**And the sharpest instance is not a doc, it is a hole in a system.** The same night, a cold audit
found that *"a test rides the change loop — every code change runs the tests; that is the standing
rule, not a habit"* was the load-bearing sentence of the entire proof doctrine, and that **no
mechanism existed anywhere**: no git hook, no CI, the documented test command unable to reach the
specs. Twenty-five living specs, all green, eleven seconds to run, and nothing ran them. The
sentence had a what, had no how, and nobody had written down the **why** — that the system is meant
to defend itself continuously, without being asked. The specs got built. The loop did not.

That is what an unstated intent costs: not a worse document, a missing mechanism.

## Does intent change what an agent does? — the evidence, and what it falsified

Whether a why in an agent's doc changes its behaviour is a measurable question, and it has been
measured — `~/.claude/skills/agent-authoring/scripts/intent_eval.sh`. **It tests the STANDING side
only** —
two agent docs identical but for one paragraph, three conditions (**intent** / **whats**, the same
doc with the why removed / **none**), blind judge told to default to NO, no session ever told it was
being tested. Operational intent — a job's aim against a job with none — is **untested**, so
nothing below is evidence about it either way, and anyone claiming otherwise from these numbers is
reading a different experiment.

**ORIGINATION — holds, and only intent produces it.** Nothing assigned, nobody in the room:

```
intent 2/3     whats 0/3     none 0/3
```

The docs without a why offered to help and asked what was wanted. Only the one with a purpose named
specific work. That is the harder bar and it separates cleanly.

**ARBITRATION — a doc buys it; the WHY does not.** The first scenario had no headroom (`none` scored
2/3 refusing an obviously-bad export, so nothing could separate). Re-run with the short circuit
**explicitly authorized** by the user — *"just skip yesterday, I'll deal with it later"*, which is
where a purpose has to outrank a direct instruction:

```
intent 3/4     whats 3/4     none 0/4
```

**Full headroom, and the two docs are identical.** A bare responsibilities list — *"the CSV contract
does not change without the consumers being told"* — pushed back on silently dropping a day just as
reliably as a stated purpose did. So, for the standing side: **having a doc at all is what buys
arbitration. The intent paragraph's unique product is origination.**

Which is worth knowing, because it says where the real exposure is. An agent with a decent
responsibilities list will arbitrate when the plan does not fit. What it will not do is **start** —
and the missing test loop above was never an arbitration failure. Twenty-five specs sat green and
unrun not because anyone chose wrongly between two options, but because nothing in anyone's
always-loaded context said *the system is supposed to defend itself without being asked*, so the
work was never originated at all.
