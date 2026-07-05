# Plugin Gap 1 (logger race) — Confirmed, Rebuttal to RFC-008

Follow-up to `PLUGIN_LOG_GAPS.md` gap #1 and to RFC-008's gap-verification table, which filed it
**"NOT REAL"** with this rebuttal:

> *Router does `{ ...Module, req, res }` — fresh spread per request after before hook injects logger.
> `this.log` is captured in that copy.*

That rebuttal is off by one step. The mechanism was traced against source and the race is **real** —
narrow, currently dormant, but real. Doubling down, with citations.

---

## Why the "fresh spread" argument doesn't hold

The spread is real, but it happens at **method-apply time — after the entire before-chain**, which
includes an **async** method middleware. The spread faithfully copies whatever the *last writer*
left on the shared `Module`, and under concurrency that can be a different request's logger.

Three facts from source establish it:

### 1. The injection target is a shared singleton
`systemlynx/ServerManager/components/Router.js` sets, per request:
```js
req.Module = Module;   // the one registered module instance — shared across all requests
req.module = Module;
```
The plugin's `before("$all")` does `Object.assign(req.Module, makeLogger(module_name, fn, traceId, arguments))`,
and `makeLogger` **binds this request's `traceId` + `arguments` into the closures at injection time**.
So `Module.log` becomes a per-request-bound function living on a shared object.

### 2. The before-chain runs `$all` → module → method, then apply
`systemlynx/ServerManager/ServerManager.js:124,141`:
```js
const before_validators = [...beforeware.$all, ...(beforeware[name] || [])];
const beforeValidators  = [...before_validators, ...(beforeware[nsp] || [])];
```
Order: **`$all` (plugin injection) first → module-level → method-level → `handleRequest`.**
So any method middleware runs *after* the plugin has already written `Module.log`.

### 3. The capture is at apply, and a method middleware yields the event loop first
`Router.js` `handleRequest`:
```js
const results = Module[fn].apply({ ...Module, req, res }, args);   // spread captures Module.log HERE
```
And a representative method middleware, buAPI `common/middleware/getItem.js`:
```js
return async function getItem(req, res, next) {
  ...
  const item = await db.model.findById(id);   // ← yields the event loop, between $all injection and apply
```
`getItem` is registered as method-level (`this.before("method", getItem)`), so it sits **between**
the plugin's `$all` injection and `handleRequest`'s spread, and it `await`s.

---

## The exact interleaving (two concurrent requests A, B to the same module)

1. **A** → plugin `$all`: `Object.assign(Module, loggerA)` → `Module.log` is A's (traceA/argsA). A start-trace emitted.
2. **A** → `getItem`: `await db.model.findById(...)` → **yields the event loop**.
3. **B** → plugin `$all`: `Object.assign(Module, loggerB)` → `Module.log` is now **B's** (traceB/argsB). B start-trace emitted.
4. **A**'s `findById` resolves → `next()` → `handleRequest`: `{ ...Module }` captures `Module.log` = **loggerB**.
5. **A**'s method body: `this.log("scope", data)` → emitted under **B's traceId / B's arguments.** ❌

A's intermediate manual log lands under B's trace. It does not stitch to A's own start/end.

---

## Fair scope (where it does NOT bite)

- **Auto start/end traces are always correct.** They read `req._svTraceId` (per-request `req`),
  never `Module.log`. Only **manual `this.log()` in a method body** is exposed.
- **Only methods with an async before-middleware** after `$all` (the `getItem`/`makeQuery` family —
  i.e. most entity-fetching methods) have a yield window. A method with only synchronous before-
  middleware runs injection→apply in one tick with no interleave, and is safe.
- **Requires genuine concurrency** — two in-flight requests to the same module overlapping.
  Consecutive test runs (the current UI/CLI usage) never trigger it. Hence "dormant," not "absent."

So RFC-008's *practical* deferral is defensible. What's inaccurate is the *mechanical* verdict
"NOT REAL" — the `{ ...Module }` spread does not prevent the race; it captures the corrupted shared
value.

---

## Root cause and fix direction

**Root cause:** per-request state (the bound logger, carrying `traceId` + `arguments`) is stored on
the **shared `Module` singleton** and re-bound on every request. Concurrent requests clobber it.

**Fix direction:** stop binding per-request state into `Module.log`. Define `Module.log` (and
`warn`/`error`/`debug`) **once**, reading the per-request context at call time:
- In a method, `this` is `{ ...Module, req, res }` — so the logger can read `this.req._svTraceId` and
  `this.req.arguments` at call time instead of a value baked in at injection.
- Middleware has `req` directly, so give it the `req`-based form (`req.module.log` reading `req`).

With no per-request mutation of the shared object, there is nothing to clobber — the race closes
regardless of concurrency or async middleware.
