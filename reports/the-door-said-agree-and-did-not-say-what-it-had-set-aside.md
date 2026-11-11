# The door said agree and did not say what it had set aside

::report{id="The door said agree and did not say what it had set aside" as=account retain=24h}

**I shipped a claim that was false at the surface an agent actually reads.** The commit that
introduced `selfWriting` says it is *"reported in full, with the same fields, and counted — the fixed
point stays VISIBLE."* True of the hub's answer. False of the MCP door, which enumerates its buckets
explicitly and had never heard of this one — so the classification rendered as **nothing at all**.

| | |
|---|---|
| **the fault** | `electron/agents/systemview.cjs` lists its sections by name — crossed, oneWay, dangling, expired, unresolvable, misplaced. A new bucket is invisible, not broken |
| **and the agreed path swallowed it twice** | it returns early with only the agree line, so a sitting whose one-ways were all self-references read *"nothing to fix"* with no sign anything had been set aside |
| **which means my fix made the surface QUIETER** | those nine entries were at least on screen as findings before I classified them. Quieter is the direction this door exists to resist |
| **the precedent was in the same function** | `notedLine` already says what was not checked, on both branches, under the comment *"a check that narrows itself in silence is the thing this door was built to catch"* |
| **tests** | `hub-skew` 7 → **11**, six other autobot suites green. Teeth proven by dropping the line from the agreed path |
| **arming** | autobot `electron/` — **this rides your shell restart**, and until then the hub classifies while the door says nothing |

---

## Press-list

- [ ] After the restart, `commitLinks({projectCode:"systemview-test", since:20})` — it should say
      *"the two directions agree"* **and** name how many commits wrote only the document they serve.
- [ ] `node tests/hub-skew.js` in `~/autobot` — 11 assertions.

:::cmd
cd ~/autobot && node tests/hub-skew.js
:::

## The evaluation, written before the work

This was **my own loose end**, named at the end of the previous sitting as *"the renderer will not
know the bucket exists; it is additive, so the existing display is unaffected."* I checked that
instead of trusting it, and the check is the finding:

> It IS safe — no raw key dump, no crash — and it is INVISIBLE, which is a different thing and the
> one I claimed was not happening. […] Before my fix those nine were at least ON SCREEN as findings.
> I made the count honest and the surface quieter.

## What was built

::commit{sha=ef3fe60 project=autobot}

::file[~/autobot/electron/agents/systemview.cjs]

**On both branches, because the two cannot be allowed to disagree about what was set aside.** The
agreed path and the findings path return through different code, and a line on only one of them
would mean the door's answer depended on whether anything else happened to be wrong.

**Read through `held`, which is not decoration in this file.** A shell holding a newer renderer than
its hub is the normal state of this system — measured 2026-11-07, when a missing section made the
whole verb answer *"Cannot read properties of undefined"*. An older hub sends no `selfWriting` and
the line simply does not appear: this file's own rule, applied to its newest field.

::file[~/autobot/tests/hub-skew.js]

**Four cases, and the suite exercises the REAL handler** — `commitLinks().handler(...)` against a
stubbed fetch, not a reimplementation of the rendering. So "the line appears" is a statement about
the code that will run, which matters more than usual here because I cannot reach the live door
(below).

The cases: the agreed path says it; **one reads as "1 commit … it serves"** rather than the
"1 commits" a surface nobody wrote on purpose; the findings path says the same thing; and an older
hub's answer produces no line, no crash, and no invented zero.

## Where the tests stand

| suite | ran | says |
|---|---|---|
| autobot `hub-skew` | 11 | green — 4 new, all on this bucket |
| `registry` · `markdown-state` · `documents` · `attachments` · `nudge` · `board` | — | green, exit 0 each |
| systemview | — | **not run and did not need to be**: nothing in that repo changed |

## What I could NOT do or verify

- **I could not use the live door, and that is the honest shape of this one.** The MCP server IS the
  shell, so an `electron/` change cannot be exercised through the tool until you restart — there is
  no moment where I can call the door and reach the new renderer. The suite calling the real handler
  is the closest available evidence and I am not going to call it a live check.
- **The gap is open right now.** The hub half has been live since the previous sitting, so until the
  restart `commitLinks` classifies self-references and the door says nothing about them. That is
  strictly better than before the classification for the `oneWay` count and strictly worse for
  knowing what happened to the rest — which is exactly why this was worth doing the same night
  rather than carding.
- **I followed the practice late again.** Note `xci5` says to write the report FILE before the first
  commit so the id exists in the tree rather than in my head. I wrote the trailer first and the file
  second — the id is at least this sitting's own rather than the previous one's, which is the part
  that had gone wrong three times today, but the practice itself is still being read rather than
  used.
