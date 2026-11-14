// WHAT A `when` ROW OFFERS — the operators, and when the value is a PICK rather than typing.
//
// An event declares the values a field can take (`session.started.origin` is cold | reinit |
// resumed), and the whole point of declaring them is that nobody types a closed set from memory.
// That only works if the row is in a state where the picker can show, and it was not: a new row was
// created with `op: "contains"` while the picker rendered only for `equals`, so EVERY condition
// started as a text box and the declared values were reachable only by changing the operator first.
// The mechanism worked and was unreachable by default, which is worse than missing — his words
// opening the builder: *"everything is the value you have to type."*
//
// NO REACT IN HERE, the rule `hookWith.js` and `hookRate.js` follow: `AgentProfile.js` cannot be
// mounted in jest, so a decision written inline there is a decision nothing can check.

/** The operators every row offers, in the order a human reads them. */
export const WHEN_OPS = [
  { value: "equals", label: "is" },
  { value: "not", label: "is not" },
  { value: "contains", label: "contains" },
  { value: "startsWith", label: "starts with" },
  { value: "endsWith", label: "ends with" },
  { value: "matches", label: "matches /re/" },
  { value: "gte", label: "≥" },
  { value: "lte", label: "≤" },
  { value: "exists", label: "exists" },
];

/**
 * `was` / `was not` — THE ONLY OPERATORS OFFERED CONDITIONALLY, because they read a snapshot most
 * events do not carry. An event declares `prior: true` when it travels with its previous state; two
 * of the twenty-five do. Offered anywhere else they are a condition that is FALSE FOREVER — a hook
 * that writes correctly, lists correctly and never fires — so the builder does not show them and
 * the write door refuses them, the same belt and braces an unknown operator already gets.
 */
export const PRIOR_OPS = [
  { value: "was", label: "was" },
  { value: "wasNot", label: "was not" },
];

/** The operator list for one event: the universal set, plus the prior pair where it means anything. */
export function opsFor(event) {
  if (!event || !event.prior) return WHEN_OPS;
  const [is, isNot, ...rest] = WHEN_OPS;
  return [is, isNot, ...PRIOR_OPS, ...rest];
}

/**
 * Does this operator compare a WHOLE value, or a fragment of one?
 *
 * `equals`, `not` and the prior pair take the value entire, so a declared set is exactly what they
 * want — asking what a field WAS is the same whole-value question asked of an earlier snapshot.
 *
 * The string operators take a FRAGMENT by definition: offering `gpu-process` as the thing to find
 * inside `gpu-process` is a dropdown with one pointless answer. `matches` takes a regex, which is a
 * pattern rather than a member of the set, and `gte`/`lte` are numeric. Those keep the text box
 * they need.
 */
export const takesWholeValue = (op) => op === "equals" || op === "not" || op === "was" || op === "wasNot";

/** `exists` is the one operator with nothing to compare against — it asks only whether a field is there. */
export const needsValue = (op) => op !== "exists";

/**
 * Should this row show a PICKER, given what the event declared for the field?
 * The two halves, in one place, so the render cannot drift from the seeding below.
 */
export const picks = (values, op) => !!(values && values.length && takesWholeValue(op));

/**
 * THE VALUE THE ROW SHOULD CARRY after a field or operator change.
 *
 * A picker whose value is "" renders blank and saves an empty condition — a hook that lists
 * correctly and matches nothing, which is the same silent-never-fires failure an unknown operator
 * causes. So when the row lands in a picking state with nothing chosen, the first declared value is
 * seeded. A value the human already typed or chose is never overwritten.
 */
export function seedVal(values, op, val) {
  if (String(val || "").length) return val;
  return picks(values, op) ? String(values[0]) : "";
}

/**
 * A NEW CONDITION ROW. `equals` rather than `contains`, which is both the commonest condition and
 * the only default under which a declared set is visible at all. Every existing hook in the system
 * uses `equals` or a numeric comparison on all but two of its conditions.
 */
export function newWhenRow(fields, valuesOf) {
  const field = ((fields || [])[0] || {}).value || "";
  const values = typeof valuesOf === "function" ? valuesOf(field) : null;
  return { field, op: "equals", val: seedVal(values, "equals", "") };
}
