# RFC-069 — Any path opens: the file becomes the identity, the project becomes a stored root

**His ask, 2026-10-14:** *"We started off a different kind of project. Now we became our own IDE. I
should be able to pull up any file in my computer. Everything is based on the projects, but that's
just stored paths — we should be able to go through any path. That's for everything."*

And the demonstration that forced it, same minute: an agent navigated the window to
`~/.autobot/jobs/proactive-work/job.md`, the tool answered *"navigated → pulled up …"*, and the pane
said **"outside the project folder."** The file exists, the hub can read it, the pane can render it —
and nothing in the system has a name for it.

## 1 · What a file IS today, and why that is now the bug

A file's identity is the pair `(projectCode, relative path)`. Every layer enforces it:

| layer | where | the project-shaped assumption |
|---|---|---|
| resolve | `api/resolvePath.js` | five shapes, every one ends at "under a known root" — an absolute path outside all roots is a *refusal* (`resolved: false`) |
| read/write | `api/index.js` `inside(root, rel)` | a path is servable only inside the project's folder |
| drive | `api/drive.js` `nav()` | `file:` is passed through blind and reported as done — the lie above |
| window | `hostFiles(projectCode)` → CodePane | every read is `readFile(pc, {path})`; no pc, no read |
| tabs | `tabsStore.js` | `key = file:<pc>:<path>` (note: `fileKey` already tolerates an empty pc) |
| agents page | `DocPanel` | agent docs and skills arrive as **text blobs** through the shell's definitions host — a second, parallel file viewer that exists *precisely because* those files have no project address |

That last row is the tell. The system already needed out-of-root files badly enough to build a
whole second viewer for them — it just built it as a smuggling route instead of a door. And RFC-064's
unlanded half means the out-of-root set is growing, not shrinking: skills still live under
`~/.claude/skills`, jobs and hooks under `~/.autobot`.

## 2 · The move

**A file with no project is a legal address.** Two forms, one pipeline:

```
(projectCode, relative path)   — a project file. Everything it has today: git, comments,
                                 tests, reports, stats. Unchanged.
("", absolute path)            — a MACHINE file. Open, read, edit, save, tab, link, nav.
                                 No git, no comments, no tests — not "broken", ABSENT,
                                 and the pane says so instead of erroring.
```

The project stops being a fence and becomes what it actually is — a stored root that *enriches* a
path with git and services when the path happens to live under one. `resolveAnyPath` already
returns `{projectCode: "", path: <abs>}` for the outside case; the change is one word of meaning:
that answer stops being a refusal and becomes an address of the second kind (when the file exists;
a path that exists nowhere is still a refusal, with the reason).

**Constraint carried from his Sep 12 board card, verbatim intent:** no browser file picker,
anywhere. A picker hands you *contents*; this system needs an **address** it can reopen, watch,
link, and let an agent nav to. Every door below is a path through the hub.

## 3 · The door is new — the fence is not loosened

`inside()` stays byte-for-byte as it is. It guards the *project* door against `../../` traversal,
where a **relative** path from a browser could otherwise walk out of the root. The machine door has
no relative paths to abuse:

- New hub verbs — `readPath` / `writePath` / `listPath` (shape mirrors the project trio) —
  **absolute paths only**, normalized, `~` expanded. A relative path at this door is refused: the
  relative grammar belongs to projects.
- **Delete removes a FILE, never a tree** (his call at review, 2026-10-15: machine files must be
  deletable). The project door's `deleteFile` is recursive; a recursive delete addressed by
  absolute path is `rm -rf` with a UI, so the machine door's `deletePath` unlinks a file (or an
  empty directory) and refuses recursion by name. `rm`, not `rm -rf`.
- Reads answer anything that exists; writes require the parent directory to exist (no
  `mkdir -p` cascade from a typo).
- **Dotfiles included, on purpose.** `~/.ssh` is readable by this door because it is readable by
  the hub's own process today; the fence was never a boundary against its own user. His standing
  ruling (corpus-kind conversation): *"I'm approving the system the whole time as I'm watching
  it."* Named here so it is a decision and not an oversight.

## 4 · What changes, layer by layer

**4.1 · The resolver** (`api/resolvePath.js`) — shape 1 gains the machine ending: absolute, outside
every root, exists on disk → `{projectCode: "", path: abs, resolved: true, machine: true}`. Tail
matching and segment matching stay project-only — you cannot tail-match a disk.

**4.2 · The nav verb stops lying** (`api/drive.js` + `api/index.js`). Today `nav` validates stats
tabs and service names but passes `file:` through blind and reports *"pulled up"* — success for a
file it never checked. It resolves first; a refusal comes back as the refusal, by name. This is the
honesty fix and it ships in slice 1 whether or not anything else does.

**4.3 · The window** — CodePane grows the second address. `hostFiles("")` (or a `machineFiles`
twin) routes to the machine verbs. When `file.projectCode === ""`: the git strip, diff, stage,
history and comments are not rendered — absent, with one quiet line saying why, never a dead
control. Tab key is `file::<abs>`, which `fileKey` already produces unchanged.

**4.4 · Opening one, by hand** — the Sep 12 card's `+` button, on the tab strip: type or paste a
path (`~` works), recents kept, resolved through `sv-resolve` like every chip. Inside a known root
it opens as the project file it is — the machine form is never used for a file that has a richer
address.

**4.5 · The agents page joins the real navigator** (his B, same breath). Docs and skills are files
on disk; with machine addresses they open in the real pane — tabs, CodeMirror, markdown preview,
save — via the `sv:openFileInNav` event that already exists. DocPanel's blob plumbing retires for
anything that is a file. **Two carve-outs, named:** the agent *definition record* has merge
semantics (`definitions.save` spreads the previous record) and stays on its own save path; and
*creation* still goes through the system (`definitions.createSkill`) — the skill-authoring rule
that hand-made files are invisible files. Editing through the pane writes the same bytes the
definitions host would; one file, one truth.

**4.6 · Agents get it for free.** `nav {file: "/abs/path"}` now lands (4.2), chips in chat resolve
(4.1), and the MCP needs no new tool. The `nav` tool's description drops "repo-relative".

## 5 · What a machine file does NOT get — said once, here

| capability | machine file | why |
|---|---|---|
| open / edit / save / tabs / links / nav / TV | **yes** | the point |
| git (diff, stage, history, commit) | no | git is a property of a repo, not of the disk |
| code comments | no | the sidecar lives in the project |
| tests, stats, services | no | they are the project's |
| delete | a file, yes — a tree, no | §3 |
| watch/poll freshness | re-read on focus, v1 | the project pane's change detection rides git |

If a machine file is later discovered to be inside a repo the registry doesn't know, nothing
guesses: it stays a machine file until the folder is added as a project — the registry remains the
only list that decides (the projects.json rule).

## 6 · Slices, in landing order

1. **Honesty + the resolver + the read door** — nav resolves before reporting; machine addresses
   exist; `readPath` answers. Smallest slice that makes "show me a file outside the project" true.
2. **The pane renders it** — CodePane second address, tabs, absent-not-broken chrome. Save via
   `writePath`.
3. **The `+` / open-by-path door** on the tab strip, with recents.
4. **The agents page on the navigator** — docs and skills as real files; DocPanel reduced to the
   definition record.
5. Later, separately: pinned machine roots in the tree (`~/.autobot`, `~/.claude`), watchers,
   delete with its own argument.

## STATUS — built 2026-10-15, same day as approval

All four slices are in the tree (one commit of his away from history): the resolver's machine
ending (25 claims), the hub doors readPath/writePath/deletePath/listPath on the SystemView module
(+ /sv-machine for bytes), the honest nav (verified live: the real job.md navigated as a machine
file; a nonexistent path REFUSED by name), CodePane's second address with absent-not-broken chrome,
the + open-by-path door with recents, and slice 4 — the strip extracted whole into
organisms/CenterTabs, the Agents view on the SAME tabsStore, path-backed agent docs opening as
machine-file tabs and door-backed ones (def prompt, def record, skills, jobs, help) as agentdoc
tabs keeping their save doors. NOT yet verified by hand: the Agents-page clicks and machine-file
editing in the pane — nothing renders those pages in any suite.

Approved by him in review, with one amendment folded in above: machine files are deletable
(file-not-tree). The hub/shell question he raised at review is settled as-is: the registry stays
the shell's, the files stay the hub's — one owner per question, same as today.

## STATUS (original) — not built

Nothing here exists. The review behind it (2026-10-14) confirmed: the resolver refuses absolute
outside-root paths at `api/resolvePath.js` shape 1; `inside()` is the only servability rule;
`Drive.nav` reports success for files it never resolved; DocPanel is blob-fed by the definitions
host; `fileKey` already tolerates an empty projectCode. Slice 1 is the cheapest and carries the
honesty fix; slice 4 depends on 1–2 only.
