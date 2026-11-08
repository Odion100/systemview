::report{id="The janitor ate the account that documented it" as=account retain=24h}

::members{who=systemview-test}

A use-pass on `commitLinks` reported two commits serving a document nothing had registered. The
document was a report filed two hours earlier. **The janitor had deleted it**, and what it was
about was the janitor.

## How it surfaced, which is the part worth copying

Nothing announced the loss. What announced it was a **DANGLING** finding:

```
commitLinks({projectCode: "systemview-test", since: 30})
→ DANGLING — serves an id nothing registered (1)
   feff2869 serves The fixture that could not survive a hub boot now rests torn down
```

`feff2869` is the commit that FILED that report. So the trailer was right, the document was gone,
and the only reason anybody noticed is that two directions were being compared. A report deleted
without a trace is invisible; a report deleted while a commit still points at it is a finding.

## The cause, read out of the log rather than guessed

```
[janitor] systemview-test: collected 1 retired — .systemview/report.systemview-test.the-fixture-that-could-not-survive-a-hub-boot.md
```

The leaf as committed was `::report{id="…" as=account retain=24h}` — **no `retired=` on it**. And it
had never been opened: `~/.autobot/documents-opened.json` holds no entry for its id, and the
retention sweep skips an unread report by design, so the sweep provably did not stamp it.

`isRetired` was the whole of it — it read the first 2048 bytes and tested them for ANY line matching
a registration leaf with `retired=`:

```js
const RETIRED_RE = /^\s*::(?:report|rfc|gap|arc)\{[^}]*\bretired=/m;
```

Line 36 of that report quoted the fixture's own leaf as its example. Run the janitor's expression
against the committed text and it answers `true`: the document was collected for explaining a
retirement.

**THE LESSON WAS ALREADY WRITTEN ONE FILE OVER.** autobot's `retention.cjs`, which stamps the
expiry, says in as many words: *"the leaf edit is surgical — the first `::report{…}` whose attrs
carry the row's id — so an example leaf later in a document is never the one that gets stamped."*
The sweep learned this; the janitor never did, and nothing in the system compares the two. One
abstraction, several offices — and a rule one office earned did not reach the other.

::commit{sha=3a9a6bdf}

`isRetired` now takes the registry row's id and tests the leaf carrying it. With no id — an older
caller — the document's FIRST leaf decides, which is what a leaf IS under RFC-073, and never a
later line.

## And the same use-pass found a second one, in the door itself

::commit{sha=c1802091}

The report's own restoration made `commitLinks` say something false. It reported the two commits
that served it as **UNCLAIMED** — *"that commit does not serve it"* — about a message whose second
line reads `Serves: The fixture that could not survive a hub boot now rests torn down`.

The trailer was at **character 82 of 1343**: on the line after the subject rather than in the block
at the end. `servesOf` reads the END block and has to — a sentence mentioning the word in prose must
never become a link — so it saw nothing, and the door then answered wrongly in both directions at
once: the commit read UNLINKED, the document read UNCLAIMED. **A reader following that advice edits
a document that was already right**, which is worse than silence.

A misplaced line is now its own finding, carrying the id it meant to serve and the move that fixes
it, with both false halves withheld — the same shape as `crossed`, for the same reason.

::commit{sha=240149d project=autobot}

## The eaten account is back

::file[.systemview/report.systemview-test.the-fixture-that-could-not-survive-a-hub-boot.md]

Restored out of `feff2869`, and nothing is faked by doing it: its 24h clock never started, because
the ledger has no open for it. It reads today exactly as it was filed.

## A third finding, and this one he had already filed

::commit{sha=9c1f02ea}

::commit{sha=4d7acd3 project=autobot}

The card, in his words from 2026-11-04: *"I don't see any list down here… I refresh the page and
there it is."* A run opened under `skill:skill-authoring` and the drawer did not draw it until a
reload — and a run nobody can see is held is the one thing runs exist to prevent.

**Two causes, in two processes, and the card had guessed at a third.** It suspected the strip reads
on mount; it does not. It reads when it is TOLD, and it was told too early:

| where | what was wrong |
|---|---|
| `sessions.cjs:2493` | `run.started` was emitted thirty lines **before** `writeRun` — so the window read the files and the record did not exist yet |
| `useAgentSession.js` | the `todo.updated` arriving AFTER the write was filtered to `lane:` sources only, so a `skill:` or `job:` run was never read a second time |

Either fix alone closes it. Both are done deliberately, because they land in processes that restart
on different hands — the window has the fix now, the host has it on your next shell restart.

The predicate also moved out of the hook into `laneTick.js`, where a suite can reach it. Its rule is
one sentence: **`source` is what opens a run, so a sourced write has touched a record the strip
reads** — and a write with no source is the session's own plan, which has no record, so re-reading
disk for it asks a question the disk cannot answer.

## Where the tests stand

| what ran | where | result |
|---|---|---|
| `node --test api/janitor.test.js` | the hub's suite | 22 assertions pass — **4 new** |
| `node --test api/commitLinks.test.js` | the hub's suite | 20 assertions pass — **4 new** |
| `laneTick.test.js` | the window suite | 6 assertions pass — **new**, mutation-verified |
| `smoke:worklist` · `run-slots` · `nudge` | autobot | 73 · 7 · 24 green |
| `yarn verify` | window + hub + cli + build | **159 suites / 2320** · 355 · 12 · green |

**Mutation-verified twice, because one pass was not enough.** Restoring the any-leaf test kills two
assertions. Pinning the id lookup to `null` — so the first-leaf fallback answers everything —
killed only one, and that one exists because the first mutation revealed the id path was otherwise
dead code that read as a rule.

**What a green suite does not cover:** the fix is in `api/`, so it is absent from the running hub
until it restarts. The next hourly pass still runs Monday's code, which means any document that
quotes a retired leaf in its first 2048 bytes is still collectable right now.

## Walk it yourself

:::cmd
kill $(pgrep -f "systemview start 3000") && systemview start 3000
:::

- [ ] the restored account is still there after the boot pass — it was not, twice, before this
- [ ] `commitLinks({projectCode: "systemview-test", since: 30})` → the DANGLING line is gone
- [ ] `grep -n "retired=" .systemview/report.systemview-test.the-janitor-ate-the-account.md` → this
      very report quotes a retired leaf and survives, which is the proof in the place it matters

## This account's own commit

::commit{sha=23801077}
