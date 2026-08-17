# RFC-034 — Comments on code files

**Status:** BUILT (2026-08-16) — verified end to end in the browser
**Date:** 2026-08-16

## What shipped

Everything below, plus one thing the plan didn't have: **`Plugin.deleteFile`**. There was no way to
remove a file at all (`discardFiles` deletes an *untracked* one, which is git's verb, not this one),
and without it the last thread leaving left an empty sidecar behind — so the tree kept marking a file
that had nothing to say. It snapshots into the history ring first, like every other write.

That makes this a **plugin change**: other projects need the published plugin before deletion really
deletes. Until then it degrades to writing an empty sidecar, and their tree mark goes stale.
Publishing is his call.

Verified in the browser, whole loop: right-click a line → *Comment on 12* → composer → post → the
thread opens itself under the line, the gutter wears 💬, the header count reads `💬 1`, the tree marks
the file. Reply lands. `clear` arms to `confirm`, wipes them, deletes the sidecar, and the tree mark
goes with it. A selection right-clicks as `Comment on 17-20`.

## The ask, in his words

> I want to make comments on my code files… they're kind of the same as threads… the comments don't
> exist in the file, they exist somewhere else, and when I pull them up they insert into the file…
> it could be something that's toggled… they'd be deleted anyway, but they would be a good thing to
> know where they are.

> what if I could select a line range and it showed the numbers that show on the side

## Why the sidecar, and why it isn't the markdown answer

A `:::thread` in a document lives IN the document — that's why RFC-025 §12 stopped writing replies to
a sidecar. It can't work here: putting a thread into `src/foo.js` means editing his source, and a
comment about code is not code.

So this is the sidecar, which is not a new mechanism — `useComments` / `commentsPath`
(`src/atoms/Markdown/comments.js`) already store comments for every markdown surface, keyed
`file-<path>` for a file preview. What does NOT exist today is any comment surface on a
non-markdown file: `commentKey` is only ever handed to `<Markdown>`. This is real work, not wiring.

## Shape

### Storage

One sidecar per commented file, in its own folder mirroring the tree (his call):
`.systemview/code-comments/<path>.json`

```json
{
  "threads": [
    { "id": "c1", "from": 57, "to": 64, "replies": [{ "text": "…", "ts": 1786…, "author": "you" }] }
  ]
}
```

**A line range, and only a line range.** Function pointers came up and he withdrew them in the next
breath — *"but that makes it hard to insert, so how about not"* — and he's right: a range says
exactly where the thread goes, a function name doesn't (under the signature? after the body? and the
thread moves every time the shape changes). Line ranges keep insertion unambiguous, which is the
whole point of showing the thread in the file.

Deliberately its own file and its own shape, NOT the flat `{id: [reply]}` the markdown sidecar uses —
that store is live and in use, and a range anchor doesn't fit it. Reply shape is identical
(`{ text, ts, author }`) so his replies and an agent's keep their distinct looks for free.

No new plugin method: readFile/writeFile, the same pair the comments store already uses.

### Anchoring — HIS CALL, on the record

**Line numbers only.** Offered three options, the middle one labelled "simple, and it quietly ends up
on the wrong lines"; that's the one he picked. So: `from`/`to` are stored and used as-is, nothing
re-finds them, and a comment on 57-64 stays on 57-64 after he inserts a line above. Ranges make this
less bad than single lines would have been, but it is a known and accepted property, not an oversight.

(If it does bite: the upgrade is storing the run's text alongside the numbers and searching for it on
load. Not in this RFC.)

### Making one

Two ways in, both on a RANGE (one line is a range of one):

1. **Drag the line numbers** — dragging down the gutter selects a run (written by hand: CodeMirror's
   number gutter has no drag-select, and without it dragging only made the browser select the
   gutter's own digits). The selected numbers light up so the range is visible before you act on it.
2. **Right-click** ("don't forget the right click menu") — with lines selected, the code's own
   right-click offers **Comment on 57-64**. The pane has no code context menu today; this adds one.
   In a document embed the BODY's right-click belongs to the document (RFC-033 follow-on), so there
   the gutter is the way in.

The selected run marks its gutter numbers the way a highlighted range already does (`focusRangeField`
in CodeEditor).

### Reading them — AS BUILT, after his corrections

A commented line wears a small 💬 on its NUMBER, always. **That icon is the button**: click it and
that comment opens under the run; click it again and it closes. The control in the pane header
expands or collapses ALL of them — it never hides the icons, and reading it as a visibility switch
was my wrong conclusion, which he caught.

The comment itself is deliberately plain: the text on a green edge, and nothing else. An earlier cut
copied the document thread's LOOK (amber badges, the word "reply", Reply and delete buttons) after he
said "make it like threads" — he meant how they BEHAVE. All of that came back out.

### Voice is a first-class way in

Right-click → **comment by voice** opens the box already recording. The form carries a mic as well.
Dictation for a CodeMirror widget is `dictateInto()` in codeComments.js — `useDictation` is a hook
and a widget is not a component.

### Deleting

- **×** on the comment deletes it — the same × a document thread's reply carries. It does not hide.
- Right-click a commented run: reply, reply by voice, delete it.
- **clear** beside the header toggle wipes every comment on the file; the last one going deletes the
  sidecar, so nothing accumulates and the tree mark disappears.

### Knowing where they are

The codebase tree marks files that have comments. Costs no new plugin method: one sidecar per
commented file means listing `.systemview/code-comments/` IS the list, and because the folder mirrors
the tree the mapping back to the file is exact rather than a slug comparison.

## Out of scope, on purpose

**Cleaning up `.systemview/` in general.** His words: *"we should try to make sure that we can clean
up things that are not being used in the systemview folder in general… that's just a consideration…
could always be a popup… not trying to digress but needs to be mentioned."* Noted and NOT folded in.
It touches stories, reports, comments, history snapshots and manifests, most of which this feature
never sees, and burying a repo-wide cleanup inside a comments RFC is how it would get built without
being thought about. Its own RFC when he wants it.

**Where the sidecars live.** They land in `.systemview/`, which is his and uncommitted in this repo
but IS committed in some projects — flagged on the TV, not answered, and the default stands until he
says otherwise.

## Files this touches

- `src/atoms/CodeView/CodeEditor.js` — gutter 💬 + drag-select, the thread widget, the code context
  menu (a new `onLineMenu` prop; the pane owns the menu, the editor just reports the range)
- `src/atoms/CodeView/codeComments.js` (new) — load/save the sidecar, the thread shape
- `src/organisms/CodePane/CodePane.js` — the header toggle, delete-all, wiring
- `src/atoms/Markdown/blocks/FileEmbed.js` — the same threads, read-only surface
- `src/organisms/CodebaseNav/CodebaseNav.js` — the 💬 mark on commented files
- `docs/interactive-markdown.md` / `agents/*` — only if an agent should be able to leave one, which
  is not yet decided
