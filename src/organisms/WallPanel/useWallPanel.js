import { useEffect, useRef, useState } from "react";

// RFC-052's PANEL ENGINE, extracted — one definition of how a wall panel resizes, collapses and
// comes back. It existed twice on the Code page (nav, scratchpad) as one hand-shared drag handler,
// and the third site (the agents page's document area, RFC-069) was hand-rolled from memory and
// got it wrong in both of the ways a copy gets wrong: the collapsed tab floated off the wall, and
// collapsing in-flow moved the container mid-drag so the math flipped and the panel blinked. His
// correction, 2026-10-16: *"we do it on the navigation tab as well… it should be componentized —
// something you could just redo."* So: the engine is THIS hook, the costumes stay the caller's.
//
// The gestures it owns, verbatim from the Code page:
//   - drag the divider → resize, clamped, width persisted (`sv.<name>W`)
//   - drag past the edge → COLLAPSE, and the gesture does not end there: it becomes a pull, so
//     keeping hold and coming back out reopens it — one motion, in and out
//   - the collapsed strip is the GRAB BAR — pull it inward and the panel is already resizing,
//     but only once the pointer is past the panel's own minimum, or it opens and shuts in one gesture
//   - openness persisted (`sv.<name>Open`), presses inside the chat ignored
//
// Callers keep their exact variable names by destructuring with aliases, so a rewire is a move:
//   const { open: navOpen, setOpen: setNavOpen, w: navW, setW: setNavW,
//           startDrag: navDrag, startPull: navPull } = useWallPanel({ name: "nav", side: "left", ... })
//
// SIDES: "left" | "right" are the wall panels; "top" | "bottom" are the BAND panels (the chat's
// instrument strip was the first — his design: "instead of expanding and de-expanding, it should
// resize; resized down it becomes a label, like it's closed"). Same engine, same gestures, the
// measurement just runs on the other axis — w is then a HEIGHT % of the row.
export default function useWallPanel({ name, side, rowRef, defaultW, min, max, collapseAt, pullGuard }) {
  const clamp = (v) => Math.min(max, Math.max(min, v));
  const [w, setW] = useState(() => {
    const v = parseFloat(localStorage.getItem(`sv.${name}W`));
    return isNaN(v) ? defaultW : clamp(v);
  });
  const [open, setOpen] = useState(() => localStorage.getItem(`sv.${name}Open`) !== "false");
  useEffect(() => {
    localStorage.setItem(`sv.${name}W`, String(w));
  }, [name, w]);
  useEffect(() => {
    localStorage.setItem(`sv.${name}Open`, String(open));
  }, [name, open]);

  const dragRef = useRef(null); // "drag" while the divider is held, "pull" while the collapsed strip is
  const liveEl = useRef(null); // THE line in hand — only it lights. A body-wide highlight lit every
  // divider on the page, so dragging one made the other side's handle "come into view" (his catch).
  // ARMED ON THE PRESS, DRESSED ON THE FIRST MOVE. The shield (pointer-events off) used to arm on
  // mousedown — which ate the mouseup, so a plain CLICK on a pull surface never fired ("you got
  // rid of just clicking that little strip to open it", his catch). A press now only remembers;
  // the shield, the lit line and the body cursor arrive with the first actual movement — a click
  // is a click and a drag is a drag, decided by the hand, not the handler.
  const dressed = useRef(false);
  const hold = (e, kind) => {
    e.preventDefault();
    dragRef.current = kind;
    liveEl.current = e.currentTarget;
    dressed.current = false;
  };
  const dress = () => {
    if (dressed.current) return;
    dressed.current = true;
    try { liveEl.current && liveEl.current.classList.add("panel-divider--live"); } catch {}
    document.body.classList.add("panel-resizing");
    // The drag's SIDE rides the body: when a collapse mid-gesture swaps the divider for the edge
    // handle, the new element mounts ALREADY LIT — the line never vanishes under your hand — and
    // only this side's, so the other wall's handle stays dark (his two catches, same day).
    document.body.classList.add(`panel-resizing--${side}`);
  };
  const startDrag = (e) => hold(e, "drag");
  // `pullGuard` — opt-in: the page panels ignore presses landing on an agent in the rail (the
  // chat's own gestures win there). It was hard-wired to ".agent-chat" until the chat's own band
  // joined the engine — whose label lives INSIDE the chat, so every pull on it was eaten at birth
  // ("you can't drag it open", his catch). The guard belongs to the panels that need it.
  const startPull = (e) => {
    if (e.button !== 0) return;
    if (pullGuard && pullGuard(e)) return;
    hold(e, "pull");
  };

  useEffect(() => {
    const up = () => {
      if (!dragRef.current) return;
      dragRef.current = null;
      if (liveEl.current) {
        try { liveEl.current.classList.remove("panel-divider--live"); } catch {}
        liveEl.current = null;
      }
      dressed.current = false;
      document.body.classList.remove("panel-resizing");
      ["left", "right", "top", "bottom"].forEach((x) => document.body.classList.remove(`panel-resizing--${x}`));
    };
    const move = (e) => {
      if (!dragRef.current || !rowRef.current) return;
      dress();
      const rect = rowRef.current.getBoundingClientRect();
      const raw =
        side === "left"
          ? ((e.clientX - rect.left) / rect.width) * 100
          : side === "right"
          ? ((rect.right - e.clientX) / rect.width) * 100
          : side === "top"
          ? ((e.clientY - rect.top) / rect.height) * 100
          : ((rect.bottom - e.clientY) / rect.height) * 100;
      if (dragRef.current === "pull") {
        // Opens at the collapse line plus a hair of hysteresis — the old gate was the panel's own
        // minimum, which made a dead stretch as wide as the panel ("you still have to pull it way
        // far out", his second catch). Now the panel pops in at its minimum the moment the pointer
        // clears the line, and tracks from there; the 3% of hysteresis is what keeps it from
        // opening and shutting in one spot.
        if (raw < collapseAt + 3) return;
        setOpen(true);
        dragRef.current = "drag";
      }
      if (dragRef.current === "drag") {
        if (raw < collapseAt) {
          setOpen(false);
          dragRef.current = "pull";
          return;
        }
        setW(clamp(raw));
      }
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
    return () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [side, min, max, collapseAt]);

  // A CLICK-OPEN NEVER RESTORES A SLIVER (his catch): collapsing by drag writes the tiny
  // pass-through height as the persisted size, so reopening gave back almost nothing. Opening from
  // at-or-near the minimum snaps to the default; a deliberate small size above that is honored,
  // and pull-opens are pointer-driven so they bypass this entirely.
  const openUp = (v) => {
    if (v) setW((cur) => (cur <= min + 2 ? defaultW : cur));
    setOpen(v);
  };
  return { open, setOpen: openUp, w, setW, startDrag, startPull };
}
