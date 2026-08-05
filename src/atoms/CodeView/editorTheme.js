import React, { useEffect, useState } from "react";

// THREE editor theme GROUPS — one per content family; flipping a toggle themes every surface of ITS
// family together:
//   "code" — code files / source panes (CodePane code mode, story file/source panes)
//   "docs" — documents: markdown files, notes, doc panes
//   "diff" — diff views
// Default is DARK; localStorage remembers each family's explicit switch (legacy single `sv.editorDark`
// seeds all three on first run). The app-level dark toggle sets all three at once.
const SCOPES = ["code", "docs", "diff"];
const legacy = localStorage.getItem("sv.editorDark");
const state = {};
SCOPES.forEach((s) => {
  const v = localStorage.getItem(`sv.editorDark.${s}`);
  state[s] = v !== null ? v !== "false" : legacy !== "false";
});
const subs = new Set();

export const getEditorDark = (scope = "code") => state[scope];

// setEditorDark(v) — no scope — sets ALL families (the app toggle's sync). With a scope, just that one.
export const setEditorDark = (v, scope) => {
  const targets = scope ? [scope] : SCOPES;
  targets.forEach((s) => {
    state[s] = !!v;
    localStorage.setItem(`sv.editorDark.${s}`, String(!!v));
  });
  subs.forEach((f) => f());
};

export function useEditorDark(scope = "code") {
  const [, bump] = useState(0);
  useEffect(() => {
    const f = () => bump((n) => n + 1);
    subs.add(f);
    return () => subs.delete(f);
  }, []);
  return [state[scope], () => setEditorDark(!state[scope], scope)];
}

// The icon-only toggle every themed surface wears — no words, just ☾/☀. `scope` picks which content
// family it flips (default "code").
export function EditorThemeToggle({ className = "", scope = "code" }) {
  const [d, toggle] = useEditorDark(scope);
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
