::report{id="The row and the document now say the same thing about a missing spec" as=spec retain=30d}

::members{who=systemview-test}

The registry row for a spec report with nothing runnable reads `invalid — no spec`. The document
did not: `Report.js` derives its badge from its own attrs — `no subtype`, `no retention` are
visible there — but **`no spec` is a fact about the document's OTHER blocks, which the block never
receives**. So the drawer and every list said one thing while the open document said another, about
the same file.

One derivation now, and it rides a trip the leaf was already making. Rendering the leaf stamps the
first open (`documentOpened`); the stamp's answer now carries the row's derived `invalid`, and the
leaf unions those reasons with its local pair — deduped, so the row repeating the local words does
not say them twice, and with the local pair still answering when nothing registered the id or the
hub is away. The words on the page are the words on the row because they are the same words: the
shell's parse derives them once.

## The evaluation, recorded before the work

On the board before building: **do it as stated, shape (a) off the card** — the card offered two
honest shapes, and joining on `documentOpened` beat exposing the document's blocks through the
markdown context because the trip already exists and the derivation already has one owner.

Reading `Report.js` for this also found an adjacent bug, filed on the board before it was touched:
**an embedded report leaf stamps the real report's first open** — `stampOpened` is first-write-wins,
so a `::file` embed of a report's head could START that report's retention clock without the report
ever being opened. The clock measured a quotation. Fixed in the same sitting (r4 below): the leaf
takes the same `InEmbed` guard the proofs panel uses — a quoted leaf renders identity and fetches
nothing, so it can neither start the clock nor claim one.

## Where the tests stand

| what ran | where | what it said |
|---|---|---|
| `api/documentsRegistry.test.js` | this tree | 13 pass — the join on all three paths, nothing for a valid row, nothing for an unregistered id; **mutation: the join cut reds exactly the new claim** |
| `Report.test.js` | this tree | 12 pass — row reasons worn, union deduped, offline fallback; **mutation: the union cut reds exactly the two new claims** |
| `yarn test:api` | this tree | 364 |
| window jest, whole suite | this tree | 2343 across 160 suites |
| `Hub.Agent.documentOpened` | **the live hub, through the MCP** | 1 passed — and its first run caught my own typo: `includes` on a string is a validator that never runs, and the gate said so by name |

::claims

**The registered-row-with-invalid case cannot be asserted at the live door without manufacturing a
stale registry row** — the hub's write door keeps `state` the shell's alone (c40), which is
correct and is exactly why that half lives in the node suite against env-pointed fixture files.
The saved spec pins what the live door can honestly promise.

::::claim[the stamp's contract holds at the live door: first write wins, divert restarts, a missing id is refused by name, and an unregistered id joins no invalid]{id=r1 state=met by=systemview-test note="four steps on a fixture id the ledger keeps (spec-fixture-opened — there is no unstamp door, so the one self-naming key is the honest residue); the refusal step asserts ok=false and the error naming the id" told=systemview-test}
::test[Hub.Agent.documentOpened]{project=systemview-test}
::::

::::claim[a registered row's invalid rides the stamp's answer on every path — fresh, already, divert]{id=r2 state=met by=systemview-test note="node suite, registry and ledger pointed at fixture files; a valid row adds nothing, an unregistered id adds nothing" told=systemview-test}
:::cmd
cd ~/Systemly/systemview && node --test api/documentsRegistry.test.js 2>&1 | tail -4
:::
::::

::::claim[the leaf wears the row's reasons, deduped against its local pair, and falls back to the local pair when no row answers]{id=r3 state=met by=systemview-test note="jest: 'invalid — no spec' rendered from the answer alone; the row repeating local words says them once; ok:false from the hub leaves the local two standing" told=systemview-test}
:::cmd
cd ~/Systemly/systemview && CI=true npx react-scripts test --testPathPattern="Report.test" --watchAll=false 2>&1 | tail -4
:::
::::

::::claim[a leaf quoted inside an embed stamps nothing — a quotation cannot start the real report's retention clock]{id=r4 state=met by=systemview-test note="the InEmbed guard on the stamp effect; mutation-verified — guard out, exactly this jest claim reds; the divert press cannot appear in a quotation either, because the clock never gets an openedAt to count from" told=systemview-test}
:::cmd
cd ~/Systemly/systemview && CI=true npx react-scripts test --testPathPattern="Report.test" --watchAll=false 2>&1 | tail -4
:::
::::

## Walk it

::branch[main]

**Armed** — the hub restarted under your standing order (the spec above ran green after), and the
window half is in `main.e949e3e1`, which lands on your window's own hold.

- [ ] open any spec-declared report whose row says `no spec` — the leaf now says it too, same words
- [ ] this report's own leaf: declared `spec`, carries one runnable spec — so it wears no badge
- [ ] the proofs panel: `Hub.Agent.documentOpened`, four steps, re-runnable

::file[api/documentsRegistry.js#L74-85]

::file[src/atoms/Markdown/blocks/Report.js#L30-40]

## The commits

::commit{sha=0687b763}

::commit{sha=bc3000b4}

## What this did not touch

Clocks the embed bug already started: the guard stops new false stamps, and does not audit the
opened ledger for stamps a quotation wrote before today — a stamp and a real first-open are
indistinguishable after the fact. And the shell's derivation of `no spec` (`SPECS = test|run`) is
untouched: a cmd still satisfies a claim and still does not make a document a spec, which is the
line RFC-076 drew.
