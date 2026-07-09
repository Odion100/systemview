# Cross-service historical logs aren't time-sorted

A project's logs **already aggregate across all its services** — this is not the gap. SystemLynx
projects scale by cloning services out (possibly onto different machines), but they keep the **same
`projectCode`**, and:

- `getProjects` groups connections by `projectCode`, so same-code services — wherever they run — show
  as **one project**.
- The CLI (and UI) don't read a shared file from the consumer side; they call `SystemView.getLog()` /
  subscribe to `SystemView.on("log")` **per service, over the socket**. So the fetch is
  topology-independent — it works across machines already.

The single real gap: **the historical merge isn't ordered by time.**

## Where

`cli/logs.js` — the `--current` path (~L350–365):

```js
for (const { svc } of connected) {
  let entries = await svc.SystemView.getLog({ limit });
  // ...filters...
  allEntries.push(...entries);   // <-- concatenates service A's block, then B's
}
// allEntries printed as-is — never sorted by timestamp
```

So with 2+ services in a project, `--current` reads as **service-A's block, then service-B's block**,
not one interleaved timeline. (The UI `/logs` page likely has the same shape — verify before fixing.)

Live streaming does **not** have this problem: entries print as they arrive, so they interleave by
arrival time naturally.

## Why it bites

The whole point of a project view is one timeline. The moment a project has more than one service
(a monolith split into services, or a scaled service cloned to another box), the historical view stops
reading chronologically — you get grouped-by-service blocks and have to mentally re-interleave them.
This is exactly the distributed case the feature exists for.

## Not the gap (deliberately out of scope)

- **Aggregation across services** — already works (above).
- **Single `"log"` event** — fine. The plugin emits one `this.emit("log", record)` carrying a `level`
  field; subscribers filter on `level`. No need for per-level events.
- **Per-service `limit`** — acceptable. `getLog({ limit })` pulls the tail from each service; the merge
  can be up to `limit × services`. A true project-level limit would be "merge, sort, take last N" — a
  refinement, not a gap.
- **Fancy/production log handling** — already solved by the escape hatch: `SystemView.emit("log", …)`
  is live, so anyone can `.on("log")` and ship entries to a DB / external sink themselves. When it gets
  to that level, that's production — out of SystemView's lane.

## Fix direction

Sort the merged set by `timestamp` before rendering — either **always**, or behind a flag (one or the
other):

```js
allEntries.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
```

Clock skew across machines is the only wrinkle, and that's a production concern — real deployments are
NTP-synced, so trusting wall-clock is fine. No sequence/ingest-clock design needed here. If a true
project-level `limit` is wanted, apply it after the sort (`.slice(-limit)`).
