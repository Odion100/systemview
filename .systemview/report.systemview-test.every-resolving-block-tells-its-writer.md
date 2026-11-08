::report{id="Every resolving block tells its writer" as=spec retain=30d}

::members{who=systemview-test}

`::commit` learned to report its own failures to the agent that wrote it — one line through
`useBlockFailure`, delivered once per failure, surviving reloads. The other five resolving surfaces
kept failing silently at the reader: a dead `::file` chip, a `::test` embed with no test named, a
`::branch` the bridge cannot resolve, a `::claim` marked met with nothing behind the mark, a
`:report` chip naming no file. The reader saw each failure in place; **the writer — the one who can
fix the value — heard nothing, so every one of them stood until you caught it by eye.**

All five are wired now, each at the moment its own failure exists, through the same hook: the same
audience rule (a document's members, else the chat's own agent), the same once-only persisted key,
the same refusal to send when there is no real address to name.

Two deliberate non-reports, because a failure that is nobody's dead pointer must not wake anyone:
a git bridge with **no branch verbs** is the host missing a capability, and a `::file` whose hub
lookup dies but whose **fallback still opens the file** was never a dead reference.

## The evaluation, recorded before the work

The card was the queue's last cleanly completable declared pick of this sitting: pattern
established by `::commit`, "the hook, the audience rule and the once-only key are done" — so the
evaluation was *do it as stated*, and the judgment spent was per-block: finding where each block's
failure actually lives (a render state for the dead chips, a press for the file refusal, a
derivation for the unproved mark) and which failures are the host's rather than the writer's.

## Where the tests stand

| what ran | where | what it said |
|---|---|---|
| the five block suites | this tree | 127 pass — a wiring claim per failure path, plus the two non-report claims |
| the mutation | this tree | Claim's effect and FileLink's refusal wire cut → exactly their two claims red; restored green |
| window jest, whole suite | this tree | **2356** across 161 suites |

::claims

::::claim[a ::file that cannot resolve tells its writer — the empty reference at render, the hub's refusal at the press — and the hub-down fallback that still opens reports nothing]{id=w1 state=met by=systemview-test told=systemview-test}
:::cmd
cd ~/Systemly/systemview && CI=true npx react-scripts test --testPathPattern="FileLink" --watchAll=false 2>&1 | tail -4
:::
::::

::::claim[a dead ::test embed and a dead :report chip tell their writers, with the reason split by which half was missing]{id=w2 state=met by=systemview-test told=systemview-test}
:::cmd
cd ~/Systemly/systemview && CI=true npx react-scripts test --testPathPattern="(TestEmbed|ReportLink)" --watchAll=false 2>&1 | tail -4
:::
::::

::::claim[a ::branch the bridge cannot resolve reports with the bridge's reason — and a bridge with no branch verbs reports nothing, because the host's absence is nobody's dead pointer]{id=w3 state=met by=systemview-test told=systemview-test}
:::cmd
cd ~/Systemly/systemview && CI=true npx react-scripts test --testPathPattern="BranchBlock" --watchAll=false 2>&1 | tail -4
:::
::::

::::claim[a ::claim marked met with no proof embedded tells the agent that made the mark — the row already told the reader]{id=w4 state=met by=systemview-test told=systemview-test}
:::cmd
cd ~/Systemly/systemview && CI=true npx react-scripts test --testPathPattern="Claim.test" --watchAll=false 2>&1 | tail -4
:::
::::

## Walk it

::branch[main]

**Lands on your window's hold** — `main.8da933f2`. Nothing to arm beyond the bundle: the wiring is
window-side only, and the hook it rides has been live since `::commit` got it.

- [ ] write `::file[nope/missing.js]` in any document you are not a member of alone — press it, and
      the agent whose chat it is gets the one line naming the chip and the hub's reason
- [ ] a claim marked met with an empty fold — its author is told it does not count
- [ ] the once-only key still holds: refresh, and nobody is woken again

::file[src/atoms/Markdown/blocks/FileLink.js#L46-L54]

::file[src/atoms/Markdown/blocks/Claim.js#L65-L77]

## The commits

::commit{sha=f1d103df}

::commit{sha=5ede5cca}

## What this did not touch

What TestPane does when a parsed target matches **no saved test** — that resolution lives inside
the pane, below this block, and the panel's own builder already names it as an issue
("the-panel-says-what-it-could-not-build", 2026-11-07). And the hook itself is unchanged: audience,
dedupe and the address rule stand exactly as `::commit` proved them.
