# Plugin Log — Gaps

Gaps in the plugin's log implementation as it stands after RFC-006/RFC-007
(`systemview-plugin@1.4.0`, `systemview-plugin/index.js`). Grounded in the code. This just names
them; decisions come later. Supersedes the RFC-004-era `LOGGER_GAPS.md` for the current codebase —
some of those gaps are now fixed (see note below); the rest are restated here against current lines.

Already addressed by RFC-006 (not gaps anymore): log I/O is co-located with the project (plugin
owns the local `SystemView` module, not the UI server); the hot-path write is an in-process module
call, not a remote RPC; all logging funnels through one local handle (`sv`).

---

## 1. Request-scoped trace/log state lives on the shared singleton module

`req.Module` is the same module instance for every request. The per-request logger, traceId, and
arguments are written onto it via `Object.assign(req.Module, makeLogger(...))` (index.js:137), and
module-level loggers via `Object.assign(mod, makeLogger(name))` (index.js:180). Request A sets its
logger, hits an `await` (e.g. a DB fetch in `getItem` middleware), request B overwrites the same
field, then A's method body logs under B's traceId/arguments. Single-threaded Node doesn't prevent
it — the await windows are enough. Under any real concurrency, trace IDs cross.

## 2. Same race on error-trace correlation

`mod._svTraceId` and `mod._svPendingDuration` are stashed on the shared module in the patched
`res.sendError` (index.js:131-132) and read back in the `mod.on("error")` handler (index.js:187,191).
Concurrent errors on the same module clobber each other's traceId/duration.

## 3. Arguments captured three times, unredacted

`arguments` is written on the `start` trace (index.js:143), again on the `end` trace
(index.js:157), and again on every manual log entry (index.js:51 / :112). No masking, no size cap.
A `this.log("step")` inside `signUp` writes the plaintext password each time. Same class as the
original redaction gap, widened by the manual-log duplication.

## 4. Double trace persisted per call

`before("$all")` writes a `start` entry (index.js:143) and `after("$all")` writes an `end` entry
(index.js:156); both are appended. Every call shows up twice (deduped by traceId in the reader's
head); the `start` entry has no duration and no returnValue.

## 5. Name collision: local module vs remote service both `"SystemView"`

`App.module("SystemView", SystemViewLogModule)` (index.js:121) registers a local module named
`SystemView`; `App.loadService("SystemView", connection)` (index.js:171) loads a remote service of
the same name. They're disambiguated only by `useModule` vs `useService`. Works, but one wrong
lookup sends logs to the wrong place with no error.

## 6. `.map(JSON.parse)` in getLog

`fs.readFileSync(...).split("\n").filter(Boolean).map(JSON.parse)` (index.js:84) passes the array
index as JSON.parse's second argument (the reviver). Harmless only because a non-function reviver
is ignored — a landmine one refactor from breaking.

## 7. Synchronous I/O, whole-file reads, no rotation

Every write is `fs.appendFileSync` (index.js:43, 60, 66, 72, 78); `getLog` does
`fs.readFileSync(entire file)` + parse per line then slices (index.js:84). O(file) per read, no
rotation or truncation except manual `clearLog`. Now in-process (RPC removed), but still blocking
and still unbounded.
