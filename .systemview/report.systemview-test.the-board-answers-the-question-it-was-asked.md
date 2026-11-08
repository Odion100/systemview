::report{id="The board answers the question it was asked" as=account retain=30d}

::members{who=systemview-test}

I read the board to choose what to work on, and it cost about 12,000 tokens and **truncated
mid-card** — so the last of the thirty open cards were not merely expensive, they were unreadable,
and the pick got made off a partial board. The door had no smaller question in it. Every call that
was not a recognised write answered with all 125 cards, including the most precise question you can
ask it: `at: <one card>`.

Three reads now exist where there was one, and an unrecognised parameter is refused instead of
answered.

| | | |
|---|---|---|
| `at` alone | **that card, whole** — with its replies | it already addresses one by id, title or part of a title for every write |
| `brief` | **the index** — id, title, state, what it owes, body size, reply count | the bodies are the entire cost, and a picker needs none of them |
| `brief` + `state` | the index of one state | the read a picker actually makes |
| anything it does not know | a refusal naming it, and the vocabulary it does know | nothing is read and nothing is written |

## Where the tests stand

| what ran | where | what it said |
|---|---|---|
| `api/board.test.js` | this tree | 41 pass — 8 of them new, **and all 8 fail against the old door** |
| `yarn verify` | this tree | 2323 window · 363 hub · 12 cli, plus the production build |
| `yarn smoke:board` | `~/autobot` | 9 claims, the tool-schema and renderer half |
| `smoke:worklist` · `smoke:nudge` · `smoke:lanes` | `~/autobot` | 73 · 24 · 21, unmoved |

**What green does not cover:** nothing here has run against the LIVE hub, because the live hub is
the process you started at 13:00 and `api/` only rides a restart. Until you restart it, the board
door you call is the old one — it will keep answering a `brief` read with every card, because the
parameter is dropped before it arrives. That is the same failure this change is about, which is the
honest reason it cannot demonstrate itself yet.

## The evaluation, recorded before the work

The card is *"a board write that matches no branch silently answers with the whole board"*, declared
`report=spec` by a pass that had not built anything. The verdict went on the card before I touched
the code: **do something else — wider than stated.** The card asks for a refusal plus "a read that
can ask for less", and the most useful smaller read turned out to be the one the fallthrough was
hiding: addressing one card already worked for every write and did nothing for a read.

**And the refusal was in the wrong file.** `api/board.js` destructures its parameters, so I wrote
the catch-all there first — then found the hub route in `api/index.js` destructures too and drops
the names it does not know *before* `board.js` can see them. That is exactly where `report=` died
against a hub that had not restarted: the route dropped it, the read fell through, 125 cards came
back, and the caller could not tell the write had never happened. Policing the vocabulary in one
place requires the route to stop deciding — so it forwards what it does not recognise, and
`board.js` refuses it by name.

::claims

**The two halves are in two repos and the first is dead without the second** — the hub can hand back
an index nothing can ask for, and the tool can ask for one no hub answers.

::::claim[`at` with no write reads that one card whole, instead of answering with the whole board]{id=b1 state=met by=systemview-test note="4 assertions in api/board.test.js: the address resolves by part of a title, the body comes back whole, `cards` is absent, and the count it chose from is still said"}
:::cmd
cd ~/Systemly/systemview && node --test api/board.test.js 2>&1 | grep -E "at. with no write|unreachable .at"
:::
::::

::::claim[`brief` hands back the index and never the bodies, and composes with a state read]{id=b2 state=met by=systemview-test note="3 assertions: the exact index row for a titled card, an untitled one marked untitled rather than silently named, and the index of one state; plus a size assertion that the index is smaller than a single card's body"}
:::cmd
cd ~/Systemly/systemview && node --test api/board.test.js 2>&1 | grep -E "brief. hands back|untitled card is still|brief. narrows"
:::
::::

::::claim[a parameter the door does not understand is refused by name, with nothing read and nothing written]{id=b3 state=met by=systemview-test note="asserts the refusal names the typo, hands back the vocabulary, leaves the board byte-identical — and that an explicitly undefined option is NOT a refusal, so spreading options still works"}
:::cmd
cd ~/Systemly/systemview && node --test api/board.test.js 2>&1 | grep -E "does not understand|explicitly undefined"
:::
::::

::::claim[the hub route forwards what it cannot name, so one file owns the vocabulary]{id=b4 state=met by=systemview-test note="reads the REAL source of api/index.js rather than a mock — a mock of a passthrough passes while the passthrough drops things, which is the failure this claim's older sibling was written for"}
:::cmd
cd ~/Systemly/systemview && node --test api/board.test.js 2>&1 | grep -E "FORWARDS what it does not recognise|forwards every parameter"
:::
::::

::::claim[the agent-facing tool declares `brief` and prints the index as scannable lines, not JSON]{id=b5 state=met by=systemview-test note="autobot tests/board.js: the schema carries it (the SDK strips an undeclared parameter silently), it reaches the hub unstripped, and the rows carry the declaration pill, the untitled marker, the reply count and the line saying how to read one whole"}
:::cmd
cd ~/autobot && yarn smoke:board 2>&1 | tail -4
:::
::::

**THIS IS AN `account`, AND THE CARD ASKED FOR A `spec`.** The declaration was right — the work
owes runnable proof and it has some: 41 node assertions, 8 of them new, every one of the 8 failing
against the old door. What is missing is an ADDRESS for it. `as=spec` derives *invalid — no spec*
unless the document carries a `::test` or `:::run` block, and neither can reach a node suite: a
`::test` chip addresses a saved test and a `:::run` block resolves against the live connection tree
of registered services. A hub module is neither. So filing this as a spec would put *invalid — no
spec* on the row of a document whose evidence runs in one command — the kind's promise unmet on
paper while the proof is green on disk. The honest leaf is the one that does not claim an address it
has not got, and the missing form is a question for him, on the board.

**Why these are `:::cmd` and not `::test` chips.** A `::test` chip addresses a SAVED test, and
writing one here would have put a fifth pointer into a project that already has a card about 27
chips resolving to nothing. A `:::run` block resolves against the live connection tree — registered
services — and the hub's own board door is not one. So the proof is the command that runs the real
suite. Be aware of what that costs: `claims.js` derives *carries a spec* from a `::test` or a
`:::run` and never from a `:::cmd`, deliberately, because a cmd running a suite and a cmd running
`grep` are indistinguishable at parse level. **So the bar cannot read these five as spec'd whatever leaf this carries.** The evidence runs;
nothing in the vocabulary can point at it.

## Walk it

::branch[main]

Nothing to arm in the window — this is `api/` and `electron/`, so:

:::cmd
systemview stop
:::

Then start it from the Hub's apps page. The autobot half rides your **shell** restart; no press arms
it. Until both, the doors below answer as they did before.

- [ ] `board({projectCode: "systemview-test", brief: true})` → one line per card, 125 of them, and
      the last line telling you how to read one whole
- [ ] `board({projectCode: "systemview-test", state: "open", brief: true})` → the thirty I had to
      read in full to pick this card
- [ ] `board({projectCode: "systemview-test", at: "a board write that matches no branch"})` → that
      card alone, with the verdict I stamped on it before building
- [ ] `board({projectCode: "systemview-test", brief: true, stat: "open"})` → refused by name, with
      the vocabulary; nothing read, nothing written

::file[api/board.js#L166-215]

::file[api/board.test.js#L212-290]

## The commits

::commit{sha=fbde13a0}

::commit{sha=5ce411e project=autobot}

::commit{sha=cb3d8e16}

::commit{sha=090dd537}

::commit{sha=aa125ee7}

**The last one is recorded by a commit carrying no `Serves:` trailer, and that is the convention
rather than an omission.** A commit that adds its own sha cannot contain that sha, so a trailer on
it is `oneWay` forever and a third commit to fix it inherits the same problem. A bookkeeping commit
that serves nothing reads as `unlinked`, which is what it is, and the chain terminates.

**One commit of this sitting carries no `Serves:` trailer and I am not going to quietly fix it.**
`04b0c86f` — the band drawing the session's plan twice — was work he asked for directly before this
job fired, committed before any report existed to name. It reads as `unlinked` and that is accurate:
it served a request, not a document. Repairing the trailer would mean rewriting history, which is
his.

## What this did not touch

The mirror of the same bug is one layer up and it is autobot's: the MCP tool validates with a zod
object, which **strips** an undeclared parameter before the call leaves the shell. So a shell older
than the hub fails in exactly the way this change fixes for a hub older than the shell — silently,
with a full board coming back. `brief` is declared now, so it is not live today; the class is.

## The second pick, which the first one found

Finding my own leaf wrong sent me at the card that says the same thing about two older reports —
*"two spec reports have no spec in them"* — and both halves closed, neither the way the card
expected.

`lifecycle-walk` is **gone from disk**: retention took it, so there is nothing left to write a spec
into. `runs-belong-to-the-agent` is mine, from 2026-11-02, and it carries seven `:::cmd` blocks,
**zero claims**, and no spec block — so it was never a spec report whose spec was missing. It is an
account that got the wrong word. Its leaf now says so.

::file[.systemview/report.systemview-test.runs-belong-to-the-agent.md#L1-5]

Writing proofs into either one would have been manufacturing evidence for claims neither document
makes. The card is off the board with that account on it, and the cause it was a symptom of is a
card of its own — the missing form is new vocabulary, which is his to decide and not a run's to
invent.
