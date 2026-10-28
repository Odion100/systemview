# The lifecycle walk — every kind, every state, pressable

::report{id=lifecycle-walk as=spec title="The lifecycle walk — a living spec of RFC-076"}

**This is a living spec, not an account.** It is never done — it is *current or drifted* — and the
difference is pressable: the walks below drive the four mock documents through every state in
RFC-076 §2's tables, and the trails either light where this document says they will, or the design
drifted and this page is where it shows first.

The mocks are one file per kind, registered under ids that say MOCK, each carrying its own walk and
its own teardown. **This document stays; the mocks come and go.** Retire a mock with an ending, or
press its `off`, and it leaves every list — a fixture that cannot leave the drawer is furniture.

| kind | the mock | its states, in table order |
|---|---|---|
| rfc | ::file[RFCs/proofs/mock-rfc.md] | draft · half-approved (still draft) · approved · rejected · built · settled · retired |
| arc | ::file[RFCs/proofs/mock-arc.md] | draft · approved · inProgress · settled · retired — moved by the PLANS, never by its own file |
| gap | ::file[RFCs/proofs/mock-gap.md] | open · resolved (needs the proof) · rejected (needs the reason) · retired |
| report | ::file[RFCs/proofs/mock-report.md] | filed · retired |

`mock-plan.md` is the arc's second plan — the walk writes its leaf; nobody edits it by hand.

## Why the walks are cmd blocks and not assertions

A jest suite already pins every one of these transitions (`lifecycleState.test.js`,
`tests/markdown-state.js`, `tests/registry.js` — the change loop runs them without anybody
remembering to). What a suite cannot do is put the state **under your finger**: these walks exist so
a human can move a document and watch the trail, the drawer and the row agree — or catch the place
they do not, which is how this fixture found three real bugs in its first hour.

## Reset everything

:::cmd
node RFCs/proofs/mock.js rfc draft && node RFCs/proofs/mock.js arc draft && node RFCs/proofs/mock.js gap open && node RFCs/proofs/mock.js report filed
:::

## Tear everything down

:::cmd
node RFCs/proofs/mock.js rfc off && node RFCs/proofs/mock.js arc off && node RFCs/proofs/mock.js gap off && node RFCs/proofs/mock.js report off && node RFCs/proofs/mock.js plan off
:::

:::cmd
node RFCs/proofs/mock.js rfc on && node RFCs/proofs/mock.js arc on && node RFCs/proofs/mock.js gap on && node RFCs/proofs/mock.js report on && node RFCs/proofs/mock.js plan on
:::
