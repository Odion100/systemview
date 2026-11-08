::report{id="The board answers the question it was asked" as=spec retain=30d}

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

**The proof is ONE SAVED SPEC AT THE REAL DOOR'S OWN ADDRESS — `Hub.Agent.board`.** The rule it took
all night to learn, stated once: a SystemLynx service has to be CONNECTED to SystemView, through the
plugin, under a project, before anything can be tested on it — and the hub's own service never was.
So the hub now registers with itself the way every real service registers (`api/index.js`, serviceId
`Hub`, project `systemview-test`, spec store `api/specs/`), and the spec lives there: four setup
steps, six assertions, cleanup through the plugin's own fixture door, everything calling the exact
method your window calls.

::::claim[`at` with no write reads that one card whole, instead of answering with the whole board]{id=b1 state=met by=systemview-test note="addressed by PART of a title among three cards, two of which share a substring; the body and the how come back; `cards` is asserted absent — the fallthrough's signature"}
::test[Hub.Agent.board]{project=systemview-test}
::::

::::claim[`brief` hands back the index and never the bodies]{id=b2 state=met by=systemview-test note="three index rows asserted field by field — the untitled one says so instead of being silently named, the titled one carries its declaration and its 22-char body SIZE, and `cards` is absent"}
::test[Hub.Agent.board]{project=systemview-test}
::::

::::claim[a parameter the door does not understand is refused by name, and writes nothing]{id=b3 state=met by=systemview-test note="the refusal names `stat` and hands back the vocabulary; the read after it finds the same three cards, so a refused call cannot have half-happened; an ambiguous address is likewise refused with its candidates"}
::test[Hub.Agent.board]{project=systemview-test}
::::

**TODAY THESE CHIPS RESOLVE TO NOTHING, AND THAT IS THE LIVE HUB SAYING SO.** The registration is
code in `api/`, and `api/` rides your restart — the hub you are running has no `Hub` service and the
old board door besides. After the restart the chips resolve, the spec runs here, and the eight node
assertions that mutation-proved the behaviour (all eight red against the old door) stop being the
only runnable evidence.

## What ran

The evidence is a command, and it is the same one either half of this runs under.

:::cmd
cd ~/Systemly/systemview && node --test api/board.test.js 2>&1 | tail -5
:::

:::cmd
cd ~/autobot && yarn smoke:board 2>&1 | tail -4
:::

The eight new assertions were checked the only way a new assertion is worth anything — by stashing
`api/board.js` and `api/index.js` and running them against the old door. Eight failed, thirty-three
passed; with the change, forty-one pass.

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

**THAT EMBED FOUND A BUG, AND IT STAYS HERE AS THE REPRODUCTION.** Line 1 of that file is its leaf,
so embedding its head renders a second registration leaf inside this document — and a leaf claims
the proofs panel on mount. Reading this report, his three specs loaded and then vanished a beat
later as the embedded leaf claimed the panel for a document nobody had open: *"the test show up for
a second and then go away."* One open tab, two leaves. The fix is in the window, below.

Writing proofs into either one would have been manufacturing evidence for claims neither document
makes — and the pattern across all three is one thing, which is that `spec` got declared on work
that owed an account. A sitting's account owes a statement of what ran. A spec is a contract, and
nobody is a party to these.
