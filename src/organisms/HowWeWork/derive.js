// THE DERIVATION, FOR REAL — the one piece of this page that is logic rather than prose, so it is
// logic and not a picture of logic. The upward-derivation demo on the page calls THIS, and Jest
// calls the same function, which is the only way a teaching surface can honestly claim to show how
// the system behaves.
//
// The rules are tonight's, from `meetings/2026-10-27-the-lifecycle-of-every-kind-we-register.md`:
//   · an objective is complete when EVERY plan attached to it is settled
//   · an objective with NO plan is incomplete, not merely un-planned
//   · an arc is settled when every objective is complete — and `has objectives` is the FLOOR,
//     because without it an empty arc satisfies everything else vacuously and takes the whole
//     trail for free
//
// No React in here on purpose, the same reason `lifecycleState.js` has none.

/** One objective: complete when it HAS plans and every one of them is settled. */
export function objectiveState(objective) {
  const plans = (objective && objective.plans) || [];
  const settled = plans.filter((p) => p.settled).length;
  return {
    id: objective && objective.id,
    total: plans.length,
    settled,
    planned: plans.length > 0,
    // THE EMPTY SET IS NOT COMPLETE. `plans.every(settled)` on an empty list is `true`, which is
    // exactly the vacuous pass the meeting ruled out: an arc with five empty objectives would read
    // done. The `total > 0` term is the floor.
    complete: plans.length > 0 && settled === plans.length,
  };
}

/**
 * THE WHOLE ARC, derived from its objectives' plans — the station it is at, and what it is waiting
 * on. `approved` is assumed (the demo starts there): what this answers is the part that derives.
 *
 * @returns {{station: string, objectives: object[], why: string, planned: number, complete: number}}
 */
export function deriveArc(objectives = []) {
  const states = objectives.map(objectiveState);
  const unplanned = states.filter((s) => !s.planned);
  const incomplete = states.filter((s) => s.planned && !s.complete);

  let station = "approved";
  let why = "";
  if (states.length === 0) {
    // The floor said out loud rather than passing vacuously.
    why = "an arc with no objectives is not settled — it is empty";
  } else if (unplanned.length) {
    station = "approved";
    why = `${unplanned.map((s) => s.id).join(" and ")} ${
      unplanned.length === 1 ? "has" : "have"
    } no plan attached — an objective with no plan is incomplete, not merely un-planned`;
  } else if (incomplete.length) {
    // HIS WORD, as of tonight: the arc's in-flight state is `inProgress`, not `open` — renamed in
    // the planning report after the first draft of this page was written.
    station = "inProgress";
    const left = states.reduce((n, s) => n + (s.total - s.settled), 0);
    why = `every objective has a plan, and ${left} ${left === 1 ? "plan is" : "plans are"} still moving`;
  } else {
    station = "settled";
    why = "every plan settled, so every objective is complete, so the arc is — derived upward, never pressed";
  }

  return {
    station,
    why,
    objectives: states,
    planned: states.filter((s) => s.planned).length,
    complete: states.filter((s) => s.complete).length,
  };
}

/**
 * WHAT A PRESS ON A STATION CAN DO — the page's own reading of its data, kept here so the panel and
 * the badge can never disagree about whether something is pressable. Mirrors the rule the whole
 * page is built around: a press does not set a state, it writes the fact the state reads.
 */
export function pressLine(station) {
  if (!station) return "";
  return station.pressable
    ? station.press
    : `${station.press} A press cannot fake this one — the surface says what is missing instead.`;
}
