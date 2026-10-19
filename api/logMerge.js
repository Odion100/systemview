// ONE TIMELINE, ACROSS SERVICES — the merge every log reader needs, in one place.
//
// A SystemLynx project is many services under one `projectCode`, each owning its own log file, so
// every historical read is N fetches that have to become one timeline. That merge existed twice and
// was wrong in both places, in different ways:
//
//   cli/logs.js  — concatenated service A's block, then B's, and never sorted at all
//                  (gaps/LOGS_CROSS_SERVICE_MERGE_UNSORTED, filed by buAPI's agent 2026-10-16)
//   api/index.js — LOOKED sorted: `all.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0))`.
//                  The plugin writes `timestamp: new Date().toISOString()` — a STRING — and
//                  subtracting two strings is NaN, which a comparator treats as "equal", so the
//                  sort was a no-op. Then `.slice(-limit)` took the tail of an unsorted
//                  concatenation, which means the agent-facing `logs` door silently DROPPED the
//                  project's newest entries whenever the last service fetched had older ones.
//                  Measured: A[01:00, 05:00] + B[03:00, 04:00] asked for 2 answered 03:00 and
//                  04:00 — the 05:00 entry, the newest thing that happened, was not in the answer.
//
// So the rule lives here, with claims, and both faces call it. A sort that cannot work is worse than
// no sort: the unsorted version at least reads as grouped blocks, while this one reads as a timeline
// and is not one.
//
// WHY `Date.parse` AND NOT SUBTRACTION: the field is an ISO string today and was a number in older
// records, and both have to place correctly in the same timeline — a mixed read happens whenever a
// service that has not been restarted answers beside one that has.

// WHEN DID THIS HAPPEN — or null, when there is no answer. A record with no usable timestamp is not
// "the oldest thing that ever happened", which is what `|| 0` quietly turns it into.
const timeOf = (e) => {
  const t = e && e.timestamp;
  if (t === null || t === undefined || t === "") return null;
  const n = typeof t === "number" ? t : Date.parse(String(t));
  return Number.isFinite(n) ? n : null;
};

/**
 * Merge per-service log batches into one timeline, oldest first.
 *
 * @param batches  an array of arrays — one fetch per service, in whatever order they answered
 * @param limit    optional ceiling: the NEWEST `limit` entries, applied AFTER the sort. Applying it
 *                 per service (which is all a caller can do on its own) is what makes
 *                 `limit × services` entries arrive and the wrong ones survive.
 *
 * Entries that carry no usable timestamp are KEPT, at the end, in arrival order — dropping a record
 * because it cannot be placed would be a log that omits, and a log that omits is a log that lies.
 * They sit last rather than first because arrival order is the only thing known about them.
 *
 * Equal timestamps keep arrival order: Array.prototype.sort is stable, and two services logging in
 * the same millisecond have no better answer available.
 */
function mergeLog(batches = [], { limit = 0 } = {}) {
  const flat = [];
  for (const b of Array.isArray(batches) ? batches : []) if (Array.isArray(b)) flat.push(...b);
  const placed = [];
  const unplaceable = [];
  for (const e of flat) (timeOf(e) === null ? unplaceable : placed).push(e);
  placed.sort((a, b) => timeOf(a) - timeOf(b));
  const out = [...placed, ...unplaceable];
  const n = Math.floor(Number(limit) || 0);
  return n > 0 ? out.slice(-n) : out;
}

module.exports = { mergeLog, timeOf };
