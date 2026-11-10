// ─── THE WORKING AGENTS COME TO HIM ────────────────────────────────────────────────────────────
//
// His ask: *"the agents that are active should be sliding to the beginning, so I don't have to
// keep swiping all the way looking for agents."* And immediately the constraint that is the whole
// difficulty: *"it has to do it intelligently, it can't be fighting. I don't want to see constant
// switching."*
//
// A naive "sort by busy" fights. Two agents working, one finishes a turn, the comparator flips,
// and the strip rearranges under a click he already started. So the ordering here is built out of
// four rules, and every one of them exists to stop a specific kind of movement:
//
//   1. ARRIVAL ORDER INSIDE THE FRONT GROUP. The working agents are ordered by WHEN THEY STARTED,
//      earliest first — never by name, never by activity level. A newly working agent therefore
//      lands at the END of the front group, so nothing already up front moves, and two working
//      agents can never swap places with each other. That single rule removes the thrash a
//      busy-sort causes.
//   2. AN AFTERGLOW. Finishing does not drop an agent instantly: it holds its slot for a while
//      after it goes quiet. A bot that flips working → waiting → working would otherwise bounce
//      in and out of the front group several times a minute, and a tab that moves because
//      something ENDED is the least useful movement there is.
//   3. A RESTART INSIDE ITS OWN AFTERGLOW KEEPS ITS OLD PLACE. It never left, so it does not
//      arrive — it keeps its original `since` and stays exactly where it was.
//   4. FROZEN WHILE HE IS ON THE STRIP. Hovering the tabs means he is about to press one. While
//      the pointer is there the order does not change at all; what arrived or left in the meantime
//      is reconciled at the edges, so a tab never moves out from under a click.
//
// THIS IS A LAYER OVER THE DOCK ORDER, NOT A CHANGE TO IT. `orderProjects` is ONE order shared by
// the dock, the rail, the codebase panel and the agent panel (his rule), so sorting it by activity
// would rearrange cards on four other surfaces. The strip asked for this; the strip alone gets it,
// and his order is what everything falls back to.

/** How long a finished agent keeps its place up front. */
export const AFTERGLOW_MS = 25000;

/** Is this agent up — working now, or still inside the afterglow of having been? */
const up = (r, now) => !!r && (r.until === 0 || r.until > now);

/**
 * `runs` as the strip keeps it: `{ [projectCode]: { since, until } }`.
 *   `since` — when it started working. The front group's sort key, and the reason it is stable.
 *   `until` — `0` while it is still working, otherwise when its afterglow runs out.
 */
export function beginRun(runs = {}, pc, now = Date.now(), afterglow = AFTERGLOW_MS) {
  const r = runs[pc];
  if (r && r.until === 0) return runs; // already working — nothing changed
  // A RESTART INSIDE ITS OWN AFTERGLOW IS NOT AN ARRIVAL: it never actually left the group, so it
  // keeps the place it already had instead of going to the back of it.
  const since = r && r.until > now ? r.since : now;
  return { ...runs, [pc]: { since, until: 0 } };
}

export function endRun(runs = {}, pc, now = Date.now(), afterglow = AFTERGLOW_MS) {
  const r = runs[pc];
  if (r && r.until !== 0) return runs; // already quiet — the afterglow it has is the one it keeps
  return { ...runs, [pc]: { since: (r && r.since) || now, until: now + afterglow } };
}

/** Who wears the working mark — derived from `runs`, so the dot and the order cannot disagree. */
export const workingNow = (runs = {}) =>
  new Set(Object.keys(runs).filter((pc) => runs[pc] && runs[pc].until === 0));

/** Is anything still counting down? The strip only needs a clock while something is. */
export const glowing = (runs = {}, now = Date.now()) =>
  Object.keys(runs).some((pc) => runs[pc] && runs[pc].until > 0 && runs[pc].until > now);

/**
 * The tabs, in the order the strip draws them.
 *
 * @param order  every tab, in the dock order — his order, which is the fallback for everything
 * @param runs   `{ [pc]: { since, until } }`
 * @param frozen he is on the strip; hold still
 * @param last   the order drawn last time, which is what `frozen` holds to
 */
export function tabOrder({ order = [], runs = {}, now = Date.now(), frozen = false, last = [] } = {}) {
  const live = (order || []).filter(Boolean);
  if (frozen && last.length) {
    // HOLD STILL, BUT STAY TRUTHFUL. A project that appeared while he hovered has to be drawn and
    // one that went away must not be, so the frozen order is reconciled at its edges and nothing
    // already on screen is moved.
    const kept = last.filter((pc) => live.includes(pc));
    return [...kept, ...live.filter((pc) => !kept.includes(pc))];
  }
  const front = live
    .filter((pc) => up(runs[pc], now))
    .sort((a, b) => runs[a].since - runs[b].since || live.indexOf(a) - live.indexOf(b));
  const rest = live.filter((pc) => !up(runs[pc], now));
  return [...front, ...rest];
}

export default tabOrder;
