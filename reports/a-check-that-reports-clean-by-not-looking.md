# A check that reported clean by not looking, and a trade I did not take for you

::report{id="A check that reported clean by not looking" as=account retain=24h}

**`commitLinks` read 200 commits by default and never said so.** Its most dangerous output — *"the
two directions agree"* — was a sentence about however far back one call happened to reach. On this
repo that is two findings at a window of 200 and twenty-four at 300. It says the window now, and a
clean answer is scoped to what was actually looked at.

**And one card I deliberately did not close:** the rail slicing agent names is a visible change to
your furniture, and you had already framed it as a trade. I measured both sides, killed a third
option by trying it, and left it to you with numbers.

| | |
|---|---|
| **fixed** | commitLinks reports its window, names the floor it stopped at, and scopes a clean result to it |
| **blocked, for you** | the rail's names — both options are one line away, and I am not picking the look of your nav |
| **carded** | every account report manufactures `unclaimed` findings — 17 tonight, growing nightly |
| **tests** | 2607 window · 374 hub · 23 cli · `yarn verify` green including the production build |
| **arming** | the hub half is **live** — I restarted it (pid 96820, answering 200). The renderer half is autobot's and **rides your shell restart** |

---

## 1 · The window is part of the answer

::commit{sha=e254319f}
::commit{sha=c32639f project=autobot}

The card said it better than I could: *"a completeness check whose default is a window is a check
that reports clean by not looking."*

**The one inference, and it is the whole mechanism:** `git log --max-count=N` answers **fewer** than
N records when it runs out. So `read < window` means the read reached the beginning of the
repository and the answer is about everything; `read === window` means older commits exist that this
run never saw. The reply now carries that, plus the oldest commit read — so *"raise the window"* is
a concrete instruction rather than a shrug — and `atCap`, for when raising it is no longer available
and the reader has to narrow the question instead.

The head line reads like this when the read did not reach the start:

```
25 commits read · 0 carry a Serves trailer · 37 registered documents · A WINDOW —
older commits exist that this did not read; raise `since` past 25
  oldest read: 32740faa "docs(report): the account for the document-position work"
```

…and the clean case becomes *"the two directions agree **inside this window** — nothing older was
read"*. Agreement about a window is a different sentence from agreement about a project, and only
one of them was true.

:file[api/commitLinks.js]

**The renderer half is autobot's**, so until you restart the shell the hub will be sending a field
the shell ignores and the line will read exactly as it does today. That is the normal state of this
system rather than a fault — the two restart on their own schedules — and the renderer is written to
say nothing when the field is absent.

## 2 · The rail's names: measured, and left to you

Your card: *"the dock slices every agent's name — the ellipsis lands outside the column."* Confirmed
and measured, with the nav collapsed and nine agents docked. The clipper is `#sv-agent-rail` at 40px
with `overflow-y: auto`, so `overflow-x` computes to clip. Labels start at x=5 with `max-width:62px`:

| name | right edge | lost |
|---|---|---|
| systemview-test | 67 | 27px — and cut twice: ellipsed at 62, then the ellipsis clipped at 40 |
| systemlynx | 63 | 23px |
| BUStudio | 51 | 11px |
| agentci · autobot | 46 | 6px |
| buAPI · BUApp · Blink · bu1 | ≤34 | fine |

**A third option, tried and dead — worth recording so nobody tries it again.** `overflow-x: clip`
with `overflow-clip-margin: 32px` should let the names paint into the gutter while the box stays
40px and captures no clicks out there. I applied it live: the computed style took it, the box stayed
40px, the rail still scrolled, and `elementFromPoint` at the names' right edges returned the centre
panel — every signal said it worked. **The screenshot said it did not.** A clip margin is ignored on
a scroll container, and `overflow-y: auto` makes this one.

**So your two stand, and I took neither.** (a) widening the scroll box keeps the gutter your own
design note asks for (*"the name runs into that gutter at a size you can read"*) but needs the well
painted by something other than the box and the box made click-transparent, or it eats 32px of the
centre's left edge. (b) `max-width: 35px` is honest — I ran it, and every name ends in an ellipsis
instead of stopping mid-letter — but it shows one character **less** than today's lie, and both your
systemview projects read `syst…`.

Everything is on the card, stamped `blocked`, with both screenshots in `~/.autobot/shots/`. One line
either way once you say which.

## 3 · The thing that will grow if nobody decides it

`commitLinks` reports **17 unclaimed findings** against this project, and every one is an account
report naming a commit it accounts for — eight from tonight's split report alone.

They are **true by the current rule and useless as signal**, for a workflow reason rather than a bug:
a report is written *after* the work, so its commits cannot carry `Serves: <report id>` — the id did
not exist yet. Report-authoring requires a `::commit{sha=}` record per commit, so every honest
account manufactures findings, and a door whose output is mostly noise stops being read.

**My read is that `unclaimed` should only fire for documents that COMMISSION work** — an arc, an RFC,
a gap. A trailer answers *"what asked for this"*, and an account never asked for anything. That is a
change to what the check MEANS, so it is carded rather than done.

## Where the tests stand

| suite | ran | says |
|---|---|---|
| window | 2607 | green |
| hub | 374 | green — 5 new |
| cli | 23 | green |
| production build | bare, in `yarn verify` | compiles |

## What I could NOT verify

- **The renderer's new head line, rendered.** The shell holds the old module until you restart, so I
  have read the code and the hub's field but have not seen the sentence come out of the door.
  Verified instead that the hub really sends `window` and that the current shell ignores it without
  complaint — which is the half that could have broken something today.
- **The rail fix**, because I did not make one.
- **Your window.** Untouched. The rail work ran in a headless browser of my own with the nav
  collapsed and the dock seeded in its localStorage.

## Press-list

- [ ] After your next shell restart: `commitLinks` on any project — the head line should say whether
      it read the whole history, and a clean answer should say "inside this window".
- [ ] The rail card is `blocked` and waiting on one word from you: **widen** or **ellipsis**.
- [ ] The unclaimed-findings card wants a read, not a press — it is the one that gets worse by itself.
