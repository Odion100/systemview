::report{id="The fixture that could not survive a hub boot now rests torn down" as=account retain=24h retired=2026-11-09 retiredAs=expired}

Eighth proactive sitting. Two picks, both of the same shape — **a door that only breaks when a
process restarts** — and a use-pass that caught two more of my own `Serves:` mistakes.

::members{who=systemview-test}

## The evaluation, recorded before the work

| card | ending | why |
|---|---|---|
| the janitor deleted a `retain=permanent` fixture | **do something else** | the card's hypothesis was wrong. The janitor is right; the fixture was COMMITTED in a collectable state |
| every other MCP renderer may crash like commitLinks | **do it as stated** | 23 sites swept, 3 genuinely bare, all three latent rather than live |
| should a leaf say its retirement is a test artifact | **not mine** | new vocabulary on a leaf is his; the half that needs no word got built instead |

## 1 · The fixture was committed in a state that deletes it

::commit{sha=e5a7760f}

`RFCs/proofs/mock-rfc.md` was restored at 06:04 this morning because four documents point at it, and
the **11:05 hub boot collected it again**. One log line each time:

```
[janitor] systemview-test: collected 5 retired — … RFCs/proofs/mock-rfc.md
```

Four of those five were genuinely expired reports; that is the janitor working. The fifth is the
RFC-lifecycle fixture, and **the card filed against it had the cause backwards.** The janitor is
correct and its own suite says so: office 1 collects a document whose leaf says somebody decided it
is over, and `retain=permanent` deliberately does not protect against a decision — there is a claim
named *"retiring a permanent document still deletes it"* pinning exactly that.

The real cause is one line of the fixture, in git:

```
::rfc{id=MOCK-RFC title="MOCK — an RFC you can push around" retired=2026-10-30 retiredAs=shelf …}
```

**Its committed rest state carries a live retired leaf.** So restoring it from git restores a
document the next hourly pass eats — the restore was doomed by construction, which is why it
happened twice in one day.

The fixtures are walked INTO the retired state on purpose, so the state they REST in is the thing
that has to be safe. The rest state is now the design's own answer: the rfc leaf is an HTML comment,
the registry row follows on the next parse, and a document with no leaf is not in the janitor's file
set at all. `mock.js` says so at the one moment it matters:

```
mock-rfc.md → retired

  ⚠  mock-rfc.md now carries a real retired= leaf, and the hub's janitor collects retired
     documents on its hourly pass — this file included.
     Finish the walk: node RFCs/proofs/mock.js rfc off
```

::file[RFCs/proofs/mock.js]

Two claims, and the second is the only kind that could have caught this: it reads the **real**
fixtures off the disk and fails by name, naming the teardown.

## 2 · The same class, swept across the MCP renderers

::commit{sha=be85e3f project=autobot}

`commitLinks` went down in your window this morning the moment your shell restart armed the new
renderer against Monday's hub. That was one site of a class, so I swept every
`r.<field>.length|map|join|slice` in `systemview.cjs`: **23 sites, 20 already inside an
`Array.isArray` guard, three bare** — the `runProofs` dry-run head, `sendUpdate`'s `sent`, and
`documents`' own list.

**None of the three can crash against today's hub**, because every success path sends its list — and
that is precisely what the `commitLinks` site looked like until somebody added a field. So `held()`
moved up beside `text()` and `fail()`, and all five expressions go through it. The honest reading of
an absent list is *nothing to report*, which is what an older hub is actually saying.

## 3 · The use-pass caught two more of mine

```
commitLinks({projectCode: "systemview-test", since: 12})
→ ONE WAY (2) · UNCLAIMED (2)
```

Both halves were one mistake twice over, and neither was about the documents:

- **a `Serves:` trailer on line 3 is not a trailer.** Git parses trailers at the END of the message;
  mine sat under the subject in `69928250` and `a9e1f2da`, so both read as serving nothing while the
  reports named them.
- **a bookkeeping commit must carry no trailer at all.** Writing a sha into a report is not a slice,
  and the earlier pairs already set that convention — `c11b0417` and `60bfdad7` carry none. Mine
  carried one, so each produced its own `oneWay`.

::commit{sha=49a669f0}

The trailers cannot be moved without rewriting history, which is yours — so the repair is on the
document side: both accounts now name the commits whose trailers actually parse. `commitLinks` over
the last eight commits reads *the two directions agree*.

## Where the tests stand

| what ran | where | result |
|---|---|---|
| `yarn test:api` | the hub's suite | **345** — 2 new |
| `npm run smoke:skew` | autobot | **6** — 3 new, mutation-verified |
| `npm run smoke:lanes` · `smoke:worklist` | autobot | 21 · 69 |
| the mutation pass | both | fixture restored to its old rest state → the new claim fails by name; `held()` as the identity function → all 6 skew claims die |

**What a green suite does not cover:** the autobot half is `electron/`, so it is inert until your
next shell restart — and until then `commitLinks` keeps working only because the hub restarted at
11:05 and sends `crossed` now. The systemview half needs no arming: the janitor reads the fixture
file on every pass, so the rest state is already safe.

## Walk it yourself

The systemview half is live:

:::cmd
cd ~/Systemly/systemview && node --test api/janitor.test.js
:::

- [ ] 18 claims; the last one reads the real `RFCs/proofs/mock-*.md` and passes
- [ ] `node RFCs/proofs/mock.js rfc retired` → the warning names the hourly pass and the teardown.
      Then `node RFCs/proofs/mock.js rfc off` to put it back where it rests
- [ ] delete the `off` comment so the leaf is live and retired again, re-run the suite → it fails by
      name and tells you which fixture and how to fix it

The autobot half **rides your next shell restart** — nothing presses it awake.

## What is on the board for you

One card, and it is the question I refused to answer myself: **should a leaf be able to say its
retirement is a test artifact?** A word like `fixture=true` would make a fixture safe even when a
walk is interrupted, instead of safe only when whoever walked it remembered to finish. That is new
vocabulary on a registration leaf, which is yours — so I built the half that needs no word.

## This account's own commit

::commit{sha=feff2869}
