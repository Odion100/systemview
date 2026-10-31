::report{id=closing-the-loop as=planning retain=permanent}

# Meeting — closing the loop, so work commits itself

::members{who=systemview-test sent=systemview-test:1187ftf}

What we come out with: the rule for how automated work lands — commits, branches, and the record
that lets any of it be undone — written down well enough that an RFC can be built from it. Not an
arc. Arcs are one of the two things this loop has to carry, and they are not set up yet.

**Where this file is:** `/Users/odionedwards/Systemly/systemview/meetings/2026-10-30-closing-the-loop-work-that-commits-itself.md` — absolute, because members live in
different repos. Read the file; this document is the state, never the summary you were sent.

## Goals

His, verbatim, 2026-10-30:

> "We got the infrastructure set up. Now what we really need to do is automation complete — put a
> procedure that allows you to commit, which I already have."

> "You can work on full automation if we follow our system. We're going to be working from arcs,
> RFCs. And when we're not working on an arc, RFC is going to be a gap. And if it's not, if it's
> just proactive development, then it's the report."

> "Even if anything goes wrong, you could easily track it back down to where it was committed. The
> commits will probably refer to the RFCs, the claims, and the claims may even log the commits and
> the specs and all that stuff, vice versa."

> "The skills will instruct. All of this is a skill for filing a report. There's a skill for RFCs,
> for a gap — that makes sure that the system is updated, the documentation, specs are required."

> "How do we structure our work as far as commits, like branches, whatever? The work can just get
> done. You can make the commits following this system. At the same time, we probably want to make
> it easy to undo things."

> "I don't need to approve every commit unless I'm working with you directly. So there's proactive
> development and there's arc development — two automations. You gotta close the loop."

> "We're not doing arcs until arcs are set up. This is not a new arc."

> "We'll take it one step at a time and we'll make it better and better over time."

## Current landscape

### "How do we structure our work as far as commits, like branches, whatever"

Where the project is. **Lanes are the only branch mechanism and they are opt-in.** A lane is three
things — a branch, a worktree, and a `worklist set` carrying `source: "lane:<branch>"`, which is
what draws its row (`agents/runs-lanes.md`). Nothing cuts one automatically. Everything else lands
straight in the working tree and waits for a `::commit` press, which is the only commit door in the
window (`api/index.js`; there is deliberately no `systemview commit` CLI verb).

The failure mode is measured, not theoretical: **fifty lanes stood for nine to twelve days with
their work never brought in**, and the retention janitor swept their run records, which unregistered
them and put them beyond the only verb permitted to clear them. A lane is invisible until somebody
brings it in, so a lane per task builds a queue nobody drains.

**How it might work.** Automated work lands on **main**, one commit per **slice**, and `git revert`
is the undo. Slices are already defined as "what lands together" and are argued in the RFC before
any code exists — they are the only landing boundary this system has ever named, so making them the
commit boundary costs nothing and gives a revert that is clean by construction. Lanes stay for work
that might be thrown away: an experiment, a second attempt, anything the agent itself is unsure of.

**Plans.**

**systemview-test** — the commit door already takes a message and a file set; what it does not take
is an ADDRESS. Add `rfc=` / `claims=` to the commit path (`api/index.js`, `CommitBlock.js`) so the
subject is composed rather than typed, and so the same call can write the sha back. Nothing new
stored: the document is the record.

::::thread{id=commit-shape subscribe=systemview-test}
For telling the room about the landing rule — main vs lane, and what a commit is allowed to contain.
::::

### "The commits will refer to the RFCs, the claims — and the claims may log the commits, vice versa"

Where the project is. **One direction exists and the other does not.** A commit message is free
text; nothing composes it and nothing reads it. A claim's mark carries `state=`, `by=`, `at=` and
`note=` (`src/atoms/Markdown/claims.js`) and has no field for a commit. So a revert today leaves
every claim that commit met still reading green over code that no longer exists — the document
lies, silently, and nothing anywhere can notice.

**How it might work.** Two halves, and the second is the one that pays. The commit subject carries
the address it closes. The claim's mark carries `sha=`, written by the same press that writes
`state=met`. Then a revert can **un-mark** exactly the claims that commit met, and "track it back
down to where it was committed" is a grep of the document rather than an archaeology of git.

**Plans.**

**systemview-test** — `sha=` on the claim line, written through `attrBag.setDirectiveAttr` like
every other attribute; `claimsOf` reports how many marks carry one. The un-mark on revert is the
harder half and probably belongs to a verb, not a hook — a revert nobody announced must still be
catchable, which means reading the log rather than listening for an event.

::::thread{id=two-way-record subscribe=systemview-test}
For telling the room about the link between a commit and the claim it closes.
::::

### "Two automations — proactive development, and arc development"

Where the project is. **Arc development is a job and it is live** (`~/.autobot/jobs/arc-development`),
never measured — its behaviour evals are an open board card. Proactive development has a skill and
no loop: nothing schedules it, nothing bounds what it may land, and nothing says when it should stop.
The nudge machinery that would drive either (`electron/agents/nudge.cjs`) watches an open run and
chases the agent; it has no notion of "this work is finished and committed."

**How it might work.** The two automations differ in exactly one place — **where the work comes
from** — and should differ nowhere else. Arc development takes an objective; proactive development
takes a gap or files a report. Both then run the same closing procedure: build, mark the claims,
commit the slice, write the sha back. That closing procedure is one skill, used twice, which is what
stops the two automations drifting into two systems.

**Plans.**

**systemview-test** — the closing procedure as a skill before either automation calls it, so the
first caller is not also its author. It is the piece that must exist first.

**autobot** — the run has to be able to end in "landed", which it currently cannot say. A run that
committed and a run that was abandoned are indistinguishable to `nudge.cjs` today.

::::thread{id=two-automations subscribe=systemview-test sent=systemview-test:xr3d5y}
For telling the room about where work comes from and what both automations share.
::::

### "If it's not an arc or an RFC it's a gap; if it's just proactive development, it's the report"

Where the project is. **All four kinds register and three of the four have a skill** — `rfc-authoring`,
`rfc-execution`, `arc-planning`. A gap has a lifecycle (open → resolved | rejected → retired) and no
authoring skill; filing one is described in `how-we-work/registration.md` and nothing walks you
through it. A report has `report-authoring`, and reports are fleeting by design — no leaf, never a
report.

**How it might work.** The kind is not a filing decision, it is a consequence of where the work came
from, and the skills should say so rather than each re-deciding: an objective → its plan is an RFC;
a defect found while doing something else → a gap, written into the repo the fix lives in; work
nobody scheduled that produced a finding → a report. The one that is missing is the gap skill, and
it is the one an automation hits most, because a defect found in passing is the commonest thing an
agent produces.

**Plans.**

**systemview-test** — `gap-authoring`, and an amendment pass over the other three so each one ends
at the same closing procedure instead of its own ending.

::::thread{id=which-kind members=systemview-test|autobot sent=systemview-test:1f2j8ez|autobot:1f2j8ez}
For telling the room about which kind a piece of work becomes, and which skill owns it.
::::

### "I don't need to approve every commit unless I'm working with you directly"

Where the project is. **The press is the only commit door and it never lifts.** `::commit` is
written by the agent and pressed by the human — stated as doctrine in `markdown.md`, and the
absence of a commit CLI verb is deliberate. Nothing anywhere distinguishes a commit that was
traceable from one that was not; the message is free text and no caller composes it.

**How it might work. The door is open — that is the decision, not a condition to be detected.**
Agents commit. He presses when he is working with me directly because he likes to, which is a
preference he exercises, not a gate the system protects. An earlier draft of this section had it
backwards: it tried to make "is he present" a state the system reads, which would have built a
lock out of a thing he was explicitly unlocking.

**What makes it safe is the LINK, not his attention.** A commit that names the claim, the spec or
the RFC it closes can be tracked back the moment anything goes wrong — which is the whole reason
the door can open at all. So the requirement moves from *who was watching* to *what does this
commit point at*, and the thing to refuse is a commit with no address, whoever made it and whoever
was in the room.

**And there is no commit skill.** The instruction belongs in the skills that already own the work —
`rfc-execution` when a slice lands, `gap-authoring` when a defect is fixed, `report-authoring` when
proactive work produces a finding. Each one ends by committing with its address attached. A
separate skill for "how to commit" would be a fourth place for the rule to drift, and the agent
reaching for it is already inside one of the other three.

**Plans.**

**systemview-test** — the address has to be composable rather than typed, or it will be typed
wrong: the commit path takes what it closes and builds the subject, and writes the sha back onto
the claim in the same call. That is the same mechanism as the section above, which is not a
coincidence — the two-way record IS the permission.

::::thread{id=the-door-is-open sent=systemview-test:a4xmr9|autobot:a4xmr9 subscribe=systemview-test}
For telling the room that agents commit, and what a commit must carry to be allowed to.
::::

## Objectives, as they become definitive

## Arcs

## What we learned on the way

::::thread{id=bugs sent=systemview-test:1jqt6sb|autobot:1jqt6sb subscribe=systemview-test}
Anything that did not work, the moment it did not work. One line, by whoever hit it.
::::

::::thread{id=procedure sent=systemview-test:17p63rd|autobot:17p63rd subscribe=systemview-test}
A move that worked and should happen again, named precisely enough to be a step in a skill.
::::
