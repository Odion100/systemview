# RFC-037 — One search that also traces code

**Status:** BUILT (2026-08-17). Written alongside the work, from his design — the shape is his, and
the parts he corrected mid-build are called out because they are the interesting half.

## Where it came from

He asked what it would take to click through code like an editor. The answer was three different
jobs wearing one name:

| | cost | verdict |
|---|---|---|
| imports and paths | half a day — it's a string, and we already open a file by path | **built** |
| a name → its binding in this file | a day — CodeMirror already parses for colouring | folded into this |
| go-to-definition across the repo | weeks — an index kept fresh, i.e. a language server | **refused** |

Then his idea, which is better than the second row: *don't jump, **search** — and colour the result
that is the definition.*

> "let's make our search different… you click on it, I want to jump to the original variable but also
> do the search thing… take advantage of putting it on the side of the screen the way we're doing with
> changes… the search follows you if you navigate to another file… instead of creating two separate
> features it's regular word search but also code trace search at the same time"

## Why a search beats a jump

**A jump has to be right or it is a lie.** An index that is 90% correct sends you confidently to the
wrong line 10% of the time, and you stop trusting all of it. A result set is honest even when the
heuristic is wrong: the worst case is that you read the list and pick. It also needs no grammar, so it
works in a `.mjs`, a `.scss` or a file type nobody has taught it about.

## The parts

- **One box** under the file header. Type in it, or **⌘-click a name** in the code and it fills.
- **Hits marked in the text**; definition-looking ones heavier; a hit inside a string dimmed.
- **The ruler carries them** — the same strip as the changes, one tick per line, click to jump.
- **`‹ 3 ›`** walks the instances; **`1 def`** is a button that goes to the definition (again for the
  next one), and its hover says *function* / *const* / *class*.
- **It follows you** — the term is per project and survives opening another file.
- **`project`** searches every file, on a press, never on a keystroke. Results grouped by file, the
  file that DECLARES the name first, each row the line itself.
- **`→ ../utils/x`** appears when the name is bound here by an import: it opens that file **on the
  declaration**, not at line 1.

## The two distinctions that took a round each

**1. An import is a definition — until it isn't.** *Inside* a file, `import { hunksOf }` IS where the
name comes from; that is the answer to "where is this bound". *Across the project* it is a signpost,
and the declaration is the answer. So the ranking is `decl ▸ import ▸ use`, and the same line can be a
definition in one view and not in the other. Two different questions that look like one.

**2. A destructured import spanning lines has no `from` on the name's line.**

```js
import {
  changeMarksOf,
  hunksOf,          // ← nothing on this line says where it comes from
} from "./gitLines";
```

Line-based detection sees a bare word and offers nothing — and this is the common case in real code.
Fixed by finding the import BLOCK and testing the hit's OFFSET against it, which also gives the
specifier and the alias for free (`import { a as b }` → chase `a` over there).

Also from him: the name inside the path string (`"./utils/mcp.mjs"` when searching `mcp`) was counting
as a second definition, because it shares the line with one. A hit inside quotes is a hit, not a
definition.

## Where it lives

- `src/atoms/CodeView/codeNav.js` — **all** the judging: import blocks, alias resolution, what a line
  does with a name, whether an offset is inside a string. One file because the editor's marks and the
  pane's trace button were already two copies of the same rule, which is how they drift.
- `src/atoms/CodeView/CodeEditor.js` — the `searchField` (hits + decorations), the ruler ticks, the
  ⌘-cursor, `⌘-click` handing the word up, and the import links.
- `src/organisms/CodePane/CodePane.js` — the box, the walker, the project search and its ranking, the
  trace hop, and resolving a specifier to a real file.

## What it deliberately will not do

Guess. Re-exports (`export * from`) are missed rather than assumed; bare package specifiers are not
links because `node_modules` isn't in the tree; nothing is indexed, so nothing goes stale.

## Not built

Two things from the design he never answered, and I left them alone: the tree marking files that
contain hits, and an **only definitions** toggle that would hand you a symbol list for the file or
the project.
