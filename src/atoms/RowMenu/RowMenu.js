import React, { useEffect, useState } from "react";

// RFC-027 — the row context menu: right-click is where connections get removed (any service, any
// project — the old tree tab's delete buttons live here now) and where a HOSTED service is
// configured (rename/add/delete modules, delete the project). Destructive items are TWO-STEP: the
// item arms into an inline confirm — no browser dialogs. One menu instance per surface.
//
// It lived inside CodebaseNav until a file EMBEDDED in a document wanted the same right-click, with
// the same verbs and the same two-step confirms. `classname` keeps every existing class byte-for-
// byte identical (`codebase-nav__menu…`), so the nav's own stylesheet still dresses both callers
// and neither look drifts from the other.
//
//   menu = { x, y, title, items: [{ label, action, danger?, confirm? }] } | null
function RowMenu({ menu, onClose, classname = "codebase-nav" }) {
  const [armed, setArmed] = useState(null);
  useEffect(() => setArmed(null), [menu]);
  useEffect(() => {
    if (!menu) return;
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menu, onClose]);
  if (!menu) return null;
  return (
    <>
      <div
        className={`${classname}__menu-overlay`}
        onClick={onClose}
        onContextMenu={(e) => {
          e.preventDefault();
          onClose();
        }}
      />
      <div className={`${classname}__menu`} style={{ top: menu.y, left: menu.x }}>
        <div className={`${classname}__menu-head`}>{menu.title}</div>
        {menu.items.map((it, i) =>
          it.confirm && armed === i ? (
            <div key={i} className={`${classname}__menu-confirm`}>
              <span className={`${classname}__menu-confirm-text`}>{it.confirm}</span>
              <span
                className={`${classname}__menu-yes`}
                role="button"
                onClick={() => {
                  onClose();
                  it.action();
                }}
              >
                ✓
              </span>
              <span
                className={`${classname}__menu-no`}
                role="button"
                onClick={() => setArmed(null)}
              >
                ✕
              </span>
            </div>
          ) : (
            <button
              key={i}
              type="button"
              className={`${classname}__menu-item${it.danger ? ` ${classname}__menu-item--danger` : ""}`}
              onClick={() => {
                if (it.confirm) setArmed(i);
                else {
                  onClose();
                  it.action();
                }
              }}
            >
              {it.label}
            </button>
          ),
        )}
      </div>
    </>
  );
}

export default RowMenu;
