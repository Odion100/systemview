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
