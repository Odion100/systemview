# The proofs run — a document's own specs, collected and run

::report{id=proofs-run as=spec retain=permanent title="The proofs run — a living spec of the collector and the runner"}

**This is a living spec, not an account.** It is never done — it is *current or drifted*. It exercises
the mechanism that collects the `:::run` and `::test` blocks a project's documents carry and runs
them through the one test engine, from three places: in a document, in the side panel, and with no
window at all.

The fixture it runs against is the mock arc and its plans — already here, already wired by address,
each one now carrying a run block so there is something to collect:

| document | serves | its spec |
|---|---|---|
| ::file[RFCs/proofs/mock-arc.md] | — | the arc's own run block, plus seven objectives |
| ::file[RFCs/proofs/mock-rfc.md] | O1 (by the walk) | claim `m1` carries a run block, which is what a spec is |
| ::file[RFCs/proofs/mock-plan.md] | O2 | `Math.describe` — primitive positional arguments |
| ::file[RFCs/proofs/mock-rfc-2.md] | O3 | `Math.add` — the object shorthand |
| ::file[RFCs/proofs/mock-rfc-3.md] | O3 | `Math.subtract` — the second plan on one objective |
| ::file[RFCs/proofs/mock-rfc-4.md] | O4 | `Math.multiply` |
| ::file[RFCs/proofs/mock-rfc-5.md] | O5 | `Math.combine` — two object arguments, and a label read back |

**The test service has to be up**, because these run blocks call it. That is deliberate: a proof that
cannot fail proves nothing.

:::cmd
node test/service/index.js &
:::

## What a spec is, and what is deliberately not one

**Only `:::run` and `::test` are collected.** A `:::cmd` is experiential facilitation — a command you
press to feel the thing work — and collecting one into a headless run would execute shell nobody
pressed and report it as a passing proof. If something a cmd does needs defending, wrap it in a run
block.

That distinction is the one definition, in the shell's `blocks.cjs SPECS`, and it is not
`PROOF_KINDS.spec` — which carries `cmd` as well, because "is there evidence in this claim's fold"
and "what does the change loop re-run" are different questions about the same block.

## Nothing downstream parses markdown

The shell's watcher already parses every registered document to derive its row, so **the row carries
the inventory** — each spec's kind, label, title, attributes and an exact line span. Collecting is a
JSON read; only a document actually about to run gets opened, to slice the span. The body is never
copied into the registry, because a document's text in two places is a document that can disagree
with itself.

:::cmd
node -e 'const r=require(require("os").homedir()+"/.autobot/documents.json");const w=r.filter(x=>x.specs&&x.specs.length);console.log(w.length+" registered documents carry specs:");w.forEach(x=>console.log("  "+x.id.padEnd(16)+x.specs.map(s=>s.kind+"@L"+s.line).join(", ")))'
:::

## Walk it

### 1 · Raise the fixture

The arc needs its plans attached, which is what the walk does. `inProgress` attaches both and leaves
one plan moving.

:::cmd
node RFCs/proofs/mock.js arc inProgress
:::

### 2 · From the diagram — the three scopes

Open ::file[RFCs/proofs/mock-arc.md] and click a node on the `::progress` map. Not the bar — the
**diagram**. The menu's *run specs* is scoped by the node:

- the **arc** chip → this document and every plan on any objective
- **O3** → the two plans that share it, and nothing else
- a **plan** chip → that document alone

Results land in the side panel's **Proofs** tab. Press with the panel CLOSED, then open it: the run
is there. The node wears a dashed border until its run settles.

### 3 · From the panel

The **Proofs** tab is the panel's default. It lists what is in scope before anything runs, `▶ Run`
re-runs exactly what is on screen, and `⤢ all` widens to the project. Each row's address is a button
that narrows the run to that one document.

### 4 · With no window

The same collector and the same engine, over the agent door:

```
runProofs({ projectCode: "systemview-test", arc: "MOCK-ARC" })
runProofs({ projectCode: "systemview-test", objective: "MOCK-ARC-O3" })
runProofs({ projectCode: "systemview-test", document: "MOCK-RFC-2" })
```

### 5 · Make one fail, and read the failure

A proof that cannot go red is decoration. Change an assertion in a plan and run it again — the row
carries the comparison that failed (expected against received, at a path), not a transcript.

:::cmd
sed -i '' 's/results.sum = 5/results.sum = 99/' RFCs/proofs/mock-rfc-2.md && echo "MOCK-RFC-2 now claims 2+3=99 — run it"
:::

:::cmd
sed -i '' 's/results.sum = 99/results.sum = 5/' RFCs/proofs/mock-rfc-2.md && echo "put back"
:::

### 6 · Put it away

:::cmd
node RFCs/proofs/mock.js arc off
:::

## Claims

::claims

**Where you stand to check these** — the files (the inventory on the rows), the host with no window
(the agent door), and the window (the diagram and the panel).

::::claim[register a document carrying a run block → its registry row lists that spec with an exact line span]{id=r1 state=met by=systemview-test at=1793328887000 note="registered the 8 fixture files through the shell's own registry: 9 rows, every spec listed with line/end checked against the real fence lines"}
:::run{title="the inventory is a JSON read — and this block is its own subject"}
- Math.add { "a": 1, "b": 2 }
  - results.sum = 3
:::
::::

::::claim[put a :::cmd in a document → it is never collected as a runnable spec]{id=r2 state=met by=systemview-test at=1793328887000 note="28 cmd blocks across the fixture, 0 collected — specsOf is test|run only, and tests/registry.js holds it"}
:::cmd
node RFCs/proofs/proofs-inventory.js
:::
::::

::::claim[run an arc → the arc's own document and every plan on any of its objectives run]{id=r3 state=met by=systemview-test at=1793328887000 note="arc MOCK-ARC collected 7 specs in 7 documents and ran them all green. First attempt collected ONE — arcOf was a narrower copy of the shell's rule and matched no MOCK-ARC-On address"}
:::cmd
node --test api/proofs.test.js 2>&1 | tail -4
:::
::::

::::claim[run an objective → only the plans pointed at that objective's address run, never the arc's other plans]{id=r4 state=met by=systemview-test at=1793328887000 note="MOCK-ARC-O3 collected exactly the two plans that share it; an unplanned objective collected nothing and said so"}
:::cmd
node --test api/proofs.test.js 2>&1 | tail -4
:::
::::

::::claim[run one document → that document alone, however many plans share its objective]{id=r5 state=met by=systemview-test at=1793328887000 note="document MOCK-RFC-2 collected 1 spec, not the sibling that shares its objective"}
:::cmd
node --test api/proofs.test.js 2>&1 | tail -4
:::
::::

::::claim[a document whose file cannot be read → reported as a problem beside the results, never as a passing run]{id=r6}
:::cmd
node --test api/proofs.test.js 2>&1 | tail -4
:::
::::

::::claim[a run of four where a fifth spec could not be built → the count says both, so a thinner run is never read as clean]{id=r7 state=met by=systemview-test at=1793328887000 note="summaryOf prints both numbers — proofRows.test.js pins the four things it has to be able to say"}
:::cmd
CI=true npx react-scripts test --watchAll=false --testPathPattern=proofRows 2>&1 | tail -5
:::
::::

::::claim[start a run from the diagram with the Proofs panel closed → open the panel afterwards and the run is there]{id=r8}
:::cmd
CI=true npx react-scripts test --watchAll=false --testPathPattern=proofsBus 2>&1 | tail -5
:::
::::

::::claim[a document with two registration leaves → collected once, so its specs are not counted or run twice]{id=r9 state=met by=systemview-test at=1793328887000 note="mock-rfc.md carries a report and an rfc leaf; the arc run collected 7 documents from 9 rows, deduped by path"}
:::cmd
cd ~/autobot && node tests/registry.js 2>&1 | tail -3
:::
::::

::::claim[an assertion the parser cannot read → dropped AND counted, so the run says what it did not check]{id=r10 state=met by=systemview-test at=1793328887000 note="an unreadable assertion is dropped and counted into problems — api/proofs.test.js, and the run reports what it did not check"}
:::cmd
node --test api/proofs.test.js 2>&1 | tail -4
:::
::::

::claim[the same run block run headless and in the window → the same steps, because one builder serves both]{id=r11}

:::approval{ask="Is this the complete list of claims for the proofs run?"}
Pressing this makes the list the contract. A behaviour missing from it is one we agreed not to
check — so the thing to read for is what is NOT here.
:::

## What defends these without anybody remembering

| claim | what runs it |
|---|---|
| r1, r2, r9 | `autobot tests/registry.js` — the spec inventory block |
| r2, r3, r4, r5, r6 | `api/proofs.test.js` — scoping and the cmd exclusion |
| r7 | `src/organisms/TestPanel/proofRows.test.js` — the summary says both numbers |
| r8 | `src/utils/proofsBus.test.js` — subscribing after the run |
| r10, r11 | `api/proofs.test.js` — the builder, held to the window's grammar |

What the suites cannot do is put it under your finger, which is what the walk above is for.
