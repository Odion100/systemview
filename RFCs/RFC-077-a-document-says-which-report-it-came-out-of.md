# RFC-077 — a document says which report it came out of

::rfc{id=RFC-077 retired=2026-11-10 retiredAs=cancelled}

## 1 · The problem, as what it costs now

**Every retention window in the reports chapter is a clock standing in for a state the system could
derive, and the chapter now says so out loud in two places it cannot check.** A planning report
*"dies when its conclusions LEAVE it — when it became an arc, a plan or a spec."* An audit's
*"FINDINGS have to leave inside the window."* Both are conditions. Neither is askable: nothing
anywhere records that a gap came out of an audit, or that an RFC came out of a planning session. So
the condition is written in prose, the clock runs regardless, and the two have no relationship.

What that costs, concretely:

- **A report that did its job dies on the same schedule as one nobody used.** The planning report
  whose conclusions became an approved RFC is indistinguishable, to every surface, from one that was
  abandoned mid-argument. Both are furniture at `24h`.
- **The forensic walk only goes one way.** `commitLinks` reads report ↔ commit in both directions
  already, proven on 200 real commits. But the walk a person actually makes starts somewhere else:
  *this gap is wrong, which audit found it?* — and that question has no answer in the system. You
  grep.
- **The archive problem lands on his attention instead of on an address.** Reports now live 30 days
  (RFC-076 as amended tonight), which is correct for evidence and wrong for a drawer: a report he
  will never read again still counts as something he has not dealt with. If a consumer named its
  source, an archived report would be reachable by address and would not need a row at all.
- **Measured tonight, the same shape one layer down:** 8 of 32 registry rows pointed at files that
  no longer existed and every count in the window included all 8, because nothing asked. A
  condition nobody can query is a condition nobody enforces.

**And this section arbitrates §4's weak slice.** Two defensible ways to make a consumed report go
away: retire it the moment a consumer registers, or let consumption start the clock it already has.
The cost above is about reports that *outlive their usefulness*, never about reports that *vanish
too early* — so where the two conflict, this RFC prefers the one that cannot take a document out
from under a reader. §4.3 follows from that and not from taste.

## 2 · The design — one attribute, mirroring the relation that already works

An RFC already says which objective it serves. The mechanism is not new, it is **one more
relation**, declared the same way and read by the same parse.

### 2.1 · The leaf

```markdown
::gap{id=G-12 from="The drawer audit"}
::rfc{id=RFC-078 arc=ARC-004-O2 from="The walk — jobs, then authoring"}
::report{id="The dashboard pick" as=planning retain=24h from="The drawer audit"}
```

The value is the source document's **registration id** — never a path, for the reason
`registration.md` already gives about `Serves:`: an id is globally unique and survives the rename
that breaks every path. A report's id is its TITLE, so the value carries spaces, em dashes and
commas.

### 2.2 · Where it is declared, and why that is the whole storage cost

`autobot electron/markdown/blocks.cjs` holds the per-kind whitelist:

```js
const REGISTRATION = {
  arc:    { kind: "arc",    id: "id" },
  rfc:    { kind: "rfc",    id: "id", relation: "arc" },
  report: { kind: "report", id: "id" },
  gap:    { kind: "gap",    id: "id" },
};
```

`relation` is already a declared, single-slot, id-not-content field. This adds a **second slot,
`source`**, available to every kind:

```js
  arc:    { kind: "arc",    id: "id", source: "from" },
  rfc:    { kind: "rfc",    id: "id", relation: "arc", source: "from" },
  report: { kind: "report", id: "id", source: "from" },
  gap:    { kind: "gap",    id: "id", source: "from" },
```

and `FIELDS` in `electron/markdown/registry.cjs` gains `"from"`, which is the entire storage change:
the row already refuses anything not on that list and already drops it loudly in `dropped`.

**Measured, so the whitelist is doing real work:** `registrationsOf` on a leaf carrying
`from=` and `owner=` today returns `{kind, id}` and nothing else. Undeclared attributes do not leak
through; they are silently absent. So without this change, agents could write `from=` for a year and
no surface would ever see it.

### 2.3 · What reads it

- **`documents.list({ from })`** — the registry filter already takes `kind`, `project`, `arc`; this
  is one more equality on the same shape, so *"what came out of this report"* is one call.
- **`retention.retireExpired`** asks the registry whether any row carries `from=<this report's id>`
  before it consults the clock. Its existing guards do not move: a report with no window, a
  `permanent` one, and an unread one are all still untouched.
- **The drawer** can stop counting a report that has been consumed, which is the half of the
  attention problem that needs no decision from him.

### 2.4 · The hazard, measured, and the thing that catches it

An unquoted value with spaces does not produce a bad `from`. **It kills the whole registration** —
measured through the real parser:

| written on the leaf | what `registrationsOf` returns |
|---|---|
| `arc=ARC-004-O2` | `{kind, id, arc: "ARC-004-O2"}` |
| `arc="The walk — jobs, then authoring"` | `{kind, id, arc: "The walk — jobs, then authoring"}` |
| `arc=The walk — jobs` | `[]` — **no registration at all** |

So an agent writing `from=The drawer audit` without quotes does not get a wrong pointer, it gets a
document that is **invisible to the system** — the worst failure this repo has, and the one
RFC-073's own prose calls *"a file written to nobody."*

This needs no new machinery, because the machinery exists: a leaf that cannot register is already
reported back to whoever wrote it (the malformed-registration path in `announceDocument`). What this
RFC owes is that the refusal **names the attribute** rather than saying the leaf is bad, and that
the doctrine says *quote it* where the attribute is documented.

## 3 · Slices, in landing order

**3.1 · The field exists and is stored.** `source: "from"` in `REGISTRATION`, `"from"` in `FIELDS`,
claims in `autobot tests/registry.js`. Nothing reads it yet. First, because every later slice needs
a row that carries the value, and a slice that teaches agents to write an attribute nothing stores
is a slice that teaches a habit the system drops.

**3.2 · It is askable.** `documents.list({ from })` and the MCP `registry` door's filter. Before any
derivation, because a derivation nobody can inspect is one nobody can debug — and this is also the
slice that makes the forensic walk work, which is worth having on its own.

**3.3 · Consumption affects retirement.** `retireExpired` consults it. Deliberately last of the
three and deliberately the WEAK one — see the approval block.

**3.4 · The doctrine.** The reports chapter's per-kind table gains the `from=` the consumer owes;
`registration.md` documents the attribute next to `Serves:`, with the quoting rule and the measured
consequence of omitting the quotes. After the code, because doctrine describing a convention that is
not built yet is the recurring way this goes wrong here.

**3.5 · The producers write it.** `gap-authoring` carries `from=` when the gap came out of an audit;
the audits carry it onto the cards and gaps their findings become; `rfc-authoring` carries it when a
planning report produced the design. Last, because an agent writing the attribute before 3.1 lands
produces invisible documents, per §2.4.

## 4 · What this does NOT add

- **No new block.** `from=` is a leaf attribute, not a `::source` block. One more thing to parse for
  a relationship the leaf can already express is how a vocabulary gets fat.
- **No second source.** One slot, one id. A document that genuinely came out of two reports names
  the one it answers to; a list invites the same "which was it really" ambiguity `Serves:` avoided
  by taking one id per line.
- **No automatic deletion.** Nothing in this RFC deletes a file. `retireExpired` stamps `retired=`
  and the hub's janitor is the only thing that unlinks, exactly as today.
- **No change to `Serves:` or `commitLinks`.** The commit ↔ document chain is built and proven; this
  is the orthogonal pointer, and conflating them would put two different relationships in one field.
- **No requirement.** A document with no `from=` is a document whose source was not recorded, which
  is honest and is most documents. This never derives `invalid`.

## 5 · The decision

:::approval{ask="Approve RFC-077 — a document says which report it came out of?" verdict=rejected}
Approving commits to:

- **`from=<source id>` as a second declared relation on every registration kind** (§2.1, §2.2) —
  one more slot in `REGISTRATION`, one more entry in the registry's `FIELDS`, and no other storage.
- **The value is a registration id, never a path** (§2.1), carrying spaces because a report's id is
  its title — and therefore **quoted**.
- **The registry answers "what came out of this"** as a filter on the same shape as `arc` (§2.3).
- **Consumption is consulted by `retireExpired` before the clock** (§2.3, §3.3).
- **A malformed `from=` is a REFUSAL that names the attribute** (§2.4), because an unquoted value
  with spaces kills the whole registration and makes the document invisible.
- **The order in §3**, where the field lands before anything reads it and the producers are taught
  last, so no agent writes an attribute that would make its document unregistered.

The piece most worth rejecting is **§3.3 — that consumption should affect retirement at all.**
The alternative is that `from=` is purely a POINTER: the forensic walk and the drawer's count get
everything they need from §3.1 and §3.2, and the clock stays the only thing that retires anything.
That is a smaller RFC and it is defensible, because the moment consumption can retire a report, an
RFC registering at 3am can take a planning report out from under a reader at nine — and the whole
reason the clock measures FIRST OPEN is that his attention is the unit, not wall time. §1 says this
RFC prefers never vanishing too early, which is why 3.3 consults consumption rather than acting on
it; if even that is too much, cut 3.3 and the rest stands unchanged.
:::

## Claims

::claims

:::approval{ask="Is this the complete list of claims for RFC-077?"}
Pressing this makes the list the contract. A behaviour missing from it is one we agreed not to
check — so the thing to read for is what is NOT here.
:::
