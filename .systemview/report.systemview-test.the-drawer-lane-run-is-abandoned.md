::report{id="The drawer lane's run is abandoned where you stopped it" as=account retain=12h}

`lane:lane/drawer-work-in-flight` has been nudging at 1/8 since you stopped its builder. This is the
account that ends the run — **not the lane**, which still stands for your word.

::members{who=systemview-test}

## What the lane was for, in your words

> I would make it all about the worklist. Work in flight. Not about dashboard shit, which I already
> have on an amazing dashboard.

So the band's drawer loses its document tabs and becomes runs, lanes, jobs and the whiteboard. Eight
items, in landing order, ending in a commit on its own branch.

## Where it died, and what exists

**1/8.** The first item — reading `bandTabs.js` and the band region of `AgentChat.js` — is done. The
item that was active when you stopped it is the cut itself: `BAND_KINDS`/`bandTabs` minus the
document tabs. **Nothing was committed**, so the branch holds no work: `lane/drawer-work-in-flight`
sits at `90c87fd8`, the base it was cut from, with a worktree at
`~/Systemly/lanes/systemview/drawer-work-in-flight`.

That is the whole state. A branch with no commits reads as "merged" to every derivation, which is why
the row says *can't tell — files moved on since it was cut, 0/2 match* rather than claiming the work
is in. It is not in. It does not exist anywhere.

## Why the run cannot be driven to done

Two of the remaining seven items are judgments you already reserved: you stopped the builder
mid-flight, and whether the lane is **cleared or respawned** is the thing the blocked card asks you.
Respawning is a fresh delegation — a new brief, a new builder — and starting one on my own say-so
after you stopped the first is the opposite of what stopping it meant.

So the run is abandoned in the exact sense the word is for: nobody is driving these items, and the
next move is not mine. The list is left at 1/8 with item two still active; nothing was marked done to
quiet the nudge.

## The mechanical reason it kept nudging, and it is the same one twice

A run is excused from nudging by the word `abandoned` **plus an attachment whose kind is `report`** —
`nudge.cjs excusedOf`, measured and written up in *the tour run closes with an account, because a card
is not one*, filed minutes before this. This run carried a status that did not start with the word and
no account at all, so it was never excused.

**And neither run could be reached until it was reopened.** `attach` and `status` act on a run *this
session opened*; a run written under another identity — a lane's own agent, a skill's — nudges here
and answers nothing here. The way through is the one the doctrine already names: write the list again
under the same source, which reopens the run, then attach and declare. Both of these were closed that
way, and the list sent back was the list verbatim.

## What stands after this

- **The lane** — worktree, branch, and its row — until you clear it or respawn the work.
- **The blocked card**, which carries the ask and outlives this document's 12 hours.

## This account's own commit

::commit{sha=PENDING}
