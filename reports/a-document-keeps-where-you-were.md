::report{id="A document keeps where you were — and I aimed at the wrong panel twice" as=account retain=24h}

# A document keeps where you were — and I aimed at the wrong panel twice

**Each open file tab now has its own code pane**, all but the active one hidden, so leaving a
document and coming back lands where you were. That is the ask, and it is done.

**It took three attempts, and the first two were aimed at panels you do not use.** The thing that
found the real target was not reading the code — I did that twice and was wrong twice. It was
reading your live window.

| attempt | what I kept | why it missed |
|---|---|---|
| 1 | dash · how · board, via `KeptPane` | documents are none of those — **and it broke the dashboard's scroll** |
| 2 | `report:` tabs | a tab kind you do not use. *"There is no such thing as a report tab."* |
| 3 | **one code pane per open file tab** | this is where your documents live |

::commit{sha=af918e05}

---

## The measurement that ended it

Two attempts of reading code and reasoning, then one call into the live window:

:::cmd
node -e "console.log('.code-pane count / .doc-kept-doc count — read via AutobotShell.Window.read')"
:::

`found: 1` — a single `.code-pane`, rendering `RFCs/RFC-064-one-portable-folder.md`. Zero document
panels of the kind I had just built. **One shared code pane was serving every file tab**, so
switching files rebuilt it and the scroll position went with it.

I also checked the bundle before blaming the code — `running` matched `served`, `holding: false`,
so the fix really was live and really was wrong. That check is the one that stopped a fourth guess.

## What was actually wrong, in order

**1 · The shape, not the wiring.** There was one panel per tab KIND. Even mounted forever, one
panel cannot hold two documents' positions, because there is only ever one of it.

**2 · The gate would have defeated it anyway.** The panes were behind
`fileLens && tab === "docs"`, so looking at the dashboard unmounted **every** file pane — exactly
the case the change exists to survive. It is a visibility test now; panes live as long as their tabs
do.

**3 · The `key` was rebuilding documents on navigation.** The report panel's key was the SCOPE, so
walking the service tree rebuilt an open document. Keyed by tab now: a document's identity is its
path, and where you are standing in the tree does not make it a different document.

## The dashboard regression — mine, and the lesson is reusable

You found it in about a minute: *"suddenly the dashboard cannot be scrolled, or is stretching too
long."*

I had wrapped the panels in `KeptPane`, whose stylesheet calls itself layout-neutral because it is
`display: contents`. **That is true of box generation and says nothing about selector matching.**
`styles.scss:621` is `> .documentation-view__data-table`, which gives the panel `min-height: 0` —
the one property that lets a flex child scroll instead of stretching its parent. One element in
between and the rule stopped matching.

::commit{sha=0ac65099}

The hide moved onto each panel's own element, adding no DOM level. `.doc-kept-away` carries
`!important` and it is earned: the rule it must beat is a three-class descendant chain setting
`display: flex`, so a single class cannot win on specificity, and the alternative is duplicating
that chain and keeping the copy in step forever.

**The general rule, which is worth more than the fix:** `display: contents` makes an element
layout-invisible and selector-visible. Any `>` chain above it breaks. I checked the selectors first
on every wrapper after this, which is how the file panes each kept their own
`documentation-view__data-table`.

## KeptPane — wired, and the wrong tool here

::commit{sha=92c57577}

It had been in the tree importing to nothing since `c287c51`: its `App.js` wiring broke navigation
and was reverted. It is generalized now — a `show`+`keep` form beside `match`, 14 assertions, the
route form asserted unchanged — and its own test pins the `className` trap I walked into.

**But the centre does not use it**, and that is the honest outcome rather than a tidy one: a
component that adds a DOM level cannot sit above a direct-child selector. It remains the right tool
where an address must survive being away, and the page-level question the card originally asked —
should Code↔Agents stop unmounting — is still open, still without the routing test the card rightly
demanded.

## The finding your correction exposed

*"A tab is a tab. There is no such thing as a report tab. All types through regular files. That shit
is probably obsolete."*

Carded, because it is a duplication rather than only my mistake: opening a document has **two**
implementations — a `report:` kind with its own panel and `?rdoc=` URL, and a `file:` tab rendered
by `CodePane`. Every feature after this pays twice, and tonight it did: the scroll work was written
twice and the first one was for nobody.

I did not delete it. It carries a migration question — cached `report:` tabs, `rdoc=` links in
documents and chat history, and whatever the reports PICKER did that `CodePane` does not — and that
is not a 1am decision off the back of a correction.

## Where the tests stand

| | |
|---|---|
| window suite | 2572 assertions, green |
| `yarn verify` | green, bare, production build included |
| KeptPane | 14 assertions, both forms |
| **the wiring in `Documentation.js`** | **no suite covers it, and none can** — the file cannot mount in jest, react-markdown sits at line 3 of its import graph |

**So the green numbers say nothing about this change.** What stands behind it is the live DOM read
and your eye. That is also the gap worth closing: there is already a card saying the chat renderer
and its neighbours cannot be tested at all, and tonight is the third time this week it has cost
something.

- [ ] Open two documents, scroll one down, switch to the other and back — it should be where you
      left it
- [ ] Switch to the dashboard and back to a document — the pane must survive that too, which is
      what the moved gate is for
- [ ] Confirm the dashboard scrolls again

Nothing is left loose: both trees are committed and the bundle is rebuilt and live.
