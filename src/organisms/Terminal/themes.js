// RFC-045 — WHAT'S OURS TO COLOUR, and it is worth being precise because he asked exactly this:
// "is that something that comes straight from my computer, or do we have control over that?"
//
// Both, split cleanly. The BACKGROUND, the default foreground, the cursor and the 16-colour PALETTE
// are ours — xterm draws with whatever theme we hand it. What his machine decides is which of those
// colours a program ASKS for: his prompt is coloured because zsh emits the codes, `ls` because of
// LSCOLORS. So we own what "red" looks like; his shell owns what gets painted red.
export const THEMES = {
  midnight: {
    label: "midnight",
    theme: { background: "#11131a", foreground: "#d6dae3", cursor: "#8fd98f", selectionBackground: "#2a3550" },
  },
  ink: {
    label: "ink",
    theme: { background: "#000000", foreground: "#e6e6e6", cursor: "#ffffff", selectionBackground: "#333333" },
  },
  slate: {
    label: "slate",
    theme: { background: "#1e222a", foreground: "#c8ccd4", cursor: "#61afef", selectionBackground: "#3a4150" },
  },
  white: {
    label: "white",
    theme: {
      background: "#ffffff",
      foreground: "#1f2328",
      cursor: "#1f2328",
      selectionBackground: "#d7e3f4",
      // Same rule as `paper`: on a white page the "bright" half of the palette is invisible unless
      // it is darkened, so a passing test staying green costs a deliberate override.
      brightWhite: "#8c8c8c",
      white: "#6e6e6e",
      yellow: "#8a6d00",
      brightYellow: "#6f5700",
      green: "#1f7a2e",
      brightGreen: "#146022",
      cyan: "#00666f",
      brightCyan: "#005159",
    },
  },
  paper: {
    label: "paper",
    theme: {
      background: "#f7f5ef",
      foreground: "#2c2a26",
      cursor: "#2c2a26",
      selectionBackground: "#dcd7c8",
      // A light terminal needs its palette darkened or every "bright" colour vanishes into the page.
      brightWhite: "#8a8578",
      white: "#6f6a5e",
      yellow: "#9a7200",
      brightYellow: "#7d5c00",
      green: "#2f7d32",
      cyan: "#00707d",
    },
  },
};

// ONE CHOICE PER APP MODE, which is his correction and obviously right: the terminal you want beside
// a dark window is not the one you want beside a light one, and a single setting means switching the
// app's theme leaves the shell looking wrong. So the stored shape is { dark, light, fontSize } and
// the gear says WHICH mode it is setting while you set it.
const KEY = "sv.term.look";
const DEFAULTS = { dark: "midnight", light: "paper", fontSize: 11.5 };

const stored = () => {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "{}") || {};
  } catch {
    return {};
  }
};

// Older single-theme setting still on disk: carry it into the mode it was chosen for rather than
// dropping it. `raw.theme` was written before there were two.
export const readLook = (dark = true) => {
  const raw = stored();
  const legacy = THEMES[raw.theme] ? raw.theme : null;
  const pick = (mode, fallback) => (THEMES[raw[mode]] ? raw[mode] : legacy || fallback);
  const themeName = dark ? pick("dark", DEFAULTS.dark) : pick("light", DEFAULTS.light);
  return {
    dark: pick("dark", DEFAULTS.dark),
    light: pick("light", DEFAULTS.light),
    mode: dark ? "dark" : "light",
    theme: themeName,
    fontSize: Number(raw.fontSize) > 0 ? Number(raw.fontSize) : DEFAULTS.fontSize,
  };
};

export const writeLook = (look) => {
  try {
    localStorage.setItem(
      KEY,
      JSON.stringify({ dark: look.dark, light: look.light, fontSize: look.fontSize }),
    );
  } catch {}
  // Every open terminal follows at once — the settings live in one place, so a change must not wait
  // for a re-mount to be visible in a pane you are looking at.
  window.dispatchEvent(new CustomEvent("sv:termLook", { detail: look }));
};
