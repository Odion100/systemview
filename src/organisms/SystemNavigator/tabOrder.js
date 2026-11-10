// ─── THE STRIP IS ORDERED BY WHAT HE HAS BEEN USING ────────────────────────────────────────────
//
// *"Don't you understand there's no this order? It's ordered by what I've been using. It's common
// sense!"*
//
// The first build of this got the shape wrong in a way worth writing down, because the bug was
// conceptual and both symptoms came out of it. It treated "working" as a TRANSIENT STATE and put
// the working agents in a temporary group at the front — which meant two things he immediately
// saw and hated:
//
//   1. AN AGENT THAT STARTED WORKING JUMPED IN FRONT OF THE TAB HE WAS IN. The front group was
//      ordered among itself and knew nothing about him, so the one tab with the strongest claim to
//      position 0 — the one he is reading — got pushed off it by a bot announcing itself.
//   2. WHEN IT FINISHED, IT WENT BACK. *"Why did it move away? It went back to where it was."* A
//      transient group has to spring back by construction, and a tab springing back is the worst
//      movement on the strip: it un-does the one useful thing that happened, so the agent he just
//      watched start is exactly as hard to find again as before.
//
// So there is no group and no springing back. THE STRIP IS A RECENCY LIST, and it only ever moves
// a tab FORWARD:
//
//   HE OPENS A TAB → it goes to the front, and that is the strongest claim there is. Usage beats
//   an agent's own announcement about itself, which is why a bot starting up lands BEHIND the tab
//   he is in rather than over it: *"it should have just added to the end of you."*
//
//   AN AGENT STARTS WORKING → it comes forward too, but only as far as the end of the agents that
//   have already come forward. So nothing that is already up front moves, two working agents can
//   never swap, and a new one is always found at the same edge.
//
//   NOTHING EVER FALLS BACK. Not when it finishes, not when it goes idle, not on a reload — the
//   ranks are persisted. A tab that came forward stays where it got to until something else
//   earns a place ahead of it.
//
// AND IT IS A LAYER OVER THE DOCK ORDER, NOT A CHANGE TO IT. `orderProjects` is ONE order shared
// by the dock, the rail, the codebase panel and the agent panel (his rule), so writing activity
// into it would rearrange cards on four other surfaces. Anything with no rank yet falls back to
// it, in his order, which is what a fresh strip looks like.

const KEY = "sv.tabRanks";

/**
 * `{ used: { [pc]: n }, ran: { [pc]: n }, seq: n }`
 *   `used` — when HE last opened that tab. The front tier.
 *   `ran`  — when it last STARTED working, having not been forward already. The second tier.
 *   `seq`  — one counter for both, so a rank is always comparable with any other rank.
 */
export const emptyRanks = () => ({ used: {}, ran: {}, seq: 0 });

export const readRanks = () => {
  try {
    const v = JSON.parse(localStorage.getItem(KEY));
    if (!v || typeof v !== "object") return emptyRanks();
    return {
      used: v.used && typeof v.used === "object" ? v.used : {},
      ran: v.ran && typeof v.ran === "object" ? v.ran : {},
      seq: Number(v.seq) || 0,
    };
  } catch {
    return emptyRanks();
  }
};

export const writeRanks = (r) => {
  try {
    localStorage.setItem(KEY, JSON.stringify(r));
  } catch {}
};

/**
 * HE OPENED IT. Straight to the front — nothing outranks the tab he is actually in.
 */
export function used(ranks, pc) {
  if (!pc) return ranks;
  const seq = (ranks.seq || 0) + 1;
  // THE `ran` RANK GOES WITH IT. Once he has opened a tab, "it was working a while ago" has
  // nothing left to say about where it sits, and leaving both would make the tiers disagree.
  const ran = { ...ranks.ran };
  delete ran[pc];
  return { used: { ...ranks.used, [pc]: seq }, ran, seq };
}

/**
 * IT STARTED WORKING. Forward, but only to the end of the agents already forward — so nothing
 * that is already up there moves, and it never climbs over a tab he opened himself.
 *
 * ALREADY FORWARD MEANS NOTHING HAPPENS. A bot that flips working → waiting → working would
 * otherwise re-rank on every flip; with a rank it already holds, there is nothing to re-rank.
 */
export function ran(ranks, pc) {
  if (!pc) return ranks;
  if (ranks.used[pc] != null || ranks.ran[pc] != null) return ranks;
  const seq = (ranks.seq || 0) + 1;
  return { used: ranks.used, ran: { ...ranks.ran, [pc]: seq }, seq };
}

/** Which tier a tab is in: his own ("u"), come-forward-on-its-own ("r"), or neither ("n"). */
export const tierOf = (ranks, pc) =>
  ranks.used[pc] != null ? "u" : ranks.ran[pc] != null ? "r" : "n";

/**
 * HE DROPPED IT EXACTLY HERE — *"I need to be able to pick exactly where I drop it."*
 *
 * A drop is the only event that names a POSITION rather than just "forward", so it is the only one
 * that cannot be expressed by bumping a counter. It lands the tab between the two it was dropped
 * between, in whichever tier those neighbours are in — which is what makes a drop stick instead of
 * being re-sorted out from under him on the next thing that happens.
 *
 * THE RANKS ARE FRACTIONAL FOR EXACTLY THIS. Inserting between two neighbours is a midpoint, so a
 * drop never has to renumber anything — and renumbering is what would move the OTHER tabs, which
 * is the thing this whole file is trying not to do.
 *
 * `index` is where it should sit in the order WITHOUT it, which is what a drop line draws.
 */
export function dropAt(ranks, order, pc, index) {
  if (!pc) return ranks;
  const rest = (order || []).filter(Boolean).filter((x) => x !== pc);
  const at = Math.max(0, Math.min(Number(index) || 0, rest.length));
  const left = rest[at - 1];
  const right = rest[at];
  const u = ranks.used;
  const r = ranks.ran;
  const seq = (ranks.seq || 0) + 1;
  const asUsed = (v) => {
    const ran2 = { ...r };
    delete ran2[pc];
    return { used: { ...u, [pc]: v }, ran: ran2, seq };
  };
  const asRan = (v) => {
    const used2 = { ...u };
    delete used2[pc];
    return { used: used2, ran: { ...r, [pc]: v }, seq };
  };
  // THE VERY FRONT — the same place opening it would put it.
  if (left === undefined) return asUsed(seq);
  const lt = tierOf(ranks, left);
  if (lt === "u") {
    // tier one sorts DESCENDING, so "after left" means a smaller number than left's
    const hi = u[left];
    const lo = tierOf(ranks, right) === "u" ? u[right] : 0;
    return asUsed((hi + lo) / 2);
  }
  if (lt === "r") {
    // tier two sorts ASCENDING — earliest forward first — so "after left" means a bigger number
    const lo = r[left];
    const hi = tierOf(ranks, right) === "r" ? r[right] : lo + 1;
    return asRan((lo + hi) / 2);
  }
  // DROPPED AMONG THE TABS NOTHING HAS TOUCHED. There is no rank to sit between down here: the
  // dock order IS the position, so the caller rearranges that instead and this tab keeps no rank
  // of its own. Reported rather than done here — `dockOrder` is four surfaces' order, not this
  // module's to write.
  const used2 = { ...u };
  const ran2 = { ...r };
  delete used2[pc];
  delete ran2[pc];
  return { used: used2, ran: ran2, seq: ranks.seq, dock: { pc, after: left } };
}

/** Drop ranks for projects that no longer exist, so the store cannot grow forever. */
export function prune(ranks, pcs = []) {
  const keep = new Set(pcs);
  const pick = (m) => Object.fromEntries(Object.entries(m).filter(([pc]) => keep.has(pc)));
  const next = { used: pick(ranks.used), ran: pick(ranks.ran), seq: ranks.seq };
  const same =
    Object.keys(next.used).length === Object.keys(ranks.used).length &&
    Object.keys(next.ran).length === Object.keys(ranks.ran).length;
  return same ? ranks : next;
}

/**
 * The tabs, in the order the strip draws them.
 *
 * @param order  every tab, in the dock order — his order, and the fallback for anything unranked
 * @param ranks  `{ used, ran, seq }`
 * @param frozen his pointer is on the strip; hold still, because he is about to press one
 * @param last   the order drawn last time, which is what `frozen` holds to
 */
export function tabOrder({ order = [], ranks = emptyRanks(), frozen = false, last = [] } = {}) {
  const live = (order || []).filter(Boolean);
  if (frozen && last.length) {
    // HOLD STILL, BUT STAY TRUTHFUL. A project that appeared while he hovered has to be drawn and
    // one that went away must not be, so the frozen order is reconciled at its edges and nothing
    // already on screen moves.
    const kept = last.filter((pc) => live.includes(pc));
    return [...kept, ...live.filter((pc) => !kept.includes(pc))];
  }
  const u = ranks.used || {};
  const r = ranks.ran || {};
  // TIER ONE — what he has opened, most recent first. This is the "ordered by what I've been
  // using" half, and it is the half that outranks everything.
  const mine = live.filter((pc) => u[pc] != null).sort((a, b) => u[b] - u[a]);
  // TIER TWO — what has come forward on its own, EARLIEST FIRST, so a new one lands at the far
  // end of the tier and moves nothing that is already in it.
  const theirs = live.filter((pc) => u[pc] == null && r[pc] != null).sort((a, b) => r[a] - r[b]);
  // TIER THREE — never opened, never worked: his order, untouched.
  const rest = live.filter((pc) => u[pc] == null && r[pc] == null);
  return [...mine, ...theirs, ...rest];
}

export default tabOrder;
