# RFC-035 — Moving files, and a verb for comments

**Status:** BUILT (2026-08-17) — `systemview@2.35.0` / `systemview-plugin@2.21.0`, published and
tarball-verified. Written after the fact: he asked how hard it would be, said "let's go", and the
work went straight in — this records the decisions so the code comments referring to RFC-035 resolve
to something.

## The ask

> how hard is it for me to be able to create files delete files copy and move files

and, on drag-and-drop:

> I believe we already have a drag and drop capability so yeah I would want to try and drop let's go

Then, separately:

> wouldn't it be easy to facilitate a function call, a SystemView command — so when I say I left
> comments, they know where to look

## Files

- **Drag a row onto a FOLDER** to move it; hold **⌥** to copy. Finder's gesture, because it's the one
  already in his hands. The folder highlights while you're over it.
- **Folders are the only drop target.** A drop onto a file would have to guess between "into its
  folder" and "replace it", and one of those answers destroys something.
- **`moveFile` / `copyFile` in the plugin** — a real `fs.rename` / `fs.copyFileSync`. Read-write-delete
  would mangle every binary and lose the file's identity (git spots a rename by content). Snapshot
  first, so ⏱ holds what moved.
- **Both refuse to overwrite**, surfaced on the nav's error line: *"path/x.txt already exists"*. A
  move that silently ate a file is the one mistake you can't see happening.
- **Menus**: New file on a folder, Rename and Duplicate on a file, and Delete on ANY file — it used
  to be untracked-only, because `discardFiles` was git's verb for throwing away a new file, not a
  plain delete.
- **The drag carries a private MIME** (`application/x-systemview-file`), the same trick the test
  panel's section drag uses, so nothing else on the page answers a file drag.

**Known limitation:** an empty folder never appears in the tree, because the tree is built from
files. Making a folder is New file with a path — `writeFile` creates the folders on the way.

## `systemview comments`

    systemview comments <project>                every file with comments, and the lines
    systemview comments <project> <path>         that file's comments, his and agents' apart
    systemview comments <project> <path> --json  structured

A verb beats a folder path someone has to remember — that was his point, and it's the same argument
as tool schemas one level up: the manifest already enumerates every method and `probe` already
executes them by name; what's missing for real tool calling is an `input_schema` per method, and the
saved tests are where those shapes are already written down. Not built, worth its own RFC.

`cli/comments.js` reads through the project's own plugin, so it works from anywhere that can reach
the hub, and `ROOT` is the only place the folder path appears.
