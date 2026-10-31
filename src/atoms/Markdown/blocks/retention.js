// THE RETENTION WINDOW, PARSED ONCE (RFC-076 §4.6). A report's leaf declares its ending —
// `retain=<window>` or `retain=permanent` — and two surfaces read it: the leaf's own clock face
// (Report.js) and the drawer row. One parser, in its own file, because Report.js lives under the
// markdown renderer jest cannot mount (react-markdown ESM), and a rule nothing can test is where
// a wrong clock hides. The sweep's copy lives in autobot (the other side of the process seam,
// where an import cannot reach) and copies the PARSER only — `electron/markdown/retention.cjs`
// decides whether a window has run out and never says a word about it, so the words below are this
// side's alone and a fix to them has nowhere else to land (checked 2026-10-31).
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

// THE FINEST UNIT THE WORDS OF A SPAN CAN SHOW — days above two days, minutes from an hour up (the
// "a day" band shows none, but a minute's rounding is what can carry it into "2 days"), seconds
// below. It reads like `tickFor`'s table and is not it: this is the resolution of the NUMBER, that
// one is the cadence of the REDRAW, and the days band deliberately redraws finer than it reads.
const resolution = (ms) => (ms >= UNIT.d * 2 ? UNIT.d : ms >= UNIT.h ? UNIT.m : UNIT.s);

// ROUND ONCE, BEFORE ANY UNIT IS NAMED. Rounding a REMAINDER after the band was chosen is what put
// "3h 60m" on his screen: 3h59m40s floors to 3 hours, rounds its own 59m40s remainder to 60, and
// the hour never hears about the carry. The whole family is that one mistake — "23h 60m", "59m 60s",
// "4m 60s", "120s" — so the fix is structural rather than four clamps: snap the span to the
// resolution it will be READ at, then pick the words. A snap can only push a span up into a coarser
// band (59m59.6s → 60m, which must read "an hour"), never down, so one re-snap settles it.
const snapped = (ms) => {
  const once = Math.round(ms / resolution(ms)) * resolution(ms);
  return resolution(once) === resolution(ms) ? once : Math.round(once / resolution(once)) * resolution(once);
};

/**
 * The human words for a span — the biggest unit that keeps a whole number-ish reading, and FINER AS
 * IT CLOSES, because the point of the clock is to be felt: *"it should be making me feel like, oh,
 * this shit's going away. That's the point."* A number that cannot change inside a minute cannot
 * make anybody feel anything, so under an hour the span carries the unit below it and under two
 * minutes it counts seconds. Above that, days and hours — nobody needs to watch a fortnight tick.
 *
 * Every unit below the one being read FLOORS and only the read one rounds (`snapped`), so no number
 * here can ever sit at its own ceiling.
 */
export function spanWords(ms) {
  if (ms <= 0) return "now";
  const span = snapped(ms);
  if (span >= UNIT.d * 2) return `${span / UNIT.d} days`;
  if (span >= UNIT.d) return "a day";
  if (span >= UNIT.h) {
    const h = Math.floor(span / UNIT.h);
    const min = (span - h * UNIT.h) / UNIT.m; // whole minutes — `snapped` already did the rounding
    // 1h 0m reads worse than "an hour", and an exact hour is the one case where the finer unit
    // says nothing.
    if (!min) return h === 1 ? "an hour" : `${h} hours`;
    return `${h}h ${min}m`;
  }
  if (span >= UNIT.m * 2) {
    const min = Math.floor(span / UNIT.m);
    const sec = (span - min * UNIT.m) / UNIT.s;
    return sec ? `${min}m ${sec}s` : `${min}m`;
  }
  return `${Math.max(1, span / UNIT.s)}s`;
}

/**
 * HOW OFTEN THE FACE MUST BE REDRAWN for the number on it to move — null when nothing will change.
 *
 * The clock was a snapshot: `retainLine` took `now` at render and nothing re-rendered, so it sat
 * saying "retires in 3 days" while the clock actually ran, and the only way to see it move was to
 * reopen the document. A ticker at one second would redraw a fortnight countdown 86,400 times to
 * change one digit, so the cadence is the granularity the WORDS have: whatever unit is showing is
 * the unit worth waiting for.
 */
export function tickFor(ms) {
  if (ms == null || ms <= 0) return null;
  if (ms >= UNIT.d * 2) return UNIT.h; // "3 days" — hourly is finer than it needs
  if (ms >= UNIT.h) return UNIT.m; // "5h 12m"
  return UNIT.s; // "4m 58s" / "9s" — the part he is meant to feel
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
