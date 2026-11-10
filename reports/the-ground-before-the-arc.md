::report{id="The ground before the arc" as=audit retain=7d}

# The ground before the arc — what is certain, what is waiting, and what is not really there

Everything built so far was infrastructure, procedure and doctrine, built while being used. This is
the count of what that left on the floor, so the real arc starts from known ground.

**35 documents are registered. 26 of them are real.** The other nine are test fixtures that have
already stood down — their leaves are lifted, so each has deregistered itself and each still has a
row. That is the only kind of not-real left on the floor, and it is not a judgement about the work.
(37 and 28 before RFC-071 and RFC-053 were deleted; their rows are ghosts until a re-parse.)

## Decisions that are yours

Nothing below this section is retired, deleted or pressed. These four are yours and the rest is mine.

**1 · ARC-001 has never been approved, and three of its objectives are already `done`.** One
approval block, unpressed, on the only real arc on the machine. So the arc everything was supposedly
built toward never authorised anything. Press it, or say it is superseded by the arc you are about
to plan — either is clean, but it cannot stay a draft with finished work hanging off it.

**2 · Two claimless RFCs are left to decide, and the count was smaller than this report said.**
`RFCs/` holds **73 .md files and only 10 carry a leaf** — the other 63 are already files rather than
RFCs, which is the same state the two retired below are now in. Of the ten, five carried no
`::claim` at all. His ruling, 2026-11-10: an RFC with no claims and no way back to spec'ing one is
history. **RFC-071 and RFC-053 are deleted** (`62530aa5`); **RFC-064 is kept** — and it is NOT the same subject as RFC-010 — that was `RFC-010-gap-closure.md`, CLI persistent
headers, unleafed for a long time and deleted with the other two. That leaves two:

- **RFC-072** — 808 lines, arc planning and execution, **both approvals pressed**, zero claims. The
  largest fully-approved unprovable commitment on the machine, and it describes the machinery the
  next arc runs on, which is the argument for it being live rather than history.
- **RFC-077** — two approvals, neither pressed, zero claims. Never reached a verdict at all.

**3 · RFC-076 is one claim and two presses from complete, and both presses are yours.** All 45 of
its claims are in container form, 44 met, one not — the best-formed contract on the machine. But two
of its three approval blocks carry no verdict: the 2026-10-29 amendment, and *"is this the complete
list of claims"*. So the document can never read `approved`, and its contract was never actually
fixed — 45 claims walked against a list nobody closed.

**4 · `G-13` is open and it has exactly two answers, both on the record.** Two claims — RFC-074's
c9 and c15 — were deleted by a commit about something else, from under an approval already reading
`verdict=approved` on *"is this the complete list"*. Restore them, or write the decision that removed
them. Until one happens RFC-075's tripwire stays red on purpose, and that red is the evidence.

## What is certain

| | claims | state |
|---|---|---|
| **RFC-078** | 25 / 25 | approved · built · done. The only document that is complete by its own contract |
| **RFC-075** | 25 / 26 | approved · built · done. The one open claim is `kind=experiential` — your eye concludes it, no spec is owed |

That is the whole of it. Two documents out of ten real RFCs can say what they are.

## What is waiting, and on what

| | claims | waiting on |
|---|---|---|
| **RFC-076** | 44 / 45 | one claim — and two unpressed approvals, one of them the claims press |
| **RFC-073** | 7 / 56 | nothing unwalked — 39 marks are in, 32 in a block that cannot hold evidence |
| **RFC-074** | 0 / 14 | nothing unwalked — 14 marks are in, every one in a block that cannot hold evidence |
| **RFC-072** | none | both approvals pressed, 808 lines, nothing checkable — his decision |
| **RFC-064** | none | no approval block at all. Kept |
| **RFC-077** | none | two approvals, neither pressed, nothing checkable — his decision |
| ~~RFC-071~~ | none | deleted 2026-11-10 |
| ~~RFC-053~~ | none | deleted 2026-11-10 |

**The pattern is one thing, not eight — and its two halves are different work.**

**Five of the ten had no claims at all, and most of that is now settled.** Claims came late, so
everything written before them is unprovable by construction — and `rfc-authoring` says a pre-block
RFC is *migrated, not left*, because a numbered line has nowhere to put a mark. Rather than migrate
five, three were decided by their subject: RFC-071 and RFC-053 deleted, RFC-064 kept. RFC-072
and RFC-077 are still open, and the 63 leafless files in `RFCs/` were already in that state before
anybody asked.

**The other two were walked and cannot say so.** A one-line `::claim[…]` has nowhere inside it for
evidence to live, so a mark on one can never read met however honestly it was made. Across RFC-073
and RFC-074 that is **62 one-line blocks carrying 46 met marks** — 32 of RFC-073's 39, and all 14 of
RFC-074's. RFC-073's eight CONTAINER claims each hold a real result block and each reads met, so the
form is the whole of the difference. Growing a block and folding in evidence that mostly already
exists is mechanical, and it is mine, not a decision for him.

## What is not really there

**There are no rows pointing at missing files.** Every one of the 37 has its file on disk — checked
path by path. The eight that did point at nothing cleared themselves on a re-parse, which is the
sweep working; the thing worth keeping from it is that nothing ANNOUNCED the sweep, so a count that
had been wrong for days came right with no record of either state.

**Nine rows are fixtures that have already stood down, and the registry still counts them.** The
nine mock documents under `RFCs/proofs/` all carry their leaf lifted — parked verbatim in an HTML
comment so one command restores it — which is how a document deregisters (RFC-073: the leaf IS the
identity). Every one of the nine reads `STALE — file newer than the parse`.

**That is the defect, and it is one step short of the finish.** `STALE` is the registry noticing the
file moved under it; dropping the row needs the re-parse that notices there is no leaf. Until that
runs, a document that deregistered itself is indistinguishable from one that is simply unparsed —
and nine of them answer `registry()` as real.

**So there was never a blank arc to retire.** The arc that looks empty is `MOCK-ARC`, and it is a
fixture `api/proofs.test.js` and `RFCs/proofs/mock.js` stand on. The blanks are RFCs.

## What I will do without asking

- **Make the nine stood-down fixture rows drop**, so lifting a leaf finishes the job it starts.
  Nothing is at risk in the act: the leaves are parked in the files and one command puts them back.
- **Grow RFC-073's and RFC-074's one-line claims into container form and fold in their evidence**, so
  46 honest marks stop reading as nothing. RFC-074's two deleted claims (`G-13`) are his call and are
  no part of this.
- **Fix the sweep so a deleted document takes its row with it at the time of deletion**, rather than
  leaving the count wrong until something happens to re-parse. Otherwise this section regrows and
  comes right again by accident.

## What I did not check

- **Whether the 20 live reports are still worth keeping.** Retention is per-document and I read none
  of their bodies.
- **Whether each of those 46 marks is still TRUE.** The form fix makes them countable; it does not
  re-verify them, and a mark made three weeks ago is a claim about a system that has moved since.
- **The three gaps' own contents.** `G-13` is named above only because another document's state
  pointed at it.
