// THE RETENTION WINDOW, PARSED ONCE (RFC-076 §4.6). A report's leaf declares its ending —
// `retain=<window>` or `retain=permanent` — and two surfaces read it: the leaf's own clock face
// (Report.js) and the drawer row. One parser, in its own file, because Report.js lives under the
// markdown renderer jest cannot mount (react-markdown ESM), and a rule nothing can test is where
// a wrong clock hides. The sweep's copy lives in autobot (the other side of the process seam,
// where an import cannot reach) — tests on both pin the same table.
const UNIT = { s: 1000, m: 60000, h: 3600000, d: 86400000, w: 604800000 };

/** "14d" → ms. "permanent" → null (no clock). Unparseable/absent → undefined (undeclared). */
export function parseRetain(retain) {
  const r = String(retain || "").trim().toLowerCase();
  if (!r) return undefined;
  if (r === "permanent") return null;
  const m = r.match(/^(\d+(?:\.\d+)?)([smhdw])$/);
  if (!m) return undefined;
  return Number(m[1]) * UNIT[m[2]];
}

/** The human words for a span — the biggest unit that keeps a whole number-ish reading. */
export function spanWords(ms) {
  if (ms <= 0) return "now";
  const d = Math.round(ms / UNIT.d);
  if (ms >= UNIT.d * 2) return `${d} days`;
  if (ms >= UNIT.d) return "a day";
  const h = Math.round(ms / UNIT.h);
  if (ms >= UNIT.h) return h === 1 ? "an hour" : `${h} hours`;
  const min = Math.max(1, Math.round(ms / UNIT.m));
  return min === 1 ? "a minute" : `${min} minutes`;
}

/**
 * What the clock face says, or null when there is nothing to say.
 * { text, counting, urgent } — counting means divert/permanent still mean something.
 */
export function retainLine({ retired, retain, windowMs, openedAt, now = Date.now() }) {
  if (retired) return null;
  if (windowMs === null) return { text: "permanent", counting: false, urgent: false };
  if (windowMs === undefined) return null; // undeclared — the invalid chip is the message, not a clock
  if (!openedAt) return { text: `retires ${spanWords(windowMs)} after first read`, counting: false, urgent: false };
  const left = openedAt + windowMs - now;
  if (left <= 0) return { text: "retiring — the clock ran out", counting: true, urgent: true };
  return { text: `retires in ${spanWords(left)}`, counting: true, urgent: left < UNIT.d * 3 };
}
