# The centre splits in two, and a document can be dragged out into it

::report{id="The centre splits in two" as=account retain=24h retired=2026-11-12 retiredAs=expired}

:::glance
- **agent** — systemview-test
- **run** — his overnight ask
- **new features** — the centre splits into two panes with a draggable divider · a document crosses by drag or by a named menu row · a tab dragged out earns its own side
- **fixes** — the stats tab is kept instead of rebuilt on leaving · a hidden document is no longer handed the live scope · the new side came up blank until the URL followed the focused pane
- **corrections** — the earlier decision to hold the surface change off — wrong twice over, and reversed
- **decisions** — none
- **live** — the bundle is rebuilt; the window swaps to it on its own clock
- **checked** — 2599 window · 369 hub · 15 cli · yarn verify green · driven end to end in a headless Chrome; no real pointer drag of a tab, scroll position unproven, three panes never made
:::

**Both halves of your overnight ask are built, armed and verified by looking.** The centre now
splits into two panes with a divider you drag, a document crosses by drag or by a named menu row,
dragging a tab out into the dark section gives it a side of its own, and closing the last tab on a
side puts it back to regular. Two board cards next door to that work closed in the same pass.

::image[reports/the-centre-splits-in-two.png]{caption="two documents side by side, each with its own strip, the divider between them"}

**Nothing waits on you to make it work.** The bundle is rebuilt and your window swapped to it on
its own clock. The press-list at the bottom is for checking it, not for arming it.

| | |
|---|---|
| **what landed** | the split + divider · drag a document across · drag a tab OUT into a pane's body · the stats tab is kept now · a hidden document is no longer told where you are standing |
| **tests** | 2599 window · 369 hub · 15 cli · `yarn verify` green including the production build |
| **the real check** | a headless Chrome of my own, driven end to end — never your window |
| **lane** | none. Both trees were clean of uncommitted code, so every piece is committed in place |

---

## The evaluation, written before the work

Recorded on the board as card **"the split: two panes, a resizable divider, and a document dragged
across"** before a line was written, which is the point of it — a verdict written first is a
decision, and the same words written afterwards are a justification.

**Where the pick came from:** the worklist door, the cheapest of the four. My own default list stood
with SLICE 3 active and nothing after it, which is a procedure saying exactly where the night
stopped: *"the split — two panes side by side, a RESIZABLE divider (he said resize twice), drag a
document across, and closing the last tab on a side collapses back to regular."*

**Ending chosen: do it as stated.** The evidence is yours, said twice — *"I want a feature where you
can split into two types and you can drag documents across types and resize between them. Close all
the tabs on one side and it goes back to regular"*, then *"don't forget the resizing between the
split paints."* The store had already learned panes, focus and sizes last night; what was missing
was only the surface.

**What I changed from the plan, and it was mine, not yours.** An hour before this run I said I would
hold off — *"a surface change in the one file no suite can reach, which I'd rather not ship into a
window you're asleep behind."* That was wrong twice over. The bundle swap is HELD until it costs you
nothing, which is the whole design, and the store half is exactly where a suite does reach. The
genuinely untestable part is the pointer handling, and the answer there is to go and look at it
rather than to not build it.

---

## 1 · The split, and the divider

::commit{sha=52b02d2b}
::commit{sha=369916f4}

- **`paneDrag.js` — the divider's arithmetic, pure.** A pointer drag is the one part of this that no
  suite in this repo can reach: jsdom has no layout, so a row's box is all zeros and a fraction of
  it means nothing. What CAN be checked is the DECISION the drag makes, so that is a function of
  numbers and the component holds only the plumbing. One divider moves only the pair it sits
  between; the floor is 12% so a pane can never become ungrabbable; a drag that cannot mean anything
  returns null rather than snapping to an invented default.
- **`PaneDivider.js` — pointer CAPTURE, not window listeners.** The thing being dragged is 6px wide
  and your hand leaves it immediately; without capture the drag dies the moment the pointer crosses
  into the document. The row's box is measured per move, because the centre itself is resizable
  mid-gesture. Double-click evens the panes up.
- **`CenterTabs` knows which side it is**, and that index is what makes a drop from the other pane a
  CROSSING instead of a reorder. This one is worth naming because the wrong answer is silent:
  `moveTab` finds a tab by key wherever it lives, so a cross-pane drop treated as a reorder shuffles
  the document inside the side you dragged it OUT of, nothing crosses, and nothing says so. The
  bulk-close counts now read the tab's own pane too — `panes[0]` by hand would have offered "Close
  all 3" on a side holding one.
- **The centre renders a column per pane.** The row is in the tree even unsplit, which is the one
  structural decision here: a row that appeared only when split would re-parent every open document
  on collapse, and re-parenting remounts — throwing away the scroll positions last night's work
  exists to hold, at the exact moment you close the last tab on one side.
- **Collapsing back to regular is the store's**, not the render's. No condition in the component says
  when to go back to one pane; `normalize` prunes a pane whose last tab closed, and the render
  follows.

:file[src/organisms/CenterTabs/paneDrag.js]

## 2 · A tab dragged OUT into the dark section

::commit{sha=8d82b50c}
::commit{sha=4f1782ec}

Your words: *"a tab should be able to be dragged out and hover and then placed back in any tab. Any
dark section."* The strips were only half of it — aiming a dragged document at a 30px strip is the
fiddly way to do what you described.

The pane's BODY is a drop target now. Dropped on the other side it crosses; dropped back into its
own side while that is the only side, it earns a pane of its own — which is the "dragged out"
gesture. Dropped into its own side with a split already standing it does nothing, because there is
nowhere for it to go that it is not already. The pane that would take it draws an inset outline
while the tab is over it, because a drag with no feedback is a guess.

::image[reports/a-tab-dragged-out.png]{caption="dropped into the dark section: a side of its own, focused, showing its document"}

**And this is the fault the real browser found, which no assertion here would have:** dropping a tab
out split it correctly and **the new side came up blank**. Focus moved to the new pane, the URL still
named the document on the old one, and the focused pane renders what the URL names. So the URL now
follows the focused side while a split is standing — stamped once per (side, document), because a
route is a history entry and one per render is a back button nobody can use.

## 3 · Two board cards next door, closed

::commit{sha=55584bd1}
::commit{sha=178e3b8a}
::commit{sha=23d039ae}
::commit{sha=295b7546}

- **The stats tab is kept now.** It was the last centre panel still rebuilt on leaving, and the
  reason was one missing prop: `Reports` accepted no className, and every kept panel hides on its
  OWN element rather than on a wrapper — because the centre's height comes down a direct-child chain
  and one added level breaks it, which is what cost you a scrollable dashboard yesterday.
- **A hidden document is no longer told where you are standing.** Hidden panels were handed the live
  scope, so walking the service tree re-fired the listing effects of every document open behind the
  one you were looking at. `KeptScope` is the address half of `KeptPane` with no element at all — a
  render prop, so there is nothing to break that same chain. The panel showing follows the scope;
  the ones behind it hold the last scope they were actually shown with, and adopt the live one again
  on return.

---

## Where the tests stand

| suite | ran | says |
|---|---|---|
| window (`yarn test`) | 2599 assertions, 168 files | green — 22 of them new tonight |
| hub (`yarn test:api`) | 369 | green |
| cli (`yarn test:cli`) | 15 | green |
| production build | in `yarn verify`, bare | compiles; eslint warnings are the pre-existing 77 |

**What a green suite here does NOT cover, exactly:** no suite in this repo can mount the centre at
all — `Documentation.js` imports the markdown registry, which pulls `remark-gfm`, which is ESM
outside `transformIgnorePatterns`. `Reports` is in the same position, which is why the stats fix
carries no jest assertion and should not pretend to. So the component wiring is covered only by what
I did in a browser, below.

## What I checked by looking, and in whose window

**Not yours.** I read your window twice — once to confirm it had swapped to the new bundle on its
own, and once to confirm the dashboard still scrolls inside its own box (900px of viewport against
2147px of content) after the pane column went into the height chain. That is the regression you
caught yesterday and it has not come back. I did not drive your window, and I did not split it.

**Everything else ran in a headless Chrome I started for this**, on the same hub, with its own
profile — so a split could be driven end to end without touching what you have open:

- two columns at 331px each, each with its own strip and its own visible document — the focused one
  driven by the URL, the other by its own pane's active tab
- the divider dragged: it followed the pointer from x=682 to x=855, and the new fractions persisted
  to the store
- dragged past the left edge: it stopped at the 12% floor, leaving a 79px pane with its tab still
  grabbable, rather than a 0px one or a snap back to the middle
- double-click evened them to exactly 50/50
- a document dragged across: it changed sides and landed where it was dropped
- **the collapse, which is the claim the always-rendered row exists to support:** closing the last
  tab on one side left one pane, no divider, stored sizes `[1]` — and the surviving document's DOM
  node was *the same node*, carrying a property I had set on it before the close. Nothing remounted.
- the drag-out: the hover outline appeared on the pane that would take it, the drop gave the tab its
  own side, and dragging it back across collapsed the split again
- the stats panel: same DOM node after leaving the tab, carrying `doc-kept-away` with
  `display: none`, and the same node again on return

## What I could NOT verify

- **A real mouse drag of a TAB** — the crossing was driven with a constructed `DragEvent` in the page
  and with jest assertions over the real store, not with HTML5 drag-and-drop driven by a pointer.
  The divider drag WAS a real pointer drag; the tab drag was not.
- **Scroll position surviving**, specifically. I set a scroll offset twice and read back 0 both
  times, because in a 900px headless window those documents did not overflow their boxes. What is
  proven is the thing scroll preservation rests on — the panel's DOM node is never torn down.
- **Three panes.** The arithmetic is written and asserted for N panes; the window only ever makes
  two, because two is what you asked for.
- **Your eye.** Both screenshots are 1400×900 headless; your window is wider and the split will
  read differently at your proportions.

## One thing the records will say, so I will say it first

`commitLinks` reports 6 **unclaimed** rows — reports naming shas that carry no `Serves:` trailer
pointing back — and tonight's eight commits carry no trailer either. That is not an oversight: this
work came from your voice and from board cards, and a board card has no leaf to name. A trailer
pointing at an id nothing registered is worse than none, because it reads as a link until somebody
checks. The structural gap is already carded as *"a commit-time nudge for the Serves trailer"*.

## Press-list — what to look at

- [ ] Open two documents, right-click one → **Split — give it its own side**. Two strips, two documents.
- [ ] Drag the divider. It should follow your hand and stop short of erasing either side; double-click it to even them up.
- [ ] Drag a tab from one strip onto the other side's strip, and then onto the other side's *document area* — both should carry it across.
- [ ] Drag a tab onto its own side's document area while unsplit: it should split out into a side of its own, focused and showing.
- [ ] Close the last tab on one side. It should go back to regular, and the surviving document should be exactly where you left it.
- [ ] Open Stats, go to another tab, come back. It should not rebuild.
- [ ] The dashboard should still scroll — that is the regression from yesterday, and the pane column sits in the same height chain.
