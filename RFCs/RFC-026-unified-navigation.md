# RFC-026 — Unified navigation (the Codebase card becomes THE nav)

**Status: approved 2026-08-08 — in progress.**

The problem: navigation is split across two tabs (SystemLynx namespaces vs Codebase files), and
navigating flips between them. That flip is where every stuck/buggy nav moment came from. The fix is
not a redesign — the current look IS the baseline (a previous attempt died of restyling creep). We
only add what's missing so one card can do everything.

## Scope

1. **Section label** — `project-testing services` → **`project services`**. The `SystemLynx` tag
   stays exactly as it renders now.

2. **Real services in the card** — the services section lists ALL of the project's services, real
   and project-defined, through the SAME expandable mini-tree the project-defined ones already use
   (service → modules → methods; modules expandable, nothing dumps flat). Same rows, same styling —
   a real service's connectionData is the same shape, so it is the same component.

3. **Files behind a fold** — the file region (filter row + tree) gets a top-level expand/collapse
   row labeled **`code`**, styled like the existing section affordances: root indentation, subtle
   badge at most, nothing colorful. State persists like the other `sv.cbNav.*` toggles.

4. **One scrollbar** — the tree stops scrolling separately; the whole nav is one scroll container.
   The file search input + filter pills are **sticky** inside it so they stay reachable deep in the
   list.

5. **Reveal clears filters** — when a reveal targets a file that active filters would hide (changed
   pill, `.md`, tracked, text query), the filters are unselected so the row is actually visible.

6. **No tab switching** — reveals stop flipping the nav lens. Namespace reveals resolve inside the
   codebase card's service tree; file reveals expand the `code` fold. Selections already ride the
   URL (`/specs/...`, `?file=`), so back walks real history. (Reveal itself stays out of the URL —
   a pointer is not a location; settled in RFC-025.)

## Refinements settled during the build (user calls)

- The **card never collapses** — it is the project's whole nav. Its **header NAVIGATES** to the
  project-level namespace (docs/tests) instead of toggling. The `code` fold owns collapsing.
- **The SystemLynx tree tab is GONE** — the nav's single tab is named `SystemLynx` and renders the
  unified card. (Supersedes the non-goal below; the delete-service/project buttons lost their UI
  home and need a new one.) The center is decoupled from the nav entirely: an open file means Code,
  and the full tab set (Code/Docs · Logs · Report · Stories) renders at project scope when no lower
  namespace is selected. Real services' dots show probe status (live/down; unprobed = SystemLynx
  indigo); service URLs are clickable; service and project rows carry doc indicators.
- The `code` fold is **collapsed by default** and selection-driven, not persisted: it opens itself
  when a file in the project is opened or revealed, expanding down to that file.
- **Navigation and expansion are separate controls**: rows navigate, carets expand/collapse. The
  carets stay small but carry an invisible padded hit area — same position, same spacing.

## Non-goals

- No restyling. No new colors, no badge redesigns, no layout changes beyond the fold + sticky row.
- The SystemLynx tab is untouched — it stays, it just stops being required.
- Nothing from the rolled-back 2026-08-06 batch comes back (pane-header band head, badge `--sub`
  outline split, `navLike` ?tab-carry/deselect, row-click navigate-only rule).
