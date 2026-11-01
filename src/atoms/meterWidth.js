// A SEGMENT THAT EXISTS MUST BE VISIBLE. One definition, because this was being guessed per bar.
//
// His complaint: *"You gotta add a minimum size, at least like 10px or something minimum to these
// progress bars — you make him just disappear."* A fill sized `width: ${(n/total)*100}%` vanishes
// as soon as the fraction is small: 1 of 53 claims is 1.9%, which on a 160px bar is three pixels,
// and 1 of 300 is none at all. The bar then says ZERO about something that is not zero — which is
// the one thing a meter may never do here, and exactly the failure the honest-middle colours were
// introduced to avoid.
//
// IT IS PIXELS, NOT A PERCENTAGE FLOOR. A percentage floor means something different on every bar
// on the page — 2% of the lane row is under a pixel and 2% of a full-width meter is visible — so
// the floor has to be stated in the unit a human actually sees. Five call sites had independently
// invented their own (`Math.max(1, …)`, `Math.max(2, …)`, `Math.max(3, …)`, `Math.max(pct, 1.5)`),
// all in percent, all different, none of them enough on a short bar.
//
// AND ZERO STAYS ZERO. A floor applied unconditionally would draw a stub over an empty count,
// which is the same lie in the other direction and the more dangerous one: "no claims are unmet"
// must not render as a sliver of red.

/** The floor, in CSS pixels. His number. */
export const MIN_SEGMENT_PX = 10;

/**
 * The style for one fill segment of a meter.
 *
 * `fillStyle(n, total)` → `{ width: "<pct>%", minWidth: <px or 0> }`
 *
 * Pass the raw counts, not a percentage — the floor needs to know whether the real value is zero,
 * and a rounded percentage has already thrown that away (0.4% rounds to 0 and becomes
 * indistinguishable from nothing at all).
 */
export function fillStyle(n, total, { min = MIN_SEGMENT_PX } = {}) {
  const value = Number(n) || 0;
  const whole = Number(total) || 0;
  if (value <= 0 || whole <= 0) return { width: "0%", minWidth: 0 };
  const pct = Math.min(100, (value / whole) * 100);
  return { width: `${pct}%`, minWidth: min };
}

/**
 * The same, for a bar that already knows its percentage and genuinely has no counts behind it —
 * a context gauge, a share of a total nobody counted in units.
 *
 * `nonZero` is explicit because a percentage cannot answer it: 0.0001% and 0% both round to the
 * same thing, and only the caller knows which it is holding.
 */
export function pctStyle(pct, { min = MIN_SEGMENT_PX, nonZero } = {}) {
  const p = Math.max(0, Math.min(100, Number(pct) || 0));
  const real = nonZero === undefined ? p > 0 : !!nonZero;
  return { width: `${p}%`, minWidth: real ? min : 0 };
}

export default fillStyle;
