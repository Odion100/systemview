::report{id="commitLinks caught me three times, so one mistake is now one finding" as=account retain=24h}

Seventh sitting. A nudged run closed the honest way, a use-pass that **caught me rather than the
code**, and the fix is to the door that should have caught it the first time.

::members{who=systemview-test}

## The nudged tour run, closed where it died

`skill:how-we-work-tour` stood at 1/3 with *"Play the ENTIRE tour"* active. A tour **speaks and
presses in your window**, so playing it while nobody is there is the one thing an idle run must not
do. Declared `abandoned` with the blocked card attached as its account, and the list left exactly
where it stopped — the skill amendment done, the play still active. Nothing was marked done to quiet
the nudge.

## The use-pass caught ME

```
commitLinks({projectCode: "systemview-test", since: 40})
→ ONE WAY (4) · UNCLAIMED (4)
```

Three of tonight's build commits carry `Serves:` naming the **previous sitting's report**, and a
fourth carries no trailer at all:

| commit | what it did | the trailer says |
|---|---|---|
| `0896a75c` | the menu's gating (sitting 2) | sitting 1's report |
| `ef1d477c` | the cli suite (sitting 5) | sitting 4's report |
| `8b26406a` | the degrade (sitting 6) | sitting 5's report |
| `f98a93eb` | three reds (sitting 4) | *nothing* |

**The cause is structural, which is why it is worth writing down rather than just apologising for.**
A trailer is written at COMMIT time; a report's id is chosen at the END of a sitting. So the title
already in hand is last sitting's, and reaching for it is the lazy wrong answer. The fix in practice
is to decide the report's id **before the first commit** — which is what this document's own title
was, and the reason its commit record below is correct.

## And the reason I missed it three times is the door itself

::commit{sha=02edc313}

A cross used to arrive as an unrelated `oneWay` in one section plus an unrelated `unclaimed` in
another — **one wrong label reported as two unrelated problems**, in two different lists, which is
exactly the shape that hides a repeating mistake. So a commit whose trailer names A while B carries
its sha is now reported once, as `crossed`, with both halves withdrawn: the count of findings should
be the count of mistakes. `says` is what the trailer claims; `carriedBy` is the document that
actually accounts for the work.

Run over the real last-40 commits: **3 crossed, 2 one-way, 1 unclaimed** — down from eight scattered
lines for the same facts.

::commit{sha=fd696d1 project=autobot}

The renderer puts it first, because it is the only finding that names a wrong LABEL rather than a
missing record.

**A multi-serve is not a cross, and a claim that already existed caught that false positive while
this was being written:** one commit may legitimately serve two documents, and when only one carries
the record the trailer is RIGHT and a record is missing. That is a plain one-way. The cross requires
that the commit does *not* also name the document holding its sha.

## The confession this report owes

`02edc313` — the commit that fixes this very thing — **carries the wrong trailer itself.** I wrote
`Serves: A use-pass found three things…`, which is sitting six's report, minutes after diagnosing the
habit. It cannot be repaired: fixing a trailer rewrites history, and that is yours. So the new
`crossed` finding will report it, correctly, against me.

The other two findings are the same habit and must NOT be "repaired" by adding records: `6cc12f18`
was reverted later tonight, so carrying its sha would claim reverted work, and `f98a93eb`'s commit
names nothing at all.

## The clean half of the use-pass

All six accounts filed tonight are **registered and addressable** — `registry({kind: "report"})`
lists 18 reports with every one of tonight's among them, by the address its leaf declared rather
than by where the file sits. A negative result, which is a legitimate outcome of using a surface.

## Where the tests stand

| what ran | where | result |
|---|---|---|
| `node --test api/commitLinks.test.js` | the hub's suite | 16 pass — 4 new |
| `yarn verify` | window + hub + cli + build | 2315 · **343** · 7 · green |
| the pure `audit()` over the real git log | node, no hub | 3 crossed found, as predicted |

**What is not proven:** the live door still runs Monday's hub, so `commitLinks` over the MCP will
keep printing the old two-section shape until the hub restarts — and the renderer half rides your
shell restart on top of that. The pure function was run against the real repo instead, which is why
the three pairs above are measured rather than asserted.

## This account's own commit

::commit{sha=172e0518}
