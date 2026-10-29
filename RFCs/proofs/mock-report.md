# MOCK — a report you can push around

::report{id=MOCK-REPORT as=notice retain=14d title="MOCK — a report you can push around"}

A report to mess with. Two states, and existence is the first — nothing can press a document into
existing, so `filed` is never a button.

## Walk it

**`filed`** — the file exists and carries no retirement. That is the whole condition.

:::cmd
node RFCs/proofs/mock.js report filed
:::

**`retired`** — a hand with a reason (`retiredAs=shelf`, a pause — it stays listed, showing why).
The only kind where a CLOCK may also write this, and only because the clock measures your
attention: a `retain=` countdown starts on your first open, never at filing.

:::cmd
node RFCs/proofs/mock.js report retired
:::

## The subtype, as a thing to try

`as=` picks what DONE means, from an OPEN vocabulary — nothing branches on it, so put any word
there and the document is still accepted. `as=nonsense` files fine; a closed list here would be a
vocabulary that can never grow by use.

| `as=` | what it is | what makes it done |
|---|---|---|
| `planning` | a table to argue with | its conclusions left it — it became an RFC, an arc or a spec |
| `notice` | here is what happened | you read it |
| `audit` | a count against a tree at one moment | never done; re-run or out of date |
| `account` | what a job, a lane or a run did | filed, and never edited |
| `brief` | context handed to another agent | the recipient acted |
| `spec` | what something should do, with runnable evidence | never done — current, or drifted |

## When you are done

:::cmd
node RFCs/proofs/mock.js report off
:::

:::cmd
node RFCs/proofs/mock.js report on
:::
