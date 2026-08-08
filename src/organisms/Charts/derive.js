// Derivations shared by the Stats page and the document embeds (RFC-025 §4.3). Extracted so a
// `::topology` or `::load` block can never drift from what the page shows — one derivation, two
// call sites.
import { fmtInt } from "./format";

// Health verdict from error rate + tail latency. A 4xx is the CALLER's fault (bad payload), so only
// 5xx and latency count against a service.
export function health({ serverErrorRate, errorRate = 0, p99 = 0 }) {
  const rate = serverErrorRate != null ? serverErrorRate : errorRate;
  if (rate >= 0.05 || p99 >= 2500) return "bad";
  if (rate >= 0.01 || p99 >= 1000) return "watch";
  return "ok";
}

// Flatten every service's per-method rollups into one list.
export function flattenMethods(statsByService) {
  const out = [];
  statsByService.forEach(({ serviceId, snapshot }) => {
    (snapshot.methods || []).forEach((m) => out.push({ ...m, serviceId }));
  });
  return out;
}

// Who carries the wall-time. `share` is a fraction of the project's total, `status` its health.
export function hotspotsFrom(methods, limit = 24) {
  const totalWall = methods.reduce((n, m) => n + (m.totalDuration || 0), 0) || 1;
  return [...methods]
    .sort((a, b) => (b.totalDuration || 0) - (a.totalDuration || 0))
    .slice(0, limit)
    .map((m) => ({ ...m, share: (m.totalDuration || 0) / totalWall, status: health(m) }));
}

// Cross-service call edges from the plugin's `edges` store — the caller string is
// `service[.Module[.method]]`, stamped by the x-sv-caller header (SystemLynx ≥ 3.2).
export function edgesFrom(statsByService) {
  const byPair = {};
  statsByService.forEach(({ serviceId, snapshot }) =>
    (snapshot.edges || []).forEach((e) => {
      const parts = String(e.caller || "").split(".");
      const fromService = parts[0];
      if (!fromService) return;
      const fromModule = parts[1] || "";
      const fromMethod = parts.slice(2).join(".");
      const key = `${fromService}→${serviceId}`;
      const pair =
        byPair[key] || (byPair[key] = { from: fromService, to: serviceId, volume: 0, errors: 0, couplings: [] });
      pair.volume += e.count;
      pair.errors += e.errors;
      const via = fromMethod || "module-level call";
      let c = pair.couplings.find((x) => x.module === (fromModule || fromService) && x.via === via);
      if (!c) pair.couplings.push((c = { module: fromModule || fromService, via, calls: [] }));
      const call = `${e.moduleMethod} ×${fmtInt(e.count)}`;
      if (!c.calls.includes(call)) c.calls.push(call);
    })
  );
  return Object.values(byPair);
}

// One node per service that reported, with its aggregate health.
export function nodesFrom(statsByService) {
  return statsByService.map(({ serviceId, snapshot }) => {
    const methods = snapshot.methods || [];
    const calls = methods.reduce((n, m) => n + (m.count || 0), 0);
    const errors = methods.reduce((n, m) => n + (m.errors || 0), 0);
    const p99 = Math.max(0, ...methods.map((m) => m.p99 || 0));
    return {
      serviceId,
      calls,
      errors,
      p99,
      status: health({ errorRate: calls ? errors / calls : 0, p99 }),
    };
  });
}
