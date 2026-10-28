# MOCK — a gap you can push around

::gap{id=MOCK-GAP title="MOCK — a gap you can push around"}

A gap to mess with. Its trail FORKS — two endings, and only one of them needs evidence: `resolved`
is the one state in the whole system a press cannot outrun.

## Walk it

**`open`** — where every gap starts: no ending declared.

:::cmd
node RFCs/proofs/mock.js gap open
:::

**`resolved`** — the declaration lands, and it only reaches the state because this document carries
a proof (the cmd below the walk counts). Delete that proof block and press `resolved` on the trail:
the control offers to attach one instead of refusing.

:::cmd
node RFCs/proofs/mock.js gap resolved
:::

**`rejected`** — declined on purpose, with `why=wontfix` beside the date. Without the reason it
would be indistinguishable from a gap nobody got to, which is the exact failure a gap exists to
prevent. Press `rejected` on the trail and it asks for the line first.

:::cmd
node RFCs/proofs/mock.js gap rejected
:::

**`retired`** — only honest from `resolved`: a resolved gap became a living spec, and retiring says
the spec stopped being worth re-running. `retiredAs=out-of-service`, an ending.

:::cmd
node RFCs/proofs/mock.js gap retired
:::

## The proof that makes resolved reachable

Remove this block and `resolved` becomes unreachable — put it back and the same press lands.

:::cmd
echo "this is the evidence — any run, cmd or test counts"
:::

## When you are done

:::cmd
node RFCs/proofs/mock.js gap off
:::

:::cmd
node RFCs/proofs/mock.js gap on
:::
