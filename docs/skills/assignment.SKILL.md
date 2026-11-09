---
name: assignment
description: Put work he hands over under the NUDGE until it is finished, and KEEP yourself there — a worklist run sourced `assignment:<name>`, his words on the whiteboard, everything you take on afterwards joining the same open run. Use it the MOMENT work arrives in passing — however small it looks, and even when you are about to do it right now: "do this for me", "I need you to…", "take care of X", "sort out Y", "while you're at it…", "don't forget…", "make sure that gets done", anything handed over for later or while he is out. Starting the work without opening the run is the exact failure this prevents: unheld work is work he has to remember for you. Also use it when he asks what you still owe him, when he tells you to drop or forget something he gave you, or when he says to use the assignment skill. Do NOT use it to write a job document for unattended or hook-fired work (job-authoring), to hand work to subagents in lanes (delegation).
---

# Assignment — work he handed you, held to

**THE POINT IS THE NUDGE.** A worklist write carrying a source opens a run the system watches, and a
session that goes quiet with one open gets nudged until every item is done. That nudge is the only
mechanism that keeps a task alive past the moment it was given — so an assignment with no run is a
sentence that scrolled past, and this skill exists to make sure one is open.

**THE SOURCE IS `assignment:<name>`** — a kind of run in its own right, with its own tab in the
drawer, its own switch in the worklist settings, and the long retention a job and a lane get,
because an assignment has an artifact somebody may come back to.

**IT USED TO BE `skill:assignment`, and the reason is worth keeping:** `assignment:` was an invented
prefix that nothing read — written to disk, no row, never nudged — and a run sourced
`assignment:run-the-proofs` sat four-of-thirteen and unheld for eleven days on 29 October because of
exactly that. The fix at the time was to use a prefix the system knew. The fix now is that the
system knows this one: the kinds are data (`runKinds.cjs`), and the tab, the switch, the retention
window and the sourced-write door's own advice all derive from that one list. Runs already open
under `skill:assignment` keep working — `skill:` is still a kind — so nothing has to be migrated.

A **job** is a written procedure, given. A **board card** is a fact nobody scheduled. An assignment
is a task handed over in passing, on context you already hold — cheap to give, easy to lose.

**AND BEING ON ASSIGNMENT IS A STANDING STATE, NOT ONE ERRAND.** His framing: *"Being on assignment
doesn't always mean you have to have a specific thing. Being on assignment just means that you set
yourself up so that you keep working. Everything you do goes on assignment."* So the run is not a
container for one deliverable that closes and goes away — it is the thing that keeps you working at
all, and **while it is open, every piece of work you take on joins it.** New work he hands over is
appended to the list you already have; a thing you discover mid-task becomes another item; a surface
you decide to fix because you tripped over it goes on too. Opening a second assignment for the next
sentence he says is the mistake — there is one open run, and it grows.

That is also why a deliverable is OPTIONAL here. §2 asks you to declare an ending because an
assignment that produces something should decide what, before you are the party with an interest in
the answer being cheap. It is not a requirement that every assignment have one. Standing work — keep
this honest, keep that current, keep going — is a legitimate assignment with no artifact at the end,
and its run stays open because the work does.

## Executing this skill

**The worklist is how this skill starts, advances and finishes.** Not a log written afterwards: the
system reads the list to know whether the procedure was followed, and this skill is complete when
every item on it is done — nothing else marks it complete.

1. **Before step 1**, put your plan for this run on the worklist with `source: "assignment:<name>"` —
   the real steps you are about to take, named for the work in front of you, covering the steps
   below without transcribing them. A copied-out procedure records nothing; a list of what you are
   actually doing shows how you read it, which is where a misread becomes visible before the output
   is wrong. `job:`, `skill:`, `lane:` and `assignment:` are the prefixes YOU write. There is
   a fifth the system reads — `correction:`, written by the assign verb when work is handed to
   ANOTHER agent, never chosen for a list of your own. Any other prefix is written to disk, draws
   no row, and is never nudged, so it runs unheld and invisible.
2. **Mark one active** as you reach it and **done** as you finish it. `set` REPLACES the whole
   list, so send every item every time — one omitted item is one deleted item. A list written once
   and never moved is indistinguishable from a procedure abandoned at step 1.
3. **The list is yours — every item is work you do.** Human confirmation is not on it: a step only
   somebody else can check off never reaches done, so the procedure could never complete.
4. **Attach what the run produced BEFORE the write that finishes it** — `attach({kind, ref})`, by
   address, never a path. The write that marks the last item done CLOSES the run, and `attach` is
   refused on a closed one, so the order is not style: attach late and the run is a finished
   procedure pointing at nothing.
5. **A run ends exactly two ways.** Every item done — or `attach` the account and then
   `status("abandoned — <why>")`. There is no third. A status of "blocked" does not stop the
   nudging, and neither does stopping quietly: an open run is nudged until it closes or is
   declared. If the work is genuinely waiting on him, that IS the abandoned path — say what it
   waits on and from whom, and reopen it later by writing the list again under the same source.
6. **If you stop early, leave the list where it stopped.** Do not tidy it, and never mark an item
   done to quiet a nudge. Where a procedure dies is the single most useful thing it can tell
   anyone — declare it (5) rather than dressing it.

## 1 · Keep his words — on the WHITEBOARD

His sentences, verbatim, on the `whiteboard`. Not in a worklist item: items are steps, and a
paragraph of his speech crammed into one makes the list unreadable while the words it was meant to
preserve sit in a field nothing displays whole. The whiteboard is prose, renders live beside the
chat, and survives a compaction — which is the whole job here, because an assignment has only what
he said. Your summary degrades across a boundary; his meaning does not. His phrasing is rough
because he talks — keep it rough.

The worklist carries the STEPS. The whiteboard carries the ASSIGNMENT.

## 2 · The ending is the WORK, and you declare the artifact that proves it

**An assignment ends when the thing he asked for works — built, running, and seen.** Not when you
have described it, planned it, modularised it, or written the decisions it would need. The
deliverable below is the RECEIPT for that; it is never a substitute for it, and a line in the chat
about unbuilt work is the cheapest possible lie about a finished assignment.

So before the deliverable, name the **done test**: the sentence that says what he will be looking at
when this is finished. *"The lane row says what the lane is for and he can watch it run."* Put that
on the list as its own item. It is the only item that cannot be satisfied by producing a document.

Three things that are NOT done, each of which has been shipped as done here:

- **A pure module nothing renders.** Decisions with tests and no surface is a half he cannot see.
  Wire it, or say out loud on the list that it is unwired and why that was forced.
- **A plan, a report, or a walkthrough of either.** Presenting the design of a thing while the
  thing does not exist is the most convincing way to deliver nothing.
- **"Waiting on him."** Only real when the answer is genuinely his and you cannot proceed without
  it. **A description is not a blank.** If he told you what he wants — follow it, pull it out,
  show me the branch and the work — that is a specification, and treating it as a question you are
  owed an answer to is how an assignment stalls on a decision he already made. Where he left room,
  fill it with your best judgment and say which part was yours.

**Then the artifact, decided now**, because one chosen at the end is whichever was cheapest and you
are the party with an interest. Pick the lightest one that is still real:

- **a line in the chat** — he can judge the answer in one breath (fine for an assignment that was
  a QUESTION; never for one that was work)
- **a board card** — `board({projectCode, add, title})`: what you found is a fact for later
- **a report** — the account, when it is long or carries choices. Choose the kind
  (`context("which report kind should I file, and why is its window that length")`), then invoke
  `report-authoring` to write it — the assignment does not describe the report's shape
- **a commit offer** — a `::commit` block, the press his. The usual ending for built work

Say which you took in one `::ask`-free sentence. Ask once at most, name your default, and if he does
not answer, take it — asking twice teaches him to stop reading.

## 3 · Work it, keeping the list moving

One item active, done as each lands, new items added when the task turns out bigger than his
sentence implied. **Blocked goes on the list as what you are waiting for** and the run stays open —
a blocked assignment is still owed.

**And the done test from §2 is the last item, always.** Mark it only when you have SEEN the thing
work — his window read, the surface photographed, the command run. Everything above it can be true
while the assignment has produced nothing he can use, which is exactly the state this item exists
to make visible.

## 4 · Close it — attach the ending to the run

Deliver what §2 declared, then **`attach({kind, ref})` it to the run** — by ADDRESS, never a path: a
report name, a branch, a card. An assignment that closes with nothing attached leaves only your word
that anything was produced.

**What gets attached depends on whether the work needs proving.** An assignment that answered a
question attaches its report or card. An assignment that BUILT something attaches the proof — the
spec, the test, the branch — because prose about working code is the weaker artifact when a
runnable one exists.

Then one line: what landed and what it did not cover. You wrote the items, so you also defined
done — that line is what makes your own completion answerable rather than asserted.

Then mark every item done. That closes the run and stops the nudge; nothing else does.

## 5 · When he calls one off

`status("abandoned — he called it off")` **with the artifact attached**. The word alone does not stop
the nudging and neither does quietly marking everything done, which claims work that never happened.

When he asks what he is owed, read the runs back (`worklist get`) and answer with the **oldest** open
one first, in his words, one line each.

## Done when

- A run exists under `assignment:<name>`, nudged, with his words on the whiteboard
- The ending delivered is the ending declared, and attached to the run
- One line says what landed and what it missed
- Every item is done — or the list sits where it stopped, or carries `abandoned` with an account
