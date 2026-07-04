# Logger — Gaps

Gaps in the observability layer as shipped (commit `6a0c6c4`). Grounded in the code, not the
RFC's intent — where the two differ, that divergence is itself a gap. This just names them;
decisions come later.

---

## 1. Payloads captured wholesale, unredacted, at rest

`before/after("$all")` in `systemview-plugin/index.js` copy `req.arguments` and `req.returnValue`
verbatim; `saveLog` in `api/index.js` appends them to `systemview.logs` as plaintext NDJSON. No
masking, no size cap. Against a real service that means `signUp`/`signIn` passwords and tokens in
`arguments`, and user docs / sessions / bulk `getPage` results in `returnValue` — all on disk.

## 2. Storage doesn't scale within a session

`saveLog` uses `fs.appendFileSync` (sync, on the hot path). `getLogs` does
`fs.readFileSync(entire file)` + `JSON.parse` per line on every query, then slices the last N —
O(file) per read. No rotation or truncation except manual `--clear`.

## 3. Two persisted entries per call

`before("$all")` writes a `start` entry and `after("$all")` writes an `end` entry, both persisted.
Doubles file growth and shows every call twice in the CLI/UI (deduped by `traceId` in the reader's
head). The `start` entry has no duration and no result.

## 4. The `after` hook awaits saveLog on the hot path

`after("$all")` does `await SystemView.saveLog(entry)` before `next()`; `before("$all")` fires the
same call without awaiting. So every method round-trips to the SystemView service and waits for it
before completing — try/caught, so an outage won't break the call, but the latency is real and the
two hooks are inconsistent.

## 5. No per-module opt-out or sampling

`SKIP_MODULES` is hardcoded to plugin internals (`Plugin`, `SystemView`, `SystemViewLogs`).
Everything else is traced, always, at 100% — no way to exclude a chatty method or sample a
high-traffic path.

## 6. Level taxonomy drift

RFC-004 specifies `trace|info|warn|error|debug`. Shipped `makeLogger` emits `log|warn|error|debug`
— no `info`, plus a `log` level the RFC never named. `cli/logs.js` `LEVEL_COLOR` and the `--level`
help still list `info`, so `--level info` matches nothing.

## 7. Hard dependency on the full systemlynx v2 upgrade

The layer relies on systemlynx v1.21.0 (`getModules`, local module error events) and v1.20.0
(socket rooms for `--follow`). It can't land without the full v2 bump of systemlynx + client +
plugin — noting it so the upgrade is sequenced as one unit.
