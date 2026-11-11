# A door nothing opened would have misdirected the next trigger

::report{id="A door nothing opened would have misdirected the next trigger" as=account retain=24h}

**`registry.noteFile` called itself "THE DOOR THE TRIGGERS CALL" and no trigger called it.** The card
asked the right question — dead, or a door somebody meant to wire? — and refused to delete it
without an answer, because deleting it blind would throw away the intent. **The answer is
superseded**, and the proof is a sentence that was carried to the new door and left behind here.

| | |
|---|---|
| **answered** | `announceDocument` is a strict superset and names the *same three triggers in nearly the same words*. Nothing was waiting to be wired; it already was, elsewhere |
| **removed** | the function and its export, with a pointer left where it stood saying where the door actually is |
| **and the docstring was the actual hazard** | this file is where the registry lives, so it is where somebody adding a trigger looks. Wiring one to that sentence registers a row and fires nothing |
| **one test case survived rather than being dropped** | the two doors genuinely differ on an unreadable path. Measured both, moved the case onto the real door |
| **narrowed, not built** | the approval-press card: the send already exists on the members pin. The next move is a question that is yours, and it is on the card |
| **tests** | autobot: registry 71 → 68 · announce 29 → 30 · eleven suites green. Teeth proven by breaking the door's answer |
| **arming** | autobot `electron/` — **this rides your shell restart**, and nothing changes when it lands because nothing called the removed function |

---

## Press-list

- [ ] `node tests/registry.js` and `node tests/markdown-announce.js` in `~/autobot` — 68 and 30.
- [ ] `grep -rn noteFile ~/autobot/electron ~/Systemly/systemview/src` — only the pointer comment.

:::cmd
cd ~/autobot && node tests/registry.js && node tests/markdown-announce.js
:::

## The evaluation, written before the work

Recorded on the board before anything was touched. **Do it as stated** — delete it — *because* the
investigation came back with the answer that made deleting safe:

> `announceDocument` (sessions.cjs:1710) is a strict SUPERSET of `noteFile`: the identical markdown
> guard, then the registry-is-the-filter head read, every leaf registered, `registerParsed`
> unconditionally so a LIFTED leaf takes its row with it, and each fire routed through the member
> router with `told=` stamped for exactly who was reached.
>
> And the tell that settles "superseded" rather than "two doors": `announceDocument`'s own comment
> names the SAME THREE TRIGGERS as `noteFile`'s docstring, nearly word for word. One sentence was
> carried from the old door to the new one.

**No caller anywhere**, checked in both repos: nothing in systemview's `src/ api/ cli/
testing-utilities/`, nothing in autobot outside its own declaration, its export line and its tests.

## Why the docstring was worth removing, and not just the function

::commit{sha=40f8a9c7 project=autobot}

**A comment that misdirects is worse than no comment.** An agent adding a trigger reads
`registry.cjs`, because that is where the registry lives — not `sessions.cjs`. Wiring it to "the
door the triggers call" would register a row and fire **nothing**: no `told=`, no member routing,
and no `registerParsed`, so a lifted leaf would keep its row forever. A document that registers
silently and reaches nobody is the exact fault RFC-073's fire machinery exists to prevent.

**So what stands there now is a POINTER, not a wrapper**, and the comment says why: a function here
that registered a row would re-create the fault, so the file names the real door instead of
offering a convenient second one.

## The one test case that was not a duplicate

Its three assertions duplicated the announce suite's — one **word for word** (*"anything that is not
markdown is skipped without a read"*). The exception is the unreadable path, and I measured both
doors rather than assuming they agreed:

| | |
|---|---|
| `noteFile(missing)` | `{ok: true, registered: false, reaped: []}` |
| `announceDocument(missing)` | `{ok: false, error: "cannot read …never-existed.md"}` |

A real difference, and it was pinned nowhere else — so it moved onto the real door rather than
disappearing with the function. Both are fire-and-forget at every callsite so neither throws; what
the assertion now holds is that the door *answers with the reason* instead of throwing into the
write or the emit that called it. **Teeth proven**: I changed that return to `{ok:true, skipped:true}`
and watched the assertion fail, then put it back.

## Where the tests stand

| suite | ran | says |
|---|---|---|
| autobot `registry` | 68 | green — was 71; the three removed were the deleted function's own |
| autobot `markdown-announce` | 30 | green — was 29; the surviving case landed here |
| `documents` · `markdown-fires` · `markdown-parse` · `markdown-state` · `markdown-write` | 29 · 20 · 12 · 42 · 16 | green |
| `attachments` · `job-path` · `nudge` · `hooks` · `board` | 25 · 33 · 39 · ✓ · 9 | green — exit 0 each |
| systemview | — | **not run, and it did not need to be**: nothing in this repo changed |

## What I could NOT do or verify

- **Nothing here is armed until your shell restart**, because it is autobot `electron/`. It is also
  the safest possible thing to be waiting: the only runtime change is the absence of a function
  nothing called, so the restart lag carries no risk either way.
- **The approval-press card is narrowed and NOT built, deliberately.** The send exists — it is
  `releaseDocumentFires`, reached from exactly one control, the members pin — so the card stops being
  "build a send" and becomes "why didn't the pin reach me". Both candidate answers are about your
  surface and one of them would reverse a decision recorded in the block itself (*"a second send from
  the window was the same decision delivered twice"*), so I put the question on the card with my lean
  rather than picking for you.
- **I could not establish which of the two bit you on RFC-078** — whether the pin appeared and was
  tucked, or never appeared. That needs an approval pressed in a live window with members on it. I
  will not drive yours, and my own instance would not navigate tonight.
- **I got a `Serves:` trailer wrong and corrected it before it could lie.** The first version named
  the board card's id — and a board card has no leaf, so nothing registers it and `commitLinks` would
  have read it as `dangling`: a link that looks real until somebody checks. Amended to this report's
  id while the commit was still unpushed and before any document recorded its sha.
