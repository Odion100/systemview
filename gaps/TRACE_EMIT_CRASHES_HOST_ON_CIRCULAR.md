# A non-serializable trace payload crashes the host service

Turning the plugin on can take down the process it is observing. If a traced method has a
non-JSON-serializable value in `req.arguments` (or `req.returnValue`) **and that method errors**,
the trace emit recurses to a stack overflow and the whole service dies. Observability must never be
able to kill the observed — right now it can.

This is not exotic. The trigger we hit is the single most common object in a Mongoose app: a
**Mongoose `Query`**. buAPI's `makeQuery` middleware sets `req.arguments[0] = Model.where(query)`
so `get`/`getPage` can run it. A `Query` holds a live reference to the driver's connection topology,
which is deeply circular:

```
query → mongooseCollection → collection → s → db → s → topology → s → sessionPool → topology
```

As long as the request succeeds nothing happens. The moment such a method **throws** — and throwing
is normal (bad id, duplicate key, failed validation) — the plugin emits an `error` trace carrying
`req.arguments`, socket.io-parser walks the Query, hits the topology cycle, and:

```
RangeError: Maximum call stack size exceeded
    at hasBinary (socket.io-parser/.../is-binary.js)
    at SocketEmitter.emit (systemlynx/.../SocketEmitter.js)
    at trace (systemview-plugin/index.js:64)
    at res.sendError (systemview-plugin/index.js:159)
```

`[nodemon] app crashed`. Because it fires on the **error** path, the observable symptom is brutal:
"once the service throws one error, every subsequent call hangs" — the service is simply dead, and
any test waiting on an emitted event hangs forever.

## Where

`systemview-plugin/index.js`:

- **`trace(scope, fields, meta)` (~line 61)** — guards the **file write** with `try/catch`
  (`fs.appendFileSync(LOG_FILE, JSON.stringify(record))`), but the very next line
  `this.emit("log", record)` is **unguarded**. socket.io-parser's `hasBinary` runs on the record at
  encode time and stack-overflows on a cycle. The same unguarded `this.emit("log", record)` is in
  `log`/`warn`/`error`/`debug` (~lines 88–106), so a circular value handed to a manual log crashes
  too.
- **The three trace sites feed it raw request data via `redactClone`:**
  - `error` trace — `arguments: redactClone(req.arguments, redact)` (~line 160)
  - `start` trace — `arguments: redactClone(req.arguments, redact)` (~line 173)
  - `end` trace — `arguments: redactClone(...)`, `returnValue: redactClone(...)` (~lines 188–189)
- **`redactClone(data, paths)` (~line 8) does not make the payload safe — and fails both ways:**
  ```js
  function redactClone(data, paths) {
    if (!paths.length || data == null) return data;      // no redact config → returns RAW data (Query + cycle)
    const clone = JSON.parse(JSON.stringify(data));       // redact config → THROWS on a circular value
    ...
  }
  ```
  With no `redact` paths (the default) it passes the live circular object straight through to the
  emit. With `redact` paths set it throws `Converting circular structure to JSON` synchronously
  inside the before/after/`sendError` hook — uncaught, still a crash, just a different stack.

## Why it bites everyone, not just this repo

A `Query` in `req.arguments` is idiomatic Mongoose middleware. But the class of the problem is much
wider: any non-plain value that reaches a traced boundary is a landmine — a class instance with
back-references, a stream or socket, a `req`/`res` accidentally passed as an argument, a Mongoose
`Aggregate`. Every adopter is one thrown error (or one manual `log(scope, someLiveObject)`) away
from taking down production. The failure is also worst-case-shaped: it only triggers on the error
path, so it stays invisible until something is already going wrong, then removes your ability to
observe *or* serve.

Losing a trace is acceptable. Losing the service is not. The correct failure mode is a **degraded
trace**, never a dead process.

## Fix direction (two layers — defense in depth)

1. **Sanitize before building the record.** Replace `redactClone`'s `JSON.parse(JSON.stringify(...))`
   with a circular-safe clone that (a) always clones (even with no redact paths — never pass raw
   request objects through), (b) breaks cycles by rendering a back-reference as a marker such as
   `"[Circular ~.arguments[0]]"`, and (c) drops or stringifies non-JSON leaves (functions, sockets).
   The consumer still gets a useful, readable trace instead of a crash or a placeholder-for-everything.
   A value with a `toJSON` should be collapsed through it first (so a Mongoose doc renders as its
   plain form, and a caller that gives its objects a `toJSON` contract — as buAPI now does for
   `Query` — is honored).

2. **Make the emit itself unkillable.** Wrap `this.emit("log", record)` (in `trace` and in the
   manual log levels) in `try/catch`. A synchronous `RangeError` from the encoder **is** catchable
   at the call site; worst case the plugin drops that one trace and logs a one-line warning to
   stderr. This is the backstop that guarantees the host survives even a payload the sanitizer
   didn't anticipate.

With (1) you keep seeing the data; with (2) you can never crash the thing you're observing.

## Note on the caller-side fix

buAPI independently gave `mongoose.Query.prototype.toJSON` a plain contract (returns `getQuery()`),
so on our side a Query now serializes to its filter conditions and traces are both safe and readable.
That is complementary, not a substitute: it fixes one known payload in one codebase. The plugin still
needs (1)+(2) so that *any* caller, passing *anything*, gets a degraded trace instead of a downed
service.
