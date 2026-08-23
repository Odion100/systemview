# RFC-047 — The codebase comes from the host

**Status**: drafted 2026-08-21, not started. His call, made in conversation:

> *"Codebase doesn't need to go through SystemLynx anymore. You're in the browser and the IDE, and
> you connect. We just need to map out what those things are that will change."*

This is the map. It follows [[host-boundary]]: the filesystem is a capability of the machine you are
sitting at, so it belongs to the browser; SystemLynx keeps everything that is **a service talking**
and everything **remote**.

Two objections I raised against this and then withdrew, so nobody re-litigates them: version skew
(gone — the browser ships the SystemLynx it uses, so the version is between it and itself) and
latency (**measured**: 0.7ms for a small file, 2.4ms for 200KB, 21ms to walk 899 entries — not a
cost worth designing around). The real reason stands on its own: **a folder with no service running
has nobody to read it.**

## The finding that makes this cheap

`systemview-plugin/fileProviders.js` is **already a root-bound library**, not service code:

```js
module.exports = Object.assign(createFileProviders(), { createFileProviders, findMethodLine, languageOf });
```

730 lines — `readFile`, `writeFile`, `listFiles`, `search`, `gitState`, `changedFiles`, `getDiff`,
`stageFiles`, `stageHunk`, `discardFiles`, `deleteFile`, `commit`, `push`, `fileHistory`,
`readSnapshot`, the snapshot ring, language detection, the ignore list, the walker. It knows nothing
about services, connections or SystemLynx: it takes a directory and does filesystem and git in it.

**So nothing is rewritten.** The host requires the same module, binds it to the folder it opened, and
exposes it. One implementation, two places it can run.

## What the `Plugin` module actually is (and where it splits)

`Plugin` today is `SystemViewModule({ specs, App, projectCode, serviceId, root, ... })` — a MIX:

| half | methods | needs a service? |
| --- | --- | --- |
| **the codebase** | readFile, writeFile, listFiles, search, gitState, changedFiles, getDiff, stageFiles, stageHunk, discardFiles, deleteFile, commit, push, fileHistory, readSnapshot | **no** — only a directory |
| **the service** | getManifest, getConnection, getTests, getDoc, getActions, saveAction, the specs | **yes** — this IS the running system |

The line he drew falls exactly on that seam, which is why this is a mapping job rather than a
redesign.

## The seam in the UI

`src/utils/pluginHost.js` already answers "who reads the files for this project" — `pickHost()`
chooses by CAPABILITY (git-capable sibling first, any plugin second). It gains one more candidate:
**the host itself**, when the browser opened this folder. Preference order becomes host → git-capable
plugin → any plugin → none.

Every call site — 23 files, ~90 calls — keeps calling `Plugin.readFile(...)`. They are already
written against an interface rather than a transport; what changes is which object `pickHost` hands
back.

## Surface by surface

| surface | opened folder (host) | connected project (plugin) |
| --- | --- | --- |
| file tree, open, edit, save | ✅ | ✅ |
| git: branch, changes, diff, stage, hunk, commit, push, discard | ✅ | ✅ |
| doc history / snapshot ring | ✅ | ✅ |
| code comments, reports, board, TV documents | ✅ (all are files) | ✅ |
| search | ✅ | ✅ |
| namespaces, services, probes | — | ✅ |
| saved tests, the test runner, the Stage's test panes | — | ✅ |
| actions panel | — | ✅ |
| stats, logs | — | ✅ |
| a project on another machine | — | ✅ **only here** |

An opened folder gets the IDE. A connected project gets the IDE **plus** the live system. Nothing is
taken away from anyone; the floor is lowered.

## The four things that genuinely change

1. **Project identity stops meaning "a connected service".** Today `connectedServices` is the source
   of every project in the nav. It gains a second source: folders the browser has open. A project is
   then `{ projectCode, root, host }` with services optional.
2. **`.systemview/` needs an owner without a service.** Reports, the board, code-comment sidecars and
   the reports index are all files under the folder — fine. The **room** is the exception: it lives in
   the repo but is served by the plugin's `SystemViewChat` module today. Either the host serves it the
   same way, or a folder-only project's room lives on the hub. *(My position: the host serves it —
   same file, same format, so an agent working in that folder can still grep and compact its own
   room, which is the whole reason the room moved into the repo.)*
3. **`systemview init` / connect changes meaning.** It stops being how a project becomes visible and
   becomes how a project gains its **live system**. Worth a rename in the UI copy.
4. **Two providers must not drift.** The host and the plugin have to expose the same method names and
   shapes forever. The cheapest guarantee is that both `require` the same `fileProviders.js` rather
   than each maintaining its own — which is only possible while the browser can load that module.

## Open, and his to answer

::question[Where does a folder-only project's chat room live?]{id=room options="the host serves it from the folder|the hub holds it"}

::question[Should an opened folder be able to LOAD its plugin later, or stay folder-only until its services run?]{id=upgrade options="upgrade in place when services connect|stay separate entries"}
