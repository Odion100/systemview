// FILE TYPE AT A GLANCE — one table, two readers.
//
// This started in CodebaseNav for the tree ("a monospace tree of forty identical names is read one
// line at a time; a glyph in front of each is read by shape"). His ask moved it to the tab strip
// too: a tab used to carry a colored dot, which tells you a KIND only if you have memorized the
// palette. The glyph tells you outright, in the same width.
//
// It lives here rather than being imported across organisms because a glyph table in two places
// drifts — the tree and the tabs would eventually disagree about what a `.mjs` is, and nothing
// would ever error.
//
// Deliberately a SMALL set. The point is telling KINDS apart (code / style / data / doc / image /
// config), not decorating every extension.
import imageFileIcon from "../assets/image-file.png";

export const FILE_ICONS = [
  [/\.(jsx?|mjs|cjs)$/i, "JS", "js"],
  [/\.tsx?$/i, "TS", "ts"],
  [/\.(json|jsonc)$/i, "{}", "data"],
  [/\.(s?css|less)$/i, "#", "style"],
  [/\.(md|markdown|txt)$/i, "¶", "doc"],
  // Images get the real icon Odion picked, not a glyph — `img` renders as an <img> at the call site.
  [/\.(png|jpe?g|gif|svg|webp|ico|avif|bmp)$/i, imageFileIcon, "img"],
  [/\.(ya?ml|toml|ini|env|conf)$/i, "⚙", "config"],
  [/\.(sh|bash|zsh)$/i, "$", "shell"],
  [/\.(html?|xml)$/i, "<>", "markup"],
];

export const iconFor = (name) => {
  for (const [re, glyph, kind] of FILE_ICONS) if (re.test(name || "")) return { glyph, kind };
  return { glyph: "·", kind: "other" };
};

// THE NON-FILE TABS NEED GLYPHS TOO, or the strip reads as broken — half symbols, half dots. These
// are the four things the center can hold that aren't a file on disk, and each glyph is picked to
// not collide with the file table above: `§` a namespace section, `≡` stacked log lines, `❖` the
// floor. A report IS markdown, so it honestly shares `¶`.
export const TAB_ICONS = {
  doc: { glyph: "§", kind: "ns" },
  logs: { glyph: "≡", kind: "logs" },
  report: { glyph: "¶", kind: "doc" },
  sv: { glyph: "❖", kind: "sv" },
};

// One resolver for a tab, so the strip never has to branch on kind at the call site.
export const iconForTab = (tab) =>
  tab && tab.kind === "file" ? iconFor(tab.file && tab.file.path) : TAB_ICONS[tab && tab.kind] || TAB_ICONS.sv;
