import { useEffect, useState } from "react";

// ONE global APP theme (light/dark) + PER-PANE overrides.
//
// The PageHeader pill drives the app theme: it stamps `sv-dark` on <html> (the CSS tokens flip) and
// RESETS every per-pane override — the whole app lands on the new theme together. From there, every
// themed pane (document, code file, diff — each individually) can diverge with its own ☾/☀, keyed by
// a stable pane key and persisted. No families, no groups: one pane, one theme.
let dark = localStorage.getItem("sv.appDark") === "true";
let paneOverrides = {};
try {
  paneOverrides = JSON.parse(localStorage.getItem("sv.paneDark") || "{}") || {};
} catch {
  paneOverrides = {};
}
const savePanes = () => localStorage.setItem("sv.paneDark", JSON.stringify(paneOverrides));
const subs = new Set();
const apply = () => document.documentElement.classList.toggle("sv-dark", dark);
apply();

export const getAppDark = () => dark;
export const setAppDark = (v) => {
  dark = !!v;
  localStorage.setItem("sv.appDark", String(dark));
  apply();
  // The app-level flip carries EVERY pane with it — clear the individual divergences.
  paneOverrides = {};
  savePanes();
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

// ── Per-pane theme ────────────────────────────────────────────────────────────────────────────────
// `key` identifies ONE themed surface (story pane id, code-pane file path, doc namespace). A pane
// without an explicit override follows the app theme.
export const getPaneDark = (key) => (key in paneOverrides ? paneOverrides[key] : dark);
export const setPaneDark = (key, v) => {
  paneOverrides[key] = !!v;
  savePanes();
  subs.forEach((f) => f());
};

export function usePaneDark(key) {
  const [, bump] = useState(0);
  useEffect(() => {
    const f = () => bump((n) => n + 1);
    subs.add(f);
    return () => subs.delete(f);
  }, []);
  return [getPaneDark(key), () => setPaneDark(key, !getPaneDark(key))];
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
