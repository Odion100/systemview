import { useEffect, useState } from "react";

// RFC-038 — AN AGENT DOCKS INTO ITS CODEBASE.
//
// Docking used to mean "parked at the top edge of the window": a pill in a lane, out of the way and
// related to nothing. An agent belongs to a codebase, so this is where it goes back to — a section
// in that project's card, next to `services` and `code`.
//
// The nav and the bot must agree on this without either owning the other: the nav renders an empty
// SLOT for a docked project, the bot renders itself into that slot through a portal (so it keeps all
// of its state — chat, board, TV, presence — and merely appears somewhere else). This module is the
// whole contract between them: a flag, an event, and the slot's id.

const KEY = (pc) => `sv.navDock.${pc}`;

export const slotId = (pc) => `sv-agent-slot-${pc}`;
// RFC-052 — THE RAIL. When the navigator is collapsed its card (and slot) is gone; the docked agents
// move to the thin strip that is left, instead of vanishing. One slot for all of them.
export const railId = "sv-agent-rail";

export const isNavDocked = (pc) => {
  try {
    return localStorage.getItem(KEY(pc)) === "1";
  } catch {
    return false;
  }
};

export const setNavDocked = (pc, on) => {
  try {
    if (on) localStorage.setItem(KEY(pc), "1");
    else localStorage.removeItem(KEY(pc));
  } catch {}
  window.dispatchEvent(new CustomEvent("sv:navDock", { detail: { projectCode: pc, on: !!on } }));
};

// Both sides listen the same way — the flag is read from storage on every signal rather than being
// mirrored in two places, which is how the two surfaces get to disagree.
export const useNavDock = (pc) => {
  const [on, setOn] = useState(() => isNavDocked(pc));
  useEffect(() => {
    const read = () => setOn(isNavDocked(pc));
    read();
    window.addEventListener("sv:navDock", read);
    return () => window.removeEventListener("sv:navDock", read);
  }, [pc]);
  return on;
};

// RFC-052 — THE DOCK HAS SPOTS. One per agent, in an order he arranges by dropping: the dock keeps
// its length whether one agent is in it or all of them, and an empty spot is visible. The order is
// the whole state; a spot's id is what a docked bot portals into.
const ORDER_KEY = "sv.dockOrder";
export const spotId = (pc) => `sv-agent-spot-${pc}`;
export const dockOrder = () => {
  try {
    const v = JSON.parse(localStorage.getItem(ORDER_KEY));
    return Array.isArray(v) ? v.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
};
export const setDockOrder = (list) => {
  try {
    localStorage.setItem(ORDER_KEY, JSON.stringify(list));
  } catch {}
  window.dispatchEvent(new CustomEvent("sv:dockOrder"));
};
// Put `pc` at `index` (null = the end), shifting the others — dropping on a spot is rearranging.
export const placeInDock = (pc, index) => {
  const cur = dockOrder().filter((x) => x !== pc);
  const i = index == null ? cur.length : Math.max(0, Math.min(index, cur.length));
  cur.splice(i, 0, pc);
  setDockOrder(cur);
};
// ONE ORDER FOR THE DOCK AND THE CODEBASE PANEL (his rule): the projects in his order first, then
// any project the order has not met yet, in the order they arrived. Both surfaces call this.
export const orderProjects = (order, projects) => [
  ...order.filter((pc) => projects.includes(pc)),
  ...projects.filter((pc) => !order.includes(pc)),
];
// Move `pc` to the position `before` holds (or the end when `before` is null) and keep the rest.
export const moveInDock = (pc, before, projects) => {
  const cur = orderProjects(dockOrder(), projects).filter((x) => x !== pc);
  const i = before == null ? cur.length : Math.max(0, cur.indexOf(before));
  cur.splice(i, 0, pc);
  setDockOrder(cur);
};
export const useDockOrder = () => {
  const [order, setOrder] = useState(dockOrder);
  useEffect(() => {
    const read = () => setOrder(dockOrder());
    window.addEventListener("sv:dockOrder", read);
    return () => window.removeEventListener("sv:dockOrder", read);
  }, []);
  return order;
};
