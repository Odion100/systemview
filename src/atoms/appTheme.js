import { useEffect, useState } from "react";
import { setEditorDark } from "./CodeView/editorTheme";

// ONE global APP theme (light/dark) — the PageHeader pill drives it, any component can subscribe.
// The `sv-dark` class flip on <html> lives HERE (not in the header component), so the CSS tokens and
// JS consumers (react-json-view themes etc.) can never drift apart.
let dark = localStorage.getItem("sv.appDark") === "true";
const subs = new Set();
const apply = () => document.documentElement.classList.toggle("sv-dark", dark);
apply();

export const getAppDark = () => dark;
export const setAppDark = (v) => {
  dark = !!v;
  localStorage.setItem("sv.appDark", String(dark));
  apply();
  // The ONE app toggle carries the documents with it — flipping the app also flips all three editor
  // theme groups (code / docs / diff). Each group can then diverge until the next app-level flip.
  setEditorDark(dark);
  subs.forEach((f) => f());
};

export function useAppDark() {
  const [, bump] = useState(0);
  useEffect(() => {
    const f = () => bump((n) => n + 1);
    subs.add(f);
    return () => subs.delete(f);
  }, []);
  return [dark, () => setAppDark(!dark)];
}

// react-json-view theme for the app theme — light keeps the stock look; dark is a base16 set tuned to
// the oneDark token palette, TRANSPARENT bg so the tree sits on whatever card it renders in.
// (rjv mapping: 07 keys/braces · 09 strings · 0A null · 0B floats · 0C indices · 0E booleans · 0F ints)
const RJV_DARK = {
  base00: "transparent",
  base01: "#343944",
  base02: "#3a3f4b",
  base03: "#b8bfd3",
  base04: "#6f7789",
  base05: "#b8bfd3",
  base06: "#c5cbdc",
  base07: "#b8bfd3",
  base08: "#e06c75",
  base09: "#98c379",
  base0A: "#d19a66",
  base0B: "#98c379",
  base0C: "#61afef",
  base0D: "#8891e0",
  base0E: "#c678dd",
  base0F: "#d19a66",
};
export const jsonTheme = (d) => (d ? RJV_DARK : "rjv-default");
