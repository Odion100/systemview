# RFC-063 — A lane leaves a receipt, and the strip nudges about what provably isn't in

**Status:** design, for Odion's review — 2026-10-02. **Design only — nothing here is built.**
**Owner:** SystemView (the strip and the verdict) with one half in autobot (the run record and the ambient field).
**Lands in:** `api/index.js` (`branchState`), `src/organisms/AgentChat/AgentChat.js` (the row, the confirm, the panel), autobot `electron/agents/worklist.cjs` (the receipt on the run record) and `electron/agents/sessions.cjs` (one ambient field).
**Related:** RFC-059 (delegation lanes — the rows), RFC-012 (hooks: `idle`, the fire rate, `until: run`), the `delegation` skill (whose bring-in step writes the receipt).

---

## 1 · What is actually wrong

A lane row answers one question — *can I delete this?* — and it answers it by **derivation**: compare the
branch's declared changes against the tree. Blob equality, or git's own containment test (the patch
reverses cleanly). That works, and it shipped on 2026-10-02.

**Derivation is archaeology, and the evidence decays.** `lane/hooks-end-of-turn` was brought in and
committed in `3694745`. Both files it touched were then rewritten on top of it (the fire rate, the
`idle` event). Its blobs no longer match and its patch no longer reverses — so the row said **not
brought in** about work that was already in, and the next step would have been applying it twice.

That failure is not a bug in the comparison. It is the comparison reaching the end of what it can
know. Three states, not two, was the first half of the fix (shipped same day):

| verdict | meaning | proof |
| --- | --- | --- |
| `in` | the work is here | blobs match, or the patch reverses cleanly |
| `out` | the work is genuinely absent | the patch applies **forward** cleanly — nothing here to collide with |
| `unknown` | the tree has moved on since the lane was cut | neither direction is clean |

`unknown` is honest and it is also a dead end. **The moment the knowledge exists is the moment of the
bring-in**, and today nobody writes it down.

## 2 · A receipt, not a settable field

The tempting fix is to let the agent set the verdict. That is rejected, on this system's own rule: an
agent's testimony is the weakest evidence here, and a field an agent can assert is a field it can be
wrong about forever. The distinction that resolves it:

- *"this lane's work is in the tree"* — a claim about current state. **Testimony.** Derivation must
  always beat it.
- *"I applied this lane's diff into autobot at base `6dd6cc9` on 2026-10-02"* — a record of an act
  that happened. **A receipt.** Dated, naming the base, checkable against history.

So the agent never answers the question. It leaves a receipt at the moment it acts, and the verdict
gains a third input:

```
in       → derived, as now
out      → derived, as now
unknown + receipt  → "brought in 2026-10-02 at 6dd6cc9 — no longer provable from the files"
unknown + none     → unknown, exactly as now
```

A receipt never overrides `out`. If the patch applies forward cleanly the work is absent, whatever
anyone wrote down — a receipt against proof is a receipt that is wrong, and the proof wins. This is
the only ordering that keeps an agent unable to make a lane look landed when it is not.

## 3 · Where it lives, and why it cannot accumulate

**On the lane's own run record** — `~/.autobot/worklists/run-*.json`, the file the row is already
drawn from (`worklist.laneRuns`). One field:

```json
{ "broughtIn": { "ts": 1759400000000, "base": "6dd6cc9", "repo": "autobot", "by": "agent:systemview-test" } }
```

His constraint, and the reason for this location rather than a store of its own: **nothing may
accumulate in the background.** This cannot, by construction —

- no new file and no new store: it is a field on a record that already exists;
- the user's 🗑 deletes the run file, so the receipt dies with the lane it describes;
- closed runs already sweep themselves after two weeks, so the retention is inherited, not invented.

A separate receipts file would be a thing somebody has to remember to clean. This one cannot outlive
what it describes.

## 4 · The nudge, aimed at the provable case

A lane reading `unknown` is exactly where an agent has nothing to offer: if it had known, the receipt
would be there, and asked a week later it would be *recalling*. Nudging there manufactures the weak
evidence this RFC exists to remove. **So nothing nudges about `unknown`.**

The case that earns a nudge is `out`: a **finished** lane whose work is *provably* not in the tree —
delegated, completed, never brought in. Three of those have sat since 2026-09-19. No guessing: the
forward apply is the proof.

And it needs no new machinery, only a field to gate on:

- **autobot** stamps one ambient field, `lanesOut` — how many closed lane runs for this project read
  `out` right now. Ambient fields ride every event already (`ctxPct`, `quotaStatus`), so this is one
  measurement, not a mechanism.
- **the nudge is then a hook he writes and tunes**, not code anybody ships:
  `on: idle` · `when: {lanesOut: {gte: 1}}` · `rate: once-per-day` · `until: run`.

The emitter reports; the hook judges. Same rule as `quietMin`.

## 5 · The receipt is written by the procedure, not remembered

`delegation`'s bring-in step gains one line: after applying and verifying, record the receipt. It is
part of the act, in the same breath as running the suite — a receipt written later is a recollection,
which is the thing being replaced.

## 6 · Out of scope

- **Making `unknown` decidable.** It is not, from the files alone, and pretending otherwise is how
  the first version lied. The receipt makes it *answerable*, not derivable.
- **Receipts for anything but a bring-in.** Reviews, rebases and landings already leave git history.
- **A second nudge for `unknown`** — §4.

## 7 · Done when

- `branchState` returns the receipt beside the verdict, and never lets one outrank `out`
- a row reading `unknown` with a receipt says when it was brought in and against what base
- the receipt is written by `delegation`'s bring-in step, and dies with the lane on his delete
- `lanesOut` is stamped ambient, and a hook gating on it fires once a day while any lane is provably out
- a test proves: a receipt does not survive the lane's deletion, and does not override `out`
