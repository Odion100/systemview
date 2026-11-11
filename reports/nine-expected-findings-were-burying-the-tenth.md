# Nine expected findings were burying the tenth

::report{id="Nine expected findings were burying the tenth" as=account retain=24h}

**`commitLinks`' `oneWay` bucket stood at nine, and every one of them was arithmetic.** A report
cannot hold the sha of the commit that writes it, so every account ever filed left a permanent entry
there. The bucket that exists to surface a broken link had become the place a broken link would hide.

**And it was hiding one.** The moment the self-references were classified out, a real one-way
appeared that nobody could have picked out of nine: the commit carrying this very fix touched `api/`
files, so its document genuinely owed it a record.

| | |
|---|---|
| **before, through the live door** | `oneWay: 9` — every entry a commit that wrote or edited the report it serves |
| **after, same call, same window** | **`oneWay: 1`** — and that one is real |
| **classified, never hidden** | `selfWriting` is reported in full with the same fields. Note `pq5k` is explicit the fixed point stays visible rather than being made to disappear by dropping a trailer |
| **and `agreed` can be true again** | it never could have been otherwise: one account filed, one permanent entry, forever |
| **structural, never a subject-line guess** | a `docs(report):` prefix is a habit; the files a commit touched are a fact |
| **tests** | hub 444 → **448** · 2632 window · 23 cli · `yarn verify` green bare, ratchet clean, build compiles |
| **arming** | `api/` — the hub was restarted, so **this is live** |

---

## Press-list

- [ ] `commitLinks({projectCode:"systemview-test", since:20})` — `oneWay` should be short and every
      entry should be something you would actually want fixed; the report-writing commits should be
      under `selfWriting`.
- [ ] `node --test api/commitLinks.test.js` — 66 assertions, four of them new.

:::cmd
cd ~/Systemly/systemview && node --test api/commitLinks.test.js
:::

## The evaluation, written before the work

From a **use-pass on my own night's output**, which is the third time that has found a real fault
today:

> `commitLinks({since:20})`: 20 commits, 20 carrying a Serves trailer, and **9 oneWay**. Every single
> one is a commit that WROTE OR EDITED THE REPORT IT SERVES. […] This will never go to zero: every
> account ever filed adds at least one permanent entry to this bucket, forever.
>
> THAT IS A BURIAL PROBLEM, AND THIS DOOR ALREADY KNOWS THE FAULT CLASS BY NAME. Its own comment,
> written when the unreadable bucket landed: *"counting it six times is how a real finding gets
> buried under its own echoes — the lesson from the burial bucket, applied before it could happen
> here."* It was applied to that bucket and not to this one.

## What was built

::commit{sha=7e595f0c}

::file[api/commitLinks.js]

**An absent file list is UNKNOWABLE, not empty**, and that is the guard that keeps this honest: a
merge lists nothing, and *"touched only its own document"* is not a claim an empty list can support.
Such a commit stays a finding rather than being excused by a gap in the evidence — which is also why
every pre-existing assertion in the suite passed untouched, since their fixtures carry no files.

**`selfWriting` is deliberately absent from `agreed`'s negation.** Every other bucket there is
something somebody has to go and fix; this one can never be emptied, so including it would mean the
door could never say "agreed" again after any account was filed.

::file[api/index.js]

**The reader needed care for two reasons that are easy to get wrong.** `git log` appends
`--name-only` output *after* the pretty format, so a trailing record marker would land before the
file names — the marker has to LEAD. And `%B` is multi-line, so the body needs its own terminator
before the names or the two blur. The `armed` handler twelve lines above can split on lines because
its format is single-line; this one cannot, and the comment says so where the next reader stands.

## Verified through the real door, on the output that found it

| | |
|---|---|
| before | `20 commits read · 20 carry a Serves trailer` · **ONE WAY (9)** |
| after | `20 commits read · 20 carry a Serves trailer` · **ONE WAY (1)** |

The remaining one is `7e595f0c` itself — the code fix — and it is correct for it to be there: the
commit changed `api/` files, so the document owes it the record this very section gives it.

## Where the tests stand

| suite | ran | says |
|---|---|---|
| hub | 448 | green — 4 new, all on the classification |
| window | 2632 | green — and says nothing about this; no window code changed |
| cli | 23 | green |
| `yarn lint:ratchet` | — | clean |
| production build | bare | compiles |
| the live door | `commitLinks` | 9 → 1, before and after a hub restart |

## What I could NOT do or verify

- **I made the same `Serves:` mistake a third time.** The commit first carried the PREVIOUS sitting's
  report id, which I noticed only when running the door on it. Amended while unpushed and before any
  document recorded the sha — but three times in three sittings is a pattern, not an accident, and
  the honest reading is that I copy the trailer from the last commit instead of asking which document
  accounts for this work. The rule I am taking from it: write the report's title into the trailer
  from the report I am about to file, never from the one above it in the log.
- **Nothing here was seen rendered.** `commitLinks` has a window surface — the four renderer halves
  that have been waiting on your shell restart since last night — and I have not watched `selfWriting`
  come out of it. The renderer will not know the bucket exists; it is additive, so the existing
  display is unaffected, but a surface that shows the new bucket is unbuilt and uncarded until I know
  what the renderer currently does with an unknown key.
- **The nine are not retroactively recorded.** They are classified now, which is the fix; going back
  to add nine `::commit` records to five reports would create five more self-writing commits and
  change nothing a reader needs.
