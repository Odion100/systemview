"use strict";
const fs = require("fs");

// RFC-015 Tier-1 aggregation. Rolling, bounded rollups over the trace stream — we TRACK, we don't
// hoard raw. Per-method counters + a fixed latency histogram (bounded memory, gives p50/p95/p99),
// plus time-bucketed throughput for the over-time charts. Read live via the SystemView module's
// getStats(); persisted per-serviceId so a restart doesn't lose history (siblings share a cwd, so the
// filename carries the serviceId to avoid a read-modify-write collision).

// Latency bucket upper edges in ms; a final overflow bucket catches anything slower.
const LAT_EDGES = [1, 2, 5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000];

function emptyMethod() {
  return {
    count: 0,
    errors: 0,
    sumDuration: 0,
    minDuration: null,
    maxDuration: 0,
    hist: new Array(LAT_EDGES.length + 1).fill(0),
    statusCounts: {}, // http-ish status code -> count (errors only)
    firstSeen: null,
    lastSeen: null,
  };
}

function bucketIndex(ms) {
  for (let i = 0; i < LAT_EDGES.length; i++) if (ms <= LAT_EDGES[i]) return i;
  return LAT_EDGES.length;
}

// Percentile estimated from the histogram: the upper edge of the bucket where the cumulative count
// crosses p×total. Coarse but bounded and monotonic — enough to watch the tail move.
function percentile(hist, total, p) {
  if (!total) return 0;
  const target = p * total;
  let cum = 0;
  for (let i = 0; i < hist.length; i++) {
    cum += hist[i];
    if (cum >= target) return i < LAT_EDGES.length ? LAT_EDGES[i] : LAT_EDGES[LAT_EDGES.length - 1];
  }
  return LAT_EDGES[LAT_EDGES.length - 1];
}

module.exports = function createStats(options = {}) {
  const {
    serviceId,
    projectCode,
    bucketMs = 60000, // 1-minute throughput buckets
    retention = 240, // keep the last N buckets (default 4h at 1m)
    file,
  } = options;

  const methods = {}; // moduleMethod -> emptyMethod()
  const buckets = new Map(); // bucketTs -> { count, errors, sumDuration }
  let startedAt = Date.now();

  // Restore a persisted snapshot so a restart continues the series rather than resetting it.
  if (file) {
    try {
      if (fs.existsSync(file)) {
        const saved = JSON.parse(fs.readFileSync(file, "utf8"));
        if (saved && saved.methods) Object.assign(methods, saved.methods);
        if (saved && saved.buckets)
          Object.entries(saved.buckets).forEach(([ts, b]) => buckets.set(Number(ts), b));
        if (saved && saved.startedAt) startedAt = saved.startedAt;
      }
    } catch {
      /* corrupt/partial snapshot — start fresh, never throw into the host */
    }
  }

  function record(moduleMethod, info = {}) {
    if (!moduleMethod) return;
    const duration = Number(info.duration) || 0;
    const error = !!info.error;
    const now = Date.now();

    const m = methods[moduleMethod] || (methods[moduleMethod] = emptyMethod());
    if (!m.statusCounts) m.statusCounts = {}; // tolerate rollups persisted before this field existed
    m.count++;
    if (error) {
      m.errors++;
      const code = info.status || 500;
      m.statusCounts[code] = (m.statusCounts[code] || 0) + 1;
    }
    m.sumDuration += duration;
    m.minDuration = m.minDuration == null ? duration : Math.min(m.minDuration, duration);
    m.maxDuration = Math.max(m.maxDuration, duration);
    m.hist[bucketIndex(duration)]++;
    m.firstSeen = m.firstSeen || now;
    m.lastSeen = now;

    const bTs = Math.floor(now / bucketMs) * bucketMs;
    const b = buckets.get(bTs) || { count: 0, errors: 0, sumDuration: 0 };
    b.count++;
    if (error) b.errors++;
    b.sumDuration += duration;
    buckets.set(bTs, b);

    if (buckets.size > retention) {
      const cutoff = bTs - retention * bucketMs;
      for (const ts of buckets.keys()) if (ts < cutoff) buckets.delete(ts);
    }
  }

  function snapshot() {
    const methodList = Object.entries(methods).map(([moduleMethod, m]) => {
      const avg = m.count ? m.sumDuration / m.count : 0;
      return {
        moduleMethod,
        serviceId,
        projectCode,
        count: m.count,
        errors: m.errors,
        errorRate: m.count ? m.errors / m.count : 0,
        avgDuration: avg,
        minDuration: m.minDuration || 0,
        maxDuration: m.maxDuration,
        totalDuration: m.sumDuration, // load share = count × avg
        p50: percentile(m.hist, m.count, 0.5),
        p95: percentile(m.hist, m.count, 0.95),
        p99: percentile(m.hist, m.count, 0.99),
        statusCounts: m.statusCounts || {},
        firstSeen: m.firstSeen,
        lastSeen: m.lastSeen,
      };
    });
    const series = [...buckets.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([ts, b]) => ({
        ts,
        count: b.count,
        errors: b.errors,
        avgDuration: b.count ? b.sumDuration / b.count : 0,
      }));
    return { serviceId, projectCode, startedAt, bucketMs, generatedAt: Date.now(), methods: methodList, series };
  }

  function flush() {
    if (!file) return;
    try {
      const bucketObj = {};
      buckets.forEach((b, ts) => { bucketObj[ts] = b; });
      fs.writeFileSync(file, JSON.stringify({ startedAt, methods, buckets: bucketObj }));
    } catch {
      /* best-effort persistence — never throw into the host */
    }
  }

  function clear() {
    Object.keys(methods).forEach((k) => delete methods[k]);
    buckets.clear();
    startedAt = Date.now();
    flush();
  }

  return { record, snapshot, flush, clear };
};
