import React, { useEffect, useRef, useState } from "react";
import "./styles.scss";

// THE APP'S OWN SELECTOR (his call: "I wanted a selector, but our own — instead of the default
// JavaScript one"). A button + menu on the app's tokens: light and dark follow the theme, the
// open menu is ours to style, and `hot` marks an option that deserves a warning color. Use this
// wherever a native <select> would have gone.
const SvSelect = ({ value, options = [], onChange, className = "" }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const away = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    const esc = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", away);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);
  const cur = options.find((o) => o.value === value) || options[0] || {};
  return (
    <span className={`sv-select ${className}`} ref={ref}>
      <button
        type="button"
        className={`sv-select__btn${cur.hot ? " sv-select__btn--hot" : ""}`}
        onClick={() => setOpen(!open)}
      >
        {cur.label}
        <span className="sv-select__caret">▾</span>
      </button>
      {open && (
        <div className="sv-select__menu">
          {options.map((o) => (
            <button
              key={String(o.value)}
              type="button"
              className={`sv-select__opt${o.value === value ? " sv-select__opt--on" : ""}${o.hot ? " sv-select__opt--hot" : ""}`}
              onClick={() => {
                setOpen(false);
                if (o.value !== value && typeof onChange === "function") onChange(o.value);
              }}
            >
              {o.label}
            </button>
          ))}
        </div>
      )}
    </span>
  );
};

export default SvSelect;
