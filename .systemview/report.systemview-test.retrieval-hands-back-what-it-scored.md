::report{id="Retrieval hands back what it scored" as=account retain=30d}

::members{who=systemview-test}

:::glance
- **agent** — systemview-test
- **run** — a board card — first option off the card, *print the matched text whole*
- **new features** — none
- **fixes** — the ~300 and ~400-char delivery caps on context() answers — delivery now prints what the score was computed over, and newlines survive so a table comes back as rows
- **corrections** — none
- **decisions** — none
- **live** — rides the shell restart — the context MCP server lives in electron
- **checked** — yarn `smoke:context` 169 — four new, through the real tool handler against the real vector store · mutation: caps back in reds the wholeness claim, restored 169 green
:::

A `context()` search scored every chunk over its whole text and then printed ~300 characters of a
note and ~400 of a doc chunk — chunks run 370–2170, so **the match said the right thing was found
and the text handed back did not contain the reason it matched.** Measured with three blind
subagents: all three hit it on tables, all three answered correctly *by inference*, which is why it
read as a pass for weeks. Every agent on this machine pays this on every search.

Both caps are gone. Delivery prints what the score was computed over, and newlines survive — the
measured amputations were tables, and a table flattened to one line is barely readable even when
whole. The bound that remains is the real one: the indexer's split threshold bounds a chunk and the
store's curation bounds a note. A second cap at delivery was two copies of one rule, drifting — the
same disease as the hub's second hash, cut this morning.

## The evaluation, recorded before the work

On the board before building: **do it as stated, first option — print the matched text whole.** The
card offered three shapes (whole, a length parameter, or a truncation notice naming a door); whole
won because the other two keep a cap that duplicates the indexer's, and a parameter nobody knows to
pass is the cap with extra steps.

**On the card's `spec` declaration, said plainly rather than quietly re-decided:** the subject is
the context MCP server's own rendering — autobot's electron, registered with no SystemLynx service
— so no saved spec can dial it and an `as=spec` leaf here would wear `no spec` by the system's own
derivation, truthfully. The declaration's substance is met in the strongest runnable form that can
reach the code: four claims through the **real tool handler** in `smoke:context`, mutation-verified.
That is why this leaf says `account` while every claim below is runnable.

## Where the tests stand

| what ran | where | what it said |
|---|---|---|
| `yarn smoke:context` | `~/autobot` | **169 claims** — four new, through the real `context` tool handler against the real vector store, throwaway scopes only |
| the mutation | `~/autobot` | caps back in → `a note longer than the old 300-char cap comes back WHOLE` reds; restored → 169 green |

::claims

::::claim[a note longer than the old 300-char cap comes back whole — the tail is in the answer]{id=t1 state=met by=systemview-test note="a fixture note with a marker past char 300, searched through the real tool handler in a throwaway scope; the marker is asserted in the rendered answer" told=systemview-test}
:::cmd
cd ~/autobot && yarn smoke:context 2>&1 | grep -E "WHOLE|ROWS|ALL"
:::
::::

::::claim[a doc chunk longer than the old 400-char cap comes back whole, and its table survives as rows]{id=t2 state=met by=systemview-test note="a fixture corpus whose one chunk is a 16-row table; the last row is asserted in the answer, and a mid-row is asserted to end in a newline — the flattening replace is gone with the cap" told=systemview-test}
:::cmd
cd ~/autobot && yarn smoke:context 2>&1 | grep -E "WHOLE|ROWS|ALL"
:::
::::

## Walk it

::branch[ElementLocator]

**Rides your shell restart** — the context MCP server lives in electron, so the running shell still
serves the amputated answers until then. Nothing to press before that; after it, any `context()`
call whose hit is long shows the difference immediately.

- [ ] after the restart: `context("how do I check what the window actually rendered")` — the doc
      sections come back whole, tables as tables
- [ ] `yarn smoke:context` in `~/autobot` — 169, the four wholeness claims by name

::file[~/autobot/electron/agents/context.cjs#L1075-1095]

## The commits

::commit{sha=0024d7d project=autobot}

## What this did not touch

The **injection** caps (`INJECT_NOTE_MAX`, the subscribed-note ~700-char delivery bound) — that is
a different surface with a real budget: injected context is pushed into every matching moment,
where retrieval is pulled by a question somebody asked. One is rent, the other is an answer. And
the `list` tool's summaries stay summaries — it is a curation index, not a reader.
