# Nine false accusations became one true finding

::report{id="Nine false accusations became one true finding" as=account retain=24h}

**`commitLinks` would have reported nine correct commits as `dangling` — "serves an id nothing
registered" — about a document that IS registered**, because the hub's read dropped a registry row
it could not open and the audit never knew it existed. One finding per document now, carrying where
it looked and why the read failed.

**And the card that sent me there was wrong, which is the more useful half.** It said `manager` has
registered documents and no root. It has a root, all six reports resolve, and nothing is being
skipped. What made me believe otherwise was **my own malformed call**: a SystemLynx method takes its
arguments in `{"__arguments":[ … ]}`, my `curl` put them at the top level, the method ran with
`projectCode` undefined, and its own guard answered *"no folder for this project"* — blaming me for
the one thing I had got right. That refusal is in three of my accounts as a fact about the hub.

| | |
|---|---|
| **fixed** | a registered-but-unreadable document is its own bucket, never a dangling trailer; `documents` means registered with `read` beside it |
| **and then** | `Agent.armed` — which committed work is newer than the process running it, the thing nothing in this system said |
| **and then** | **one-way links 29 → 0** and the one `crossed` label with them. Every single one was a document missing a record, not a commit missing a trailer |
| **corrected** | three accounts that blamed the hub for a refusal my own request shape caused |
| **tests** | 2607 window · 416 hub (+17 tonight) · 23 cli · `yarn verify` green including the production build |
| **arming** | the hub half is **live** — restarted twice from `~/autobot`, cwd confirmed, listener pid 40963. Nothing here rides your shell restart |

---

## Press-list

- [ ] `commitLinks({projectCode: "systemview-test", since: 400})`. `oneWay` should be **0**, and
      everything left should be something only a history rewrite can fix.
- [ ] `armed({projectCode: "systemview-test", paths: ["api", "cli", "src"]})` — it should say the
      hub is current. Then pass `since` as any earlier ms timestamp and watch it name the commits.
- [ ] Open the walk report and press one of the twenty-two new records: it should resolve to a real
      commit from 11-01 to 11-03.

## The evaluation, written before the work

The card declared `spec` and asked two questions: is a rootless registration a finding, and should
every door that counts documents say how many it could not open. **The verdict I put on the board
before touching anything was *do something else*, because the card's premise is false** — and the
line is still there with its reasoning:

> `manager` is NOT rootless. `projects.json` has it at `/Users/odionedwards/manager`,
> `shellProjectRoot` answers it, all 42 registered documents resolve and exist, and the running hub
> resolves a manager report over `/sv-resolve`. So nothing is being skipped today. The real fault is
> one level over.

The second half of the card, though, was exactly right, and it is the half I built.

## What the fault actually was

::commit{sha=a8c45f2a}

The hub read every registry row and ended with `.filter(Boolean)`:

```js
try { text = fsGit.readFileSync(abs, "utf8"); } catch { return null; }
```

So a row it could not open was gone before `audit` saw it. **The cost is not a quiet undercount —
it is a false accusation.** `byId` has no entry, the `!doc` branch runs, the retired-document check
misses (the file was never deleted), and the commit lands in `dangling`: *serves an id nothing
registered*. A reader following that finding edits a trailer that was already correct, and the one
artifact that is broken — the registration, or the file's location — is never mentioned.

**Measured on this repository rather than reasoned about.** I pointed RFC-078's registry row at a
path that is not there, called the real door through `Client.loadService`, and put the registry back
byte-identical afterwards:

| | before the fix | after |
|---|---|---|
| nine real commits serving RFC-078 | **9 `dangling`** | **1 `unreadable`**, carrying all nine shas |
| the document count | 42 (silently "what I could read") | `documents: 42`, `read: 41` |

```
{ "id": "RFC-078", "project": "systemview-test",
  "looked": "/Users/odionedwards/Systemly/systemview/RFCs/RFC-078-MOVED-AWAY-FOR-ONE-MEASUREMENT.md",
  "why": "the file is not where the registry says it is",
  "shas": [ "afa51dfb…", "38b4fb3c…", "f22c697b…", … ] }
```

And the counterfactual, so the "would have" is not my word for it:

```
OLD: dangling = 9 | agreed = false
NOW: dangling = 0 | unreadable = 1, shas = 9
```

:file[api/commitLinks.js]

**Three decisions inside it, each one a lesson from the four fixes before it.** One finding per
DOCUMENT and not per commit — six echoes of one fault is how a real finding gets buried, which is
what the burial bucket taught two days ago. An unreadable row appears even when no commit serves it,
because a registration pointing at nothing is a fault before any trailer names it. And it does
**not** hold `agreed` down: an unreadable document is an absence, not a disagreement, so it has the
same standing as `expired` and `noted` — what keeps that honest is that the bucket is in the answer,
and a clean `agreed` beside an empty `unreadable` is the only clean bill of health.

## The caveat in three reports was mine, not the hub's

::commit{sha=5eb99349}

Three accounts filed last night carry a line in their what-I-could-not-verify section blaming the
hub: a `curl` at the service route answered *"no folder for this project"* for every project, and I
wrote it up as *"the MCP route resolves roots differently"*. **It does not.**
`systemlynx/ServerManager/components/Server.js:40` destructures `__arguments` off `req.body`; my
body put the arguments at the top level; the method ran with `projectCode` undefined and answered
from its own guard.

Called properly, the door answers the real repository — and these are the numbers those three
reports said could not be got:

| what the report said it could not verify | what it actually answers |
|---|---|
| `noted` populated over the real repo | **`noted: 66`** at a 400-commit window |
| `retiredScan`'s own numbers, "inferred from the dangling count moving by forty" | **`{paths: 105, found: 34, capped: false, cap: 400}`** |
| documents in projects the hub cannot see | **42 registered, 42 read** — nothing skipped |

The three caveats are replaced by the measurements. **The store had already recorded the rule** —
note `z0zh` says to use the client and not to hand-roll the wire — and I derived it from source
anyway, a day after writing the note's own warning into three reports. The note now carries the
symptom as well as the rule, because the rule alone did not stop me: *a service refusal that names
a missing input is a wire-shape suspect first and a logic suspect second.* A board card is filed for
the SystemLynx side, where a POST with no `__arguments` key could be refused by name instead of
running with none — that one is yours to weigh, since it turns on what legitimately posts an empty
body today.

## Then: which committed work is not live

::commit{sha=a4c7c101}

I had lived the next card the same morning. Working out that your owed shell restart arms **five**
commits and not seven meant reading the electron main's start time out of `ps` and diffing it
against seven commit stamps by hand. The card says it plainly: *nothing says which committed work is
not live in the running processes*, and *the answer is a line somebody can read when a fix looks
dead, not a prompt to restart.*

The comparison is one subtraction — a process has a start time, git knows when each tracked file
last changed. **It is parameterized on `since`** rather than a surface that tries to know about
every process: the caller brings the start time of the process it is asking about, and the hub
defaults to its own because that is the single process it can speak for without guessing.

:file[api/armed.js]

**Verified against git's own answer, on this repo.** Asked with a one-hour baseline:

| | `armed` says | `git log --since` says |
|---|---|---|
| distinct commits newer | 5 | 5 |
| `api` | 2 — `a8c45f2a`, `1204f7ed` | the same two |
| `reports` | 3 — `5eb99349`, `c5ecdcf8`, `0d0083f5` | the same three |
| `cli` · `src` | 0 · 0 | 0 · 0 |
| uncommitted | `api/index.js`, `api/armed.js`, `api/armed.test.js` | the same three |

**Three things keep it from being another confident count.** No baseline is a **refusal**, not a
zero — `since: 0` would make all of history newer and report a catastrophe in a confident voice,
which is the failure this is a reaction to. The baseline travels with the answer, with whose it is
(`"this hub's own start"` or `"as given"`). And a group is a directory prefix, never a substring, so
`api` cannot match `apiary/` — the way this count would go quietly wrong rather than visibly wrong.

## And then the door's own findings, which were mine all along

::commit{sha=03cf75c5}

Running the door on my own work is the last step the job asks for, and it reported **29 one-way
links**. Every single one was a document missing a record — never a commit missing a trailer. So the
half that was broken was the one a reader walks backwards from, and it was the half I own.

| | |
|---|---|
| 22 | the walk report, 11-01 to 11-03, from before it had a records section at all — now in three dated blocks beside what each night did |
| 5 | RFC-078's 2026-11-09 amendment, into the **document-level** fold, for the reason that fold states about itself: a record parked inside a claim dies when the claim is removed, which is how 45 of these were lost once already |
| 2 | single reports, one record each |

**`oneWay: 29 → 0`**, and `unclaimed` stayed at 0 throughout — which is the check that all 29 shas
really do point back, rather than me having pasted plausible ones.

**And the card's second half was wrong, which is worth saying so the next run does not re-pick
it.** It claimed the walk report "names four shas that serve something else, so it is wrong in both
directions at once." Those four — `b277cb5e`, `7e250584`, `e0fce8ea`, `249ff06c` — carry **no
`Serves:` trailer at all**. The document names them legitimately, in a paragraph that says what each
one changed; the commits simply predate the convention. That is `unlinked` on the commit side and
honest, not a crossing. Nothing was wrong in both directions.

**The one `crossed` label fell out of the same pass.** A commit saying `Serves: G-13` had its sha
carried only by the sitting's own account, which reads as a wrong label — and the reason was that
**G-13 held no `::commit` records at all**, not that anything was mislabelled. The gap names its
filing commit now.

::commit{sha=5e681203}

**That is the commit that created this file**, recorded by a later one carrying no `Serves:`
trailer — the convention rather than an omission. A report cannot hold the sha of the commit that
writes it, so the record lands in the next touch; that touch serves nothing and reads as `unlinked`,
which is the honest answer for a document edit. Trying to make it name itself is how I turned one
sha into two wrong ones a minute ago: an `--amend` moved the commit I had just written down.

## Where the tests stand

| suite | ran | says |
|---|---|---|
| window | 2607 | green — and says nothing about any of this; no window code changed |
| hub | 416 | green — 17 new tonight: 9 on the unreadable bucket, 9 on `armed` (one file overlaps the count) |
| cli | 23 | green |
| production build | bare, in `yarn verify` | compiles |
| the real door | `Client.loadService` → `Agent.commitLinks` / `Agent.armed` | both answered the real repository, numbers above |

## What I could NOT do or verify

- **The `unreadable` condition does not exist on this machine today.** 42 rows, 42 resolve. Every
  measurement of the bucket is on a **planted** row — RFC-078's path pointed at a file that is not
  there, and put back byte-identical. The condition arrives the first time a project leaves
  `projects.json` or a document moves between parses, and it arrives looking exactly like a dangling
  trailer, which is why it is pinned now.
- **The rendered side of any of this.** Your shell holds the old renderer, so `unreadable`, `read`
  and `armed` have not come out of the window in front of me — only out of the hub, through the
  client, with the numbers above. The MCP tool description in my own session is still the old one,
  which is how I know.
- **`armed` on autobot's `electron/`** — the half that would have helped me most this morning. The
  shell knows when it started and nothing asks with it, so that question is still answered by
  reading `ps`. It is a second repo and dead until you restart, so it went back on the board as its
  own card rather than being half-landed here.
- **The twelve `misplaced` trailers.** A `Serves:` line outside the trailer block, which git does
  not read as a trailer at all — fixing them means rewriting commit messages, which is yours. After
  tonight they are the entire remaining disagreement on this repo. The one `crossed` label went with
  the rest: a commit saying `Serves: G-13` whose sha only the sitting's account carried, because
  **G-13 held no `::commit` records at all**. It names its own filing commit now, and `crossed` is 0.
- **Whether the nine pre-existing `dangling` findings are wrong.** They are trailers naming ids
  that were renamed afterwards — also a history rewrite. Three more appeared tonight because my own
  commits name this report; writing this file registered the id and they resolved on the spot,
  measured: **12 → 9**, with `oneWay`, `unclaimed` and `unreadable` all at 0 and 43 documents
  registered and read.
