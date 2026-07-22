# RFC-011: Log Highlight + JSON View + Collapsible Analyzer

Three small UX features for the observability log surfaces (CLI + `/logs` UI), building on the existing
filter/analyzer machinery and the react-json-view expand rendering. Independent; each can ship alone.

1. **Highlight** — filter's twin; emphasize matches instead of hiding non-matches (highlight is the new UI default).
2. **JSON view mode** — show the existing expanded JSON view for every entry (not a new card).
3. **Collapsible analyzer** — collapse the clause editors to a summary row of active indicators; give the table the space.
   x

---

## Feature 1: Highlight (filter's twin)

**Idea:** highlighting _is_ filtering that keeps every row. Same match logic as filter
(`field=value`, dot-paths, `has=`/`missing=`, AND/OR), but matches are **visually emphasized instead
of non-matches being hidden**. The user needs a way to flip a given filter between "filter" and
"highlight."

### UI

- The `/logs` page already has filter clauses / analyzer slots (quickFilters + `FieldAnalyzer` with
  AND/OR conjunction). Add a **per-clause mode toggle: Filter ↔ Highlight.**
  - **Highlight is the new default in the UI.** A newly added clause starts in highlight mode —
    matches are emphasized, no rows disappear. The user must explicitly flip a clause to Filter to
    hide non-matching rows. (This inverts today's behavior, where adding a clause immediately hides
    rows.)
  - Filter mode (explicit): non-matching rows removed.
  - Highlight mode (default): **all** rows stay; matching rows (and/or the matching field cell) get a
    highlight (background tint / emphasized cell). Each clause is independently filter or highlight.
- Reuse the existing match evaluation — only the _application_ differs (hide vs mark).
- Files: `src/pages/Logs/Logs.js` (clause state gains `mode`; row render applies a highlight class
  when a highlight clause matches), `src/sass/_log-table.scss` (`.log-row--highlight` / highlighted
  cell). Apply to the Documentation inline log table too if it shares the analyzer.

### CLI

- Add `--highlight field=value` (repeatable; **same grammar as `--filter`**, incl. `has=`/`missing=`
  and dot-paths). Parse in `cli/utils/cli.js` + `cli/startLineReader.js` (interactive log flags).
- Behavior: print **all** entries; those matching a highlight clause are colored/emphasized (chalk) —
  the matched field/value and/or the whole row. Highlight chips in the header, distinct color from
  filter chips.
- Files: `cli/logs.js` (render: mark highlighted rows; header chips), flag plumbing as above.

---

## Feature 2: JSON view mode (UI)

**Idea:** a second view mode for `/logs`. Today = table rows, click a row to expand the JSON
(react-json-view). New mode = **show that same expanded JSON view for every entry, always** — no click.

**Not a new card component.** We are _not_ designing a new card. It is the **exact JSON view we already
render on expand today**, just shown inline for all entries instead of one-at-a-time behind a click.
The only new thing is the toggle that makes "expanded" the default for every row.

### Design

- A **view-mode toggle** in the log toolbar: `Table | JSON`.
- JSON mode: each entry renders **the existing expanded-row content** — the same react-json-view
  component/props already used when you expand a row today — for every entry at once. The standard
  fields (timestamp / level / scope / moduleMethod / traceId / duration) are the same values already
  shown; whatever the expanded row shows today is what shows here, per entry.
- Reuse the current expand rendering path; don't invent new markup. If anything, this is "expand-all"
  as a persistent mode.
- **Filters _and_ highlight apply in both view modes.** Highlight is first-class in JSON mode, not just
  the table: a highlight match tints the entry **and** emphasizes the matched key/value _inside_ the
  react-json-view block. (Table mode: row/cell tint.) The Feature-1 highlight mechanism must target
  both the table cells and the JSON rendering.
- Files: `src/pages/Logs/Logs.js` (view-mode state; render the existing expanded content for every row
  instead of on click), `src/sass/_log-table.scss` (layout for the always-expanded entries).

---

## Feature 3: Collapsible analyzer (reclaim vertical space)

**Idea:** the analyzer field rows (the filter/highlight clause editors) take a lot of vertical space.
Add a way to **collapse/expand the whole analyzer** so that when collapsed it shrinks to a single
summary row — the chips/indicators that say _which_ filters and highlights are active — and the log
table gets all the reclaimed height. Expand again to edit the clauses.

### Design

- A **collapse/expand toggle** on the analyzer section. Collapsed = just the summary row of active
  filter/highlight indicators; the clause editors (field pickers, value inputs, AND/OR, mode toggles)
  hide. Expanded = today's full editing UI.
- **Indicators live ABOVE the analyzer clauses**, not below/inside them — so the summary row of active
  filter/highlight chips stays visible (and keeps defining what's shown) when the clause editors are
  collapsed away. Reorder so the chip/indicator strip is the persistent top element and the editable
  clause rows sit under it.
- Purely presentational: collapsing doesn't change which filters/highlights are active — it only hides
  the editors. The applied filter/highlight state is unchanged.
- Files: `src/pages/Logs/Logs.js` (collapsed/expanded state; move the indicator strip above the clause
  editors; conditionally render the editors), `src/sass/_log-table.scss` (collapsed layout).

---

## What changes (summary)

| File                       | Change                                                                                                                                                                                                                                           |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `src/pages/Logs/Logs.js`   | per-clause `mode` (filter/highlight, highlight default) + highlight application; Table/JSON view-mode toggle that renders the existing expanded content for every row; collapse/expand analyzer + indicator strip moved above the clause editors |
| `src/sass/_log-table.scss` | highlight styles; always-expanded entry layout; collapsed-analyzer layout                                                                                                                                                                        |
| `cli/utils/cli.js`         | `--highlight` flag parse                                                                                                                                                                                                                         |
| `cli/startLineReader.js`   | `--highlight` in interactive log flags                                                                                                                                                                                                           |
| `cli/logs.js`              | print all + mark highlighted rows; highlight header chips                                                                                                                                                                                        |

## Open questions

- **Highlight granularity** — whole row, or just the matching field cell? _(lean: row tint + emphasize
  the matched cell.)_
- **Multiple highlight clauses** — different colors per clause, or one highlight color? _(lean: one to
  start.)_
- **JSON mode depth** — mirror whatever the current expand uses (same collapse level), or expand a
  level further since it's the primary view now?
- **Scope** — Documentation inline log table gets the same modes, or `/logs` first? _(lean: `/logs`
  first.)_

## Sequencing

Small and independent. CLI `--highlight` + UI highlight can land together; card view is UI-only and
standalone. Neither blocks the RFC-010 CLI-test work.
