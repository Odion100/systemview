# A comment that was a map to the mistake

::report{id="A comment that was a map to the mistake" as=account retain=24h}

**His card asked for send-all to narrow to threads with something actually unsent. It already does —
I proved it before building anything.** What the proving turned up is that `docSend.js`'s header
names two callers that do not exist, and both of them were retired *for causing the exact fault the
card describes*. A comment pointing the next author at the retired path is a map to the mistake.

| | |
|---|---|
| **disproven, by running the real scan** | a thread carrying `told=` produces **no fire at all**. The narrowing he asked for is already the behaviour |
| **and the second sender is gone** | `sendUpdateTo` stamps nothing; the pin goes through the host, which records. A thread's row and the pin both used to call it and were retired 2026-11-06 |
| **fixed** | the header names its real callers, and says plainly which path a new sender should want |
| **and the list is a CHECK now** | a comment cannot notice a new import. The guard reads the source and fails when the caller set changes |
| **tests** | window 2636 → **2638** · 448 hub · 23 cli · `yarn verify` green bare, ratchet clean |
| **arming** | `src/` — bundle rebuilt, live. Nothing rides your shell restart |

---

## Press-list

- [ ] `yarn test --testPathPattern=docSend.callers` — two assertions, and it should fail if anyone
      adds an import of `sendUpdateTo`.
- [ ] The caveat below is the one thing that will still look like the bug and is not.

:::cmd
cd ~/Systemly/systemview && CI=1 npx react-scripts test --testPathPattern=docSend.callers --watchAll=false
:::

## The evaluation — I reproduced the mechanism instead of reading it

A document with two threads, one carrying `told=buapi` on its reply and one not, through the real
`docFires.scan`:

```
fire name=approval line=6  thread=""   told=[] held=["buapi"]
fire name=reply    line=17 thread="t2" told=[] held=["buapi"]
```

**Thread `t1` — the one already told — does not appear at all.** His words were *"send-all should
narrow to threads that actually have something unsent for that member."* That is what it does.

And the thing that could have bypassed the stamping is gone: `releaseDocumentFires` writes `told=`
with the union of who was actually delivered, and the only way to deliver without that record is a
window-side sender. There is no longer one for documents.

**ONE CAVEAT, because it will look identical and is not the bug.** A press that reaches **nobody
live** stamps nothing — `told=` is written only for members actually delivered — so the fire stays
owed and the next press sends again. That is c30 working as designed, and it only ever re-sends to
somebody who never received it.

## What was built

::commit{sha=bc6cf819}

::file[src/atoms/Markdown/docSend.js]

The header said *"three controls make this call now — the document's block, a thread's row, and the
pinned update row that carries both."* **Two of the three are wrong.** The pin does not call this;
it calls `releaseFires`, which is the entire reason the stamping works. The thread's row does not
call it either — that sender was retired, for causing this card's fault.

So the comment named, as current callers, the two controls that were removed for doing the thing the
comment's own file must not do. That is the `noteFile` fault in a smaller place: a sentence that
sends the next author down the retired path.

::file[src/atoms/Markdown/docSend.callers.test.js]

**A comment cannot notice a new import.** The guard reads the source for importers naming
`sendUpdateTo` and asserts the set — adding a caller is not forbidden, it is made *deliberate*: the
test fails, the author reads why, and decides whether they wanted the pin's path. It also pins that
`MembersPin` still contains `releaseFires` and does **not** contain `sendUpdateTo`, which is the half
that records the delivery.

**Teeth proven** by planting an import in `Claim.js` and watching it fire.

## Where the tests stand

| suite | ran | says |
|---|---|---|
| window | 2638 | green — 2 new, both on the caller set |
| hub | 448 | green — unchanged; no hub code touched |
| cli | 23 | green |
| `yarn lint:ratchet` | — | clean |
| production build | bare | compiles, bundle rebuilt |

## What I could NOT do or verify

- **I did not press send-all in his window.** The evidence is the real `docFires.scan` over a
  purpose-built document and the absence of any window-side document sender — not a press. Pressing
  it would deliver real notifications to real agents about his real documents, which is not mine to
  do to prove a point.
- **The nobody-live path is unexercised here.** I reasoned it from `releaseDocumentFires` stamping
  only `delivered` members and from the announce suite's c30 assertion; I did not stage a release
  with no listener and watch the fire stay owed.
- **`routeResult` is on the no-stamp side and that is a judgement, not a measurement.** A result
  block's `subscribe=` is news about a block completing rather than a document update to a member,
  so it belongs there — but if somebody ever points it at a document's members, the same fault
  returns and the guard will not catch it, because it is inside the file.
