# RFC-053 — One source of interactive markdown, two hosts

**Status: proposed 2026-08-31** · from his direction to collaborate with autobot on the browser's chat

## The problem, in his words

*"There should be one source of markdown, but it seems like Autobot pushed back against that."* And
then, thinking it through further, his own pushback on that: *"there's a lot of unique visual
features about their chat that I don't want to mess up… Interactive markdown can come from one
source with different styles… even the styles can come from the one source, but if that's not
possible"* — and *"the browser should be able to define certain things that users can access."*

So the requirement is not "the browser uses SystemView's chat." It is:

1. One implementation of the **grammar** — `::file`, `::run`, `::commit`, `:ns[…]`, the lot. A
   directive must mean the same thing in both apps or agents have to learn two dialects.
2. The browser keeps its **own look**. Its chat does things ours doesn't, and none of that is on the
   table.
3. The browser **decides what the grammar may touch**. A block is a capability, and the host says
   which capabilities exist.

## What the audit found

Measured, not assumed — `src/atoms/Markdown` is 4,016 lines across 19 blocks:

- The renderer core imports **nothing** from SystemView: `Markdown.js`, `directives.js`,
  `registry.js`, `context.js`, `comments.js`, `menuOptions.js`, `nsResolve.js`, `threadFocus.js`.
- **8 of 19 blocks are already portable**: `FileLink`, `HelpLink`, `ReportLink`, `Approval`,
  `Inputs`, `Structure` (callout/details), `runSteps`, `Thread`-adjacent parsing.
- All coupling lives in **six files** and is one shape — a direct import of `ServiceContext`,
  `loadService` or `hostFiles`: `StatsEmbeds` (6), `FileEmbed` (4), `CommitBlock` (4), `RunBlock`
  (3), `ChartEmbed` (3), `TestEmbed`/`LogsEmbed` (2).

The shared thing was never our chat. It is a grammar plus a registry, and it is already most of the
way free of us.

## The design: capabilities in, styles out

**One seam.** The six coupled blocks stop importing SystemView's service layer and read a
capability context instead:

```js
{ files, git, services, stats, tests, run }
```

The host implements them. Ours resolves through the hub; the browser's resolves through Electron.

Three things fall out of that single seam:

- **Portability.** Nothing in the registry knows what app it is in.
- **Permissions — his "define what users can access."** The capability bag *is* the access model.
  A host that passes no `git` doesn't get a `::commit` button it has to disable; the block renders
  inert because the capability isn't there. No second mechanism.
- **Honest failure.** A missing capability is a stated absence, not a broken block.

**Styles stay the host's.** The core emits class names and reads theme tokens. Structure shared,
look owned. This is the part he corrected himself on, and it is not a compromise — a chat bubble and
a document page *should* render the same block differently.

### Absent is not denied

autobot's addition, and it's right: *inert-because-not-wired* and *inert-because-not-allowed* look
identical and mean opposite things. So a host marks the second by passing `DENIED` for the key, and
a block that speaks to the reader asks `useCapabilityState` for one of three words:

| state | what the host did | what the reader is told |
|---|---|---|
| `granted` | implemented it | the block works |
| `absent` | never wired it | "this surface can't read files" |
| `denied` | wired it and withheld it | "reading files isn't allowed here" |

`useCapability` still returns `null` for both refusals, so no block can act on a withheld one by
accident.

## How the browser consumes it — answered

autobot's answer, from measuring both builds: **an npm package.** Not a submodule (it would weld our
CRA/sass build to their Vite build), not a vendored copy (it rots silently, which is the worst
failure mode for a thing whose point is being one source). npm is already the channel between the
two repos.

Three constraints come with it, all theirs, all load-bearing:

1. **`react` is a peerDependency, never a dependency** (`>=17`). A direct dependency installs a
   second React and every block dies on "invalid hook call" the moment the two meet. They're on
   React 19.2.8, we're on 17.0.2 — two majors apart makes this certain, not likely.
2. **The core must not import a stylesheet.** `Markdown.js:21` does `import "./styles.scss"`, and
   autobot has no sass toolchain at all — that one line fails their build. The CSS ships as a
   separate optional entry the host imports if it wants it. Which is this RFC's own "structure
   shared, look owned", enforced by the package boundary instead of by discipline.
3. **ESM with an exports map.** Vite consumes ESM natively; CJS interop on a React package is
   avoidable pain.

## Work on our side, in order

1. **The capability context** — `atoms/Markdown/capabilities.js`, granted once at the app root
   (`App.js`) so every surface inherits it. **Built 2026-08-31**, with `capabilities.test.js`
   covering granted/absent/denied.
2. **Migrate the six** off direct imports, one at a time, each with its tests green. `FileEmbed`
   done; `StatsEmbeds`, `CommitBlock`, `RunBlock`, `ChartEmbed`, `TestEmbed`/`LogsEmbed` remain.
3. **Lift the styles** into tokens where a block still hard-codes its own look, and split the
   stylesheet out of the core's import graph (constraint 2 above).
4. **Extract** to the package, peer-React and ESM as specified.

**Detached trees re-provide everything.** A CodeMirror comment widget mounts its own React tree via
`ReactDOM.render`, so context does not reach it — `CodePane` re-provides the scope there and now the
capabilities too. Miss that and a `::file` inside a code comment goes inert while the identical
block two panes over works.

Steps 1–3 are worth doing on our own merits — six files reaching around the registry into the app is
the same coupling that makes any second surface expensive — so they don't wait on the answer.

## Not in this RFC

The **agents-as-agents** direction he described — a conversation becoming a defined agent with an
assignment, a place it runs, tool access, skills you can read and write, MCP after that. Autobot's
session layer (own cwd, env and permission mode per session) is closer to that spine than ours is,
so that RFC should be theirs. Noted here only so it isn't mistaken for part of this one.
