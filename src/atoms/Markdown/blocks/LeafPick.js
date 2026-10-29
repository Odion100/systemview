import React, { useEffect, useRef, useState } from "react";

// A LEAF ATTRIBUTE YOU CAN PRESS (RFC-076, his direction 2026-10-29: "that badge should be
// clickable with a custom dropdown"). The chip shows the attribute's current word; pressing it
// summons a small list of the words the system knows, and — where the vocabulary is OPEN (a
// report's `as=` is a vocabulary, not an enum) — a field to type one nobody listed. Picking
// writes; the document stays the single state and this is only a door onto one line of it.
//
// It is its own component because the subtype chip and the retention clock are the same
// interaction wearing two labels, and two copies of a popover are two popovers drifting.
const LeafPick = ({ className = "", label, title, options = [], free, onPick }) => {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const rootRef = useRef(null);

  // A press anywhere else dismisses — the same contract every popover here keeps.
  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const pick = (word) => {
    // `onPick` may refuse (return false) — a free-typed word the attribute cannot read. The
    // popover stays open with the word still in the field, so the refusal reads as "fix it",
    // never as a press that silently did nothing.
    const ok = onPick ? onPick(word) : undefined;
    if (ok === false) return;
    setOpen(false);
    setTyped("");
  };

  return (
    <span className={`md-pick ${className}`} ref={rootRef}>
      <button type="button" className="md-pick__chip" title={title} onClick={() => setOpen(!open)}>
        {label}
        <span className="md-pick__caret" aria-hidden="true">
          ⌄
        </span>
      </button>
      {open ? (
        <span className="md-pick__pop" role="listbox">
          {options.map((o) => (
            <button key={o} type="button" className="md-pick__opt" onClick={() => pick(o)}>
              {o}
            </button>
          ))}
          {free ? (
            <input
              className="md-pick__free"
              placeholder={free}
              value={typed}
              autoFocus={!options.length}
              onChange={(e) => setTyped(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && typed.trim()) pick(typed.trim());
                if (e.key === "Escape") setOpen(false);
              }}
            />
          ) : null}
        </span>
      ) : null}
    </span>
  );
};

export default LeafPick;
