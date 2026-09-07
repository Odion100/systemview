# RFC-054 — The center is a tab strip of open documents

**Status: proposed 2026-09-06** · planning conversation, his direction

## His ask, in his words

*"Let's turn this UI into a proper file navigator… I want to be able to have multiple files
'open'… tabs to switch to files in the middle… If logs are open, they're open in a tab… Stage is
just another tab that pops up… side navigation to get to some of these places, so that the middle
section just shows tabs of what's open."*

And the unifying rule, his: *"at the end of the day, everything is a sort of document — even a
namespace. They all show; they have distinct-looking tabs per type."* The open set is kept —
*"we need to have that in the cache."*

## What's wrong with today

The middle section's three tabs — Documentation / Logs / Stage — are **kinds**, not open things.
Opening a file doesn't add anything: it hijacks the Documentation slot (the tab relabels to
"Code"), and the URL holds exactly one file, so opening a second silently closes the first.
Logs and Stage are permanent residents whether or not you're using them.

## The model

**A tab is an open document.** The center shows a tab strip of what's open, plus the active one's
content. Nothing is a permanent resident; the side navigation is how you *get* places, the strip is
what you *have open*.

### Tab kinds (each visually distinct — icon + accent, same strip)

| kind | opened from | content component (existing) |
|---|---|---|
| `file` | codebase tree, `:file[…]` chips, agent `nav --file` | CodePane |
| `doc` (namespace documentation) | clicking a project/service/module/method in the nav | Documentation body |
| `report` | Stage picker, `::report` links, `nav --report` | Reports/Stage body |
| `logs` | side-nav Logs entry, `::logs` | LogAnalyzer / InlineLogs |

Later kinds (diff-only, tests) follow the same shape; nothing here precludes them.

### Rules

- **Focus, don't duplicate.** Opening something already open focuses its tab.
- **Per-project tab sets.** Each project page keeps its own strip.
- **Close is a tab affordance** (× on hover, middle-click). Closing the active tab focuses its
  neighbor. An empty strip shows the project's own doc — the honest "nothing open" state.
- **Changed files keep their dot** on the tab, same amber the nav uses.

### URL and cache

- The **active tab rides the URL** — exactly what deep links, agent commands and `:file`/`::report`
  chips need; every existing param keeps meaning what it meant (`file=…` opens/focuses a file tab,
  `rdoc=…` a report tab, `tab=logs` a logs tab). Old links keep working with no translation layer.
- The **full open set is cached per project** (localStorage: kind + address + order + active), his
  "in the cache": a reload restores the strip, the URL decides only which one is front.

### The side navigation

Gains what the center loses: **Logs** and **Stage** become nav entries (openers), alongside the
codebase tree and the SystemLynx services tree that already exist. The nav's job is the map; the
strip's job is the desk.

### Agents

No CLI change required: `nav --file` / `--report` / `tab=logs` open-or-focus tabs instead of
replacing the center. Additive later: `tabs` state in `nav`'s receipt so an agent can see what he
has open before pointing at something.

## Migration shape (implementation sketch, not started)

1. `TabStrip` organism + an `openTabs` store (per project, cached) — the ONE writer for
   open/focus/close/reorder.
2. SystemView.js's URL→state effect feeds the store instead of `codeFile`/`tab` directly; the
   existing params become open-or-focus operations.
3. Documentation / CodePane / Reports / LogAnalyzer become tab *content* — no internal tab bar;
   the `doc-tabs` row (with its scope breadcrumb) moves into the `doc` tab's own header.
4. `sv:openFileInNav` and friends keep their names; their handler opens tabs.

## Out of scope

Split panes, drag-out windows, cross-project strips, unsaved-buffer semantics (files stay
save-on-edit as today).

**But split panes are NEXT (his word, planning ahead), so the store is shaped for them now:** the
open-tabs store models `panes: [{ tabs, active }]` with v1 holding exactly one pane. Nothing else
in this RFC changes — it just means the split work adds a pane instead of rebuilding the store.
