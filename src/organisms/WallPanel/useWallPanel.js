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
export default function useWallPanel({ name, side, rowRef, defaultW, min, max, collapseAt }) {
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
  const hold = (e, kind) => {
    e.preventDefault();
    dragRef.current = kind;
    liveEl.current = e.currentTarget;
    try { liveEl.current.classList.add("panel-divider--live"); } catch {}
    document.body.classList.add("panel-resizing");
    // The drag's SIDE rides the body: when a collapse mid-gesture swaps the divider for the edge
    // handle, the new element mounts ALREADY LIT — the line never vanishes under your hand — and
    // only this side's, so the other wall's handle stays dark (his two catches, same day).
    document.body.classList.add(`panel-resizing--${side}`);
    // The drag's SIDE rides the body: when a collapse mid-gesture swaps the divider for the edge
    // handle, the new element mounts ALREADY LIT (the line never vanishes under your hand) — and
    // only this side's, so the other wall's handle stays dark (his two catches, same day).
    document.body.classList.add(`panel-resizing--${side}`);
  };
  const startDrag = (e) => hold(e, "drag");
  // Ignored when the press lands on an agent in the rail — the chat's own gestures win.
  const startPull = (e) => {
    if (e.button !== 0) return;
    if (e.target.closest && e.target.closest(".agent-chat")) return;
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
      document.body.classList.remove("panel-resizing");
      document.body.classList.remove("panel-resizing--left");
      document.body.classList.remove("panel-resizing--right");
    };
    const move = (e) => {
      if (!dragRef.current || !rowRef.current) return;
      const rect = rowRef.current.getBoundingClientRect();
      const raw =
        side === "left"
          ? ((e.clientX - rect.left) / rect.width) * 100
          : ((rect.right - e.clientX) / rect.width) * 100;
      if (dragRef.current === "pull") {
        // Opens only past the panel's own MINIMUM — any earlier and the pointer lands inside the
        // collapse zone of the resize that follows, so the panel opens and shuts in the same gesture.
        if (raw < min) return;
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

  return { open, setOpen, w, setW, startDrag, startPull };
}
