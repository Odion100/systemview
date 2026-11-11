# The centre stops arguing with the click

::report{id="The centre stops arguing with the click" as=account retain=24h}

**One press on a tab was producing eight events, and the document you left won.** Measured in a real
browser on his exact two-pane state: the click wrote `active=dash`, the route pushed `?tab=dash`,
and then the centre's URL→store effect fired on the changed tab param while the `codeFile` prop
still held the file — re-opened it, and the focus-routing effect pushed the file's URL back. He
could not leave the document.

**The side panel had lost its signal for the same reason the split created.** `DocProofs` claimed
the proofs panel on MOUNT, under a comment stating that only the active document is ever in the DOM.
That stopped being true twice over — a hidden tab keeps its pane mounted so its scroll survives, and
two panes hold two documents at once — so the panel went to whichever leaf rendered last, and
clicking a tab, which unmounts nothing, changed nothing at all.

| | |
|---|---|
| **fixed** | the URL decides whether a file is open; a prop that disagrees means WAIT, never guess |
| **fixed** | the proofs panel follows the document he SELECTED — the focused pane's active tab |
| **and the duplicate history entries** | a route that would not change the URL is no longer pushed, so one click is one back-press |
| **proven in a real browser**, not only in the suite | five presses, before and after, with every store write and every push logged |
| **tests** | 2649 window (+11) · 448 hub · 23 cli · `yarn verify` green bare, including the ratchet and the production build |
| **arming** | `src/` only — **the bundle is rebuilt and swapped**, so your window takes it on its own at a moment that costs you nothing. Nothing to press, nothing to restart |

---

## Press-list

- [ ] Split, drag a document across, drag it back, then press the Dashboard tab. It should go to
      the Dashboard and STAY there.
- [ ] With two panes open, click a tab on each side in turn and watch the Proofs panel's scope
      label — it should name the document you just clicked, both times.
- [ ] Press a tab, then press the browser's back button **once**. It should undo exactly that one
      click.

## What it actually was

::file[src/pages/SystemView/tabsStore.js]

The centre is handed a `codeFile` prop that `SystemView` derives from the URL **in an effect** — and
**React runs a child's effects before its parent's**. So there is always one render where the URL
has moved on and the prop still names the document you just left. That is not a race that sometimes
happens; it happens on every navigation. The split did not cause it — it made it visible, because
two panes gave the focused side something else to be.

`fileBranch` is the rule, extracted and pure so it can be pinned:

| the URL says | the prop says | answer |
|---|---|---|
| a file | the same file | **`file`** — a real navigation, open it |
| a file | a different file, or nothing yet | **`wait`** — neither is trusted; the next render agrees |
| no file | still a file | **`tabs`** — the tab param decides, and the stale prop opens nothing |

`wait` is the whole fix, and waiting is safe because the prop catching up is itself a render.

## The measurement, before and after

One press on the Dashboard tab, every `localStorage` write and every `pushState` logged:

| | before | after |
|---|---|---|
| events from one click | **8** — four store writes, three pushes | **4** — one push, and the writes agree |
| where it landed | back on the file, URL restored to `?file=…` | `?tab=dash`, Dashboard wearing `--active` |
| tab counts across five presses | — | **`2+1` throughout; nothing spawned** |

That last row is the one aimed at his second report — *"you click something and then some other
tabs show up."* A stale prop re-opening a document is also how a document that is **no longer open**
gets re-created as a tab out of nowhere.

## The side panel

::file[src/atoms/Markdown/blocks/DocProofs.js]

A `Shown` context, set per pane by the centre and defaulting to **true** — so every host that shows
one document at a time (the Agents page, an embed, a fixture) is untouched, and only a surface that
can show two says which one he picked. `DocProofs` asks it instead of inferring, which also answers
the case mount never could: **selecting a document that was already mounted**.

Live, across panes:

```
click RFC-076 (pane 0)       panel=RFC-076                                   focus=0
click the report (pane 1)    panel=The board answers the question it was…    focus=1
click RFC-076 again (pane 0) panel=RFC-076                                   focus=0
```

## Where the tests stand

| suite | ran | says |
|---|---|---|
| window | 2649 | green — 11 new, on the branch rule and on selection |
| hub | 448 | green — untouched by this |
| cli | 23 | green — untouched by this |
| `yarn lint:ratchet` | — | no rule got worse and nothing new appeared |
| production build | bare | compiles |
| **a real browser** | 5 presses × before/after | the numbers above |

## What I could NOT do or verify

- **The third report is only partly answered.** *"There was already a bug where there's these stale
  tabs"* — I proved tabs no longer spawn across five tab presses, which is the path he described as
  affecting his clicking. I did **not** test opening files from chips, from the nav, or from the
  chat, and an older stale-tab fault on those paths would still be there. If it recurs, it is a
  different door and I want to see it.
- **Nothing was checked in HIS window**, by design. Everything above is my own headless browser
  against the same hub, seeded with a copy of his state read read-only.
- **A green suite says nothing about the two remaining store writes** in the after-trace. They are
  idempotent re-writes of the same value, not an oscillation — the state is identical before and
  after each — but they are work the centre does not need to do, and I left them rather than widen
  the change.

## What built it

::commit{sha=fb8841e7}
::commit{sha=de7d0431}

The second is the bundle, which is how `src/` reaches the window — nothing here needs a restart. A
report cannot hold the sha of the commit that writes it, so these records land in the touch after
them and the newest commit is one-way: a fixed point left visible rather than hidden by dropping a
trailer.
