# RFC-022: The Codebase Surface — a file navigator, and multiple file systems

**Status:** Vision / direction with a build checklist. Extends RFC-020 (CLI-as-a-service) and RFC-021
(SystemLynx-agnostic). Does **not** change anything about how the CLI works under the hood.
**Depends on:** RFC-018 file providers (`listFiles`/`readFile`/`writeFile`/`changedFiles`) + the CM6
`CodeEditor` — already shipped. This is mostly a **new UI surface over plumbing we already have.**

## The idea — a second lens on the same project

The CLI-as-a-service (RFC-020) stays exactly as designed under the hood. What changes is its **face in the
UI**: instead of only appearing as a service in the nav, it powers a **file navigator** — your codebase,
VS-Code-style. The file tree is on the side; the center shows whichever file you pick.

This is a **second lens on one project, not a replacement**:

- **Namespace lens** (today) — `service / module / method`, the *semantic* index. SystemLynx projects lead
  with this.
- **File lens** (new) — the *physical* index, the actual filesystem. Agnostic projects lead with this.

Same store underneath. A file usually *is* a namespace locator (a module file ≈ a module of the
project-defined service), so the file lens can **find** the same tests/docs/stories a namespace holds —
but everything **stays attached to namespaces**; the lens adds no new attachment semantics. Filters
("which files have tests") are a query over that store. **You never lose the namespace map; you gain a
second entry point.**

## How it lands in the UI

- **A tab, not a peer service.** Switching from *Services* to *Files* is a lens switch — it's your codebase,
  not another service. So it's a **tab/mode**, and switching it **swaps the whole navigation** (services →
  file tree) and the center.
- **The roots are CONNECTED CODEBASES.** The Files lens lists every **connected CLI/codebase** (SystemView
  already boots one per location and detects running instances). Each codebase carries two things: its
  **file system**, and its **project-defined services** — the RFC-021 synthesized namespaces, which **may be
  empty at first**. The Services nav stays purely real live connections; synthesized services live HERE,
  under the codebase that owns them. A connected codebase with zero services is the **bootstrap state** —
  the natural anchor for "study this project and build its namespace map" (`docs/namespaces-for-agents.md`).
- **Tabs persist their state.** Switch to Files, poke around, switch back to Services — each lens remembers
  where you were. (Same discipline as the current URL/localStorage persistence.)
- **The center says CODE, and it's EDIT-FIRST.** In the file lens the center tab reads **Code** (not
  Documentation), and **everything opens in edit mode by default** (CM6 + `writeFile`) — the inversion of
  the namespace lens, which is read-first. An **`.md` file gets a Preview button in the pane header** to
  flip edit ⇄ rendered (the same read/edit look the doc panes already share); the toggle remembers itself
  per file so flipping a README to preview sticks when you come back.
- **NO BEHAVIOR CHANGES to existing features.** Stories do **not** hang on files — stories hang on
  **services/namespaces**, exactly as today. Docs likewise. The file lens adds **no new attachment
  semantics**: anything namespace-flavored a codebase gets comes from **dynamically building the
  project-defined SystemLynx service under the hood** (RFC-021) and pointing the EXISTING service
  functionality at it. That's the whole architectural move — reuse, don't rewire. **Logs** also stay with
  the service lens.
- **Design the navigation FRESH — don't copy the service nav.** A file tree wants its own affordances —
  expand/collapse dirs, open-file tabs across the top, a breadcrumb, dirty-state dots — and the new
  panel's navigation should be designed on its own terms, not derived from the existing navigator's
  shape. Treat it as an opportunity to come up with something **better**, not a port.

## Why it's worth it — develop *from* here

Scratchpad + named actions + a file editor + per-file tests is the skeleton of a **development surface**,
with the CLI-service as its backend. It turns SystemView from "inspect and test my system" into "**work on**
my system" — and it's the natural home for more dev tools over time.

## The next level — multiple file systems

The real unlock of CLI-**as-a-service**: it's just a service, so **one CLI can get a handle on another CLI**
by loading it (SystemLynx `loadService`). And if the CLI is **properly modularized, the CLI itself becomes a
module** you can mount. That means:

- **Multiple CLIs / multiple file systems at once.** SystemView already boots and detects whether an
  instance is running; running it for **multiple locations** locally already happens. So the UI can connect
  to **whichever CLI is running** — and you can be working across **several file systems from one window**.
- **Map out your system** becomes its own view on top of this (topology across services *and* file systems)
  — noted here as a future surface, not part of the first cut.

None of this needs new transport — it's SystemLynx service composition, which is what the whole system is
built on.

## Build checklist

**Foundation (reuses shipped providers — cheapest, highest value):**

- [ ] **Lens switch** — a Services ⇄ Files toggle that swaps the nav and center; each lens persists its
      state (URL/localStorage), same as tabs do today.
- [ ] **Codebase roots** — the Files nav lists connected CLIs/codebases; each expands into its file tree +
      its project-defined services (possibly empty). Empty-services state carries the bootstrap affordance.
- [ ] **File tree** — per-codebase tree over `listFiles` (dirs expand/collapse, filter box, changed-file
      dots via `changedFiles`).
- [ ] **Code center (edit-first)** — center tab reads **Code**; open a file → CM6 **edit by default** →
      `writeFile`; `.md` gets a header **Preview** toggle (edit ⇄ rendered, remembered per file); open-file
      tabs + breadcrumb; dirty-state indicator.

**Per-file tests (agnostic path, builds on RFC-020/021):**

- [ ] **Tests surfaced per file** via the file ≈ namespace mapping of the project-defined service —
      attachment stays on namespaces; filters to show which files carry tests.
- [ ] Reuse the scratchpad (Test/Actions tabs) against the file's namespace on the project-defined service.

**Multi-filesystem (the next level):**

- [ ] **Connect to another running CLI** — pick/attach a second CLI-service; show its file tree alongside.
- [ ] **CLI-as-a-module** — modularize so a CLI can mount another CLI; multiple file systems in one window.
- [ ] **"Map out your system"** view — topology across services and file systems.

## Non-goals (first cut)

- Replacing the namespace lens — it stays; the file lens is additive.
- A full editor/IDE — this is a focused file view + the existing scratchpad/actions, not a code editor
  rewrite.
- Multi-filesystem on day one — stand up the single-CLI file lens first; multi-CLI is the level after.
