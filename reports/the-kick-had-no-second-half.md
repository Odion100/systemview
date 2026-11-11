# The kick had no second half

::report{id="The kick had no second half" as=account retain=24h}

**`kick()` has been writing the bounced identity into a `kicked` map since it was built, under a
comment promising that "rejoins are refused for KICK_TTL" — and nothing ever read it.** `KICK_TTL`
appeared in two comments and its own declaration; `kicked` appeared at its declaration and three
times inside `kick()` writing to it, and nowhere else. A kicked identity could speak again in the
next second, and the etiquette that says *stay freely* rested on a constant.

**And the card I picked first does not reproduce**, which is the other half of this sitting: the
docs tab is not showing a stale copy, measured three ways including through the hub's own mark door.
Nothing was built for it and the card is off the board.

| | |
|---|---|
| **fixed** | the kick now has a reader — `kickedOut` — consulted where a refusal has a voice, with the window in the sentence |
| **disproven** | the stale-docs-tab card, measured on a fresh load, an out-of-band disk write, and the hub's own `mark` door |
| **and a correction to my own instrument** | a seeded tab store leaves the centre BLANK while every DOM query reads perfectly. Only the screenshot said so |
| **tests** | 2610 window · 430 hub (+5) · 23 cli · `yarn verify` green including the ratchet and the production build |
| **arming** | the hub was restarted from `~/autobot`, so the kick fix is **live**. Nothing rides your shell restart |
| **not verified live** | the refusal itself — no project has connected services right now, so the identity gate fires before the kick gate. Said in full below |

---

## Press-list

- [ ] With any project's services up: kick an identity from a room, then have it speak there. It
      should be refused with *"…cannot speak in it for another N minute(s). The cooldown lapses on
      its own — nothing needs to be undone."*
- [ ] Then have the same identity speak in a **different** room. It should go through — a kick lands
      on one identity in one room in one project, never a project-wide ban.
- [ ] `yarn test:api` — five new assertions in `api/Chats.kick.test.js`.

## Pick 1 — the card that was already fixed

The card said the docs tab showed RFC-078's ledger at *"0 of 41 met, 41 unchecked"* with zero signed
chips while the file carried seven marks. **I reproduced before trusting it**, on my own headless
Chrome against the same hub — never your window — and it does not happen:

| what I did | what the window said |
|---|---|
| loaded RFC-078 fresh | **100% · met · 25 of 25 claims · 25 of 25 spec'd**, with **27 signed chips** — exactly the disk (25 `state=met`, 27 claims carrying `by=`) |
| wrote the file **out of band** while it was open | `unchecked` → `met` in **4 seconds**, no navigation |
| wrote through **the hub's own `mark` door** while it was open | `unchecked` → `met` in **3 seconds**, signer chips 1 → 2 |

The third is the path the card actually names, and it is the one I would have doubted. I cannot say
which commit fixed it — three days and a large amendment landed in between — so the card is stamped
`resolved` with the measurements rather than with a guess, and taken off.

## And a correction to my own instrument, which is worth more than that card

**A seeded tab store puts the tab in the strip and leaves the centre blank.** `showsKey` needs the
PAGE's own `codeFile`, which `localStorage['sv.tabs.<pc>']` does not give it, so the pane renders
into `documentation-view__data-table doc-kept-away` — `display: none`, the designed hidden state.

**Every DOM query read perfectly through this.** 429 `md-claim` nodes, every claim's state correct,
the ledger's text complete and right. `Page.captureScreenshot` showed an empty centre.

I checked your live window read-only to be sure it was my instrument and not the product — 1 pane
showing, 2 kept away, which is what correct looks like. **That is the second time tonight a picture
corrected a conclusion the DOM supported**, and it is now a note (`rn1b`) rather than a lesson I
re-learn next week.

## Pick 2 — the kick, built

::commit{sha=d3c3f836}

:file[api/Chats.js]

The architecture is *"SPEAKING IS ARRIVING"* — there is no `join`, an identity arrives by speaking,
and `enterBySpeaking` marks it. Nothing between the kick and the next sentence consulted the bounce.

**The refusal goes where a refusal has a voice.** `resolveSpeaker` already throws a named error for
an unknown identity carrying its own fix, so the bounce is read there and the message is turned away
with the window in the sentence. A gate that quietly declined to mark entry would let the message
through anyway — which is the *"a kick that does not stop the messages is worse than no kick"* line
already written three functions above it. `enterBySpeaking` refuses too, as the belt beside it, so
no second caller can mark a kicked visitor present by accident.

**It lapses, and lapses on read.** A kick is a cooldown and not a ban: the entry is dropped the
moment it ages out, so the map cannot only grow and the bounce genuinely ends.

Five assertions, and the two that keep it narrow are the ones to read: a kick lands on **one
identity in one room in one project**, and fifteen minutes on the door is open again with the entry
**gone** rather than merely ignored. The refusal itself is pinned at its callsite — including that
the bounce is read BEFORE arrival is marked — because requiring `api/index.js` stands a hub up.

## Where the tests stand

| suite | ran | says |
|---|---|---|
| window | 2610 | green — and says nothing about any of this; no window code changed |
| hub | 430 | green — 5 new, all on the kick |
| cli | 23 | green |
| `yarn lint:ratchet` | — | clean, and `no-unused-vars` came down 31 → 30 because `KICK_TTL` is read now |
| production build | bare | compiles |

## What I could NOT do or verify

- **The refusal firing live.** I restarted the hub, kicked an identity from a scratch room, and
  tried to speak as it — and got the *identity* refusal instead: `"manager" is not a connected
  project`. No project has connected services on this machine right now (`getServices` with a search
  term is the only way to get any, and the hosted services are a different list), so
  `resolveSpeaker` never reaches the kick gate. The mechanism is pinned by assertion and the
  callsite is pinned by name, including its order; the end-to-end is the first press on the list.
- **Which commit fixed the docs tab.** I measured that it works, not when it started working.
- **The scratch room is gone.** The probe wrote `.systemview/chats/systemview-test.scratch-kick-probe-*.jsonl`
  — a real file, in the project's own chat directory, because a project owns its room. Deleted, and
  the tree is clean; the probe document and its registry row went too.
- **A kick survives a hub restart? No, and that is unchanged.** `kicked` is in-memory, so a restart
  clears every cooldown. That was true before this change and is still true; making it durable is a
  different decision and not one I made tonight.
