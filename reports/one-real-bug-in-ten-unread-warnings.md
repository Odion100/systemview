# One real bug in ten unread warnings

::report{id="One real bug in ten unread warnings" as=account retain=24h}

**The card said clear 87 eslint warnings so the build gate can be strict. I read them instead, and
the reading is where the value was: three real findings came out of a class everybody calls style.**
A markdown block registered under a name already taken, so one chip drew two different things
depending on where you read it. A page in the tree that nothing could reach. And a board feature
with four paragraphs of comment explaining what it protects, wired to nothing.

| | |
|---|---|
| **fixed** | the registry collision, with a guard that reads the source — because a duplicate key is invisible in the parsed object |
| **deleted** | `src/pages/Agents/Agents.js`, reachable from nothing; the route it was for renders Context, which mounts the profile itself |
| **built** | `yarn lint:ratchet` — the warning class now fails when it GROWS, instead of waiting to be cleared |
| **cleared** | 33 warnings and four whole rules. The pile is two rules now, from six |
| **the gate is still NOT strict**, and that is the honest headline | 54 problems remain: 31 computed-and-dropped values and 23 hook deps, both on the board with what each needs |
| **tests** | 2610 window (+3) · 416 hub · 23 cli · `yarn verify` green including the production build and the ratchet |
| **arming** | `src/` is in the served bundle (rebuilt). `api/` and `cli/` are live — the hub was restarted from `~/autobot`. Nothing rides your shell restart |

---

## Press-list

- [ ] `yarn lint:ratchet` — under a second, and it should say no rule got worse. Then add an unused
      variable anywhere in `src` and run it again: it should fail and name the rule.
- [ ] `yarn verify` still passes bare, with the ratchet now inside it before the build.
- [ ] Two cards are new and both carry the full line-numbered list: the thirty-one values wired to
      nothing, and the twenty-three hook deps that must not be bulk-fixed.

## The evaluation, written before the work

The card's premise is reasonable and the order is wrong, so the verdict was **do something else**,
recorded on the board before anything was built:

> The count is 87 now, not 77, and lumping them together is what has kept them standing: 55
> `no-unused-vars` (mechanical), 22 `react-hooks/exhaustive-deps` (DANGEROUS to bulk-fix), and TEN
> others that are not a class at all. So I read all ten individually, which nobody had.

Two reasons clearing-first is the wrong order. The list regrows the moment nobody is watching — so
the gate has to go on against the backlog, not after it. And **a real bug can hide in a class nobody
reads**, which is not a hypothetical: one of the ten was live.

## Finding 1 — one name, two components

::commit{sha=b23fd09f}

`src/atoms/Markdown/registry.js` registered the key `report` at line 63 to `ReportLink` — the chip
that opens a report — and again eighty lines down to `Report`, the registration leaf. **An object
literal keeps the last key.** So the first component became unreachable through the registry, while
`AgentChat.js` went on importing it directly and using it in four places. The same `:report[…]`
therefore drew the leaf's lifecycle UI in a document and the real chip in the chat. One fact, two
answers — the shape of your own card about getting rid of the report drop block.

**The leaf owns the name**, and that decides the fix without touching your open question.
`::report{id=…}` is what makes a document a report, and three documents already say nothing should
write a `:report[…]` chip at all — `agents/markdown.md`, `agents/chat.md` and
`docs/interactive-markdown.md` each say *never*, because a report is a FILE and `:file[…]` reads as
one without navigating anywhere. `ReportLink` stays on disk because the chat uses it as its
unknown-ref fallback. **What a `:report[…]` in a document SHOULD draw is still yours** — removing a
line that could never be reached does not answer it either way.

:file[src/atoms/Markdown/registry.dupes.test.js]

**The guard reads the file, and it has to.** A duplicate key is gone from the parsed object by the
time you can count `Object.keys`, so the only instrument that can see this fault is the source. And
`registry.js` cannot be imported in jest at all — it reaches react-markdown, which is ESM outside
`transformIgnorePatterns`, and the suite dies on the import. **Proven to have teeth** rather than
assumed: I planted a second `ns` key, watched two assertions fail, and put it back.

The first version of that guard searched the whole file for the removed line and failed on the
**comment explaining why it was removed** — which is its own small lesson, now written into the
test: a check that reads prose is a check that breaks when somebody documents it. It asserts the
import is absent instead.

## Finding 2 — a page nothing could reach

::commit{sha=b536b6f8}

`src/pages/Agents/Agents.js` is the agent-management page: *"open an agent, see and change
everything feeding it (the always-loaded doc, tools, skills, MCPs, the knowledge)."* The route
`/agents/:projectCode?` renders `<Context />`. Nothing rendered `<Agents />`. Its only reference in
the entire tree was **an unused import in `App.js` that eslint had been flagging for weeks.**

Nothing is lost and that is checked, not assumed: `pages/Context/Context.js:281` mounts
`<AgentProfile />` itself, so the profile is live at that exact route. The twenty-line wrapper was
superseded and stayed in the tree on the strength of a dead import. It is gone, and the route says
why — the same way `App.js` already records the `/ide` removal, so the next reader meets the reason
where they stand rather than finding a gap.

## Finding 3 — a safety mechanism that was never rendered

Not fixed, and deliberately: this is the board's own feature and finishing it is a decision about
what the control looks like.

`src/organisms/Board/Board.js` computes `settledArmed`, `setSettledArmed`, `settledCount` and
`doneCount`, under comments that are emphatic about why each exists —

> *"WHICH GROUP IS ARMED, by name — not a boolean. Every state in the header is its own press, so a
> single `armed` flag would arm all of them at once and a press aimed at `partial` would read as a
> press on `done`."*
>
> *"TWO COUNTS, AND THE GAP BETWEEN THEM IS THE POINT. `settled` is how many cards carry an account;
> `done` is how many are FINISHED — and only those are what a press clears."*

**All four are wired to nothing.** The clear-just-the-settled button with its own arm, and the two
counts whose gap IS the safety, were designed, argued in comments, computed, and never drawn. It is
the same feature whose MCP description I had to correct yesterday (autobot `2cc3479`) for claiming
it clears every card with a status when it clears only `resolved` — so the surface and the code have
now both been found overstating the same thing. It is on the board with the line numbers.

## The ratchet, which is the durable half

::commit{sha=3fc16b6c}

:file[tools/lintRatchet.js]

The gate goes on **now**, against the backlog as it stands. A rule that is already failing keeps its
allowance; a rule that gets worse fails; **a rule nobody has seen before fails loudest**, because
that is the one most likely to be a real finding rather than style. An allowance that comes in under
its cap prints the new baseline to paste, so the number can only travel one way. An **error** is
never allowanced — `no-undef` and an unresolvable import are build failures, and a tool that
allowanced them would be the thing hiding them.

**Test files are excluded, and not for convenience.** The production build does not lint them, but a
bare eslint run extends `react-app/jest`, so the jest and testing-library rules fire at ERROR
severity on every spec: **1203 problems and 1093 "errors" with specs in, against 54 and zero
without.** Including them would measure a different system from the one the build gates, and the
number would read as a catastrophe nobody can act on. The suites are what check the suites.

**Teeth proven, not claimed:** I appended an unused variable and a sequence expression to a real
file and ran it — exit 1, with the error gate firing first, the worsened count named (`67`, allowed
`66`) and both new rules listed. Then put the file back.

## What got cleared, and the shape of the pile now

::commit{sha=fd550eeb}

| | before | after |
|---|---|---|
| rules in the pile | 6 | **2** |
| `no-unused-vars` | 66 | 31 |
| `react-hooks/exhaustive-deps` | 23 | 23 |
| `no-useless-escape` · `no-mixed-operators` · `no-sparse-arrays` · `no-dupe-keys` · `no-loop-func` · `no-fallthrough` · `import/no-anonymous-default-export` | 12 | **0** |

Every one of the twelve was read rather than silenced, and the two that looked most like real bugs
were not: both `no-loop-func` closures run synchronously before the variable moves, so they were
correct — and they now read from a `const` the loop does not touch, which is one reordering away
from mattering. `TestPanel` stopped re-scanning the names once per candidate while I was in there.
Four character-class escapes were already literal. A `&&`/`||` precedence a reader had to know by
heart is parenthesised. A `resolveRef` key whose first value was shadowed twice over is gone.

**And one unused binding is load-bearing**, so it says so now instead of sitting in the pile:
`watchGitRoots` in `api/index.js` is never called on purpose — armed, it fed itself to a load
average of 546 — and it carries an explicit disable pointing at the reason already written below it.

**A comment was protecting dead code by lying about it.** `test-helpers.js` carried `isFnRegEx` with
*"kept: `str.match(isFnRegEx)` callers below"*. There are no callers below; grep finds the
declaration and nothing else. That is worse than no comment — it is the thing that stops the next
reader deleting dead code.

## Where the tests stand

| suite | ran | says |
|---|---|---|
| window | 2610 | green — 3 new, all on the registry guard |
| hub | 416 | green — unchanged by this work |
| cli | 23 | green — and it is the suite that covers the four CLI files edited here |
| `yarn lint:ratchet` | 4 assertions' worth of comparison | clean, inside `yarn verify` before the build |
| production build | bare | compiles |

**A green suite says very little about an import sweep**, so the scope is worth naming: 27 import
statements across 17 files, plus seven discarded locals. What stands behind them is the production
build (an unresolved import is a compile error, and `no-undef` would catch a binding removed while
still referenced) and 2610 window assertions over the components involved. What neither covers is
whether removing a module from the graph removed a SIDE EFFECT it had on import — I checked each
removal was a component or a pure util, but that is my reading, not a test.

## What I could NOT do or verify

- **The gate is still not strict, which was the card's actual goal.** 54 problems stand. Turning
  `CI=true` on today would fail the build. The ratchet is the honest substitute and it is why the
  card is `partial` rather than removed.
- **The 23 hook deps are untouched on purpose.** One wrong dep is a render loop — I caused exactly
  that last night in `0c6450bd`, where `onFloor` sat in a dep array and was computed from a value
  the effect itself changed. A sweep would plant that fault twenty-three times. Carded, with the
  per-file list and `context.js` ×6 named as where to start, because a stale closure in the markdown
  scope is wrong in every document at once.
- **The 31 remaining values are a finding I did not act on.** Several are not leftovers but
  half-built features whose comments read as though they shipped — the board's arm, `Chats.js`'s
  `KICK_TTL` (so the kick cooldown the etiquette rests on is not enforced), and twelve in
  `AgentChat.js` including an add-a-visitor input that touches the connect arc's own question.
  Bulk-deleting them would destroy the intent the comments preserve, so they are carded one by one
  instead.
- **Nothing here was seen rendered.** The registry fix changes what a `:report[…]` would draw in a
  document, and there is no `:report[…]` in any document to look at — zero in the repo, because the
  doctrine already bans it. So the fix is proven by the registry's own shape and the planted-key
  test, never by a screenshot.
