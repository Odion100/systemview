import { useEffect, useRef, useState } from "react";

// THE SPECS NAV DRAG, SHARED — his rule: it is the SAME side panel on every page, not a subtly
// different copy ("you know how I know it's not working? you can't drag and drop in the same
// way"). This is the nav half of SystemView.js's panel logic, extracted verbatim: width is a % of
// the row, the divider drags it, dragging past the edge collapses it, and the collapsed strip is
// a GRAB BAR — pull it inward and the panel comes back out already resizing under the pointer,
// one continuous gesture both ways (RFC-052). Same width key too (`sv.navW`), so the panel is one
// panel wherever you meet it.
const clampNav = (v) => Math.min(45, Math.max(12, v));

export default function usePanelDrag({ setOpen }) {
  const [w, setW] = useState(() => {
    const v = parseFloat(localStorage.getItem("sv.navW"));
    return isNaN(v) ? 25 : clampNav(v);
  });
  useEffect(() => {
    localStorage.setItem("sv.navW", String(w));
  }, [w]);
  const navRef = useRef(null); // the nav-panel element; its parent is the row we measure against
  const dragRef = useRef(null); // "nav" | "pull-nav" while held
  const startDrag = (e) => {
    e.preventDefault();
    dragRef.current = "nav";
    document.body.classList.add("panel-resizing");
  };
  // Ignored when the press lands on an agent in the rail — same guard as Specs.
  const startPull = (e) => {
    if (e.button !== 0) return;
    if (e.target.closest && e.target.closest(".agent-chat")) return;
    e.preventDefault();
    dragRef.current = "pull-nav";
    document.body.classList.add("panel-resizing");
  };
  useEffect(() => {
    const up = () => {
      dragRef.current = null;
      document.body.classList.remove("panel-resizing");
    };
    const move = (e) => {
      const row = navRef.current && navRef.current.parentElement;
      if (!dragRef.current || !row) return;
      const rect = row.getBoundingClientRect();
      // A pull on the collapsed strip: past the panel's own minimum, it opens and the drag
      // becomes an ordinary resize — opening earlier put the pointer inside the collapse zone.
      if (dragRef.current === "pull-nav") {
        if (((e.clientX - rect.left) / rect.width) * 100 < 12) return;
        setOpen(true);
        dragRef.current = "nav";
      }
      if (dragRef.current === "nav") {
        const raw = ((e.clientX - rect.left) / rect.width) * 100;
        // Past the edge → collapse — and the gesture does not end there: the drag turns back
        // into a pull, so keeping hold and coming back out reopens it. One motion, in and out.
        if (raw < 7) {
          setOpen(false);
          dragRef.current = "pull-nav";
          return;
        }
        setW(clampNav(raw));
      }
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
    return () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
    };
  }, [setOpen]);
  return { w, navRef, startDrag, startPull, resetW: () => setW(25) };
}
