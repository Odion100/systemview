# Forty-nine findings became nine, and the nine are worth reading

::report{id="Forty-nine findings became nine" as=account retain=24h}

**`commitLinks`' DANGLING bucket was 49 findings and almost all of it was a report doing exactly
what a report is for.** A report's normal end of life — the janitor collects it, its row leaves the
registry — made every trailer that ever named it read *"serves an id nothing registered"*. The
bucket carried no signal and was structurally guaranteed to grow forever.

**It is 9 now**, and those nine are the ones that were buried:

| what the nine are | why it matters |
|---|---|
| three gap titles that were **renamed** after commits named them | the trailer points at an id that no longer exists anywhere |
| *"Refining the manager — what it enforces, what the doctrine is missing…"* ×3 | the document lives in the **manager** project and its title changed under commits that named it |
| *"RFC-075's own proofs point at 27 saved tests…"* ×2, *"a run block that resolves nothing…"* ×1 | same shape — a gap renamed, the link left behind |

| | |
|---|---|
| **fixed** | expired documents get their own bucket, carrying the `git show` that reads them back |
| **tests** | 2607 window · 385 hub · 23 cli · `yarn verify` green including the production build |
| **arming** | the hub half is **live** (listener pid 9229). The renderer half is autobot's and **rides your shell restart** |
| **the night's third fix to this door** | the window, the accounts, and now the burials — all three were the same fault wearing different clothes |

---

## The address, not the accusation

::commit{sha=21f19377}
::commit{sha=4362de5 project=autobot}

The card said the important part: *"the reasoning is NOT lost; it is one `git show` away."* So the
finding carries it:

```
EXPIRED — the document ended its life as designed; the reasoning is one `git show` away
  a09158cf serves RFC-077 — git show 1b2c3d4e^:RFCs/RFC-077-a-document-says-which-report.md
```

**Where the evidence comes from.** The documents are gone from disk *and* from HEAD — the card's own
test (`git cat-file -e HEAD:<path>`) was written when the janitor's deletions had not been committed
yet, and they have been since. So the burial is read out of history: one
`git log --diff-filter=D --name-only -- "*.md"`, then the deleted blob at `<sha>^:<path>`, parsed
with the **same** `LEAF_ID` rule the registry uses — exported from `api/reports.js` rather than
copied, because *"what id does this document declare"* is one rule and it is now asked of documents
that no longer exist.

**Cost, measured on this repo:** the log is 0.06s; the blob reads are one per distinct deleted
markdown path — 105 of them — and the whole scan is **1.0s**. Capped at 400 paths, and **the cap is
reported**: when it bites, the door says the split may be wrong for the oldest burials rather than
quietly guessing.

**Two rules keep it from over-reaching.** Expiry is not a disagreement, so it does not hold `agreed`
down — the trailer was right when it was written. And a document registered *today* is never read as
expired, whatever git remembers about a file that once carried its id. Both have assertions.

:file[api/commitLinks.js]

## All three of tonight's fixes to this door were one fault

Worth saying together, because the pattern is the point:

1. **The window** — it read 200 commits and reported *"the two directions agree"* without saying
   that was a window. A check that stops looking and reports clean.
2. **The accounts** — 17 findings that could not come out any other way, because a report is written
   after the work it accounts for. A check asking a question with only one possible answer.
3. **The burials** — 40 findings that were a document's designed end of life. A check treating a
   normal event as a fault.

Each one made the door's output less readable, and the third one hid a real finding behind forty
expected ones. **In every case the fix was the same shape: narrow what counts as a finding, and say
out loud what was narrowed.** The window line, the `noted` count, and the burial-scan cap all exist
for that reason.

## Where the tests stand

| suite | ran | says |
|---|---|---|
| window | 2607 | green |
| hub | 385 | green — 5 new here, 16 across tonight's three commitLinks changes |
| cli | 23 | green |
| production build | bare, in `yarn verify` | compiles |

## What I could NOT verify

- **The EXPIRED section rendered.** Your shell holds the old renderer until you restart, so what I
  have seen is the count moving (49 dangling → 9) and the unit assertions on the bucket's shape. The
  section itself has not come out of the door in front of me.
- **`retiredScan` over the real repo** — read off the response since, and the thing that blocked it
  was my own call: a SystemLynx method takes its arguments in `{"__arguments":[ … ]}`, so a body
  with them at the top level runs the method with `projectCode` undefined and the refusal reads like
  a missing root. Through `Client.loadService` the real repository answers
  **`retiredScan: {paths: 105, found: 34, capped: false, cap: 400}`** — the 1.0s cost measured above
  and the cap untouched, rather than inferred from the dangling count moving.
- **The nine remaining findings are not fixed.** They are stale links in commit trailers, which
  means fixing them is rewriting history, which is yours. They are now visible, which is the whole
  point of the change.

## Press-list

- [ ] After your next shell restart: `commitLinks({projectCode: "systemview-test", since: 400})`.
      DANGLING should be nine, and each EXPIRED row should be a `git show` you can paste.
- [ ] Paste one of them. It should print the retired document, intact, from history.
