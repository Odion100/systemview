::report{id="The hub stopped counting who's behind off prose hashes" as=spec retain=30d}

::members{who=systemview-test}

Your ruling of 2026-11-06 — *"general text in the document should send no updates, period point
blank"* — killed the edit channel in the window: blocks are the only senders, the engine delivers
their fires, `told=` is the receipt. **The hub's folder scan never got the same cut.** Its
`documents` verb still derived `behind` from the document's prose hash against per-member `sent=`
stamps, at both levels, and counted `withUpdates` off it — so the one door agents use to ask "what
am I on?" answered in a dead channel's language, and the MCP tool printed it: `• path (behind: …)`,
`N with unsent updates`.

Gone. The answer is membership now — `who`, `auto`, the threads' audiences, `everyone`,
`withMembers` — and nothing in the row, the thread or the summary speaks the hash language. Who is
OWED a fire is the shell's fires engine's question; the hub answering it off hashes was a second
copy of a rule retired where the first copy lived.

## The evaluation, recorded before the work

On the board before anything was built: **do it as stated, scoped to the read side.** Three
survivals mapped — the hub's computation (the source), the MCP `documents` tool printing it, and a
`behind` Set in the navigator that nothing reads. **Not cut:** the reply route's `sent=` stamping —
write-side receipts that nothing will read after this — filed back on the board as its own card
rather than smuggled into this one.

## Where the tests stand

| what ran | where | what it said |
|---|---|---|
| `api/documentMembers.test.js` | this tree | 34 pass — the dead-channel claims rewritten as absence claims; **mutation: `behind` put back in the row reds exactly one test, the cut claim** |
| `yarn test:api` | this tree | 363 |
| window jest, whole suite | this tree | 2340 across 160 suites |
| `yarn test:cli` | this tree | 12 |
| `yarn smoke:skew` | `~/autobot` | 7 claims — including the new one: an older hub still sending `behind`/`withUpdates` renders as membership, never as a count |
| `Hub.Agent.documents` | **the live hub, through the MCP** | 1 passed, after the restart you ordered standing |

::claims

**The proof is one saved spec at the real door's own address — `Hub.Agent.documents`** — run
against the live tree, whose documents still WEAR old `sent=` stamps. That is the exact case that
used to answer in the dead channel's language, which makes it the right fixture: no planting
needed, the repo is the reproduction.

::::claim[a document wearing old sent= stamps answers with membership only — no behind, no sent, at either level]{id=d1 state=met by=systemview-test note="asserted live: rows carry who/auto/threads/everyone; behind and sent are typed absent on the row; the node suite pins the thread level and the stamps case" told=systemview-test}
::test[Hub.Agent.documents]{project=systemview-test}
::::

::::claim[the folder summary counts members and cannot count "unsent updates" — the field is gone, not zero]{id=d2 state=met by=systemview-test note="withMembers answers as a number ≥1; withUpdates is typed absent, so the number the band once read off prose hashes cannot be read at all" told=systemview-test}
::test[Hub.Agent.documents]{project=systemview-test}
::::

::::claim[the MCP documents tool prints membership only, and survives a hub still speaking the edit channel]{id=d3 state=met by=systemview-test note="the old renderer indexed d.behind unconditionally and would have TypeErrored on the cut answer; the skew case feeds it an old-shaped answer with behind/withUpdates and pins the exact output line" told=systemview-test}
:::cmd
cd ~/autobot && yarn smoke:skew 2>&1 | tail -4
:::
::::

## Walk it

::branch[main]

**The hub half is armed** — I restarted it under your standing order, and the live spec above ran
green after. **The autobot half rides your shell restart**: until then, the running shell's old
`documents` tool indexes `d.behind` on an answer that no longer carries it, so that one MCP verb
answers with a caught failure instead of a list. The fix is committed on `ElementLocator` beside
last night's board-tool commit.

- [ ] `documents({projectCode: "systemview-test", member: "systemview-test"})` → 24 documents,
      membership only (after your shell restart; `probe Hub.Agent.documents` shows it now)
- [ ] the saved spec on the proofs panel: `Hub.Agent.documents` — two steps, both green, re-runnable
- [ ] the navigator's member filter still works — it never read `behind`, which was the tell

::file[api/documentMembers.js#L118-152]

::file[api/specs/tests/Agent.documents.json]

## The commits

::commit{sha=2afafb70}

::commit{sha=ea6834e project=autobot}

::commit{sha=56aa9847}

::commit{sha=53927faa}

## What this did not touch

**The write side.** The reply route still stamps `sent=` receipts on `::members` lines and thread
openers — bookkeeping for a channel nothing now reads. Cutting it changes what a reply writes into
documents, which is its own decision; it is on the board as its own card. And the `::members` lines
across the tree keep their old stamps — receipts of a dead channel, inert, read by nothing.
