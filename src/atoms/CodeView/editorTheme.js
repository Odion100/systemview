import React from "react";
import { usePaneDark } from "../appTheme";

// PER-PANE editor theme — every themed surface (document, code file, diff) carries its OWN ☾/☀,
// keyed by a stable `paneKey` (story pane id, file path, doc namespace). The store + app-default
// fallback live in atoms/appTheme; this module just re-exports the hook and the toggle button.
export { usePaneDark } from "../appTheme";

// The icon-only toggle every themed surface wears — no words, just ☾/☀. Flips ONLY its pane.
export function EditorThemeToggle({ className = "", paneKey }) {
  const [d, toggle] = usePaneDark(paneKey);
  return (
    <button
      type="button"
      className={`editor-theme-toggle ${className}`}
      title={d ? "Light" : "Dark"}
      onClick={(e) => {
        e.stopPropagation();
        toggle();
      }}
    >
      {d ? "☀" : "☾"}
    </button>
  );
}
