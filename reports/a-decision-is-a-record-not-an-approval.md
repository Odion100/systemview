::report{id="A decision is a record, not an approval" as=account retain=7d}

:::glance
- **agent** — systemview-test
- **run** — your ask in conversation, not a job or a skill
- **new features** — `::decision` and `::decisions`, a block for the record of a choice
- **fixes** — the tab cap applied every keystroke, and a cap of 2 was still in force in your window
- **corrections** — the tab cap was mine; so was the registry comment that called `::approval` a decision
- **decisions** — carried as blocks below, which is also how this report shows you the thing. The count is the roll-up, never this line
- **live** — `src/` only; the bundle is rebuilt and swapped three times over
- **checked** — 176 suites · 2715 window · 453 hub · 23 cli · `yarn verify` green bare
:::

# A decision is a record, not an approval

**`::decision` is built, wired and in the bundle.** This report is the first document that uses it,
which is the only honest way to show you a visual block — every block below is real, with a real
rejected road, and the roll-up at the bottom counts them off the blocks themselves.

**And the tab bug you reported twice is fixed in two places, because it was two faults.** The one I
shipped yesterday set the cap by accident; the one still biting you was that accident sitting on
your disk with no way for you to connect cause to effect.

---

## The four decisions, as the block renders them

:::decision[Is a decision an approval with more options, or its own block?]{id=d1 owner=you state=decided chose="its own block" over="extending :::approval with options|a decision is an approval with an n-way verdict" by=odion}
**why** — your words: *"making a decision doesn't mean you have the approval. And when you think
about it in an organization, it's different."* An approval is one party SANCTIONING: it gates the
document, it is binary, the verdict is the whole of it. A decision is one party CHOOSING: it gates
nothing, it is n-way, and whether anybody ratified it is a separate and usually absent fact.

**instead** — collapsing them would have made the commonest state in an organization
unrepresentable: *decided, and nobody has signed it.*
:::

:::decision[What does pressing a decision actually do?]{id=d2 owner=systemview-test state=decided chose="move the state and stamp the clock, nothing else" over="an options picker that writes chose=" by=systemview-test}
**why** — you speak your decisions and they get written down. A picker would model a ceremony that
does not happen here, and it is the shape that invited the commitLinks problem: infrastructure for
an act nobody performs.

**instead** — a decision recorded with no choice written down says so on its own face rather than
being prevented by a widget.
:::

:::decision[A tab cap of 1 or 2 — honour it, clamp it, or ignore it?]{id=d3 owner=systemview-test state=decided chose="under 3 reads as NO cap" over="let 1 and 2 stand as typed|clamp the stored number to 3" by=systemview-test ratify=you}
**why** — a doc/dash/board tab takes a slot of its own, so at 2 there is exactly one slot left for a
file and every open evicts the last one; at 1 there are none. Neither value can produce a usable
window. And 0 already means *off*, so below the floor there is no meaning left to honour. Ignoring
it also heals a window already carrying the accident without you having to find the cog.

**instead** — clamping would have silently rewritten a number you typed, and honouring it would have
left you exactly where you were when you reported this.
:::

:::decision[The SYNTAX — does `agents/markdown.md` document the block?]{id=d4a owner=you}
**what changes** — the agent-facing reference gains an entry for `::decision` and `::decisions`:
attributes, states, what `over=` is for, and why it is not `::approval`. Descriptive only; it makes
no planning document behave differently.

**my position** — yes, and it is the cheapest of the three. Measured today: `::decision` appears in
**zero** skills, **zero** handbooks and **zero** agent docs, so the only way an agent learns the
block exists is by reading `registry.js` — the exact failure the agent docs exist to prevent.
:::

:::decision[The PRACTICE — does a how-we-work chapter describe capturing what lands?]{id=d4b owner=you}
**what changes** — a chapter on conducting a planning discussion: the document opens first, the
talking happens inside it, what settles becomes a `::decision` where it settled, and **a section
says its own substance before it says what landed.**

**my position** — yes. This is the part you have been teaching me all day and none of it is written
down anywhere, including the correction that a section cannot lead with its decisions.
:::

:::decision[The REQUIREMENT — does `arc-planning` start DEMANDING the block?]{id=d4c owner=you}
**what changes** — §1 and §3 would say *capture what lands as a `::decision`* instead of leaving
`**DECIDE HERE:**` prose as an option. Every planning document written after that is a different
shape, and so is every agent's behaviour in a meeting.

**why it is separate** — this one has teeth and the other two do not. A reference entry and a
handbook chapter describe; a skill line obliges.

**my position** — yes, but after `d4b`: a skill demanding a block with no written practice behind it
produces forty blocks and no argument.

**what was ALREADY true, and the correction that goes with it** — `arc-planning` §1 has read *"Open
the planning report FIRST — the discussion happens inside it"* since 2026-11-10, at your
instruction. I argued otherwise earlier today from the skill body injected into this session, which
was captured before that edit. You were right; I was quoting my own superseded text back at you.

**how it stood before** — *"It doesn't mean that we're going to update any doctrine around it yet.
And if it just do it, then I could decide to use it or not."* And after two live meetings using it:
*"the whole thing is that there needs to be a corpus on that, right, and capture those things we
just got — decisions."*
:::

::decisions

**The roll-up above counts the blocks in this file, not a number I typed.** Press this to see the
same count from outside the window:

:::cmd
cd ~/Systemly/systemview && F=reports/a-decision-is-a-record-not-an-approval.md && echo "blocks: $(grep -c '^:::decision\[' $F)" && echo "decided: $(grep -c '^:::decision\[.*state=decided' $F)"
:::

Expect the block count to match the roll-up — and the first version of this very command said one
more `decided` than there were,
because `grep -o 'state=decided'` matched the pattern printed in its own command line. Anchoring it
to the block's opening line is the fix, and it is worth leaving here: a pressable check that
disagrees with the document is worse than no check, and this one did for about a minute.

---

## 1 · What the block is, and what prose could not do

::file[src/atoms/Markdown/decisions.js]
::file[src/atoms/Markdown/blocks/Decision.js]
::file[src/atoms/Markdown/blocks/Decisions.js]

A planning document today carries `**DECIDE HERE:**` and a numbered list. Counted on the connect
planning report: **nine sections, nine such lists, and nothing anywhere can say how many forks are
still open or whose they are.** Reading all nine is the only way to find out, which is why nobody
does. Four specific things the prose form cannot do:

1. **No address.** Nothing can point at it — not an objective it blocks, not a commit that implements
   it, not a later decision that reverses it.
2. **No state**, in a document whose whole doctrine is that the document IS the state.
3. **Nothing can count it.** An arc has `::progress`, an RFC has `::claims`; a plan had nothing.
4. **The answer erases the question.** Rewriting the section is right for describing a mechanism —
   but `over=` is the road not taken, and **it was never in the file, so git cannot be the changelog
   for it.** It is also the first thing anybody asks about a decision they did not sit in on.

The attributes, and the two pairs that carry the distinction you drew:

| | |
|---|---|
| `owner` | who OWES the answer while the fork is open |
| `by` | who actually made the call — a different fact, and an organization has to be able to show a decision taken by somebody it was not assigned to |
| `ratify` | whose signature this decision still owes. **Opt-in**, so a decision nobody has to sign is not painted as pending |
| `approved` | who has signed. `ratify` minus `approved` is what renders *decided, not approved* in amber |
| `chose` / `over` | the choice, and the roads it was chosen over — struck through beside it |
| `state` | `open` → `decided` → `reversed`. A reversal keeps the overturned choice VISIBLE rather than deleting it |

Two counts exist only because of your correction: **`awaiting`** (made, unsigned) and **`unsaid`** (a
decision recorded with no choice written down — the wrong half of a record, worse than leaving it
open).

::commit{sha=466f2dd6}
::commit{sha=9b90bd03}

I also rewrote the registry comment that described `::approval` as *"a story's approve/reject
verdict… a decision"*. That conflation was sitting in my own code, which is probably where I got it.

---

## 2 · The cap applied every keystroke, and that was mine

::file[src/organisms/CodePane/CodePane.js]

The cog's number input called `writeMax` from `onChange`, and `writeMax` **trims the window as it
saves**. Typing `15` passes through `1`. So reaching for a cap of fifteen closed every document but
the one you were looking at, on the first digit, with nothing to undo it — and from then on every
open evicted the last tab, which from the strip reads exactly as a tab *switching* instead of
opening.

The comment I had written beside it argued that applying on the spot was the honest thing to do:
*"a number he typed that does nothing until some later open is a setting he cannot tell he has set."*
That reasoning is fine for a reversible write and wrong for a destructive one, and the destructive
half is what I did not check.

Now: the typed value is a draft, committed on a pause (900ms), on blur, or on Enter. `capFrom` holds
the *is this a setting yet* judgement as a pure function — an empty field commits nothing, because
`Number("") || 0` is 0 and 0 means **no cap**, so clearing the text to retype would have silently
turned the limit off.

::commit{sha=024d0ae4}
::commit{sha=198400ec}

---

## 3 · And a cap of 2 was still in force — measured, not reasoned

::file[src/pages/SystemView/tabsStore.js]

You said *"I can only open one, every time it's being replaced"* and blamed the tab persistence. It
is not the persistence. I read your live window through the shell's read-only door, twice, an hour
apart:

:::cmd
cd ~/Systemly/systemview && npx --no-install react-scripts test --watchAll=false --testPathPattern tabsStore
:::

| read | what the strip held |
|---|---|
| 05:4x | `Dashboard` · `2026-11-10-the-platform-connects.md` |
| 06:3x | `Dashboard` · `the-row-said-met-and-could-not-say-undefended.md` |

**Two tabs both times, and a different file the second time.** That is a cap of 2 evicting on every
open — one slot for the dashboard, one for a file, and the file you just opened takes it from the
file you had. The previous commit stops that cap being set by accident again; it does not undo the
number already on your disk, which is why this third commit exists.

`MIN_CAP = 3`, applied in `trim` alone so `writeMax`, the centre's URL effect and a reload all
inherit it. The number stays readable in the cog and **the hint now says it has no force at that
value** — a setting that is set and does nothing is the other half of the same fault.

::commit{sha=92542305}
::commit{sha=3c66ecb0}

Three existing `trim` tests moved to legal caps. The rules they assert — least-recently-touched goes
first, an active tab is never evicted, a tab with no stamp is the oldest — are all unchanged; they
just needed a cap that bites.

---

## 4 · What I could not verify

**I have not seen `::decision` render.** Every one of its 36 assertions is jsdom: the markup, the
press, the counts, the two names, the amber state. Nothing in the repo used the block until this
file, and no suite renders the stylesheet — so **the 2715-test number says nothing whatsoever about
how this looks.** You are the first instrument that can answer that, which is what this report is
for.

**And your window may be a build behind while you read it.** The window holds a bundle swap until
the tab is hidden or you have been still for 90 seconds — that hold is the feature. Until it lands,
the four blocks above render as *unknown block*. They are not broken; the swap has not happened yet.

**Nothing here `Serves:` a registered document.** No RFC asked for it, no board card declared it, no
arc objective covers it — it came out of conversation, three turns of it, and the commits carry no
`Serves:` trailer because there is nothing honest to name. Said here rather than left to be noticed
by somebody grepping for the link.

**Not checked:** whether the cap floor actually relieves your window. It will the moment the bundle
swaps, because `trim` is consulted on every open — but I cannot press anything in your window to
prove it, and the two reads above are the last measurement I have.

---

**Where this file is:** `/Users/odionedwards/Systemly/systemview/reports/a-decision-is-a-record-not-an-approval.md`
