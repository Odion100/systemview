# Two counts that were not the truth, and an error rate that was fine all along

::report{id="Two counts that were not the truth" as=account retain=24h}

**Three things, all of them about numbers a surface was reporting.** One was fine and I stopped
chasing it; two were wrong and are fixed.

| | |
|---|---|
| **the Stats page's 3.8% server errors** | not sick. It is TestService's own deliberately-failing fixtures. Written to the store so nobody re-chases it |
| **the CLI's stats arithmetic** | 86 byte-identical lines copied from the hub, under a comment swearing the answer could not fork. It is the caller it always claimed to be now |
| **the scratch pad's "Saved actions 8"** | there are four. A lookup map read as a list answered with every action twice |
| **tests** | 2607 window · 369 hub · 23 cli · `yarn verify` green including the production build |
| **lane** | none. The tree was clean, so each piece is committed in place |

---

## 1 · The investigation: nothing is sick

The Stats page reads *"19,312 calls, 3.8% server errors (703 client 4xx)"*, and a 3.8% server
error rate is the kind of number that deserves somebody going and looking. I looked.

| method | calls | errors | what it is |
|---|---|---|---|
| `Auth.divideByZero` | 258 | 258 (100%) | a fixture whose job is to throw |
| `Auth.throwError` | 381 | 381 (100%) | the same |
| `Math.divide` | 1,408 | 703, all 4xx | its refusal path, exercised deliberately |

Those three are essentially the entire error count, and all of it is TestService — the project's own
test fixture — driven by the suites. **Nothing is wrong.** The finding is written to the context
store rather than left in a report that expires, so the next session that sees 3.8% does not spend
the same twenty minutes.

**One thing worth knowing if you ever reach for it:** do not probe `getStats` raw. It answers with
every per-minute bucket since the service started and floods a context window. The totals come back
through `stats`, or off the page.

## 2 · The CLI never became the caller its own design said it was

::commit{sha=1fc624d0}

`api/stats.js` opens with this:

> *"it moves here and `cli/stats.js` becomes a caller — the whole point of the exercise being that
> the answer never forks."*

It did not become a caller.

```bash
diff <(sed -n '14,100p' api/stats.js) <(sed -n '16,102p' cli/stats.js)
# → one line of difference, and that line is a comment
```

Eighty-six lines — the windowing, the 4xx/5xx split, the health thresholds and the three formatters
— sat in the CLI as a byte-identical copy. The hub already exported all of it; nobody required it.

**Nothing had drifted, which is exactly the state a drift starts from.** The next person to fix a
windowing bug fixes it in one of the two places, and the hub's report and the CLI's digest start
disagreeing about the same snapshot — both "right" against their own copy, under a comment at the
top of one of them swearing that cannot happen.

The CLI requires the arithmetic now. What stays there is **printing**: colour, column widths, what
the digest chooses to show. That is its job and the only thing in it that should ever differ.

**The third copy stays, and that is a decision rather than an oversight.**
`src/pages/Reports/Reports.js` has its own `splitErrors` because the window is a separate build and
cannot require from `api/`. Said out loud here so nobody "finishes the job" by breaking the bundle.

**Two of the eight new assertions caught me rather than the code** — I expected `changeDelta` to
refuse an all-time range (it halves whatever buckets it has, which is right) and `fmtPct(0.038)` to
round to 4% (the decimal threshold is 0.1 as a *fraction*, so 3.8% keeps its decimal and 38% loses
it). Both are now pinned, because both faces print them.

:file[cli/stats.callers.test.js]

## 3 · The saved actions list counted every action twice

::commit{sha=f15a02d8}
::commit{sha=5bc6f32a}

Pressed the scratch pad's **Actions** tab and read *"Saved actions 8"* over `buildGreeting`,
`buildGreeting`, `seedSum`, `seedSum`. There are four.

`getActionMap` is a **lookup** map, and it holds every action under two keys — qualified
`TestService.seedSum` and bare `seedSum` — because a `{ use: … }` reference may be stored either way
and a lookup must never have to know which form it is holding. That is right. The panel then listed
`Object.values(map)`, which answers with each action twice, and the count is derived from the list.

**Deduped by reference, which is what makes it exact:** the two entries are one object, while two
genuinely different actions that share a name — one per service, which the panel already handles by
routing edits to the owning service — are two objects and both survive.

**A second fault in the same list, which the dedupe does not cover.** The cards were keyed by
`a.name` alone. Two services in one project may each hold a `seedSum`, so duplicate keys among
siblings let React reuse the first card's DOM and state for the second — a fold opening the wrong
card, a run result landing on the wrong row. **Nothing said so:** React's duplicate-key warning is
development-only, so the built window is silent about it. The key carries the owning service now.

## Where the tests stand

| suite | ran | says |
|---|---|---|
| window | 2607 assertions, 171 files | green — 6 new |
| hub | 369 | green |
| cli | 23 | green — 8 new |
| production build | in `yarn verify`, bare | compiles |

Both new test files are **pure modules with no imports**, and that is the point rather than a
convenience: `ActionsPanel` pulls in the service client, the stage and the test controller, and the
fault was never in a render — it was in two one-line decisions. The same for the stats arithmetic,
which is now asserted through the one door both faces use.

## The rest of the use-pass

Walked in a headless Chrome of my own, with a collector installed for console errors, unhandled
rejections and failing fetches. **It came back empty.**

- **the Agents page in a plain tab** — says *"Agent management is a harness capability — open this
  inside the SystemView browser"* and the same for the context store. That is a refusal surfaced
  honestly, and worth noting beside last night's board, which claimed "no live service" when the
  truth was something else entirely.
- **the open-by-path `+` door** — typed `src/organisms/CenterTabs/` and it listed all seven files
  including tonight's new ones; typed a path that does not exist and it refused with *"no project
  holds that path"* rather than opening a dead tab.
- **the scratch pad** — all three tabs draw; the Test tab's sections, the Actions tab's list.

## What I could NOT verify

- **Your window.** None of this touched it.
- **The duplicate-key symptom itself.** I fixed the key on the strength of what React does with
  duplicate siblings, not by reproducing a card inheriting another's state — that needs two services
  in one project each holding a same-named action, which this project does not currently have.
- **The CLI's digest output against the hub's report, side by side.** I ran the command against the
  live hub and it printed correctly, and the arithmetic is now literally the same function — but I
  did not diff a rendered digest against a rendered report.
- **Anything about the Statistics tab on the Agents page.** I read the Agents page's refusals and
  moved on.

## Press-list

- [ ] Scratch pad → **Actions**: the count should read 4 and each name should appear once.
- [ ] `systemview stats systemview-test --range all` — the digest should read exactly as it did.
- [ ] Nothing else should look different. All three of these were about numbers being true, not
      about anything moving.
