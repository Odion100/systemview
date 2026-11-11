# Eight cards met the live system

::report{id="Eight cards met the live system" as=account retain=24h}

**Two of his cards in two sittings had turned out already-built when checked against the running
system rather than read.** So this sitting checked a batch of the oldest undeclared `open` cards
before any of them could be picked up as work — eight readers, one card each, every verdict carrying
an address.

**The headline is not what I expected.** Six verdicts in, only one card was wrong about being
outstanding — and the sweep's real value was elsewhere: one card **undercounted**, one pointed at a
**surface that no longer exists**, and two had **half their work already landed** without anybody
updating them.

| verdict | cards |
|---|---|
| **still true** | 3 — and one of them undercounted by a module |
| **partly** | 3 — a half landed, a surface moved, a fault narrowed to latent |
| **built this sitting** | 1 |
| **a misdiagnosis** | 1 — real observation, wrong cause, disproven from the transcript |

**All eight verdicts are in.** Of eight cards, **five were wrong in a way that would have cost a sitting each** — and only one of those five was wrong by being already built.

---

## Press-list

- [ ] `node tests/hub-skew.js` and friends in `~/autobot` — fourteen suites green after the ESM move.
- [ ] The board now carries six cards whose status says what was MEASURED rather than what was
      guessed; the two `reviewed` ones are the next real work and both name their fix.

:::cmd
cd ~/autobot && node -e 'require("./electron/agents/systemview.cjs");require("./electron/agents/context.cjs");console.log("both load")'
:::

## What got built — the card that was right and undercounted

::commit{sha=1998924 project=autobot}

*"three more agent modules carry the top-level ESM require."* Still true, **and it was four.**
`context.cjs:35`, `discovery.cjs:23`, `services.cjs:28` — and `systemview.cjs:11`, the MCP door I had
been editing all night without noticing.

`@anthropic-ai/claude-agent-sdk` is `"type": "module"` with no `require` condition in its exports, so
a top-level require makes the **whole module** unloadable to any CommonJS caller on node older than
22.12 — and the hub runs v20.11.1 while the shell and terminal run 22+. The blast radius is real:
`context.cjs` alone is required by `host.cjs`, `hooks.cjs` twice, `definitions.cjs`,
`apps/context-host.cjs` and two test files.

**Four one-line deferrals, not a refactor** — every use was mapped to its enclosing function first,
and `worklist.cjs` has done it exactly this way since 2026-10-27.

## What the sweep was actually worth

**A card can be wrong in more ways than "already fixed".** The two that would have cost the most:

- **A card pointing at a surface that no longer exists.** *"the band's arc row counts flags the trail
  no longer believes"* — the band has no arc row; documents moved to the dashboard on 2026-11-06.
  The defect survives verbatim in `arcRows.js:53` and now shows on Dashboards A, B and C. Re-titled,
  because as written it sends a run to a tab that is not there.
- **A card whose half had quietly landed.** *"a subagent's worklist and whiteboard writes land on the
  owner's"* — the `get` half was fixed on 2026-11-09 (`7bc70a2`); it now answers with every open run,
  stalest first. The whiteboard is still one unnamespaced slot (`sessions.cjs:2907`) and run records
  still name no agent (`worklist.cjs:336-343`). Stamped `partial` with the line between them.

And one narrowed from alarming to latent: *"C's shelf drops a card when two projects share a file
path"* is **not a user-visible drop** — `shelvesFrom` partitions by project before calling `cardsFor`
(`dashboardC.data.js:327`), so every shelf is correct today. `cardsFor` alone is unsafe for a future
caller, which is a different and much smaller thing.

## The misdiagnosis — the most expensive kind of wrong card

*"the skill listing shrank mid-session — invocation refused for skills on disk."* The observation was
real; **both conclusions drawn from it were false**, and as written the card sends somebody hunting a
harness bug that does not exist.

A one-skill listing is the **CLI re-announcing a skill whose file just changed**. From the session's
own transcript, the same skill 78 minutes apart with DIFFERENT description text — a re-announce after
an edit, not a replacement. The pattern holds across the session: every single-skill listing names
the skill being edited at that moment, interleaved with full listings of 29–37.

**And invocation was never restricted.** Two recorded calls succeeded under a one-skill listing that
named something else — `Skill{assignment}` and `Skill{context-maintenance}`, neither erroring — and
`Skill(rfc-execution)`, the one the card says was refused, ran three times in the same session.

Nothing harness-side prunes anything: the only gate is `sessions.cjs:484`, and **no agent definition
sets `skills` at all**.

## The two that are now the best-specified work on the board

Both were `open` with no declaration; both now carry a reproduction and a named fix.

- **two-leaf cross-talk.** Reproduced: a report row sitting beside an RFC carries the **RFC's
  verdict**. The leaf half IS kind-scoped (`blocks.cjs:363`) and the approvals read is not (`:332`) —
  and `objectives` and `approvals` have the same hole. Currently data-level only: `stateOf` reads
  `verdict` for rfc/arc alone, so no surface draws it yet.
- **the sibling-session cookie.** Still true, and the leftover is **on disk right now**:
  `.systemview/session.json` holds a `:5556` Cookie dated Oct 27. `headersOf` flattens headers across
  projects (`api/runTests.js:71`), so two specs in one project assert opposite values for the same
  method.

## Where the tests stand

| suite | ran | says |
|---|---|---|
| autobot, fourteen suites | hub-skew · registry · markdown-state · documents · attachments · job-path · nudge · hooks · board · lanes · compaction · run-slots · context · docs | green, exit 0 each |
| module load | all five agent modules | load clean after the deferral |
| systemview | — | not run and did not need to be: nothing in that repo changed |

## What I could NOT do or verify

- **Nobody reproduced `ERR_REQUIRE_ESM`.** This machine is node v22.21.1, where `require(esm)` is
  unflagged and succeeds. The fix rests on the package's own exports map and on a measurement from
  2026-10-27 that I am repeating rather than re-deriving — said plainly because "we fixed it" and "we
  saw it fail" are different claims.
- **All eight verdicts landed and all eight are applied.** The last one — subagent rows named by a
  tool-use id — is still true and now carries its cause: the name is derived from a TRANSIENT spawn
  event (`AgentChat.js:7812` ← `feedRows.js:106`), while a durable name sits unread on disk in
  `subagents/agent-*.meta.json`. Two further holes in the same function were found on the way: it
  reads only `input.prompt` where autobot reads `prompt || description`, and the capture sits in the
  non-parented branch, so **a nested subagent can never be named**. Their cards are untouched and still `open`, which is the honest state.
- **Every verdict here is a READER's, verified by its address rather than by me re-running it.** I
  applied them because each one carries a file:line or a command output I can follow; I did not
  independently repeat the six investigations.
- **No live dashboard was looked at** for the arc-row card, and no live arc was checked for an actual
  disagreement between ticked flags and settled plans. The re-aiming is from source and git history.
