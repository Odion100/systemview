# The check was wrong twice before it was right

::report{id="The check was wrong twice before it was right" as=account retain=24h}

:::glance
- **agent** — systemview-test
- **run** — not stated
- **new features** — an UNRESOLVABLE check — a ::commit naming a sha outside its own project, carrying the exact line to write instead
- **fixes** — none
- **corrections** — two versions of the check that accused correct work — one dropping project=, one matching only HEAD-reachable shas — both caught against the real repository · the curl refusal blamed on the hub was a malformed __arguments body
- **decisions** — none
- **live** — not stated
- **checked** — 2607 window · 399 hub (+22) · 23 cli · yarn verify green; the rendered UNRESOLVABLE section not seen
:::

**A cross-repo `::commit` with no `project=` renders "no such commit" in your window, and was only
ever caught after it was written and read.** The fault reporter flags the newest and leaves the
rest — ten sat in RFC-078 for a day. Three store notes said the rule and it happened twice in two
days, which makes it a missing *check*, not a knowledge gap.

There is a check now, and it carries the edit rather than the complaint:

```
UNRESOLVABLE — the document names a sha that is not a commit in its own project
  reports/x.md names d2067ba — that commit is in autobot;
  write ::commit{sha=d2067ba project=autobot}
```

**And the more useful half of this report is that I got it wrong twice first**, both times in the
direction that matters — it accused correct work. Both were caught by running it against the real
repository, and neither would have been caught by the tests I had written.

| | |
|---|---|
| **first version** | read the sha and **dropped `project=`** → reported 25 of my own correct cross-repo records as broken |
| **second version** | matched against `git log --format=%H` → reported **45 records in RFC-078** as pointing nowhere. Every one is a real commit on `before-rfc078-rollback`, a branch HEAD cannot see |
| **now** | systemview-test comes back **agreed**, and a planted cross-repo record is named with its fix |
| **tests** | 2607 window · 399 hub · 23 cli · `yarn verify` green including the production build |

---

## The two mistakes, because they are the same mistake

::commit{sha=1204f7ed}
::commit{sha=9a948ce project=autobot}

**`project=` is not decoration.** The first version pulled `sha=` out of each record and threw the
rest away, so every correctly-written cross-repo record — including the ones I had written an hour
earlier in tonight's own accounts — was looked for in the wrong repo and reported broken. A check
written to catch exactly this fault committed exactly this fault.

**Reachability is not existence.** The second version built one `git log --format=%H` per project
and matched against it. That is *commits reachable from HEAD*, and RFC-078's records point at a
rollback branch. Forty-five findings about work sitting right there.

Both versions passed every assertion I had written. **The fixtures were the problem:** they were
records without `project=`, and shas that either were or were not in a list I had built by hand.
Neither mistake was reachable from a test I would have thought to write, and both were obvious
within seconds of running the thing against the real repo.

So the rule now asks the caller a question with four answers — *in the repo it names* / *in that
one instead* / *nowhere this hub knows* / *nobody looked* — and the fourth is what keeps it honest:
when nothing has been resolved, nothing is claimed.

:file[api/commitLinks.js]

## How it resolves, and what that costs

One `git log --all --format=%H` per project that has documents — every ref, 0.02s on a 900-commit
repo — for the fast path, and `git cat-file -e` for anything that list misses. `cat-file` is what
the window itself resolves a `::commit` through, so a finding is never a guess about something the
renderer would have drawn fine.

It only asks about records the window cannot already answer, so in the steady state it asks nothing.

**And a fenced block is an example, not a record.** RFC-033 and the markdown guide carry made-up
shas on purpose; a check that cries wolf about documentation is one nobody runs twice. `shasIn`
strips fences first — including a longer fence holding a shorter one, which is how the guide shows
a fence inside a fence.

## Where the tests stand

| suite | ran | says |
|---|---|---|
| window | 2607 | green |
| hub | 399 | green — 22 new here, 38 across tonight's four commitLinks changes |
| cli | 23 | green |
| production build | bare, in `yarn verify` | compiles |

The new assertions include the two faults above, pinned by name so they cannot come back: a record
that names its repo is checked against *that* repo, and a commit that exists but is unreachable from
HEAD is not a finding.

## What I could NOT verify

- **A real broken record in a real document.** systemview-test has none — which is the honest
  outcome and also means the live proof is a *planted* record: I handed the audit a document naming
  autobot's HEAD without `project=` and watched it come back with `foundIn: "autobot"`. The 45
  RFC-078 records are proven silent, which is the other half.
- **The rendered section.** Your shell holds the old renderer until you restart, so the
  UNRESOLVABLE heading has not come out of the door in front of me.
- **The direct HTTP call, which I blamed on the hub.** A `curl` at the service route answered `no
  folder for this project` for every project, and I wrote that up as *"the MCP route resolves roots
  differently"*. It does not: a SystemLynx method takes its arguments in `{"__arguments":[ … ]}`,
  my body put them at the top level, and the method then ran with `projectCode` undefined — so the
  refusal was about the one thing I had got right. **Called through `Client.loadService`, the door
  answers the real repository**: 42 registered documents, 42 read, `noted: 66`, `retiredScan:
  {paths: 105, found: 34, capped: false}`, `dangling: 9`, `unreadable: 0`.
  `~/.autobot/projects.json` has `manager` at `/Users/odionedwards/manager`, all six of its reports
  resolve, and nothing is being skipped.

## Press-list

- [ ] After your next shell restart, `commitLinks` on this project should read **agreed**.
- [ ] Write a `::commit{sha=…}` naming an autobot commit without `project=` in any registered
      document, then run it: the finding should print the exact line to write instead.
