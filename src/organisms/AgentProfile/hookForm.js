// THE HOOK FORM'S DECISIONS, out of the render — the repo's own pattern (fold.js, floor.js,
// filters.js): what a control OFFERS is logic, and logic in a 1500-line component is logic nothing
// can hold to anything.
//
// EVERY ANSWER HERE COMES OFF THE EVENT CATALOG the harness hands over (`listHooks().events`), never
// off a table this file keeps. An event declares its own `fields`, the `values` worth offering for
// them, and the `units` those values are in — so the day `idle` learns a second field, the form
// knows without being edited. The window asking rather than voting is the rule that keeps one
// definition of what an event is.

export const eventNamed = (events, name) => (events || []).find((e) => e && e.name === name) || null;

/** Every field a `when` may use on this event: its own, then the ambient set. */
export const condFields = (events, ambient, on) => [
  ...((eventNamed(events, on) || {}).fields || []).map((f) => ({ value: f, label: f })),
  ...(ambient || []).map((a) => ({ value: a.name, label: `${a.name} · ambient` })),
];

/** The preset values an event declares for one field, or null when it declares none. */
export const valuesFor = (events, on, field) => {
  const v = (eventNamed(events, on) || {}).values;
  const vals = v && v[field];
  return Array.isArray(vals) ? vals : null;
};

/** The unit those values are in — "min", "%" — the event's to declare, never this form's to guess. */
export const unitFor = (events, on, field) => {
  const u = (eventNamed(events, on) || {}).units;
  return (u && u[field]) || "";
};

export const labelled = (v, unit) => (unit ? `${v} ${unit}` : String(v));

/**
 * WHAT THE VALUE CONTROL OFFERS, or null when it has to stay a text box.
 *
 * Offers apply to `is` AND to the two THRESHOLD ops, because a duration or a percentage is exactly
 * what gets compared with ≥ — that was the hole: `idle` declared `quietMin` and the form asked a
 * human to know the field's name, pick ≥, and type a bare number into a box with no unit on it
 * (his catch, 2026-11-07: *"I can't select the kind of times I want"*).
 *
 * A value ALREADY on the hook rides into the list even when nobody offered it, so opening a hook to
 * edit something else can never silently round it to a neighbour.
 */
export const offersFor = (events, on, field, op, current) => {
  const vals = valuesFor(events, on, field);
  if (!vals || !["equals", "gte", "lte"].includes(op)) return null;
  const unit = unitFor(events, on, field);
  const opts = vals.map((v) => ({ value: String(v), label: labelled(v, unit) }));
  if (current !== "" && current != null && !opts.some((o) => o.value === String(current)))
    opts.unshift({ value: String(current), label: labelled(current, unit) });
  return opts;
};

/**
 * What a new condition row starts as. A THRESHOLD field opens at `≥` with a real number already in
 * it; `contains` used to be the default for everything because the generic case was the only case,
 * and "contains 5" on a duration is a row nobody wanted and nobody could use.
 */
export const blankRow = (events, ambient, on) => {
  const field = (condFields(events, ambient, on)[0] || {}).value || "";
  const vals = valuesFor(events, on, field);
  const numeric = !!(vals && vals.length && typeof vals[0] === "number");
  return { field, op: numeric ? "gte" : "contains", val: numeric ? String(vals[0]) : "" };
};
