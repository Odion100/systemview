::report{id="The ground before the arc" as=audit retain=7d}

# The ground before the arc — what is certain, what is waiting, and what is not really there

Everything built so far was infrastructure, procedure and doctrine, built while being used. This is
the count of what that left on the floor, so the real arc starts from known ground.

**44 documents are registered. 29 of them are real.** The other 15 are two different kinds of
not-real, and neither is a judgement about the work — one is a file that was deleted and left a row
behind, the other is a test fixture doing its job.

## Decisions that are yours

Nothing below this section is retired, deleted or pressed. These four are yours and the rest is mine.

**1 · ARC-001 has never been approved, and three of its objectives are already `done`.** One
approval block, unpressed, on the only real arc on the machine. So the arc everything was supposedly
built toward never authorised anything. Press it, or say it is superseded by the arc you are about
to plan — either is clean, but it cannot stay a draft with finished work hanging off it.

**2 · Five RFCs carry no `::claim` at all.** Not thin claims — none. That is what "no spec" means
here: nothing in them can be checked, so no one can say whether they were built. Two of them are
marked `done` anyway. Which of these are live designs, and which are history?

**3 · RFC-074 is approved, built, marked done — and 0 of its 14 claims are met.** `G-13` is already
filed about it ("two claims deleted from an approved contract"). This is the one document whose state
actively disagrees with itself.

**4 · RFC-073 reads built with 7 of 55 claims met.** Either 48 claims were never walked, or it is
not built. It is the largest contract on the machine and the least settled.

## What is certain

| | claims | state |
|---|---|---|
| **RFC-078** | 25 / 25 | approved · built · done. The only document that is complete by its own contract |
| **RFC-075** | 25 / 26 | approved · built · done. The one open claim is `kind=experiential` — your eye concludes it, no spec is owed |

That is the whole of it. Two documents out of ten real RFCs can say what they are.

## What is waiting, and on what

| | claims | waiting on |
|---|---|---|
| **RFC-076** | 44 / 45 | one claim, and no verdict pressed on the document |
| **RFC-073** | 7 / 55 | 48 claims unwalked. Reads `built` with no verdict |
| **RFC-074** | 0 / 14 | every claim. `G-13` names the cause |
| **RFC-071** | none | approved · done, nothing checkable |
| **RFC-072** | none | approved, 807 lines, nothing checkable |
| **RFC-053** | none | an unpressed approval, nothing checkable |
| **RFC-064** | none | no approval block at all |
| **RFC-077** | none | two unpressed approvals, nothing checkable |

**The pattern is one thing, not eight.** Claims came late to this system. Everything written before
them is unprovable by construction — and `rfc-authoring` already says a pre-block RFC is *migrated,
not left*, because a numbered line has nowhere to put a mark. Five documents never got that pass.

## What is not really there

**Eight registry rows point at files that do not exist.** The row survives, is re-parsed, and
answers every `registry()` query as though the document were real — RFC-010 was re-parsed at 11:19
today against a path that has been gone for longer than that.

| | |
|---|---|
| `RFC-010` | `RFCs/RFC-010-one-portable-folder.md`. Its title is RFC-064's subject — renumbered, and the old row never went |
| `G-15` | `gaps/A_COUNTERSIGNATURE_CAN_NEVER_BE_RENEWED_OR_WITHDRAWN.md` |
| 6 reports | drain-stood-down · first-disinterested-drain · the-amendment-landed · eight-countersigned · my-own-signature-went-stale · refining-the-manager-setup |

**This is a defect, not untidiness.** A report is *meant* to be deleted when its window runs out —
`registration.md` says so: *"the file goes later (a report is deleted)"*. What is missing is the row
going with it. So the registry's count climbs forever, and a document that was correctly swept is
indistinguishable from one that was lost.

**And seven rows are test fixtures.** `MOCK-ARC`, `MOCK-PLAN`, `MOCK-RFC-2` through `-5`, `MOCK-GAP`
— all under `RFCs/proofs/`, all load-bearing: `api/proofs.test.js` and `RFCs/proofs/mock.js` stand
on them.

**So there was no blank arc to retire.** The arc that looks empty is `MOCK-ARC`, and retiring it
breaks a suite. The blanks are RFCs. What the fixtures actually cost is the count: ask "which arcs
do I have" and one of the two answers is a fixture, every time.

## What I will do without asking

- **Clear the eight ghost rows**, after reading each one to be sure the file was swept rather than
  lost — a row deleted on a guess is a document nobody will hear about again.
- **Fix the sweep that leaves them**, so a deleted report takes its row with it. Otherwise this
  section regrows.

## What I did not check

- **Whether the 16 live reports are still worth keeping.** Retention is per-document and I read none
  of their bodies.
- **Whether RFC-073's 48 unwalked claims are unwalked or unmet.** That is a claims walk, not an
  inventory, and it is the single largest piece of work this count implies.
- **The three gaps' own contents.** `G-13` is named above only because another document's state
  pointed at it.
