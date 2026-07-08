# Trace enrichment only reaches the `end` entry

The `trace` config option accepts a function — `trace: (req) => ({ ...ctx })` — whose return value
enriches trace entries with caller-provided context (e.g. `{ user_id: req.session?.user_id }`). As
shipped, that context is applied to **only the `end` trace**.

## Where

`systemview-plugin/index.js`:

- **after-hook (`end` trace)** computes and merges the context:
  `const ctx = typeof traceConfig === "function" ? traceConfig(req) : {}` → spread into the `end`
  record.
- **before-hook (`start` trace)** does not compute or merge `ctx`.
- **`sendError` wrapper (`error` trace)** does not compute or merge `ctx`.

## Why it bites

A request that errors produces a `start` and an `error` entry but **no `end`** (the after-hook never
runs). So an errored request carries **none** of the enrichment — for buAPI that means no `user_id`
on any of its entries, so failures can't be filtered by who caused them. That's exactly the case
where the enrichment matters most: you most want to know *who* hit the error.

Successful requests are fine (the `end` entry carries it); only errored requests lose it.

## Fix direction

Call the `trace` function at **each** entry — `start`, `end`, and `error` — not once with the result
reused. Each entry gets its own fresh snapshot, which:

- lets you **filter on the enriched value at any entry**, not just the one that happened to capture it
  (otherwise you filter the `end` and miss the request's `start`/`error` for the same id);
- **surfaces a mid-request change** in the value — e.g. session or user id shifting between `start`
  and `error` — instead of masking it behind a single capture. Unlikely, but that's precisely the
  anomaly you'd want visible.

The compute is cheap (a session/id read), so there's no reason to cache it across the entries.
