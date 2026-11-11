# A green suite over a row shape that does not exist

::report{id="A green suite over a row shape that does not exist" as=account retain=24h}

**143 assertions were green about a row the registry never sends.** `bandBlock` decides what a
drawer row says before it is opened, and for a report it would have drawn the **filename** where the
sentence belongs — the exact fault the band rebuild exists to fix, shipped by the thing fixing it.
Found by running it over all 52 real registered documents rather than by reading it.

| | |
|---|---|
| **fixed** | a report's headline is its `id` — the sentence somebody wrote — with `name` still first for a caller that has one and `path` last because a filename beats an empty headline |
| **why nothing caught it** | every fixture in the suite hands it `{name: "…"}`. A registry row has no `name`: its fields are `id, kind, path, project, members, at, state` |
| **only `report` was affected** | asserted, not assumed — rfc, arc and gap go through `titleWith`, which already reads the `id` rows carry |
| **and one of his cards was DISPROVEN, with live evidence** | run-delete-with-confirm is built; 23 🗑 buttons are rendered in his window right now |
| **tests** | `bandBlock` 19 → **23** · 2636 window · 448 hub · 23 cli · `yarn verify` green bare |
| **arming** | `src/` — the bundle is rebuilt, so it is live. **It renders nowhere yet**, which is the card's real subject and waits on him |

---

## Press-list

- [ ] `yarn test --testPathPattern=bandBlock` — 23, four of them built from a real row shape.
- [ ] The question that is yours is below, in one line.

:::cmd
cd ~/Systemly/systemview && CI=1 npx react-scripts test --testPathPattern=bandBlock --watchAll=false
:::

## Pick 1 — his card, disproven, and the evidence is his own screen

*"deleting a list — a warning, then the click turns into confirm, like we always do."* It is built,
and the check is the live window rather than the source: `.agent-chat__lane-del` returns **23
buttons, all rendered, none hidden**, right now.

And it is the pattern he described, not a plain delete. `runDelete.js` decides the press in ONE
place so the button and its confirm can never disagree: an ended run deletes plain; one that has not
ended arms into the confirm with text saying what dies — *"not done — N of M still open. The record
and its nudging die with it."* A run declared abandoned with no account gets its own line. Eight
assertions, green, and the chain behind it is `deleteRunRecord` → the shell's `deleteLaneRun` →
`worklist.deleteRun`, which is the general verb — so a `job:` run deletes like a lane does.

**The code comment quotes his card's own words back** — *"they're nudging you — I want to stop
myself"* — which is how I know the card and that build are one subject rather than two that rhyme.
The card is off the board. **I did not press one**: deleting a real run record is destructive and not
something to do to his window to satisfy my curiosity.

## Pick 2 — the evaluation, written before the work

The card says `bandBlock` waits on a design decision, and it does. So I ran the dead code over real
data first, which is where the finding was:

> 52 rows — 7 rfc, 42 report, 3 gap. Nothing threw, nothing returned null, no fold came back
> entirely empty. Then I read what it would actually DRAW:
>
>     SAMPLE report row → title: "reports/drain-stood-down-during-onboarding.md"
>
> THE HEADLINE IS THE FILE PATH. […] The card's complaint is rows "spending their width on a state
> word, an owner, a clock […] none of which answer what the thing IS" — and the replacement would
> have put a filename in the headline.

## What was built

::commit{sha=8ac603bf}

::file[src/organisms/AgentChat/bandBlock.js]

::file[src/organisms/AgentChat/bandBlock.test.js]

**The suite was green about a shape nothing reaches it with**, which is the transferable half of
this. A fixture that supplies a field the world does not send does not test the code; it tests the
fixture. Four assertions now start from a real registry row — `id`, no `name` — so the next change
to this file meets the data it will actually be handed.

## Where the tests stand

| suite | ran | says |
|---|---|---|
| window | 2636 | green — 4 new, all on the real row shape |
| hub | 448 | green — unchanged by this |
| cli | 23 | green |
| `yarn lint:ratchet` | — | clean |
| production build | bare | compiles, and the bundle is rebuilt |

## What I could NOT do or verify

- **This renders nowhere, and the fix does not change that.** `bandBlock` has no production caller —
  `laneBlock` is imported by `AgentChat.js` and this is not — which is the card's actual subject. I
  fixed what it would draw; I did not draw it.
- **The design question is still open and still his**, and it is one line: *the lane row was rebuilt
  through `laneBlock` and reads well — should the document and owed rows take the same shape
  (headline, then a fold that explains it), or is the opened row something else?* An answer unblocks
  the rebuild; I am not picking it, because it is a visual decision on his main surface.
- **Nothing here was seen rendered**, for the ordinary reason that there is nothing to look at: no
  surface draws a `bandBlock` row. The evidence is the real-data run and the assertions.
- **I did not press the run delete.** Its evidence is the control rendered in his window and the
  decision function's eight assertions, with the press left to him.
